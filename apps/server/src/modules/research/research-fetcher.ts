import { readFile } from "node:fs/promises";

export interface RetrievedSourceDocument {
    url: string;
    title: string;
    contentType?: string | undefined;
    content: string;
}

export async function fetchSourceDocument(url: string): Promise<RetrievedSourceDocument> {
    if (url.startsWith("file://")) {
        const filePath = new URL(url);
        const content = await readFile(filePath, "utf8");
        const contentType = guessContentType(url);

        return {
            url,
            title: filePath.pathname.split("/").pop() ?? "Local artifact",
            content,
            ...(contentType ? { contentType } : {}),
        };
    }

    const response = await fetch(url);
    const content = await response.text();

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? undefined;

    return {
        url,
        title: inferTitle(url, content),
        content,
        ...(contentType ? { contentType } : {}),
    };
}

export function isResearchableDocument(document: RetrievedSourceDocument): boolean {
    const lowerUrl = document.url.toLowerCase();
    const lowerContentType = (document.contentType ?? "").toLowerCase();

    if (
        lowerUrl.includes("/_astro/") ||
        lowerUrl.endsWith(".svg") ||
        lowerUrl.endsWith(".png") ||
        lowerUrl.endsWith(".jpg") ||
        lowerUrl.endsWith(".jpeg") ||
        lowerUrl.endsWith(".gif") ||
        lowerUrl.endsWith(".webp") ||
        lowerUrl.endsWith(".woff") ||
        lowerUrl.endsWith(".woff2") ||
        lowerUrl.endsWith(".ttf") ||
        lowerUrl.endsWith(".eot") ||
        lowerUrl.endsWith(".css") ||
        lowerUrl.endsWith(".js") ||
        /sitemap.*\.xml$/.test(lowerUrl)
    ) {
        return false;
    }

    if (
        lowerContentType.startsWith("image/") ||
        lowerContentType.includes("font") ||
        lowerContentType.includes("octet-stream")
    ) {
        return false;
    }

    return true;
}

function inferTitle(url: string, content: string): string {
    const titleMatch = content.match(/<title>(.*?)<\/title>/i);

    if (titleMatch?.[1]) {
        return titleMatch[1].trim();
    }

    const slug = url.split("/").filter(Boolean).pop();
    return slug ?? url;
}

function guessContentType(url: string): string | undefined {
    if (url.endsWith(".json")) {
        return "application/json";
    }

    if (url.endsWith(".yaml") || url.endsWith(".yml")) {
        return "application/yaml";
    }

    if (url.endsWith(".md")) {
        return "text/markdown";
    }

    return undefined;
}
