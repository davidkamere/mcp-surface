import { useUser } from "@clerk/clerk-react";
import {
    MASKED_RUNTIME_CONFIG_VALUE,
    type Capability,
    type Platform,
    type ResearchFinding,
} from "@mcpsurface/shared";
import { useEffect, useMemo, useState } from "react";
import { updatePlatformRuntimeConfig } from "../api/platforms-api";

interface PlatformRuntimeConfigPanelProps {
    platform: Platform;
    findings: ResearchFinding[];
    capabilities: Capability[];
    onUpdated: (platform: Platform) => void | Promise<void>;
}

export function PlatformRuntimeConfigPanel({
    platform,
    findings,
    capabilities,
    onUpdated,
}: PlatformRuntimeConfigPanelProps) {
    const { user } = useUser();
    const [entries, setEntries] = useState(platform.runtimeConfig);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requiredKeys = useMemo(
        () => inferRequiredExecutionKeys(findings, capabilities),
        [capabilities, findings],
    );
    const requiredKeySet = useMemo(() => new Set(requiredKeys), [requiredKeys]);

    useEffect(() => {
        setEntries(platform.runtimeConfig);
    }, [platform.runtimeConfig]);

    useEffect(() => {
        setEntries((current) => {
            const requiredEntries = requiredKeys.map((key) => {
                const existing = current.find(
                    (entry) => entry.key.trim().toUpperCase() === key,
                );
                return existing ? { ...existing, key } : { key, value: "" };
            });
            const optionalEntries = current.filter(
                (entry) => !requiredKeySet.has(entry.key.trim().toUpperCase()),
            );
            return [...requiredEntries, ...optionalEntries];
        });
    }, [platform.runtimeConfig, requiredKeySet, requiredKeys]);

    async function handleSave() {
        if (!user) {
            setError("You must be signed in to update runtime config.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const nextPlatform = await updatePlatformRuntimeConfig(
                platform.id,
                {
                    runtimeConfig: entries
                        .map((entry) => ({
                            key: entry.key.trim(),
                            value: entry.value,
                        }))
                        .filter((entry) => entry.key.length > 0),
                },
                user.id,
            );
            await onUpdated(nextPlatform);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Unable to update runtime config.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section className="panel setup-composer">
            <div className="panel-header">
                <div>
                    <p className="eyebrow">Execution setup</p>
                    <h2>Credentials and environment</h2>
                    <p className="muted-text">
                        Research has suggested the highlighted keys from the API documentation.
                        Add their values to enable authenticated calls. Add any other keys your
                        runtime needs; saved values stay masked.
                    </p>
                </div>
            </div>

            <div className="stack">
                {entries.map((entry, index) => (
                    <div
                        className={`runtime-config-row${requiredKeySet.has(entry.key.trim().toUpperCase()) ? " runtime-config-row-required" : ""}`}
                        key={`${entry.key}-${index}`}
                    >
                        <input
                            aria-label={`${entry.key} environment key`}
                            className={`text-input${requiredKeySet.has(entry.key.trim().toUpperCase()) ? " runtime-config-required-key" : ""}`}
                            onChange={(event) =>
                                setEntries((current) =>
                                    current.map((item, itemIndex) =>
                                        itemIndex === index
                                            ? { ...item, key: event.target.value }
                                            : item,
                                    ),
                                )
                            }
                            placeholder="KEY_NAME"
                            readOnly={requiredKeySet.has(entry.key.trim().toUpperCase())}
                            value={entry.key}
                        />
                        <input
                            aria-label={`${entry.key || "Custom"} value`}
                            className={`text-input${requiredKeySet.has(entry.key.trim().toUpperCase()) ? " runtime-config-required-value" : ""}`}
                            onChange={(event) =>
                                setEntries((current) =>
                                    current.map((item, itemIndex) =>
                                        itemIndex === index
                                            ? {
                                                  ...item,
                                                  value:
                                                      event.target.value.length === 0 &&
                                                      item.value === MASKED_RUNTIME_CONFIG_VALUE
                                                          ? MASKED_RUNTIME_CONFIG_VALUE
                                                          : event.target.value,
                                              }
                                            : item,
                                    ),
                                )
                            }
                            placeholder={
                                requiredKeySet.has(entry.key.trim().toUpperCase()) &&
                                entry.value !== MASKED_RUNTIME_CONFIG_VALUE
                                    ? "Required value"
                                    : entry.value === MASKED_RUNTIME_CONFIG_VALUE
                                    ? "Stored value configured"
                                    : "Value"
                            }
                            type="password"
                            value={entry.value === MASKED_RUNTIME_CONFIG_VALUE ? "" : entry.value}
                        />
                        {requiredKeySet.has(entry.key.trim().toUpperCase()) ? (
                            <span className="runtime-required-label">Required</span>
                        ) : (
                            <button
                                className="button button-secondary"
                                onClick={() =>
                                    setEntries((current) =>
                                        current.filter((_, itemIndex) => itemIndex !== index),
                                    )
                                }
                                type="button"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                ))}
                <div className="action-row">
                    <button
                        className="button button-secondary"
                        onClick={() =>
                            setEntries((current) => [...current, { key: "", value: "" }])
                        }
                        type="button"
                    >
                        Add key
                    </button>
                    <button
                        className="button button-primary"
                        disabled={isSubmitting}
                        onClick={() => void handleSave()}
                        type="button"
                    >
                        {isSubmitting ? "Saving..." : "Save runtime config"}
                    </button>
                </div>
                {error ? <p className="error-text">{error}</p> : null}
            </div>
        </section>
    );
}

function inferRequiredExecutionKeys(
    findings: ResearchFinding[],
    capabilities: Capability[],
) {
    const keys = new Set<string>();
    const authFindings = findings.filter((finding) => finding.kind === "authentication");
    const envKeyPattern = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

    for (const finding of authFindings) {
        const text = [finding.title, finding.summary, ...finding.evidence].join(" ");
        for (const match of text.matchAll(envKeyPattern)) {
            const key = match[0];
            if (/(API|AUTH|KEY|TOKEN|SECRET|CREDENTIAL|ACCOUNT)/.test(key)) {
                keys.add(key);
            }
        }
    }

    if (capabilities.some((capability) => capability.authRequired)) {
        keys.add("CLOUDFLARE_API_TOKEN");
    }

    if (
        capabilities.some((capability) =>
            capability.parameters.some((parameter) => parameter.name.toLowerCase() === "account_id") ||
            capability.path?.includes("{account_id}"),
        )
    ) {
        keys.add("CLOUDFLARE_ACCOUNT_ID");
    }

    return Array.from(keys);
}
