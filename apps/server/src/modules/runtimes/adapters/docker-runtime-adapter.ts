import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { promisify } from "node:util";
import type { WorkspaceRuntime } from "@mcpsurface/shared";
import { env } from "../../../lib/env.js";
import type {
    RuntimeAdapter,
    RuntimeCodeExecutionRequest,
    RuntimeExecutionRequest,
    RuntimeExecutionResult,
    RuntimeStartResult,
    RuntimeStopResult,
} from "../runtime-adapter.js";

const execFile = promisify(execFileCallback);
const EXECUTION_SERVER_VERSION = "2026-04-24-runtime-exec-v3";

export interface DockerCommandRunner {
    run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }>;
}

class DefaultDockerCommandRunner implements DockerCommandRunner {
    async run(command: string, args: string[]) {
        return execFile(command, args);
    }
}

export class DockerRuntimeAdapter implements RuntimeAdapter {
    readonly target = "docker" as const;

    constructor(
        private readonly runner: DockerCommandRunner = new DefaultDockerCommandRunner(),
        private readonly allocatePort: () => Promise<number> = getAvailablePort,
    ) {}

    async isAvailable() {
        try {
            await this.runner.run("docker", ["version", "--format", "{{.Server.Version}}"]);
            return true;
        } catch {
            return false;
        }
    }

    async isRuntimeRunning(runtime: WorkspaceRuntime) {
        const containerId =
            typeof runtime.targetMetadata.containerId === "string"
                ? runtime.targetMetadata.containerId
                : null;

        if (!containerId) {
            return false;
        }

        try {
            const { stdout } = await this.runner.run("docker", [
                "inspect",
                "-f",
                "{{.State.Running}}",
                containerId,
            ]);
            return stdout.trim() === "true";
        } catch (error) {
            if (isMissingContainerError(error)) {
                return false;
            }

            throw error;
        }
    }

    async start(runtime: WorkspaceRuntime): Promise<RuntimeStartResult> {
        const hostPort = await this.allocatePort();
        const containerName = `mcpsurface-runtime-${runtime.id}`;
        const executionScript = buildExecutionServerScript(runtime);
        const { stdout } = await this.runner.run("docker", [
            "run",
            "-d",
            "--rm",
            "--name",
            containerName,
            "-p",
            `${hostPort}:${env.RUNTIME_DOCKER_INTERNAL_PORT}`,
            env.RUNTIME_DOCKER_IMAGE,
            "node",
            "-e",
            executionScript,
        ]);

        const startedAt = new Date().toISOString();
        return {
            status: "running",
            targetMetadata: {
                ...runtime.targetMetadata,
                containerId: stdout.trim(),
                containerName,
                endpoint: `http://127.0.0.1:${hostPort}`,
                port: hostPort,
                executionServerVersion: EXECUTION_SERVER_VERSION,
                executionCredentialsFingerprint: getExecutionCredentialsFingerprint(runtime),
            },
            startedAt,
        };
    }

    async stop(runtime: WorkspaceRuntime): Promise<RuntimeStopResult> {
        const containerId =
            typeof runtime.targetMetadata.containerId === "string"
                ? runtime.targetMetadata.containerId
                : null;

        if (containerId) {
            try {
                await this.runner.run("docker", ["stop", containerId]);
            } catch (error) {
                if (!isMissingContainerError(error)) {
                    throw error;
                }
            }
        }

        const stoppedAt = new Date().toISOString();
        return {
            status: "stopped",
            targetMetadata: {
                ...runtime.targetMetadata,
            },
            stoppedAt,
        };
    }

    async execute(
        runtime: WorkspaceRuntime,
        request: RuntimeExecutionRequest,
    ): Promise<RuntimeExecutionResult> {
        assertExecutionServerVersion(runtime);
        const endpoint =
            typeof runtime.targetMetadata.endpoint === "string"
                ? runtime.targetMetadata.endpoint
                : null;

        if (!endpoint) {
            throw new Error("Docker runtime endpoint is unavailable.");
        }

        const response = await fetch(`${endpoint}/execute`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                capability: request.capability,
                capabilityKey: request.capability.key,
                input: request.input,
                runtimeId: runtime.id,
                executionTarget: this.target,
            }),
        });

        const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

        if (!response.ok) {
            return {
                error:
                    typeof json?.error === "string"
                        ? json.error
                        : `Docker runtime execution failed (${response.status}).`,
            };
        }

        return {
            output: json ?? {
                handledBy: this.target,
            },
        };
    }

    async executeCode(
        runtime: WorkspaceRuntime,
        request: RuntimeCodeExecutionRequest,
    ): Promise<RuntimeExecutionResult> {
        assertExecutionServerVersion(runtime);
        const endpoint =
            typeof runtime.targetMetadata.endpoint === "string"
                ? runtime.targetMetadata.endpoint
                : null;

        if (!endpoint) {
            throw new Error("Docker runtime endpoint is unavailable.");
        }

        const response = await fetch(`${endpoint}/execute-code`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                code: request.code,
                capabilities: request.capabilities,
                runtimeArtifact: request.runtimeArtifact,
                runtimeId: runtime.id,
                executionTarget: this.target,
                approvalContext: request.approvalContext,
            }),
        });

        const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

        if (!response.ok) {
            return {
                error:
                    typeof json?.error === "string"
                        ? json.error
                        : `Docker runtime code execution failed (${response.status}).`,
                logs: Array.isArray(json?.logs) ? (json.logs as string[]) : [],
                approval:
                    json?.approval && typeof json.approval === "object"
                        ? (json.approval as import("../runtime-adapter.js").PendingRuntimeApproval)
                        : undefined,
            };
        }

        return {
            output:
                json?.output && typeof json.output === "object"
                    ? (json.output as Record<string, unknown>)
                    : {},
            logs: Array.isArray(json?.logs) ? (json.logs as string[]) : [],
            approval:
                json?.approval && typeof json.approval === "object"
                    ? (json.approval as import("../runtime-adapter.js").PendingRuntimeApproval)
                    : undefined,
        };
    }
}

function isMissingContainerError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    return /No such container|no such object|cannot find the file specified|container .* not found/i.test(
        error.message,
    );
}

function assertExecutionServerVersion(runtime: WorkspaceRuntime) {
    const currentVersion =
        typeof runtime.targetMetadata.executionServerVersion === "string"
            ? runtime.targetMetadata.executionServerVersion
            : null;
    const currentFingerprint =
        typeof runtime.targetMetadata.executionCredentialsFingerprint === "string"
            ? runtime.targetMetadata.executionCredentialsFingerprint
            : null;

    if (
        currentVersion !== EXECUTION_SERVER_VERSION ||
        currentFingerprint !== getExecutionCredentialsFingerprint(runtime)
    ) {
        throw new Error("Docker runtime execution server is out of date; restart required.");
    }
}

function getExecutionCredentialsFingerprint(runtime: WorkspaceRuntime) {
    const executionEnvironment = getRuntimeExecutionEnvironment(runtime);
    return createHash("sha256")
        .update(
            `${resolveExecutionSetting("CLOUDFLARE_ACCOUNT_ID", executionEnvironment) ?? ""}:${resolveExecutionSetting("CLOUDFLARE_API_TOKEN", executionEnvironment) ?? ""}`,
        )
        .digest("hex");
}

function buildExecutionServerScript(runtime: WorkspaceRuntime) {
    const executionEnvironment = getRuntimeExecutionEnvironment(runtime);
    return `
    const http = require('node:http');
    const vm = require('node:vm');
    const CLOUDFLARE_ACCOUNT_ID = ${JSON.stringify(resolveExecutionSetting("CLOUDFLARE_ACCOUNT_ID", executionEnvironment) ?? null)};
    const CLOUDFLARE_API_TOKEN = ${JSON.stringify(resolveExecutionSetting("CLOUDFLARE_API_TOKEN", executionEnvironment) ?? null)};
    function errorMessage(error, fallback) {
      if (!error) {
        return fallback;
      }
      if (typeof error === 'string') {
        return error;
      }
      if (typeof error.message === 'string' && error.message.trim()) {
        return error.message;
      }
      try {
        return JSON.stringify(error);
      } catch {
        return fallback;
      }
    }
    function errorStack(error) {
      return typeof error?.stack === 'string' ? error.stack : null;
    }
    class RuntimeApprovalRequiredError extends Error {
      constructor(approval) {
        super('Approval required.');
        this.approval = approval;
      }
    }
    function toAccessorName(key) {
      const camel = key
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((segment, index) =>
          index === 0 ? segment.toLowerCase() : segment[0]?.toUpperCase() + segment.slice(1).toLowerCase(),
        )
        .join('');
      return camel && !/^\\d/.test(camel) ? camel : \`capability\${camel[0]?.toUpperCase() ?? ""}\${camel.slice(1)}\`;
    }
    function capabilityText(capability) {
      return [
        capability.key,
        capability.name,
        capability.summary,
        capability.description,
        capability.method,
        capability.path,
        Array.isArray(capability.tags) ? capability.tags.join(' ') : '',
      ].filter(Boolean).join(' ').toLowerCase();
    }
    function rankCapabilities(query, capabilities) {
      const terms = String(query || '').toLowerCase().split(/\\s+/).map(term => term.trim()).filter(Boolean);
      if (terms.length === 0) {
        return capabilities.slice(0, 10);
      }
      return [...capabilities]
        .map(capability => ({
          capability,
          score: terms.reduce((total, term) => total + (capabilityText(capability).includes(term) ? 1 : 0), 0),
        }))
        .filter(entry => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map(entry => entry.capability)
        .slice(0, 10);
    }
    function executeCapability(capability, input, runtimeId, approvalContext) {
      const preparedInput = withAutoParameters(input || {});
      const required = Array.isArray(capability.parameters) ? capability.parameters.filter(parameter => parameter.required).map(parameter => parameter.name) : [];
      const missing = required.filter(name => !(name in preparedInput));
      if (missing.length > 0) {
        throw new Error(\`Missing required input: \${missing.join(', ')}\`);
      }
      const requesterEmail = String(approvalContext?.requesterEmail || '').trim().toLowerCase();
      const platformOwnerEmail = String(approvalContext?.platformOwnerEmail || '').trim().toLowerCase();
      if (requesterEmail && platformOwnerEmail && requesterEmail !== platformOwnerEmail && capability.riskLevel !== 'read') {
        throw new RuntimeApprovalRequiredError({
          capabilityKey: capability.key,
          input: preparedInput,
          summary: String(approvalContext?.summary || capability.summary || capability.name || 'Capability execution'),
          riskLevel: capability.riskLevel,
        });
      }
      return executeCapabilityHttp(capability, preparedInput, runtimeId);
    }
    async function executeCode(body) {
      const logs = [];
      try {
        const capabilities = Array.isArray(body.capabilities) ? body.capabilities : [];
        const runtime = {
          search: async (query) => rankCapabilities(query, capabilities).map(capability => ({
            key: capability.key,
            name: capability.name,
            summary: capability.summary,
            method: capability.method,
            path: capability.path,
            parameters: capability.parameters,
          })),
          execute: async ({ capabilityKey, input }) => {
            const capability = capabilities.find(entry => entry.key === capabilityKey);
            if (!capability) {
              throw new Error(\`Capability \${capabilityKey} is not available in this runtime.\`);
            }
            return executeCapability(capability, input || {}, body.runtimeId, body.approvalContext || {});
          },
          capabilities: Object.fromEntries(
            capabilities.map(capability => [
              toAccessorName(capability.key),
              async (input) => executeCapability(capability, input || {}, body.runtimeId, body.approvalContext || {}),
            ]),
          ),
        };
        const context = vm.createContext({
          runtime,
          URL,
          URLSearchParams,
          Headers,
          Request,
          Response,
          FormData,
          Blob,
          fetch,
          console: {
            log: (...args) => logs.push(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ')),
          },
        });
        const script = new vm.Script(\`(async () => {\\n\${String(body.code || '').split('\\n').map(line => \`      \${line}\`).join('\\n')}\\n    })()\`, {
          filename: 'runtime-orchestrator.js',
        });
        const result = await script.runInContext(context, { timeout: 10000 });
        return {
          output: result && typeof result === 'object' && !Array.isArray(result) ? result : { value: result ?? null },
          logs,
        };
      } catch (error) {
        if (error instanceof RuntimeApprovalRequiredError) {
          return {
            approval: error.approval,
            logs,
          };
        }
        const message = errorMessage(error, 'Code execution failed.');
        const stack = errorStack(error);
        if (stack) {
          logs.push(stack);
        }
        return {
          error: message,
          logs,
        };
      }
    }
    async function executeCapabilityHttp(capability, input, runtimeId) {
      if (!capability.method || !capability.path) {
        throw new Error(\`Capability \${capability.key} does not include an executable HTTP method and path.\`);
      }
      const url = buildCapabilityUrl(capability, input);
      const headers = new Headers();
      if (capability.authRequired) {
        if (!CLOUDFLARE_API_TOKEN) {
          throw new Error('Real capability execution requires CLOUDFLARE_API_TOKEN.');
        }
        headers.set('Authorization', \`Bearer \${CLOUDFLARE_API_TOKEN}\`);
      }
      for (const parameter of Array.isArray(capability.parameters) ? capability.parameters.filter(entry => entry.in === 'header') : []) {
        const value = input[parameter.name];
        if (typeof value !== 'undefined') {
          headers.set(parameter.name, String(value));
        }
      }
      const bodyInput = input.body;
      const init = {
        method: capability.method,
        headers,
      };
      if (typeof bodyInput !== 'undefined') {
        if (isCloudflareWorkerScriptMutation(capability, bodyInput)) {
          init.body = buildCloudflareWorkerScriptBody(String(bodyInput));
        } else if (typeof bodyInput === 'string') {
          headers.set('content-type', 'text/plain; charset=utf-8');
          init.body = bodyInput;
        } else {
          headers.set('content-type', 'application/json');
          init.body = JSON.stringify(bodyInput);
        }
      }
      const response = await fetch(url, init);
      const payload = await parseResponsePayload(response);
      if (!response.ok) {
        throw new Error(formatExecutionError(capability, payload, response.status));
      }
      return {
        capabilityKey: capability.key,
        capabilityName: capability.name,
        method: capability.method,
        path: capability.path,
        input,
        runtimeId,
        handledBy: 'docker',
        statusCode: response.status,
        contentType: response.headers.get('content-type') || null,
        response: payload,
        ok: true,
      };
    }
    function withAutoParameters(input) {
      const next = { ...(input || {}) };
      if (typeof next.account_id === 'undefined' && CLOUDFLARE_ACCOUNT_ID) {
        next.account_id = CLOUDFLARE_ACCOUNT_ID;
      }
      return next;
    }
    function buildCapabilityUrl(capability, input) {
      let path = capability.path || '';
      for (const parameter of Array.isArray(capability.parameters) ? capability.parameters.filter(entry => entry.in === 'path') : []) {
        const value = input[parameter.name];
        if (typeof value === 'undefined') {
          throw new Error(\`Missing required input: \${parameter.name}\`);
        }
        path = path.replaceAll(\`{\${parameter.name}}\`, encodeURIComponent(String(value)));
      }
      const normalizedPath = String(path).startsWith('/') ? String(path).slice(1) : String(path);
      const url = new URL(normalizedPath, 'https://api.cloudflare.com/client/v4/');
      for (const parameter of Array.isArray(capability.parameters) ? capability.parameters.filter(entry => entry.in === 'query') : []) {
        const value = input[parameter.name];
        if (typeof value === 'undefined') continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            url.searchParams.append(parameter.name, String(item));
          }
        } else {
          url.searchParams.set(parameter.name, String(value));
        }
      }
      return url.toString();
    }
    function isCloudflareWorkerScriptMutation(capability, bodyInput) {
      return typeof bodyInput === 'string' && ['PUT', 'POST'].includes(String(capability.method || '').toUpperCase()) && String(capability.path || '').includes('/workers/scripts');
    }
    function buildCloudflareWorkerScriptBody(scriptBody) {
      const syntax = detectWorkerSyntax(scriptBody);
      const partName = 'worker.js';
      const metadata = syntax === 'module' ? { main_module: partName } : { body_part: partName };
      const form = new FormData();
      form.append('metadata', JSON.stringify(metadata));
      form.append(
        'files',
        new Blob([scriptBody], {
          type: syntax === 'module' ? 'application/javascript+module' : 'application/javascript',
        }),
        partName,
      );
      return form;
    }
    function detectWorkerSyntax(content) {
      const normalized = String(content || '').toLowerCase();
      if (/\\bexport\\s+default\\b/.test(normalized) || /\\bimport\\s+.+\\s+from\\s+["']/.test(normalized)) {
        return 'module';
      }
      return 'service-worker';
    }
    async function parseResponsePayload(response) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json().catch(() => null);
      }
      return await response.text().catch(() => '');
    }
    function formatExecutionError(capability, payload, statusCode) {
      const message = Array.isArray(payload?.errors) && payload.errors[0] && typeof payload.errors[0].message === 'string'
        ? payload.errors[0].message
        : null;
      return message ? \`\${capability.name} failed (\${statusCode}): \${message}\` : \`\${capability.name} failed with status \${statusCode}.\`;
    }
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === 'POST' && req.url === '/execute') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            const result = await executeCapability(parsed.capability, parsed.input || {}, parsed.runtimeId);
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Capability execution failed.' }));
          }
        });
        return;
      }
      if (req.method === 'POST' && req.url === '/execute-code') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            const result = await executeCode(parsed);
            if (result && typeof result === 'object' && typeof result.error === 'string') {
              res.statusCode = 500;
            }
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({
              error: errorMessage(error, 'Code execution failed.'),
              logs: errorStack(error) ? [errorStack(error)] : [],
            }));
          }
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    server.listen(${env.RUNTIME_DOCKER_INTERNAL_PORT}, '0.0.0.0');
  `.trim();
}

function getRuntimeExecutionEnvironment(runtime: WorkspaceRuntime) {
    const environment = runtime.targetMetadata.executionEnvironment;
    return environment && typeof environment === "object" && !Array.isArray(environment)
        ? (environment as Record<string, string>)
        : undefined;
}

function resolveExecutionSetting(
    key: "CLOUDFLARE_API_TOKEN" | "CLOUDFLARE_ACCOUNT_ID",
    environment?: Record<string, string>,
) {
    const override = environment?.[key];
    if (typeof override === "string" && override.trim().length > 0) {
        return override;
    }
    return env[key];
}

async function getAvailablePort() {
    return new Promise<number>((resolve, reject) => {
        const server = createServer();

        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Unable to resolve an available port."));
                return;
            }

            const port = address.port;
            server.close(() => resolve(port));
        });

        server.on("error", reject);
    });
}
