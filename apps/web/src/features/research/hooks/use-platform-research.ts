import { useUser } from "@clerk/clerk-react";
import type { Capability, ResearchFinding, ResearchJob, ResearchSource } from "@mcpsurface/shared";
import { useEffect, useState } from "react";
import { getResearchJob, listResearchJobs, startResearchJob } from "../api/research-api";

interface ResearchState {
    latestJob: ResearchJob | null;
    sources: ResearchSource[];
    findings: ResearchFinding[];
    capabilities: Capability[];
}

const runningStatuses = new Set(["queued", "running"]);

export function usePlatformResearch(platformId: string) {
    const { user, isLoaded } = useUser();
    const [state, setState] = useState<ResearchState>({
        latestJob: null,
        sources: [],
        findings: [],
        capabilities: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

    useEffect(() => {
        if (!isLoaded || !user) {
            return;
        }

        const currentUser = user;
        const userId = currentUser.id;
        let cancelled = false;
        let timerId: number | undefined;

        async function load() {
            try {
                setIsLoading(true);
                const knownJobId = activeJobId ?? state.latestJob?.id ?? null;

                if (knownJobId) {
                    const detail = await getResearchJob(knownJobId, userId);

                    if (!cancelled) {
                        setState({
                            latestJob: detail.job,
                            sources: detail.sources,
                            findings: detail.findings,
                            capabilities: detail.capabilities,
                        });
                        setLastSyncedAt(Date.now());
                        setError(null);
                    }

                    if (runningStatuses.has(detail.job.status) && !cancelled) {
                        timerId = window.setTimeout(() => {
                            void load();
                        }, 2000);
                    }

                    return;
                }

                const jobs = await listResearchJobs(platformId, userId);
                const latestJob = jobs[0] ?? null;

                if (!cancelled) {
                    setActiveJobId(latestJob?.id ?? null);
                    setState((current) => ({
                        ...current,
                        latestJob,
                    }));
                    setLastSyncedAt(Date.now());
                    setError(null);
                }

                if (!latestJob) {
                    if (!cancelled) {
                        setState({
                            latestJob: null,
                            sources: [],
                            findings: [],
                            capabilities: [],
                        });
                    }
                    return;
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        requestError instanceof Error
                            ? requestError.message
                            : "Unable to load research.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
            if (timerId) {
                window.clearTimeout(timerId);
            }
        };
    }, [activeJobId, isLoaded, platformId, reloadToken, state.latestJob?.id, user]);

    async function triggerResearch() {
        if (!user) {
            throw new Error("You must be signed in to start research.");
        }

        setIsStarting(true);
        setError(null);

        try {
            const detail = await startResearchJob(platformId, user.id);
            setState({
                latestJob: detail.job,
                sources: detail.sources,
                findings: detail.findings,
                capabilities: detail.capabilities,
            });
            setLastSyncedAt(Date.now());
            setActiveJobId(detail.job.id);
            setReloadToken((value) => value + 1);
        } catch (requestError) {
            const message =
                requestError instanceof Error ? requestError.message : "Unable to start research.";
            setError(message);
            throw requestError;
        } finally {
            setIsStarting(false);
        }
    }

    return {
        ...state,
        isLoading,
        isStarting,
        isPolling: runningStatuses.has(state.latestJob?.status ?? ""),
        lastSyncedAt,
        error,
        refreshResearch: () => setReloadToken((value) => value + 1),
        triggerResearch,
    };
}
