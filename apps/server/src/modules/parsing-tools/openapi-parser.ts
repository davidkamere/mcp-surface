import type { CapabilityParameterLocation } from "@mcpsurface/shared";
import { parse as parseYaml } from "yaml";

export interface ParsedParameter {
    name: string;
    in: CapabilityParameterLocation;
    required: boolean;
    type?: string | undefined;
    description?: string | undefined;
}

export interface ParsedOperation {
    method: string;
    path: string;
    operationId: string;
    summary: string;
    description?: string | undefined;
    parameters: ParsedParameter[];
    security: string[];
    tags: string[];
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
                      const location = toCapabilityParameterLocation(parameter.in);

                      if (!name || !location) {
                          return [];
                      }

                      const schema = isRecord(parameter.schema) ? parameter.schema : {};
                      const type = typeof schema.type === "string" ? schema.type : undefined;
                      const description =
                          typeof parameter.description === "string"
                              ? parameter.description
                              : undefined;

                      return [
                          {
                              name,
                              in: location,
                              required: Boolean(parameter.required),
                              type,
                              description,
                          },
                      ];
                  })
                : [];

            const requestBody = isRecord(operationValue.requestBody)
                ? operationValue.requestBody
                : null;

            if (requestBody) {
                const content = isRecord(requestBody.content) ? requestBody.content : {};
                const firstMediaType = Object.values(content).find(isRecord);
                const schema =
                    firstMediaType && isRecord(firstMediaType.schema) ? firstMediaType.schema : {};
                const bodyType = typeof schema.type === "string" ? schema.type : "object";

                parameters.push({
                    name: "body",
                    in: "body",
                    required: Boolean(requestBody.required),
                    type: bodyType,
                    description:
                        typeof requestBody.description === "string"
                            ? requestBody.description
                            : "Request body",
                });
            }

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
                description:
                    typeof operationValue.description === "string"
                        ? operationValue.description
                        : undefined,
                parameters,
                security,
                tags: Array.isArray(operationValue.tags)
                    ? operationValue.tags.filter((tag): tag is string => typeof tag === "string")
                    : [],
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

function toCapabilityParameterLocation(value: unknown): CapabilityParameterLocation | null {
    if (value === "path" || value === "query" || value === "header") {
        return value;
    }

    return null;
}
