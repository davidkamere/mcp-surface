import { env } from "../../lib/env.js";

interface SearchResult {
  link?: string;
}

export interface DiscoveredResearchSource {
  url: string;
  origin: "discovered_link" | "github_example" | "serper_search";
}

export async function discoverRelatedSources(input: {
  sourceUrl: string;
  title: string;
  content: string;
}): Promise<DiscoveredResearchSource[]> {
  const linkedUrls = extractRelevantLinks(input.sourceUrl, input.content);
  const serperUrls = await searchSerperForRelatedDocs(input);

  return rankResearchSources(dedupeResearchSources([...linkedUrls, ...serperUrls]), input.sourceUrl).slice(0, 20);
}

function extractRelevantLinks(baseUrl: string, content: string): DiscoveredResearchSource[] {
  const discovered = new Map<string, DiscoveredResearchSource>();
  const base = tryCreateUrl(baseUrl);

  if (!base) {
    return [];
  }

  for (const match of content.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = match[1]?.trim();

    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) {
      continue;
    }

    try {
      const nextUrl = new URL(href, base);
      const sameHost = nextUrl.hostname === base.hostname;
      const githubUrl = nextUrl.hostname === "github.com";

      if (!sameHost && !githubUrl) {
        continue;
      }

      if (!isUsefulResearchUrl(nextUrl)) {
        continue;
      }

      const url = nextUrl.toString();
      discovered.set(url, {
        url,
        origin: nextUrl.hostname === "github.com" ? "github_example" : "discovered_link",
      });
    } catch {
      continue;
    }
  }

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)#\s]+)\)/g)) {
    const href = match[1]?.trim();

    if (!href) {
      continue;
    }

    try {
      const nextUrl = new URL(href, base);

      if (!isUsefulResearchUrl(nextUrl)) {
        continue;
      }

      if (nextUrl.hostname !== base.hostname && nextUrl.hostname !== "github.com") {
        continue;
      }

      const url = nextUrl.toString();
      discovered.set(url, {
        url,
        origin: nextUrl.hostname === "github.com" ? "github_example" : "discovered_link",
      });
    } catch {
      continue;
    }
  }

  return Array.from(discovered.values());
}

async function searchSerperForRelatedDocs(input: {
  sourceUrl: string;
  title: string;
  content: string;
}): Promise<DiscoveredResearchSource[]> {
  if (!env.SERPER_API_KEY) {
    return [];
  }

  const base = tryCreateUrl(input.sourceUrl);

  if (!base) {
    return [];
  }

  const hostname = base.hostname.replace(/^www\./, "");
  const query = `${input.title || hostname} API docs github ${hostname}`;

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-KEY": env.SERPER_API_KEY,
    },
    body: JSON.stringify({
      q: query,
      num: env.SERPER_RESULT_LIMIT,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const json = (await response.json()) as { organic?: SearchResult[] };

  return (json.organic ?? [])
    .map((entry) => entry.link?.trim())
    .filter((link): link is string => Boolean(link))
    .flatMap((link) => {
      const url = tryCreateUrl(link);

      if (!url || !isUsefulResearchUrl(url)) {
        return [];
      }

      if (url.hostname !== "github.com" && !url.hostname.endsWith(hostname)) {
        return [];
      }

      return [
        {
          url: link,
          origin: url.hostname === "github.com" ? "github_example" : "serper_search",
        } satisfies DiscoveredResearchSource,
      ];
    });
}

function isUsefulResearchUrl(url: URL): boolean {
  const value = url.toString().toLowerCase();
  const path = url.pathname.toLowerCase();

  if (
    value.includes("/_astro/") ||
    path.endsWith("/favicon.svg") ||
    path.endsWith("/favicon.ico") ||
    path.endsWith(".svg") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".gif") ||
    path.endsWith(".webp") ||
    path.endsWith(".woff") ||
    path.endsWith(".woff2") ||
    path.endsWith(".ttf") ||
    path.endsWith(".eot") ||
    path.endsWith(".css") ||
    path.endsWith(".js") ||
    path.endsWith(".map")
  ) {
    return false;
  }

  if (/sitemap.*\.xml$/.test(path)) {
    return false;
  }

  return true;
}

function tryCreateUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function dedupeResearchSources(sources: DiscoveredResearchSource[]) {
  const byUrl = new Map<string, DiscoveredResearchSource>();

  for (const source of sources) {
    if (!byUrl.has(source.url)) {
      byUrl.set(source.url, source);
    }
  }

  return Array.from(byUrl.values());
}

function rankResearchSources(sources: DiscoveredResearchSource[], baseUrl: string) {
  const base = tryCreateUrl(baseUrl);

  return [...sources].sort((left, right) => {
    const leftScore = scoreResearchSource(left, base);
    const rightScore = scoreResearchSource(right, base);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.url.localeCompare(right.url);
  });
}

function scoreResearchSource(source: DiscoveredResearchSource, base: URL | null) {
  const url = tryCreateUrl(source.url);

  if (!url) {
    return -100;
  }

  const value = source.url.toLowerCase();
  const path = url.pathname.toLowerCase();
  let score = 0;

  if (base && url.hostname === base.hostname) {
    score += 8;
  }

  if (source.origin === "serper_search") {
    score += 2;
  }

  if (source.origin === "github_example") {
    score += 1;
  }

  if (/\b(openapi|swagger)\b/.test(value) || /\.(json|ya?ml)$/i.test(path)) {
    score += 30;
  }

  if (/(^|\/)(api|reference|references|resources|operations|operation|methods|method)(\/|$)/.test(path)) {
    score += 18;
  }

  if (/(^|\/)(workers|zones|accounts|scripts|content)(\/|$)/.test(path)) {
    score += 10;
  }

  if (path.includes("/api/resources/")) {
    score += 10;
  }

  if (/(^|\/)(examples?|samples?|templates?|quickstart|cookbook|sdk)(\/|$)/.test(path)) {
    score += 4;
  }

  if (/(^|\/)(overview|getting-started|tutorials?|guides?|blog|changelog|release-notes?)(\/|$)/.test(path)) {
    score -= 12;
  }

  if (/(^|\/)(search|tags|categories)(\/|$)/.test(path)) {
    score -= 6;
  }

  return score;
}
