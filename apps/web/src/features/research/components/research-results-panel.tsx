import type { Capability, ResearchFinding, ResearchSource } from "@mcpsurface/shared";
import { useMemo, useState } from "react";

interface ResearchResultsPanelProps {
  sources: ResearchSource[];
  findings: ResearchFinding[];
  capabilities: Capability[];
  currentStage?: string | undefined;
}

type ResearchTab = "sources" | "findings" | "capabilities";

export function ResearchResultsPanel({
  sources,
  findings,
  capabilities,
  currentStage,
}: ResearchResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<ResearchTab>("capabilities");
  const [query, setQuery] = useState("");
  const [visibleCounts, setVisibleCounts] = useState<Record<ResearchTab, number>>({
    sources: 12,
    findings: 12,
    capabilities: 12,
  });

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCapabilities = useMemo(
    () => capabilities.filter((capability) => matchesCapability(capability, normalizedQuery)),
    [capabilities, normalizedQuery],
  );
  const filteredSources = useMemo(
    () => sources.filter((source) => matchesSource(source, normalizedQuery)),
    [sources, normalizedQuery],
  );
  const filteredFindings = useMemo(
    () => findings.filter((finding) => matchesFinding(finding, normalizedQuery)),
    [findings, normalizedQuery],
  );
  const groupedSources = useMemo(() => groupSourcesByType(filteredSources), [filteredSources]);
  const groupedFindings = useMemo(() => groupFindingsBySource(filteredFindings), [filteredFindings]);
  const visibleCapabilities = filteredCapabilities.slice(0, visibleCounts.capabilities);
  const tabCounts: Record<ResearchTab, number | null> = {
    sources: filteredSources.length,
    findings: filteredFindings.length,
    capabilities: filteredCapabilities.length,
  };

  return (
    <section className="panel research-results-shell">
      <div className="research-results-header">
        <div>
          <p className="eyebrow">Research workspace</p>
          <h2>Workspace</h2>
        </div>
      </div>

      <div className="research-workbench">
        <aside className="research-nav">
          <div className="research-tabs research-tabs-vertical">
            {[
              ["capabilities", "Operations"],
              ["sources", "Sources"],
              ["findings", "Evidence"],
            ].map(([value, label]) => (
              <button
                className={`research-tab research-tab-nav${activeTab === value ? " research-tab-active" : ""}`}
                key={value}
                onClick={() => setActiveTab(value as ResearchTab)}
                type="button"
              >
                <span>{label}</span>
                {tabCounts[value as ResearchTab] !== null ? (
                  <span className="result-kind">{tabCounts[value as ResearchTab]}</span>
                ) : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="research-content">
          <div className="tab-toolbar">
            <label className="tab-search">
              <span className="tab-search-label">Search this run</span>
              <input
                className="text-input tab-search-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search operations, sources, evidence, paths, auth..."
                type="search"
                value={query}
              />
            </label>
          </div>

          {activeTab === "sources" ? (
            <div className="research-tab-panel">
              <div className="section-intro">
                <h3>Discovered sources</h3>
                <p className="muted-text">
                  Inspect the pages and artifacts the workflow relied on before looking at the raw
                  evidence.
                </p>
              </div>
          {groupedSources.length > 0 ? (
            <div className="stack">
              {groupedSources.map(([type, items]) => (
                <section className="result-subpanel" key={type}>
                  <div className="result-row">
                    <strong>{type}</strong>
                    <span className="result-kind">{items.length}</span>
                  </div>
                  <ul className="result-list compact-result-list source-card-list">
                    {items.slice(0, visibleCounts.sources).map((source) => (
                      <li key={source.id}>
                        <div className="result-row">
                          <strong>{source.title}</strong>
                          <span className={`status-badge status-${source.status}`}>{source.status}</span>
                        </div>
                        <p className="muted-text">{source.url}</p>
                      </li>
                    ))}
                  </ul>
                  {items.length > visibleCounts.sources ? (
                    <button
                      className="button button-secondary"
                      onClick={() =>
                        setVisibleCounts((current) => ({ ...current, sources: current.sources + 12 }))
                      }
                      type="button"
                    >
                      Show more sources
                    </button>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <p className="muted-text">No sources discovered yet.</p>
          )}
            </div>
          ) : null}

          {activeTab === "findings" ? (
            <div className="research-tab-panel">
              <div className="section-intro">
                <h3>Evidence and research notes</h3>
                <p className="muted-text">
                  This is the raw material behind the synthesized action surface.
                </p>
              </div>
          {groupedFindings.length > 0 ? (
            <div className="stack">
              {groupedFindings.slice(0, visibleCounts.findings).map(([sourceUrl, items]) => (
                <details className="result-accordion" key={sourceUrl} open={items.length <= 3}>
                  <summary>
                    <span>{items[0]?.title ?? sourceUrl}</span>
                    <span className="result-kind">{items.length} finding(s)</span>
                  </summary>
                  <div className="accordion-body">
                    <p className="muted-text">{sourceUrl}</p>
                    <ul className="result-list compact-result-list">
                      {items.map((finding) => (
                        <li key={finding.id}>
                          <div className="result-row">
                            <strong>{finding.title}</strong>
                            <span className="result-kind">{finding.kind}</span>
                          </div>
                          <p>{finding.summary}</p>
                          {finding.evidence.length > 0 ? (
                            <details className="evidence-block">
                              <summary>Evidence</summary>
                              <ul className="token-list">
                                {finding.evidence.map((evidence) => (
                                  <li key={evidence}>{evidence}</li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="muted-text">
              {currentStage === "docs_extraction" || currentStage === "capability_synthesis"
                ? "Research is still working through the source content."
                : "No findings yet. If this completes empty, the source likely needs stronger docs extraction or a more specific reference URL."}
            </p>
          )}
          {groupedFindings.length > visibleCounts.findings ? (
            <button
              className="button button-secondary"
              onClick={() => setVisibleCounts((current) => ({ ...current, findings: current.findings + 8 }))}
              type="button"
            >
              Show more evidence groups
            </button>
          ) : null}
            </div>
          ) : null}

          {activeTab === "capabilities" ? (
            <div className="research-tab-panel">
              <div className="section-intro">
                <h3>Operation inventory</h3>
                <p className="muted-text">
                  These are the canonical operations the later MCP and runtime phases should consume
                  directly.
                </p>
              </div>
          {visibleCapabilities.length > 0 ? (
            <div className="capability-card-grid">
              {visibleCapabilities.map((capability) => (
                <article className="capability-card" key={capability.id}>
                  <CapabilityCardContent capability={capability} />
                </article>
              ))}
            </div>
          ) : (
            <p className="muted-text">
              {currentStage === "capability_synthesis"
                ? "Capabilities are being synthesized now."
                : "No execution-ready operations synthesized yet."}
            </p>
          )}
          {filteredCapabilities.length > visibleCapabilities.length ? (
            <button
              className="button button-secondary"
              onClick={() =>
                setVisibleCounts((current) => ({ ...current, capabilities: current.capabilities + 12 }))
              }
              type="button"
            >
              Show more operations
            </button>
          ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CapabilityCardContent({ capability }: { capability: Capability }) {
  const hasEndpoint = Boolean(capability.method && capability.path);

  return (
    <div className="capability-card-content">
      <div className="capability-card-header">
        <div className="capability-title-block">
          <strong>{capability.name}</strong>
          <span className="capability-key">{capability.key}</span>
        </div>
        <span className={`capability-signal capability-signal-${capability.riskLevel}`}>
          {capability.riskLevel}
        </span>
      </div>

      {hasEndpoint ? (
        <div className="capability-endpoint-row">
          <span className={`capability-method capability-method-${capability.method?.toLowerCase()}`}>
            {capability.method}
          </span>
          <code className="capability-endpoint">{capability.path}</code>
        </div>
      ) : null}

      <p>{capability.summary}</p>

      <div className="capability-meta">
        <span className="capability-pill">{capability.approvalMode.replaceAll("_", " ")}</span>
        <span className={`capability-pill${capability.authRequired ? " capability-pill-attention" : ""}`}>
          {capability.authRequired ? "auth required" : "no auth detected"}
        </span>
      </div>

      {capability.parameters.length > 0 ? (
        <ul className="token-list capability-parameter-list capability-parameter-list-compact">
          {capability.parameters.map((parameter) => (
            <li key={`${parameter.name}-${parameter.in}`}>
              <strong>{parameter.name}</strong>
              <span>{parameter.in}</span>
              <span>{parameter.required ? "required" : "optional"}</span>
              {parameter.type ? <span>{parameter.type}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-text">No parameters extracted.</p>
      )}

      <p className="muted-text capability-provenance">Provenance: {capability.provenance.join(" • ")}</p>
    </div>
  );
}

function groupSourcesByType(sources: ResearchSource[]) {
  return Object.entries(
    sources.reduce<Record<string, ResearchSource[]>>((accumulator, source) => {
      const nextGroup = accumulator[source.sourceType] ?? [];
      nextGroup.push(source);
      accumulator[source.sourceType] = nextGroup;
      return accumulator;
    }, {}),
  );
}

function groupFindingsBySource(findings: ResearchFinding[]) {
  return Object.entries(
    findings.reduce<Record<string, ResearchFinding[]>>((accumulator, finding) => {
      const nextGroup = accumulator[finding.provenanceUrl] ?? [];
      nextGroup.push(finding);
      accumulator[finding.provenanceUrl] = nextGroup;
      return accumulator;
    }, {}),
  );
}

function matchesCapability(capability: Capability, query: string) {
  if (!query) {
    return true;
  }

  return [
    capability.name,
    capability.key,
    capability.summary,
    capability.method,
    capability.path,
    capability.provenance.join(" "),
    capability.parameters.map((parameter) => `${parameter.name} ${parameter.in} ${parameter.type ?? ""}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function matchesSource(source: ResearchSource, query: string) {
  if (!query) {
    return true;
  }

  return [source.title, source.url, source.sourceType, source.origin, source.status]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function matchesFinding(finding: ResearchFinding, query: string) {
  if (!query) {
    return true;
  }

  return [finding.title, finding.summary, finding.kind, finding.provenanceUrl, finding.evidence.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
