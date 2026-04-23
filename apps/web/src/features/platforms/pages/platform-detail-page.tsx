import { Link } from "@tanstack/react-router";
import { PlatformDetailCard } from "../components/platform-detail-card";
import { ArtifactUploadForm } from "../components/artifact-upload-form";
import { PlatformSourcesEditor } from "../components/platform-sources-editor";
import { usePlatformDetail } from "../hooks/use-platform-detail";
import { useUpdatePlatformSources } from "../hooks/use-update-platform-sources";
import { useUploadPlatformArtifact } from "../hooks/use-upload-platform-artifact";
import { ResearchResultsPanel } from "../../research/components/research-results-panel";
import { ResearchStatusCard } from "../../research/components/research-status-card";
import { usePlatformResearch } from "../../research/hooks/use-platform-research";

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
    error: researchError,
    triggerResearch,
  } = usePlatformResearch(platformId);
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
    <div className="stack">
      <div className="section-header">
        <div>
          <p className="eyebrow">Platform setup</p>
          <h1>Shape the source surface, then inspect the research graph</h1>
        </div>
        <Link className="button button-secondary" to="/platforms">
          Back to platforms
        </Link>
      </div>

      <div className="workspace-grid">
        <div className="stack">
          <PlatformDetailCard platform={platform} />
          <PlatformSourcesEditor
            platform={platform}
            isSubmitting={isSubmitting}
            error={saveError}
            onSubmit={async (input) => {
              await saveSources(platform.id, input);
              await refresh();
            }}
          />
          <ArtifactUploadForm
            isUploading={isUploading}
            error={uploadError}
            onUpload={async (input) => {
              await uploadArtifact(platform.id, {
                ...input,
                kind: "file",
              });
              await refresh();
            }}
          />
        </div>

        <div className="stack">
          <ResearchStatusCard
            job={latestJob}
            isStarting={isStarting}
            error={researchError}
            onStart={async () => {
              await triggerResearch();
            }}
          />
          {isResearchLoading ? (
            <section className="panel">Loading research output...</section>
          ) : (
            <ResearchResultsPanel
              sources={sources}
              findings={findings}
              capabilities={capabilities}
            />
          )}
        </div>
      </div>
    </div>
  );
}
