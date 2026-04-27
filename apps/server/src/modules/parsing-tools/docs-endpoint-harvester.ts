import type { ResearchFinding } from "@mcpsurface/shared";

interface HarvestDocsEndpointsInput {
  title: string;
  url: string;
  content: string;
}

type HarvestedFinding = Pick<ResearchFinding, "kind" | "title" | "summary" | "evidence" | "provenanceUrl">;

const endpointPattern =
  /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%{}]+)/g;
const curlPattern =
  /curl[^\n]*?(?:-X|--request)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)[^\n]*?(https?:\/\/[^\s"'`]+|\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%{}]+)/gi;

export function harvestDocsEndpoints(input: HarvestDocsEndpointsInput): HarvestedFinding[] {
  const normalizedContent = normalizeDocumentText(input.content);
  const lines = normalizedContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const findingsByKey = new Map<string, HarvestedFinding>();

  for (const endpoint of extractEndpointCandidates(lines, input.url)) {
    const key = `${endpoint.method} ${endpoint.path}`;
    const summary = endpoint.summary ?? humanizeEndpoint(endpoint.method, endpoint.path, input.title);
    const evidence = buildEvidence(endpoint.method, endpoint.path, endpoint.contextLines);

    findingsByKey.set(key, {
      kind: "endpoint",
      title: key,
      summary,
      evidence,
      provenanceUrl: input.url,
    });
  }

  return Array.from(findingsByKey.values());
}

export function normalizeDocumentText(content: string): string {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|section|article|li|tr|td|pre|code|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractEndpointCandidates(lines: string[], sourceUrl: string) {
  const candidates: Array<{
    method: string;
    path: string;
    summary?: string;
    contextLines: string[];
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line) {
      continue;
    }

    for (const match of line.matchAll(endpointPattern)) {
      const method = match[1];
      const path = normalizePath(match[2], sourceUrl);

      if (!method || !path || !looksLikeApiPath(path)) {
        continue;
      }

      const contextLines = collectContext(lines, index);
      candidates.push({
        method,
        path,
        summary: inferSummary(lines, index, method, path),
        contextLines,
      });
    }

    for (const match of line.matchAll(curlPattern)) {
      const method = match[1]?.toUpperCase();
      const rawPath = match[2];
      const path = normalizePath(rawPath, sourceUrl);

      if (!method || !path || !looksLikeApiPath(path)) {
        continue;
      }

      const contextLines = collectContext(lines, index);
      candidates.push({
        method,
        path,
        summary: inferSummary(lines, index, method, path),
        contextLines,
      });
    }
  }

  return dedupeCandidates(candidates);
}

function collectContext(lines: string[], index: number) {
  return [lines[index - 2], lines[index - 1], lines[index], lines[index + 1], lines[index + 2]]
    .filter((line): line is string => Boolean(line))
    .filter((line) => line.length <= 220)
    .slice(0, 5);
}

function inferSummary(lines: string[], index: number, method: string, path: string) {
  const surroundingLines = [lines[index - 2], lines[index - 1], lines[index + 1], lines[index + 2]]
    .filter((line): line is string => Boolean(line))
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .filter((line) => !looksLikeEndpointLine(line))
    .filter((line) => !/^(parameters?|headers?|response|request|body)$/i.test(line));

  const actionLine = surroundingLines.find((line) => /\b(create|update|delete|get|list|read|rotate|deploy)\b/i.test(line));
  const descriptionLine = surroundingLines.find((line) => /^[A-Z][^:]{10,140}$/.test(line));

  return actionLine ?? descriptionLine ?? humanizeEndpoint(method, path);
}

function buildEvidence(method: string, path: string, contextLines: string[]) {
  const evidence: string[] = [];
  const pathParameters = Array.from(path.matchAll(/\{([^}]+)\}/g))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  if (pathParameters.length > 0) {
    evidence.push(`parameters: ${pathParameters.map((name) => `${name} (path)`).join(", ")}`);
  } else {
    evidence.push("parameters: none");
  }

  const authSchemes = inferAuthSchemes(contextLines.join(" "));
  evidence.push(`security: ${authSchemes.length > 0 ? authSchemes.join(", ") : "none"}`);

  const examples = contextLines
    .filter((line) => /curl|example|request body|request payload|response body|sample/i.test(line))
    .slice(0, 2);
  evidence.push(...examples);

  return evidence;
}

function inferAuthSchemes(value: string) {
  const lowerValue = value.toLowerCase();
  const schemes: string[] = [];

  if (lowerValue.includes("bearer")) {
    schemes.push("bearerAuth");
  }

  if (lowerValue.includes("api key") || lowerValue.includes("api token")) {
    schemes.push("apiKeyAuth");
  }

  if (lowerValue.includes("oauth")) {
    schemes.push("oauth2");
  }

  return Array.from(new Set(schemes));
}

function dedupeCandidates(
  candidates: Array<{
    method: string;
    path: string;
    summary?: string;
    contextLines: string[];
  }>,
) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.method} ${candidate.path}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizePath(rawPath: string | undefined, sourceUrl: string) {
  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    try {
      return new URL(rawPath).pathname || "/";
    } catch {
      return null;
    }
  }

  if (rawPath.startsWith("/")) {
    return rawPath;
  }

  try {
    return new URL(rawPath, sourceUrl).pathname || "/";
  } catch {
    return null;
  }
}

function looksLikeApiPath(path: string) {
  return (
    path.startsWith("/") &&
    path.length > 1 &&
    !/\.(png|jpg|jpeg|gif|svg|css|js|map|woff2?)$/i.test(path) &&
    path.split("/").filter(Boolean).length >= 1
  );
}

function looksLikeEndpointLine(value: string) {
  return new RegExp(endpointPattern.source, "i").test(value) || new RegExp(curlPattern.source, "i").test(value);
}

function humanizeEndpoint(method: string, path: string, fallbackTitle?: string) {
  const subject = path
    .replace(/[{}]/g, "")
    .split("/")
    .filter(Boolean)
    .slice(-3)
    .map((segment) => segment.replace(/[-_]+/g, " "))
    .join(" ");

  const verb = {
    GET: "Get",
    HEAD: "Read",
    POST: "Create",
    PUT: "Update",
    PATCH: "Update",
    DELETE: "Delete",
    OPTIONS: "Inspect",
  }[method] ?? method;

  return `${verb} ${subject || fallbackTitle || "resource"}`.trim();
}
