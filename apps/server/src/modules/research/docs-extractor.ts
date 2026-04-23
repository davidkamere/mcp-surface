import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { ResearchFinding } from "@mcpsurface/shared";
import { env } from "../../lib/env.js";
import { createId } from "../../lib/ids.js";

const structuredFindingSchema = z.object({
  findings: z.array(
    z.object({
      kind: z.enum(["operation_summary", "authentication", "example", "capability_hint", "overview"]),
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

export async function extractDocsFindings(
  input: ExtractDocsFindingsInput,
): Promise<Pick<ResearchFinding, "kind" | "title" | "summary" | "evidence" | "provenanceUrl">[]> {
  if (!env.OPENROUTER_API_KEY) {
    return extractFallbackFindings(input);
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

  const result = await model.invoke([
    {
      role: "system",
      content:
        "You are a docs research specialist. Extract concise findings about operations, auth, examples, and capability hints. Prefer explicit facts from the source and avoid speculation.",
    },
    {
      role: "user",
      content: `Source title: ${input.title}\nSource URL: ${input.url}\n\nContent:\n${truncate(input.content, 12000)}`,
    },
  ]);

  return result.findings.map((finding) => ({
    kind: finding.kind,
    title: finding.title,
    summary: finding.summary,
    evidence: finding.evidence ?? [],
    provenanceUrl: input.url,
  }));
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

function extractFallbackFindings(
  input: ExtractDocsFindingsInput,
): Pick<ResearchFinding, "kind" | "title" | "summary" | "evidence" | "provenanceUrl">[] {
  const findings: Pick<ResearchFinding, "kind" | "title" | "summary" | "evidence" | "provenanceUrl">[] = [];
  const content = input.content;
  const authLines = content.match(/.*(api key|bearer token|oauth|authorization).*/gi) ?? [];
  const exampleLines = content.match(/.*(example|curl|request|response).*/gi) ?? [];
  const headingLines = content.match(/^#{1,3}\s+.+$/gm) ?? [];

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

function truncate(value: string, length: number): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length)}...`;
}
