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
        const jobs = await listResearchJobs(platformId, userId);
        const latestJob = jobs[0] ?? null;

        if (!latestJob) {
          if (!cancelled) {
            setState({ latestJob: null, sources: [], findings: [], capabilities: [] });
            setError(null);
          }
          return;
        }

        const detail = await getResearchJob(latestJob.id, userId);

        if (!cancelled) {
          setState({
            latestJob: detail.job,
            sources: detail.sources,
            findings: detail.findings,
            capabilities: detail.capabilities,
          });
          setError(null);
        }

        if (runningStatuses.has(detail.job.status) && !cancelled) {
          timerId = window.setTimeout(() => {
            void load();
          }, 2000);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load research.");
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
  }, [isLoaded, platformId, user]);

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
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to start research.";
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
    error,
    triggerResearch,
  };
}
