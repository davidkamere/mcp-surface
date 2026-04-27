import type {
  Capability,
  CapabilityApprovalMode,
  CapabilityParameter,
  CapabilityRiskLevel,
  ResearchFinding,
  ResearchSource,
} from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { parseOpenApiDocument } from "../parsing-tools/openapi-parser.js";

interface SynthesizeCapabilitiesInput {
  platformId: string;
  researchJobId: string;
  findings: ResearchFinding[];
  sources: ResearchSource[];
}

export function synthesizeCapabilities(input: SynthesizeCapabilitiesInput): Capability[] {
  const now = new Date().toISOString();
  const byKey = new Map<string, Capability>();
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const sourceAuthHints = collectSourceAuthHints(input.findings);

  for (const source of input.sources) {
    if (source.sourceType !== "openapi" || !source.notes) {
      continue;
    }

    const parsed = parseOpenApiDocument(source.notes);

    if (!parsed) {
      continue;
    }

    for (const operation of parsed.operations) {
      const riskLevel = classifyRiskLevel(operation.method, operation.summary, operation.description);
      mergeCapability(byKey, {
        id: createId(),
        platformId: input.platformId,
        researchJobId: input.researchJobId,
        researchSourceIds: [source.id],
        key: buildCapabilityKey(operation.method, operation.path, operation.operationId, operation.summary),
        name: toCapabilityName(operation.summary, operation.method, operation.path),
        summary: operation.summary,
        description: operation.description,
        method: operation.method,
        path: operation.path,
        parameters: operation.parameters,
        authRequired: operation.security.length > 0,
        authSchemes: operation.security,
        tags: operation.tags,
        examples: [],
        riskLevel,
        approvalMode: approvalModeForRisk(riskLevel),
        provenance: [source.url],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const finding of input.findings) {
    if (finding.kind === "authentication") {
      const authHints = extractAuthSchemes(finding.evidence);
      const sourceCapabilities = Array.from(byKey.values()).filter((capability) =>
        capability.researchSourceIds.includes(finding.researchSourceId),
      );

      for (const capability of sourceCapabilities) {
        capability.authRequired = true;
        capability.authSchemes = dedupeStrings([...(capability.authSchemes ?? []), ...authHints]);
        capability.provenance = dedupeStrings([...capability.provenance, finding.provenanceUrl]);
        capability.updatedAt = now;
      }

      continue;
    }

    const source = sourceById.get(finding.researchSourceId);
    const descriptor = extractActionDescriptor(finding.title, finding.summary);

    if (!descriptor || !descriptor.method || !descriptor.path || !isActionableFinding(finding)) {
      continue;
    }

    const riskLevel = classifyRiskLevel(descriptor.method, finding.title, finding.summary);
    mergeCapability(byKey, {
      id: createId(),
      platformId: input.platformId,
      researchJobId: input.researchJobId,
      researchSourceIds: [finding.researchSourceId],
      key: buildCapabilityKey(descriptor.method, descriptor.path, undefined, descriptor.name),
      name: descriptor.name,
      summary: finding.summary,
      description: buildDescription(finding, source),
      method: descriptor.method,
      path: descriptor.path,
      parameters: extractParametersFromEvidence(finding.evidence),
      authRequired: sourceAuthHints.has(finding.researchSourceId),
      authSchemes: sourceAuthHints.get(finding.researchSourceId) ?? [],
      tags: inferTagsFromSource(source),
      examples: extractExamplesFromEvidence(finding.evidence),
      riskLevel,
      approvalMode: approvalModeForRisk(riskLevel),
      provenance: [finding.provenanceUrl],
      createdAt: now,
      updatedAt: now,
    });
  }

  return Array.from(byKey.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function mergeCapability(store: Map<string, Capability>, incoming: Capability) {
  const existing = store.get(incoming.key);

  if (!existing) {
    store.set(incoming.key, {
      ...incoming,
      researchSourceIds: dedupeStrings(incoming.researchSourceIds),
      parameters: dedupeParameters(incoming.parameters),
      authSchemes: dedupeStrings(incoming.authSchemes ?? []),
      tags: dedupeStrings(incoming.tags ?? []),
      examples: dedupeStrings(incoming.examples ?? []),
      provenance: dedupeStrings(incoming.provenance),
    });
    return;
  }

  existing.researchSourceIds = dedupeStrings([...existing.researchSourceIds, ...incoming.researchSourceIds]);
  existing.summary = longestText([existing.summary, incoming.summary]) ?? existing.summary;
  existing.description = longestText([existing.description, incoming.description]) ?? existing.description;
  existing.parameters = dedupeParameters([...existing.parameters, ...incoming.parameters]);
  existing.authRequired = existing.authRequired || incoming.authRequired;
  existing.authSchemes = dedupeStrings([...(existing.authSchemes ?? []), ...(incoming.authSchemes ?? [])]);
  existing.tags = dedupeStrings([...(existing.tags ?? []), ...(incoming.tags ?? [])]);
  existing.examples = dedupeStrings([...(existing.examples ?? []), ...(incoming.examples ?? [])]);
  existing.provenance = dedupeStrings([...existing.provenance, ...incoming.provenance]);
  existing.updatedAt = incoming.updatedAt;

  if (!existing.method && incoming.method) {
    existing.method = incoming.method;
  }

  if (!existing.path && incoming.path) {
    existing.path = incoming.path;
  }

  if (!existing.description && incoming.description) {
    existing.description = incoming.description;
  }

  existing.riskLevel = higherRiskLevel(existing.riskLevel, incoming.riskLevel);
  existing.approvalMode = approvalModeForRisk(existing.riskLevel);
}

function buildCapabilityKey(
  method: string | undefined,
  path: string | undefined,
  operationId: string | undefined,
  fallback: string,
) {
  if (method && path) {
    return slugify(`${method}-${path}`);
  }

  if (operationId) {
    return slugify(operationId);
  }

  return slugify(fallback);
}

function toCapabilityName(summary: string, method: string, path: string) {
  if (isHttpSignature(summary)) {
    return humanizeHttpSignature(method, path);
  }

  return summary.trim();
}

function extractActionDescriptor(title: string, summary: string) {
  const titleSignature = extractHttpSignature(title);

  if (titleSignature) {
    const { method, path } = titleSignature;
    return {
      method,
      path,
      name: isHttpSignature(summary) ? humanizeHttpSignature(method, path) : summary,
    };
  }

  const summarySignature = extractHttpSignature(summary);

  if (summarySignature) {
    return {
      method: summarySignature.method,
      path: summarySignature.path,
      name: title,
    };
  }

  return null;
}

function isActionableFinding(finding: ResearchFinding) {
  if (finding.kind !== "endpoint") {
    return false;
  }

  const text = `${finding.title} ${finding.summary}`.toLowerCase();
  return !["overview", "general documentation source", "authentication guidance detected", "examples detected"].some(
    (phrase) => text.includes(phrase),
  );
}

function collectSourceAuthHints(findings: ResearchFinding[]) {
  const authHints = new Map<string, string[]>();

  for (const finding of findings) {
    if (finding.kind !== "authentication") {
      continue;
    }

    authHints.set(
      finding.researchSourceId,
      dedupeStrings([...(authHints.get(finding.researchSourceId) ?? []), ...extractAuthSchemes(finding.evidence)]),
    );
  }

  return authHints;
}

function buildDescription(finding: ResearchFinding, source: ResearchSource | undefined) {
  const evidence = finding.evidence.slice(0, 3);
  const fragments = [finding.summary];

  if (source?.title && source.title !== finding.title) {
    fragments.push(`Discovered in ${source.title}.`);
  }

  if (evidence.length > 0) {
    fragments.push(evidence.join(" | "));
  }

  return fragments.join(" ");
}

function extractParametersFromEvidence(evidence: string[]) {
  const parametersLine = evidence.find((entry) => entry.toLowerCase().startsWith("parameters:"));

  if (!parametersLine || parametersLine.endsWith("none")) {
    return [];
  }

  return parametersLine
    .replace(/^parameters:\s*/i, "")
    .split(",")
    .map((chunk) => chunk.trim())
    .map((chunk) => {
      const match = chunk.match(/^(.+?)\s+\((path|query|header|body)\)$/i);

      if (!match) {
        return null;
      }

      const parameterName = match[1];
      const parameterLocation = match[2];

      if (!parameterName || !parameterLocation) {
        return null;
      }

      return {
        name: parameterName.trim(),
        in: parameterLocation.toLowerCase() as CapabilityParameter["in"],
        required: parameterLocation.toLowerCase() === "path",
      };
    })
    .filter((parameter): parameter is CapabilityParameter => parameter !== null);
}

function extractAuthSchemes(evidence: string[]) {
  const schemes = evidence.flatMap((entry) => {
    if (!entry.toLowerCase().startsWith("security:")) {
      const pathSecurity = entry.match(/:\s*(.+)$/);
      const schemeText = pathSecurity?.[1];

      if (schemeText && /bearer|api[-_\s]?key|oauth|token|basic/i.test(schemeText)) {
        return schemeText.split(",").map((item) => item.trim());
      }

      return [];
    }

    return entry
      .replace(/^security:\s*/i, "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && item !== "none");
  });

  return dedupeStrings(schemes);
}

function extractExamplesFromEvidence(evidence: string[]) {
  return dedupeStrings(
    evidence.filter((entry) => /\b(curl|example|request payload|request body|sample)\b/i.test(entry)).slice(0, 3),
  );
}

function inferTagsFromSource(source: ResearchSource | undefined) {
  if (!source) {
    return [];
  }

  return [source.sourceType];
}

function classifyRiskLevel(
  method: string | undefined,
  ...texts: Array<string | undefined>
): CapabilityRiskLevel {
  const normalizedMethod = method?.toUpperCase();

  if (normalizedMethod === "GET" || normalizedMethod === "HEAD") {
    return "read";
  }

  if (normalizedMethod === "POST" || normalizedMethod === "PUT" || normalizedMethod === "PATCH") {
    return "write";
  }

  if (normalizedMethod === "DELETE") {
    return "destructive";
  }

  const text = texts.filter(Boolean).join(" ").toLowerCase();

  if (/\b(delete|remove|revoke|purge|destroy)\b/.test(text)) {
    return "destructive";
  }

  if (/\b(create|update|deploy|publish|rotate|set|assign)\b/.test(text)) {
    return "write";
  }

  return "read";
}

function approvalModeForRisk(riskLevel: CapabilityRiskLevel): CapabilityApprovalMode {
  return riskLevel === "read" ? "none" : "root_approval_required";
}

function higherRiskLevel(left: CapabilityRiskLevel, right: CapabilityRiskLevel): CapabilityRiskLevel {
  const priority: Record<CapabilityRiskLevel, number> = {
    read: 0,
    write: 1,
    destructive: 2,
  };

  return priority[right] > priority[left] ? right : left;
}

function longestText(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .sort((left, right) => right.length - left.length)[0];
}

function dedupeParameters(parameters: CapabilityParameter[]) {
  const seen = new Set<string>();
  return parameters.filter((parameter) => {
    const key = `${parameter.name}:${parameter.in}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractHttpSignature(value: string) {
  const match = value.trim().match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/\S*)$/i);

  if (!match) {
    return null;
  }

  const method = match[1];
  const path = match[2];

  if (!method || !path) {
    return null;
  }

  return {
    method: method.toUpperCase(),
    path,
  };
}

function isHttpSignature(value: string) {
  return extractHttpSignature(value) !== null;
}

function humanizeHttpSignature(method: string, path: string) {
  const cleanedPath = path
    .replace(/[{}]/g, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[-_]+/g, " "))
    .join(" ");

  const verb = {
    GET: "Read",
    HEAD: "Read",
    POST: "Create",
    PUT: "Update",
    PATCH: "Update",
    DELETE: "Delete",
    OPTIONS: "Inspect",
  }[method] ?? method;

  return `${verb} ${cleanedPath || "resource"}`.trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
