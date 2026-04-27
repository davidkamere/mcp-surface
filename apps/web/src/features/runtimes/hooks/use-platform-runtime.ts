import { useUser } from "@clerk/clerk-react";
import type { ExecutionTrace, RuntimeExecutionInput, WorkspaceRuntime } from "@mcpsurface/shared";
import { useEffect, useState } from "react";
import {
  executeRuntime,
  getOrCreateMyRuntime,
  getRuntime,
  listRuntimeTraces,
  startRuntime,
  stopRuntime,
} from "../api/runtimes-api";

interface RuntimeState {
  runtime: WorkspaceRuntime | null;
  traces: ExecutionTrace[];
}

export function usePlatformRuntime(platformId: string, runtimeId?: string) {
  const { user, isLoaded } = useUser();
  const [state, setState] = useState<RuntimeState>({
    runtime: null,
    traces: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const userId = user?.id;
    const userEmail = resolveUserEmail(user);

    if (!userId || !userEmail) {
      setIsLoading(false);
      setState({ runtime: null, traces: [] });
      return;
    }

    const resolvedUserId = userId;
    const resolvedUserEmail = userEmail;
    let cancelled = false;

    async function load() {
      setIsLoading(true);

      try {
        const runtime = runtimeId
          ? await getRuntime(runtimeId, resolvedUserId, resolvedUserEmail)
          : await getOrCreateMyRuntime(platformId, resolvedUserId, resolvedUserEmail);
        const traces = await listRuntimeTraces(runtime.id, resolvedUserId, resolvedUserEmail);

        if (!cancelled) {
          setState({ runtime, traces });
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load runtime.");
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
    };
  }, [isLoaded, platformId, reloadToken, runtimeId, user]);

  async function runMutation<T>(operation: (userId: string, userEmail: string, runtime: WorkspaceRuntime) => Promise<T>) {
    const userId = user?.id;
    const userEmail = resolveUserEmail(user);
    const runtime = state.runtime;

    if (!userId || !userEmail || !runtime) {
      throw new Error("Runtime is unavailable.");
    }

    setIsMutating(true);
    setError(null);

    try {
      const result = await operation(userId, userEmail, runtime);
      setReloadToken((value) => value + 1);
      return result;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Runtime request failed.";
      setError(message);
      throw requestError;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    ...state,
    isLoading,
    isMutating,
    error,
    refreshRuntime: () => setReloadToken((value) => value + 1),
    start: () => runMutation((userId, userEmail, runtime) => startRuntime(runtime.id, userId, userEmail)),
    stop: () => runMutation((userId, userEmail, runtime) => stopRuntime(runtime.id, userId, userEmail)),
    execute: (input: RuntimeExecutionInput) =>
      runMutation((userId, userEmail, runtime) => executeRuntime(runtime.id, input, userId, userEmail)),
  };
}

function resolveUserEmail(
  user: {
    primaryEmailAddress?: { emailAddress: string | null } | null;
    emailAddresses?: Array<{ emailAddress: string | null }>;
  } | null | undefined,
) {
  return (
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.find((entry) => Boolean(entry.emailAddress))?.emailAddress ??
    null
  );
}
