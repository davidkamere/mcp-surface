import { Link } from "@tanstack/react-router";
import { PlatformDetailCard } from "../components/platform-detail-card";
import { PlatformSourcesEditor } from "../components/platform-sources-editor";
import { usePlatformDetail } from "../hooks/use-platform-detail";
import { useUpdatePlatformSources } from "../hooks/use-update-platform-sources";
import { useUploadPlatformArtifact } from "../hooks/use-upload-platform-artifact";
import { ResearchResultsPanel } from "../../research/components/research-results-panel";
import { ResearchStatusCard } from "../../research/components/research-status-card";
import { usePlatformResearch } from "../../research/hooks/use-platform-research";
import { RuntimeSummarySection } from "../../runtimes/components/runtime-summary-section";
import { usePlatformRuntime } from "../../runtimes/hooks/use-platform-runtime";
import { PlatformMcpPanel } from "../components/platform-mcp-panel";
import { PlatformRuntimeConfigPanel } from "../components/platform-runtime-config-panel";
import { PlatformSharingPanel } from "../../sharing/components/platform-sharing-panel";

interface PlatformDetailPageProps {
  platformId: string;
}

export function PlatformDetailPage({ platformId }: PlatformDetailPageProps) {
  const { platform, isLoading, error, refresh } = usePlatformDetail(platformId);
  const {
    latestJob,
    sources,
    findings,
    capabilities,
    isLoading: isResearchLoading,
    isStarting,
    isPolling,
    lastSyncedAt,
    error: researchError,
    triggerResearch,
  } = usePlatformResearch(platformId);
  const {
    runtime,
    isLoading: isRuntimeLoading,
    isMutating: isRuntimeMutating,
    error: runtimeError,
    start: startRuntime,
    stop: stopRuntime,
  } = usePlatformRuntime(platformId);
  const { submit: saveSources, isSubmitting, error: saveError } = useUpdatePlatformSources();
  const { submit: uploadArtifact, isUploading, error: uploadError } = useUploadPlatformArtifact();

  if (isLoading) {
    return <section className="panel">Loading platform...</section>;
  }

  if (error) {
    return <section className="panel error-text">{error}</section>;
  }

  if (!platform) {
    return (
      <section className="panel">
        <h1>Platform not found</h1>
        <Link className="button button-secondary" to="/platforms">
          Back to platforms
        </Link>
      </section>
    );
  }

  return (
    <div className="research-page-shell">
      <div className="research-page-header">
        <div>
          <p className="eyebrow">Platform setup</p>
          <h1>{platform.name}</h1>
          <p className="muted-text">
            Configure the source surface in the control rail, then review discovery, operations,
            and findings in the workspace.
          </p>
        </div>
        <div className="runtime-actions-row">
          <Link className="button button-secondary" params={{ platformId: platform.id }} to="/platforms/$platformId/chat">
            Open chat
          </Link>
          <Link className="button button-secondary" to="/platforms">
            Back to platforms
          </Link>
        </div>
      </div>

      <PlatformDetailCard platform={platform} />

      <section className="panel setup-composer">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Setup</p>
            <h2>Sources and artifacts</h2>
          </div>
        </div>

        <div className="setup-composer-grid">
          <PlatformSourcesEditor
            embedded
            platform={platform}
            isSubmitting={isSubmitting}
            error={saveError}
            isUploading={isUploading}
            uploadError={uploadError}
            onSubmit={async (input) => {
              await saveSources(platform.id, input);
              await refresh();
            }}
            onUploadArtifact={async (input) => {
              await uploadArtifact(platform.id, {
                ...input,
                kind: "file",
              });
              await refresh();
            }}
          />
        </div>
      </section>

      <PlatformSharingPanel ownerUserId={platform.createdByUserId} platformId={platform.id} />
      <PlatformRuntimeConfigPanel platform={platform} onUpdated={refresh} />
      <PlatformMcpPanel platformId={platform.id} ownerEmail={platform.ownerEmail} />

      <ResearchStatusCard
        job={latestJob}
        isStarting={isStarting}
        isPolling={isPolling}
        lastSyncedAt={lastSyncedAt}
        error={researchError}
        onStart={async () => {
          await triggerResearch();
        }}
      />
      <RuntimeSummarySection
        error={runtimeError}
        isLoading={isRuntimeLoading}
        isMutating={isRuntimeMutating}
        onStart={startRuntime}
        onStop={stopRuntime}
        platformId={platform.id}
        runtime={runtime}
      />
      {isResearchLoading ? (
        <section className="panel">Loading research output...</section>
      ) : (
        <ResearchResultsPanel
          sources={sources}
          findings={findings}
          capabilities={capabilities}
          currentStage={latestJob?.currentStage}
        />
      )}
    </div>
  );
}
