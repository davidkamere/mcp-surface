import { env } from "../../lib/env.js";
import type { Capability } from "@mcpsurface/shared";

export interface RuntimeHttpExecutionOptions {
  capability: Capability;
  input: Record<string, unknown>;
  executionTarget: string;
  runtimeId: string;
  environment?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export async function executeRuntimeHttp(input: RuntimeHttpExecutionOptions) {
  const capabilityInput = withAutoParameters(input.input, input.environment);
  validateCapabilityInput(input.capability, capabilityInput);
  const request = buildRequest(input.capability, capabilityInput, input.environment);
  const response = await (input.fetchImpl ?? fetch)(request.url, request.init);
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new Error(formatExecutionError(input.capability, payload, response.status));
  }

  return {
    capabilityKey: input.capability.key,
    capabilityName: input.capability.name,
    method: input.capability.method,
    path: input.capability.path,
    input: capabilityInput,
    runtimeId: input.runtimeId,
    handledBy: input.executionTarget,
    statusCode: response.status,
    contentType: response.headers.get("content-type") ?? null,
    response: payload,
    ok: true,
  };
}

function buildRequest(capability: Capability, input: Record<string, unknown>, environment?: Record<string, string>) {
  if (!capability.method || !capability.path) {
    throw new Error(`Capability ${capability.key} does not include an executable HTTP method and path.`);
  }

  const url = buildCapabilityUrl(capability, input);
  const headers = new Headers();

  if (capability.authRequired) {
    const token = resolveExecutionSetting("CLOUDFLARE_API_TOKEN", environment);

    if (!token) {
      throw new Error("Real capability execution requires CLOUDFLARE_API_TOKEN.");
    }

    headers.set("Authorization", `Bearer ${token}`);
  }

  for (const parameter of capability.parameters.filter((entry) => entry.in === "header")) {
    const value = input[parameter.name];

    if (typeof value !== "undefined") {
      headers.set(parameter.name, String(value));
    }
  }

  const bodyInput = input.body;
  const init: RequestInit = {
    method: capability.method,
    headers,
  };

  if (typeof bodyInput !== "undefined") {
    if (isCloudflareWorkerScriptMutation(capability, bodyInput)) {
      init.body = buildCloudflareWorkerScriptBody(String(bodyInput));
    } else if (typeof bodyInput === "string") {
      headers.set("content-type", "text/plain; charset=utf-8");
      init.body = bodyInput;
    } else {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(bodyInput);
    }
  }

  return { url, init };
}

function buildCapabilityUrl(capability: Capability, input: Record<string, unknown>) {
  const baseUrl = resolveCapabilityBaseUrl(capability);
  let path = capability.path ?? "";

  for (const parameter of capability.parameters.filter((entry) => entry.in === "path")) {
    const rawValue = input[parameter.name];

    if (typeof rawValue === "undefined") {
      throw new Error(`Missing required input: ${parameter.name}`);
    }

    path = path.replaceAll(`{${parameter.name}}`, encodeURIComponent(String(rawValue)));
  }

  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  for (const parameter of capability.parameters.filter((entry) => entry.in === "query")) {
    const rawValue = input[parameter.name];

    if (typeof rawValue === "undefined") {
      continue;
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        url.searchParams.append(parameter.name, String(item));
      }
    } else {
      url.searchParams.set(parameter.name, String(rawValue));
    }
  }

  return url.toString();
}

function resolveCapabilityBaseUrl(capability: Capability) {
  if ((capability.path ?? "").startsWith("/")) {
    return "https://api.cloudflare.com/client/v4/";
  }

  throw new Error(`Capability ${capability.key} does not have a supported base URL.`);
}

function withAutoParameters(input: Record<string, unknown>, environment?: Record<string, string>) {
  const next = { ...input };
  const accountId = resolveExecutionSetting("CLOUDFLARE_ACCOUNT_ID", environment);

  if (typeof next.account_id === "undefined" && accountId) {
    next.account_id = accountId;
  }

  return next;
}

function resolveExecutionSetting(key: "CLOUDFLARE_API_TOKEN" | "CLOUDFLARE_ACCOUNT_ID", environment?: Record<string, string>) {
  const override = environment?.[key];
  if (typeof override === "string" && override.trim().length > 0) {
    return override;
  }
  return env[key];
}

function validateCapabilityInput(capability: Capability, input: Record<string, unknown>) {
  const missing = capability.parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name)
    .filter((name) => typeof input[name] === "undefined");

  if (missing.length > 0) {
    throw new Error(`Missing required input: ${missing.join(", ")}`);
  }
}

function isCloudflareWorkerScriptMutation(capability: Capability, bodyInput: unknown) {
  return (
    typeof bodyInput === "string" &&
    Boolean(capability.method && ["PUT", "POST"].includes(capability.method)) &&
    Boolean(capability.path?.includes("/workers/scripts"))
  );
}

function buildCloudflareWorkerScriptBody(scriptBody: string) {
  const syntax = detectWorkerSyntax(scriptBody);
  const partName = "worker.js";
  const metadata = syntax === "module" ? { main_module: partName } : { body_part: partName };
  const form = new FormData();

  form.append("metadata", JSON.stringify(metadata));
  form.append(
    "files",
    new Blob([scriptBody], {
      type: syntax === "module" ? "application/javascript+module" : "application/javascript",
    }),
    partName,
  );

  return form;
}

function detectWorkerSyntax(content: string): "module" | "service-worker" {
  const normalized = content.toLowerCase();

  if (/\bexport\s+default\b/.test(normalized) || /\bimport\s+.+\s+from\s+["']/.test(normalized)) {
    return "module";
  }

  return "service-worker";
}

async function parseResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => null)) as unknown;
  }

  return await response.text().catch(() => "");
}

function formatExecutionError(capability: Capability, payload: unknown, statusCode: number) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const errors = (payload as Record<string, unknown>).errors;
    const firstError = Array.isArray(errors) ? errors[0] : null;
    const message =
      firstError && typeof firstError === "object" && typeof (firstError as Record<string, unknown>).message === "string"
        ? String((firstError as Record<string, unknown>).message)
        : null;

    if (message) {
      return `${capability.name} failed (${statusCode}): ${message}`;
    }
  }

  return `${capability.name} failed with status ${statusCode}.`;
}
