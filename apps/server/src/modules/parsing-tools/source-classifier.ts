import { parse as parseYaml } from "yaml";
import type { ResearchSourceType } from "@mcpsurface/shared";

interface ClassifySourceInput {
    url: string;
    contentType?: string | undefined;
    content: string;
}

export function classifySource(input: ClassifySourceInput): ResearchSourceType {
    const normalizedContentType = (input.contentType ?? "").toLowerCase();
    const normalizedUrl = input.url.toLowerCase();
    const lowerContent = input.content.toLowerCase();
    const githubExampleMatch =
        normalizedUrl.includes("github.com") &&
        /\/(blob|tree)\/.+\/(examples?|samples?|templates?|quickstart|demo|sdk|cookbook)\b/.test(
            normalizedUrl,
        );

    if (
        normalizedContentType.includes("openapi") ||
        normalizedUrl.endsWith(".openapi.json") ||
        normalizedUrl.endsWith("openapi.json") ||
        normalizedUrl.endsWith(".yaml") ||
        normalizedUrl.endsWith(".yml") ||
        normalizedUrl.endsWith("/swagger.json") ||
        looksLikeOpenApi(input.content)
    ) {
        return "openapi";
    }

    if (
        githubExampleMatch ||
        (normalizedUrl.includes("github.com") &&
            (/curl\s+/i.test(input.content) ||
                /fetch\s*\(/i.test(input.content) ||
                /axios\./i.test(input.content) ||
                /client\./i.test(input.content)))
    ) {
        return "github_example";
    }

    if (
        normalizedUrl.includes("auth") ||
        normalizedUrl.includes("oauth") ||
        lowerContent.includes("api key") ||
        lowerContent.includes("bearer token") ||
        lowerContent.includes("oauth")
    ) {
        return "auth";
    }

    if (
        normalizedUrl.includes("/docs") ||
        normalizedUrl.includes("/reference") ||
        normalizedContentType.includes("text/html") ||
        normalizedContentType.includes("text/markdown") ||
        lowerContent.includes("<html") ||
        lowerContent.includes("# ")
    ) {
        return "docs";
    }

    return "unknown";
}

function looksLikeOpenApi(content: string): boolean {
    try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        return typeof parsed.openapi === "string" || typeof parsed.swagger === "string";
    } catch {
        try {
            const parsed = parseYaml(content) as Record<string, unknown>;
            return typeof parsed?.openapi === "string" || typeof parsed?.swagger === "string";
        } catch {
            return false;
        }
    }
}
