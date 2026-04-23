import type { Capability, ResearchFinding, ResearchSource } from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";

interface SynthesizeCapabilitiesInput {
  platformId: string;
  researchJobId: string;
  findings: ResearchFinding[];
  sources: ResearchSource[];
}

export function synthesizeCapabilities(input: SynthesizeCapabilitiesInput): Capability[] {
  const now = new Date().toISOString();
  const byKey = new Map<string, Capability>();

  for (const source of input.sources) {
    if (source.sourceType === "openapi") {
      const key = source.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      if (!byKey.has(key)) {
        byKey.set(key, {
          id: createId(),
          platformId: input.platformId,
          researchJobId: input.researchJobId,
          researchSourceId: source.id,
          key,
          title: source.title,
          description: `Structured API surface discovered from ${source.title}.`,
          sourceUrl: source.url,
          provenance: [source.url],
          createdAt: now,
        });
      }
    }
  }

  for (const finding of input.findings) {
    const key = finding.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const existing = byKey.get(key);

    if (existing) {
      existing.provenance = Array.from(new Set([...existing.provenance, finding.provenanceUrl]));
      existing.description = dedupeSentences([existing.description, finding.summary]).join(" ");
      continue;
    }

    byKey.set(key, {
      id: createId(),
      platformId: input.platformId,
      researchJobId: input.researchJobId,
      researchSourceId: finding.researchSourceId,
      key,
      title: finding.title,
      description: finding.summary,
      sourceUrl: finding.provenanceUrl,
      provenance: [finding.provenanceUrl],
      createdAt: now,
    });
  }

  return Array.from(byKey.values());
}

function dedupeSentences(sentences: string[]): string[] {
  return Array.from(new Set(sentences.map((sentence) => sentence.trim()).filter(Boolean)));
}
