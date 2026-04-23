import type { FormEvent } from "react";
import type { Platform, UpdatePlatformSourcesInput } from "@mcpsurface/shared";
import { useEffect, useState } from "react";
import { FormField } from "../../../components/form-field";

interface PlatformSourcesEditorProps {
  platform: Platform;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: UpdatePlatformSourcesInput) => Promise<void>;
}

export function PlatformSourcesEditor({
  platform,
  isSubmitting,
  error,
  onSubmit,
}: PlatformSourcesEditorProps) {
  const [sourceUrls, setSourceUrls] = useState(platform.sourceUrls.join("\n"));

  useEffect(() => {
    setSourceUrls(platform.sourceUrls.join("\n"));
  }, [platform.sourceUrls]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      sourceUrls: sourceUrls
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      sourceArtifacts: platform.sourceArtifacts.map((artifact) => ({
        label: artifact.label,
        kind: artifact.kind,
        uri: artifact.uri,
        mimeType: artifact.mimeType,
      })),
    });
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Sources</p>
          <h2>Define the research surface</h2>
        </div>
      </div>

      <FormField label="Source URLs" hint="One URL per line. These become the initial discovery set.">
        <textarea
          className="text-area"
          value={sourceUrls}
          onChange={(event) => setSourceUrls(event.target.value)}
          rows={8}
        />
      </FormField>

      <div className="artifact-list">
        <h3>Attached artifacts</h3>
        {platform.sourceArtifacts.length > 0 ? (
          <ul className="token-list">
            {platform.sourceArtifacts.map((artifact) => (
              <li key={artifact.id}>
                {artifact.label} • {artifact.kind}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No uploaded artifacts yet.</p>
        )}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="button button-secondary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving..." : "Save sources"}
      </button>
    </form>
  );
}
