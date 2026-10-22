import {
    MASKED_RUNTIME_CONFIG_VALUE,
    type Platform,
    type PlatformRuntimeConfigEntry,
} from "@mcpsurface/shared";

export function maskPlatformForResponse(platform: Platform): Platform {
    return {
        ...platform,
        runtimeConfig: maskPlatformRuntimeConfig(platform.runtimeConfig),
    };
}

export function maskPlatformRuntimeConfig(
    entries: PlatformRuntimeConfigEntry[],
): PlatformRuntimeConfigEntry[] {
    return entries.map((entry) => ({
        key: entry.key,
        value: MASKED_RUNTIME_CONFIG_VALUE,
    }));
}

export function isMaskedRuntimeConfigValue(value: string) {
    return value === MASKED_RUNTIME_CONFIG_VALUE;
}
