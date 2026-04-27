import { useUser } from "@clerk/clerk-react";
import { MASKED_RUNTIME_CONFIG_VALUE, type Platform } from "@mcpsurface/shared";
import { useEffect, useState } from "react";
import { updatePlatformRuntimeConfig } from "../api/platforms-api";

interface PlatformRuntimeConfigPanelProps {
  platform: Platform;
  onUpdated: (platform: Platform) => void | Promise<void>;
}

export function PlatformRuntimeConfigPanel({ platform, onUpdated }: PlatformRuntimeConfigPanelProps) {
  const { user } = useUser();
  const [entries, setEntries] = useState(platform.runtimeConfig);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(platform.runtimeConfig);
  }, [platform.runtimeConfig]);

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
      setError(requestError instanceof Error ? requestError.message : "Unable to update runtime config.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel setup-composer">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Runtime config</p>
          <h2>Optional execution keys</h2>
          <p className="muted-text">
            Add platform-scoped values the runtime can use during execution, such as
            <code> CLOUDFLARE_API_TOKEN </code>
            or
            <code> CLOUDFLARE_ACCOUNT_ID</code>. Stored values are masked after save. Remove a row to clear a value.
          </p>
        </div>
      </div>

      <div className="stack">
        {entries.map((entry, index) => (
          <div className="runtime-config-row" key={`${entry.key}-${index}`}>
            <input
              className="text-input"
              onChange={(event) =>
                setEntries((current) =>
                  current.map((item, itemIndex) => (itemIndex === index ? { ...item, key: event.target.value } : item)),
                )
              }
              placeholder="KEY_NAME"
              value={entry.key}
            />
            <input
              className="text-input"
              onChange={(event) =>
                setEntries((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          value:
                            event.target.value.length === 0 && item.value === MASKED_RUNTIME_CONFIG_VALUE
                              ? MASKED_RUNTIME_CONFIG_VALUE
                              : event.target.value,
                        }
                      : item,
                  ),
                )
              }
              placeholder={entry.value === MASKED_RUNTIME_CONFIG_VALUE ? "Stored value configured" : "value"}
              type="password"
              value={entry.value === MASKED_RUNTIME_CONFIG_VALUE ? "" : entry.value}
            />
            <button
              className="button button-secondary"
              onClick={() => setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="action-row">
          <button
            className="button button-secondary"
            onClick={() => setEntries((current) => [...current, { key: "", value: "" }])}
            type="button"
          >
            Add key
          </button>
          <button className="button button-primary" disabled={isSubmitting} onClick={() => void handleSave()} type="button">
            {isSubmitting ? "Saving..." : "Save runtime config"}
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}
