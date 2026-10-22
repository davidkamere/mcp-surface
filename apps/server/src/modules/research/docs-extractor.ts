import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { ResearchFinding } from "@mcpsurface/shared";
import { env } from "../../lib/env.js";
import { createId } from "../../lib/ids.js";
import {
    harvestDocsEndpoints,
    normalizeDocumentText,
} from "../parsing-tools/docs-endpoint-harvester.js";

const structuredFindingSchema = z.object({
    findings: z.array(
        z.object({
            kind: z.enum([
                "endpoint",
                "operation_summary",
                "authentication",
                "example",
                "capability_hint",
                "overview",
            ]),
            title: z.string().min(1),
            summary: z.string().min(1),
            evidence: z.array(z.string()).default([]),
        }),
    ),
});

interface ExtractDocsFindingsInput {
    platformId: string;
    researchJobId: string;
    researchSourceId: string;
    url: string;
    title: string;
    content: string;
}

type ExtractedFinding = Pick<
    ResearchFinding,
    "kind" | "title" | "summary" | "evidence" | "provenanceUrl"
>;

export async function extractDocsFindings(
    input: ExtractDocsFindingsInput,
): Promise<ExtractedFinding[]> {
    const normalizedContent = normalizeDocumentText(input.content);
    const preparedContent = prepareResearchDocument(normalizedContent);
    const deterministicFindings = extractDeterministicDocsFindings({
        ...input,
        content: normalizedContent,
    });
    const isGithubExample = /github\.com/i.test(input.url);

    if (!env.OPENROUTER_API_KEY) {
        return mergeFindings(
            deterministicFindings,
            extractFallbackFindings({ ...input, content: normalizedContent }),
        );
    }

    if (isGithubExample) {
        return mergeFindings(
            deterministicFindings,
            extractFallbackFindings({ ...input, content: normalizedContent }),
        );
    }

    const model = new ChatOpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        model: env.RESEARCH_MODEL,
        temperature: 0,
        configuration: {
            baseURL: env.OPENROUTER_BASE_URL,
            defaultHeaders: {
                "X-Title": env.OPENROUTER_APP_NAME,
                ...(env.OPENROUTER_HTTP_REFERER
                    ? {
                          "HTTP-Referer": env.OPENROUTER_HTTP_REFERER,
                      }
                    : {}),
            },
        },
    }).withStructuredOutput(structuredFindingSchema);

    const result = await model
        .withConfig({
            runName: "docs_extraction",
            tags: ["research", "docs_extraction"],
            metadata: {
                sourceUrl: input.url,
                sourceTitle: input.title,
            },
        })
        .invoke([
            {
                role: "system",
                content:
                    "You are a docs research specialist. Extract concise findings about explicit API operations, auth, examples, and capability hints. Prefer concrete HTTP endpoints and direct facts from the source. Do not emit page-level summaries when a specific action can be named. Lower confidence for deprecated or legacy guidance.",
            },
            {
                role: "user",
                content: `Source title: ${input.title}\nSource URL: ${input.url}\n\nContent:\n${preparedContent}`,
            },
        ]);

    const llmFindings: ExtractedFinding[] = result.findings.map((finding) => ({
        kind: finding.kind,
        title: finding.title,
        summary: finding.summary,
        evidence: finding.evidence ?? [],
        provenanceUrl: input.url,
    }));

    return mergeFindings(deterministicFindings, llmFindings);
}

export function materializeDocsFindings(
    input: ExtractDocsFindingsInput,
    findings: Awaited<ReturnType<typeof extractDocsFindings>>,
): ResearchFinding[] {
    const now = new Date().toISOString();

    return findings.map((finding) => ({
        id: createId(),
        platformId: input.platformId,
        researchJobId: input.researchJobId,
        researchSourceId: input.researchSourceId,
        kind: finding.kind,
        title: finding.title,
        summary: finding.summary,
        evidence: finding.evidence,
        provenanceUrl: finding.provenanceUrl,
        createdAt: now,
    }));
}

function extractFallbackFindings(input: ExtractDocsFindingsInput): ExtractedFinding[] {
    const findings: ExtractedFinding[] = [];
    const content = normalizeDocumentText(input.content);
    const authLines = content.match(/.*(api key|bearer token|oauth|authorization|token).*/gi) ?? [];
    const exampleLines = content.match(/.*(example|curl|request|response|sdk|client).*/gi) ?? [];
    const headingLines = extractHeadingLines(input.content, content);
    const meaningfulLines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 40)
        .slice(0, 6);

    if (headingLines.length > 0) {
        findings.push({
            kind: "overview",
            title: `${input.title} overview`,
            summary: headingLines.slice(0, 3).join(" | "),
            evidence: headingLines.slice(0, 3),
            provenanceUrl: input.url,
        });
    }

    if (authLines.length > 0) {
        findings.push({
            kind: "authentication",
            title: "Authentication guidance detected",
            summary: authLines.slice(0, 2).join(" "),
            evidence: authLines.slice(0, 2),
            provenanceUrl: input.url,
        });
    }

    if (exampleLines.length > 0) {
        findings.push({
            kind: "example",
            title: "Examples detected",
            summary: exampleLines.slice(0, 2).join(" "),
            evidence: exampleLines.slice(0, 2),
            provenanceUrl: input.url,
        });
    }

    if (meaningfulLines.length > 0) {
        findings.push({
            kind: "operation_summary",
            title: `${input.title} key coverage`,
            summary: meaningfulLines.slice(0, 2).join(" "),
            evidence: meaningfulLines.slice(0, 3),
            provenanceUrl: input.url,
        });
    }

    if (findings.length === 0) {
        findings.push({
            kind: "capability_hint",
            title: "General documentation source",
            summary: `Captured documentation content from ${input.title}. This source can inform later capability synthesis.`,
            evidence: [truncate(content.replace(/\s+/g, " "), 180)],
            provenanceUrl: input.url,
        });
    }

    return findings;
}

function extractDeterministicDocsFindings(input: ExtractDocsFindingsInput): ExtractedFinding[] {
    return harvestDocsEndpoints({
        title: input.title,
        url: input.url,
        content: input.content,
    });
}

function mergeFindings(primary: ExtractedFinding[], secondary: ExtractedFinding[]) {
    const byKey = new Map<string, ExtractedFinding>();

    for (const finding of [...primary, ...secondary]) {
        const key = `${finding.kind}:${finding.title.toLowerCase()}`;
        const existing = byKey.get(key);

        if (!existing) {
            byKey.set(key, {
                ...finding,
                evidence: Array.from(new Set(finding.evidence)),
            });
            continue;
        }

        byKey.set(key, {
            ...existing,
            summary:
                existing.summary.length >= finding.summary.length
                    ? existing.summary
                    : finding.summary,
            evidence: Array.from(new Set([...existing.evidence, ...finding.evidence])),
        });
    }

    return Array.from(byKey.values());
}

function prepareResearchDocument(content: string) {
    return truncate(content, 12000);
}

function truncate(value: string, length: number): string {
    if (value.length <= length) {
        return value;
    }

    return `${value.slice(0, length)}...`;
}

function extractHeadingLines(originalContent: string, normalizedContent: string): string[] {
    const markdownHeadings = normalizedContent.match(/^#{1,3}\s+.+$/gm) ?? [];

    if (markdownHeadings.length > 0) {
        return markdownHeadings.slice(0, 4);
    }

    const htmlHeadings = Array.from(originalContent.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi))
        .map((match) =>
            (match[1] ?? "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim(),
        )
        .filter(Boolean);

    if (htmlHeadings.length > 0) {
        return htmlHeadings.slice(0, 4);
    }

    return normalizedContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 20 && line.length < 120)
        .slice(0, 3);
}
