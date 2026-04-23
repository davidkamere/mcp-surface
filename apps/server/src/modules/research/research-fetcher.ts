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
