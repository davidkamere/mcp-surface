import { Link } from "@tanstack/react-router";
import type { Capability, ResearchFinding, ResearchSource } from "@mcpsurface/shared";
import { useEffect, useRef } from "react";
import { PlatformDetailCard } from "../components/platform-detail-card";
import { PlatformSourcesEditor } from "../components/platform-sources-editor";
import { usePlatformDetail } from "../hooks/use-platform-detail";
import { useUpdatePlatformSources } from "../hooks/use-update-platform-sources";
import { useUploadPlatformArtifact } from "../hooks/use-upload-platform-artifact";
import { ResearchResultsPanel } from "../../research/components/research-results-panel";
import { ResearchStatusCard } from "../../research/components/research-status-card";
import { usePlatformResearch } from "../../research/hooks/use-platform-research";
import { usePlatformRuntime } from "../../runtimes/hooks/use-platform-runtime";
import { PlatformMcpPanel } from "../components/platform-mcp-panel";
import { PlatformRuntimeConfigPanel } from "../components/platform-runtime-config-panel";
import { PlatformSharingPanel } from "../../sharing/components/platform-sharing-panel";
import { usePlatformArtifacts } from "../hooks/use-platform-artifacts";
import {
    LockedChatLink,
    ResearchUnlockPanel,
} from "../components/research-unlock-panel";

interface PlatformDetailPageProps {
    platformId: string;
    startInitialResearch?: boolean | undefined;
}

export function PlatformDetailPage({
    platformId,
    startInitialResearch = false,
}: PlatformDetailPageProps) {
    const autoResearchAttemptedFor = useRef<string | null>(null);
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
        mcpArtifact,
        runtimeArtifact,
        isLoading: isArtifactsLoading,
        error: artifactsError,
        refresh: refreshArtifacts,
    } = usePlatformArtifacts(platformId);
    const { submit: saveSources, isSubmitting, error: saveError } = useUpdatePlatformSources();
    const { submit: uploadArtifact, isUploading, error: uploadError } = useUploadPlatformArtifact();

    const artifactsReady =
        latestJob?.status === "completed" &&
        Boolean(mcpArtifact && runtimeArtifact) &&
        mcpArtifact?.sourceResearchJobId === latestJob.id &&
        runtimeArtifact?.sourceResearchJobId === latestJob.id;

    useEffect(() => {
        if (latestJob?.status === "completed") {
            refreshArtifacts();
        }
    }, [latestJob?.id, latestJob?.status, refreshArtifacts]);

    useEffect(() => {
        if (
            !startInitialResearch ||
            isLoading ||
            isResearchLoading ||
            latestJob ||
            autoResearchAttemptedFor.current === platformId
        ) {
            return;
        }

        autoResearchAttemptedFor.current = platformId;
        void triggerResearch().catch(() => undefined);
    }, [
        isLoading,
        isResearchLoading,
        latestJob,
        platformId,
        startInitialResearch,
        triggerResearch,
    ]);

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
                        Add trusted sources and complete one research run. Chat, workspace,
                        runtime, MCP access, and sharing unlock when generated artifacts are ready.
                    </p>
                </div>
                <div className="runtime-actions-row">
                    {artifactsReady ? (
                        <Link
                            className="button button-primary"
                            params={{ platformId: platform.id }}
                            to="/platforms/$platformId/chat"
                        >
                            Open chat
                        </Link>
                    ) : (
                        <LockedChatLink />
                    )}
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
            {isArtifactsLoading || isResearchLoading ? (
                <section className="panel research-loading-state" aria-live="polite">
                    Preparing your research workspace…
                </section>
            ) : artifactsReady ? (
                <ReadyPlatformWorkspace
                    platform={platform}
                    platformId={platform.id}
                    ownerUserId={platform.createdByUserId}
                    onPlatformUpdated={refresh}
                    sources={sources}
                    findings={findings}
                    capabilities={capabilities}
                    currentStage={latestJob?.currentStage}
                />
            ) : (
                <ResearchUnlockPanel
                    researchCompleted={latestJob?.status === "completed"}
                    artifactError={artifactsError}
                />
            )}
        </div>
    );
}

function ReadyPlatformWorkspace({
    platform,
    platformId,
    ownerUserId,
    onPlatformUpdated,
    sources,
    findings,
    capabilities,
    currentStage,
}: {
    platform: NonNullable<ReturnType<typeof usePlatformDetail>["platform"]>;
    platformId: string;
    ownerUserId: string;
    onPlatformUpdated: () => Promise<void>;
    sources: ResearchSource[];
    findings: ResearchFinding[];
    capabilities: Capability[];
    currentStage?: string;
}) {
    return (
        <>
            <ResearchResultsPanel
                sources={sources}
                findings={findings}
                capabilities={capabilities}
                currentStage={currentStage}
            />
            <PlatformRuntimeConfigPanel
                platform={platform}
                findings={findings}
                capabilities={capabilities}
                onUpdated={onPlatformUpdated}
            />
            <PlatformMcpPanel platformId={platformId} ownerEmail={platform.ownerEmail} />
            <PlatformSharingPanel ownerUserId={ownerUserId} platformId={platformId} />
        </>
    );
}
