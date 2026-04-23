import { parse as parseYaml } from "yaml";

export interface ParsedOperation {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  parameters: string[];
  security: string[];
}

export interface ParsedOpenApiDocument {
  title: string;
  operations: ParsedOperation[];
}

export function parseOpenApiDocument(content: string): ParsedOpenApiDocument | null {
  const parsed = parseStructuredDocument(content);

  if (!parsed) {
    return null;
  }

  const openapiVersion = parsed.openapi ?? parsed.swagger;

  if (typeof openapiVersion !== "string") {
    return null;
  }

  const info = isRecord(parsed.info) ? parsed.info : {};
  const title = typeof info.title === "string" ? info.title : "API reference";
  const paths = isRecord(parsed.paths) ? parsed.paths : {};
  const operations: ParsedOperation[] = [];

  for (const [pathKey, pathValue] of Object.entries(paths)) {
    if (!isRecord(pathValue)) {
      continue;
    }

    for (const [methodKey, operationValue] of Object.entries(pathValue)) {
      if (!isRecord(operationValue) || !isHttpMethod(methodKey)) {
        continue;
      }

      const parameters = Array.isArray(operationValue.parameters)
        ? operationValue.parameters.flatMap((parameter) => {
            if (!isRecord(parameter)) {
              return [];
            }

            const name = typeof parameter.name === "string" ? parameter.name : null;
            const location = typeof parameter.in === "string" ? parameter.in : "unknown";
            return name ? [`${name} (${location})`] : [];
          })
        : [];

      const security = Array.isArray(operationValue.security)
        ? operationValue.security.flatMap((entry) => {
            if (!isRecord(entry)) {
              return [];
            }

            return Object.keys(entry);
          })
        : [];

      operations.push({
        method: methodKey.toUpperCase(),
        path: pathKey,
        operationId:
          typeof operationValue.operationId === "string"
            ? operationValue.operationId
            : `${methodKey}_${pathKey.replace(/[^a-zA-Z0-9]+/g, "_")}`,
        summary:
          typeof operationValue.summary === "string"
            ? operationValue.summary
            : typeof operationValue.description === "string"
              ? operationValue.description
              : `${methodKey.toUpperCase()} ${pathKey}`,
        parameters,
        security,
      });
    }
  }

  return { title, operations };
}

function parseStructuredDocument(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    try {
      const parsed = parseYaml(content);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function isHttpMethod(value: string): boolean {
  return ["get", "post", "put", "patch", "delete", "options", "head"].includes(value);
}
