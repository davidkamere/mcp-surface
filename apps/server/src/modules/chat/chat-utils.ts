export function chunkText(value: string) {
    if (!value) {
        return [];
    }

    return value.match(/.{1,48}(\s|$)/g) ?? [value];
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
}

export async function withDelayedStatus<T>(
    promise: Promise<T>,
    onDelay: () => Promise<void> | void,
    delayMs = 1800,
): Promise<T> {
    let settled = false;
    const timeoutId = setTimeout(() => {
        if (!settled) {
            void onDelay();
        }
    }, delayMs);

    try {
        return await promise;
    } finally {
        settled = true;
        clearTimeout(timeoutId);
    }
}
