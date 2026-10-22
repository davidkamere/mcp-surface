import { Script } from "node:vm";
import type { Capability } from "@mcpsurface/shared";

export interface WorkersPageEditRequest {
    url: string;
    summary: string;
    capabilityKeys: string[];
    discoveryCapabilityKeys: string[];
    readCapabilityKeys: string[];
    writeCapabilityKey: string;
}

export function resolveWorkersPageEditRequest(
    userMessage: string,
    capabilities: Capability[],
): WorkersPageEditRequest | null {
    const url = extractWorkersDevUrl(userMessage);

    if (!url) {
        return null;
    }

    const normalized = userMessage.toLowerCase();

    if (!isLikelyWorkersEditFollowUp(normalized) && !/\b(make|set|turn|style)\b/.test(normalized)) {
        return null;
    }

    const readCapabilities = selectWorkersScriptCapabilities(capabilities, "read");
    const writeCapability = selectWorkersScriptCapabilities(capabilities, "write")[0] ?? null;
    const discoveryCapabilities = selectWorkersDiscoveryCapabilities(capabilities);

    if (readCapabilities.length === 0 || !writeCapability) {
        return null;
    }

    return {
        url,
        summary: `Read the current Worker source for ${url}, rewrite it to satisfy the user's request, validate it, and deploy the updated script.`,
        capabilityKeys: [
            ...discoveryCapabilities.map((capability) => capability.key),
            ...readCapabilities.map((capability) => capability.key),
            writeCapability.key,
        ],
        discoveryCapabilityKeys: discoveryCapabilities.map((capability) => capability.key),
        readCapabilityKeys: readCapabilities.map((capability) => capability.key),
        writeCapabilityKey: writeCapability.key,
    };
}

export function buildWorkersSourceReadCode(
    url: string,
    discoveryCapabilityKeys: string[],
    readCapabilityKeys: string[],
    instruction: string,
) {
    const accountId = extractAccountId(instruction);

    return [
        `const targetUrl = ${JSON.stringify(url)};`,
        `const accountId = ${JSON.stringify(accountId)};`,
        `const discoveryCapabilityKeys = ${JSON.stringify(discoveryCapabilityKeys)};`,
        `const readCapabilityKeys = ${JSON.stringify(readCapabilityKeys)};`,
        `const hostname = new URL(targetUrl).hostname;`,
        `const hostnameScriptName = hostname.split(".")[0];`,
        `const hostSegments = hostnameScriptName.split(/[^a-z0-9]+/i).filter(Boolean);`,
        `const scriptCandidates = [];`,
        `const seenScriptCandidates = new Set();`,
        `const registerScriptCandidate = (value) => {`,
        `  if (typeof value !== "string") return;`,
        `  const trimmed = value.trim();`,
        `  if (!trimmed || seenScriptCandidates.has(trimmed)) return;`,
        `  seenScriptCandidates.add(trimmed);`,
        `  scriptCandidates.push(trimmed);`,
        `};`,
        `const scoreScriptCandidate = (value) => {`,
        `  const normalized = String(value).toLowerCase();`,
        `  let score = normalized === hostnameScriptName.toLowerCase() ? 100 : 0;`,
        `  if (normalized.includes(hostnameScriptName.toLowerCase())) score += 30;`,
        `  for (const segment of hostSegments) {`,
        `    if (normalized.includes(segment.toLowerCase())) score += 10;`,
        `  }`,
        `  return score;`,
        `};`,
        `const normalizeDiscoveryItems = (payload) => {`,
        `  const queue = [payload];`,
        `  const seen = new Set();`,
        `  while (queue.length > 0) {`,
        `    const current = queue.shift();`,
        `    if (!current || seen.has(current)) continue;`,
        `    seen.add(current);`,
        `    if (Array.isArray(current)) return current;`,
        `    if (typeof current === "object") {`,
        `      for (const [key, value] of Object.entries(current)) {`,
        `        if (Array.isArray(value) && value.length > 0) return value;`,
        `        if (value && typeof value === "object" && !Array.isArray(value) && !["errors","messages","result_info"].includes(key)) queue.push(value);`,
        `      }`,
        `    }`,
        `  }`,
        `  return [];`,
        `};`,
        `const extractScriptName = (item) => {`,
        `  if (typeof item === "string") return item;`,
        `  if (!item || typeof item !== "object") return null;`,
        `  return item.script_name ?? item.id ?? item.name ?? item.script ?? null;`,
        `};`,
        `const extractWorkerSource = (value) => {`,
        `  if (typeof value !== "string") return "";`,
        `  const text = value.trim();`,
        `  if (!text.startsWith("--")) return value;`,
        `  const normalized = value.replace(/\\r\\n/g, "\\n");`,
        `  const firstBlankLine = normalized.indexOf("\\n\\n");`,
        `  if (firstBlankLine === -1) return value;`,
        `  const contentStart = firstBlankLine + 2;`,
        `  const closingBoundaryIndex = normalized.indexOf("\\n--", contentStart);`,
        `  return closingBoundaryIndex === -1 ? normalized.slice(contentStart).trim() : normalized.slice(contentStart, closingBoundaryIndex).trim();`,
        `};`,
        `registerScriptCandidate(hostnameScriptName);`,
        `const discoveryDiagnostics = [];`,
        `for (const capabilityKey of discoveryCapabilityKeys) {`,
        `  try {`,
        `    const discoveryResult = await runtime.execute({ capabilityKey, input: accountId ? { account_id: accountId } : {} });`,
        `    const discoveredNames = normalizeDiscoveryItems(discoveryResult.response).map(extractScriptName).filter(Boolean);`,
        `    discoveryDiagnostics.push(capabilityKey + ": " + (discoveredNames.length > 0 ? discoveredNames.join(", ") : "[no script names found]"));`,
        `    discoveredNames.sort((left, right) => scoreScriptCandidate(right) - scoreScriptCandidate(left)).forEach(registerScriptCandidate);`,
        `  } catch (error) {`,
        `    discoveryDiagnostics.push(capabilityKey + ": ERROR " + (error instanceof Error ? error.message : String(error)));`,
        `  }`,
        `}`,
        `let readResult = null;`,
        `let scriptName = null;`,
        `const readErrors = [];`,
        `for (const candidateScriptName of scriptCandidates) {`,
        `  for (const capabilityKey of readCapabilityKeys) {`,
        `    try {`,
        `      readResult = await runtime.execute({ capabilityKey, input: accountId ? { account_id: accountId, script_name: candidateScriptName } : { script_name: candidateScriptName } });`,
        `      if (readResult) { scriptName = candidateScriptName; break; }`,
        `    } catch (error) {`,
        `      readErrors.push(candidateScriptName + " via " + capabilityKey + ": " + (error instanceof Error ? error.message : String(error)));`,
        `    }`,
        `  }`,
        `  if (readResult) break;`,
        `}`,
        `if (!readResult) {`,
        `  const diagnosticSummary = discoveryDiagnostics.length > 0 ? " Discovery: " + discoveryDiagnostics.join(" | ") : "";`,
        `  throw new Error((readErrors.join(" | ") || "Unable to read Worker script content.") + diagnosticSummary);`,
        `}`,
        `const currentSource = typeof readResult.response === "string" ? readResult.response : typeof readResult.response?.script === "string" ? readResult.response.script : typeof readResult.response?.content === "string" ? readResult.response.content : "";`,
        `const normalizedSource = extractWorkerSource(currentSource);`,
        `if (!normalizedSource) throw new Error("Worker script content was empty.");`,
        `return { scriptName, scriptCandidates, readCapabilityKey: readResult.capabilityKey ?? null, readStatus: readResult.statusCode ?? null, normalizedSource };`,
    ].join("\n");
}

export function buildWorkersSourceWriteCode(
    scriptName: string,
    writeCapabilityKey: string,
    source: string,
    accountId: string | null,
) {
    return [
        `const scriptName = ${JSON.stringify(scriptName)};`,
        `const accountId = ${JSON.stringify(accountId)};`,
        `const updatedSource = ${JSON.stringify(source)};`,
        `const writeResult = await runtime.execute({`,
        `  capabilityKey: ${JSON.stringify(writeCapabilityKey)},`,
        `  input: accountId ? { account_id: accountId, script_name: scriptName, body: updatedSource } : { script_name: scriptName, body: updatedSource },`,
        `});`,
        `return {`,
        `  ok: Boolean(writeResult.ok),`,
        `  scriptName,`,
        `  changed: true,`,
        `  writeStatus: writeResult.statusCode ?? null,`,
        `  writeResponse: writeResult.response ?? null,`,
        `};`,
    ].join("\n");
}

export function validateWorkerSourceRewrite(source: string) {
    const normalized = source.trim();

    if (!normalized) {
        throw new Error("The model returned an empty Worker source.");
    }

    if (/\bexport\s+default\b/.test(normalized) || /\bimport\s+.+\s+from\s+["']/.test(normalized)) {
        if (!/\bexport\s+default\b/.test(normalized)) {
            throw new Error("The rewritten module Worker is missing an export default handler.");
        }

        if (!/\bfetch\s*\(/.test(normalized) && !/\bfetch\s*:\s*async\b/.test(normalized)) {
            throw new Error("The rewritten module Worker is missing a fetch handler.");
        }

        return;
    }

    new Script(normalized);

    if (!/addEventListener\s*\(\s*["']fetch["']/.test(normalized)) {
        throw new Error("The rewritten classic Worker is missing a fetch handler.");
    }
}

export function dedupeCapabilities(capabilities: Capability[]) {
    const seen = new Set<string>();
    return capabilities.filter((capability) => {
        if (seen.has(capability.key)) {
            return false;
        }
        seen.add(capability.key);
        return true;
    });
}

export function extractAccountId(value: string) {
    const match =
        value.match(/\baccount_id\b[^a-z0-9]*([a-f0-9]{32})\b/i) ??
        value.match(/\b([a-f0-9]{32})\b/i);
    return match?.[1] ?? null;
}

function selectWorkersScriptCapabilities(capabilities: Capability[], intent: "read" | "write") {
    return capabilities
        .filter((capability) => isWorkersScriptCapability(capability))
        .map((capability) => ({
            capability,
            score: scoreWorkersScriptCapability(capability, intent),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.capability)
        .slice(0, intent === "read" ? 3 : 2);
}

function selectWorkersDiscoveryCapabilities(capabilities: Capability[]) {
    const candidates = capabilities.filter((capability) => {
        const method = (capability.method ?? "").toUpperCase();
        const path = capability.path ?? "";

        return (
            method === "GET" &&
            (path === "/accounts/{account_id}/workers/scripts" ||
                path === "/accounts/{account_id}/workers/scripts-search")
        );
    });

    const searchCapability =
        candidates.find(
            (capability) =>
                (capability.path ?? "") === "/accounts/{account_id}/workers/scripts-search",
        ) ?? null;
    const listCapability =
        candidates.find(
            (capability) => (capability.path ?? "") === "/accounts/{account_id}/workers/scripts",
        ) ?? null;

    return [searchCapability, listCapability].filter(Boolean) as Capability[];
}

function isWorkersScriptCapability(capability: Capability) {
    const path = capability.path ?? "";
    return (
        path.includes("/workers/scripts/{script_name}") &&
        !path.includes("/dispatch/") &&
        !path.includes("/tails") &&
        !path.includes("/versions") &&
        !path.includes("/deployments") &&
        !path.includes("/secrets") &&
        !path.includes("/settings") &&
        !path.includes("/subdomain") &&
        !path.includes("/schedules")
    );
}

function scoreWorkersScriptCapability(capability: Capability, intent: "read" | "write") {
    const method = (capability.method ?? "").toUpperCase();
    const path = capability.path ?? "";
    const text = [capability.key, capability.name, capability.summary, capability.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    let score = 0;

    if (intent === "read") {
        if (method !== "GET") {
            return -100;
        }

        score += 40;

        if (path === "/accounts/{account_id}/workers/scripts/{script_name}") {
            score += 30;
        }

        if (path.endsWith("/content") || path.endsWith("/content/v2")) {
            score += 20;
        }

        if (/\b(download|get|read|content|script)\b/.test(text)) {
            score += 20;
        }

        if (/\bdelete|remove|destroy|update|put|patch|post\b/.test(text)) {
            score -= 200;
        }

        if (capability.riskLevel === "destructive") {
            score -= 200;
        }
    } else {
        if (!["PUT", "PATCH", "POST"].includes(method)) {
            return -100;
        }

        score += 40;

        if (path === "/accounts/{account_id}/workers/scripts/{script_name}/content") {
            score += 40;
        }

        if (/\b(update|upload|content|script|deploy)\b/.test(text)) {
            score += 20;
        }

        if (/\bdelete|remove|destroy\b/.test(text)) {
            score -= 200;
        }

        if (capability.riskLevel === "destructive") {
            score -= 200;
        }
    }

    return score;
}

function extractWorkersDevUrl(value: string) {
    const match = value.match(/https?:\/\/[^\s"]+\.workers\.dev[^\s"]*/i);
    return match?.[0] ?? null;
}

function isLikelyWorkersEditFollowUp(value: string) {
    const normalized = value.toLowerCase();
    return (
        /\b(button|text|style|color|red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|brown|link|page|html|site|worker|script)\b/.test(
            normalized,
        ) ||
        /\b(add|update|edit|modify|change|insert|replace|remove|delete|make|set|turn|again|retry)\b/.test(
            normalized,
        )
    );
}
