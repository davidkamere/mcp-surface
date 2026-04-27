import type { FormEvent } from "react";
import type { Platform, UpdatePlatformSourcesInput } from "@mcpsurface/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormField } from "../../../components/form-field";

interface PlatformSourcesEditorProps {
  platform: Platform;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: UpdatePlatformSourcesInput) => Promise<void>;
  onUploadArtifact: (input: {
    label: string;
    fileName: string;
    mimeType?: string;
    contentBase64: string;
  }) => Promise<void>;
  isUploading: boolean;
  uploadError: string | null;
  embedded?: boolean;
}

export function PlatformSourcesEditor({
  platform,
  isSubmitting,
  error,
  onSubmit,
  onUploadArtifact,
  isUploading,
  uploadError,
  embedded = false,
}: PlatformSourcesEditorProps) {
  const [sourceUrls, setSourceUrls] = useState(platform.sourceUrls);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isArtifactFormOpen, setIsArtifactFormOpen] = useState(false);
  const [artifactLabel, setArtifactLabel] = useState("");
  const [artifactFile, setArtifactFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSourceUrls(platform.sourceUrls.length > 0 ? platform.sourceUrls : [""]);
  }, [platform.sourceUrls]);

  const normalizedSourceUrls = useMemo(
    () => sourceUrls.map((value) => value.trim()).filter(Boolean),
    [sourceUrls],
  );
  const urlIssues = useMemo(() => {
    const counts = new Map<string, number>();

    for (const value of sourceUrls) {
      const normalized = value.trim().toLowerCase();

      if (!normalized) {
        continue;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return sourceUrls.map((value) => {
      const trimmed = value.trim();

      if (!trimmed) {
        return null;
      }

      if (!isValidHttpUrl(trimmed)) {
        return "Enter a valid http or https URL.";
      }

      if ((counts.get(trimmed.toLowerCase()) ?? 0) > 1) {
        return "Duplicate URL.";
      }

      return null;
    });
  }, [sourceUrls]);
  const hasUrlIssues = urlIssues.some(Boolean);
  const hasUnsavedChanges = useMemo(() => {
    const current = JSON.stringify(normalizedSourceUrls);
    const persisted = JSON.stringify(platform.sourceUrls);
    return current !== persisted;
  }, [normalizedSourceUrls, platform.sourceUrls]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      sourceUrls: normalizedSourceUrls,
      sourceArtifacts: platform.sourceArtifacts.map((artifact) => ({
        label: artifact.label,
        kind: artifact.kind,
        uri: artifact.uri,
        mimeType: artifact.mimeType,
      })),
    });
    setLastSavedAt(new Date().toISOString());
  }

  async function handleArtifactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!artifactFile) {
      return;
    }

    const contentBase64 = await readFileAsBase64(artifactFile);
    const payload: {
      label: string;
      fileName: string;
      mimeType?: string;
      contentBase64: string;
    } = {
      label: artifactLabel.trim() || artifactFile.name,
      fileName: artifactFile.name,
      contentBase64,
    };

    if (artifactFile.type) {
      payload.mimeType = artifactFile.type;
    }

    await onUploadArtifact(payload);

    setArtifactLabel("");
    setArtifactFile(null);
    setIsArtifactFormOpen(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function updateSourceUrl(index: number, value: string) {
    setSourceUrls((current) => current.map((entry, entryIndex) => (entryIndex === index ? value : entry)));
  }

  function addSourceUrlRow() {
    setSourceUrls((current) => [...current, ""]);
  }

  function removeSourceUrlRow(index: number) {
    setSourceUrls((current) => {
      const next = current.filter((_, entryIndex) => entryIndex !== index);
      return next.length > 0 ? next : [""];
    });
  }

  function removeArtifact(uri: string) {
    void onSubmit({
      sourceUrls: normalizedSourceUrls,
      sourceArtifacts: platform.sourceArtifacts
        .filter((artifact) => artifact.uri !== uri)
        .map((artifact) => ({
          label: artifact.label,
          kind: artifact.kind,
          uri: artifact.uri,
          mimeType: artifact.mimeType,
        })),
    }).then(() => {
      setLastSavedAt(new Date().toISOString());
    });
  }

  function handleUrlPaste(index: number, pastedValue: string) {
    const lines = pastedValue
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      updateSourceUrl(index, pastedValue);
      return;
    }

    setSourceUrls((current) => {
      const next = [...current];
      next.splice(index, 1, ...lines);
      return next;
    });
  }

  return (
    <form className={embedded ? "form-panel setup-section" : "panel form-panel"} onSubmit={handleSubmit}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Source URLs</h2>
        </div>
        <div className="setup-status-cluster">
          <span className="setup-summary-chip">{normalizedSourceUrls.length} URL{normalizedSourceUrls.length === 1 ? "" : "s"}</span>
          <span className="setup-summary-chip">
            {platform.sourceArtifacts.length} artifact{platform.sourceArtifacts.length === 1 ? "" : "s"}
          </span>
          <span className="setup-status-text">
            {hasUnsavedChanges
              ? "Unsaved changes"
              : lastSavedAt
                ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                : "Saved"}
          </span>
        </div>
      </div>

      <div className="setup-block">
        <div className="setup-block-header">
          <div>
            <p className="eyebrow">Step 1</p>
            <h3>Entry points</h3>
          </div>
          <button className="button button-secondary" onClick={addSourceUrlRow} type="button">
            Add URL
          </button>
        </div>
        <div className="setup-url-list">
          {sourceUrls.map((value, index) => (
            <div className="setup-url-entry" key={`${index}-${platform.id}`}>
              <div className="setup-url-row">
                <span className="setup-url-index">{index + 1}</span>
                <input
                  className={`text-input${urlIssues[index] ? " text-input-invalid" : ""}`}
                  onChange={(event) => updateSourceUrl(index, event.target.value)}
                  onPaste={(event) => {
                    const pastedValue = event.clipboardData.getData("text");

                    if (pastedValue.includes("\n")) {
                      event.preventDefault();
                      handleUrlPaste(index, pastedValue);
                    }
                  }}
                  placeholder="https://developers.example.com/api/"
                  type="url"
                  value={value}
                />
                <button
                  aria-label={`Remove source URL ${index + 1}`}
                  className="button button-secondary"
                  disabled={sourceUrls.length === 1 && !value}
                  onClick={() => removeSourceUrlRow(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
              {urlIssues[index] ? <p className="error-text inline-error-text">{urlIssues[index]}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="setup-block">
        <div className="setup-block-header">
          <div>
            <p className="eyebrow">Step 2</p>
            <h3>Artifacts</h3>
          </div>
          <button
            className="button button-secondary"
            onClick={() => setIsArtifactFormOpen((current) => !current)}
            type="button"
          >
            {isArtifactFormOpen ? "Close" : "Add artifact"}
          </button>
        </div>

        {platform.sourceArtifacts.length > 0 ? (
          <ul className="artifact-item-list">
            {platform.sourceArtifacts.map((artifact) => (
              <li className="artifact-item" key={artifact.id}>
                <div>
                  <strong>{artifact.label}</strong>
                  <p className="muted-text">
                    {artifact.kind}
                    {artifact.mimeType ? ` • ${artifact.mimeType}` : ""}
                  </p>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => removeArtifact(artifact.uri)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No artifacts added.</p>
        )}

        {isArtifactFormOpen ? (
          <form className="inline-artifact-form" onSubmit={handleArtifactSubmit}>
            <FormField label="Label">
              <input
                className="text-input"
                onChange={(event) => setArtifactLabel(event.target.value)}
                placeholder="OpenAPI spec export"
                value={artifactLabel}
              />
            </FormField>

            <FormField label="File">
              <input
                className="text-input file-input"
                onChange={(event) => setArtifactFile(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
                type="file"
              />
            </FormField>

            {uploadError ? <p className="error-text">{uploadError}</p> : null}

            <div className="setup-actions-row">
              <button className="button button-secondary" disabled={isUploading || !artifactFile} type="submit">
                {isUploading ? "Uploading..." : "Upload artifact"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="setup-footer">
        <p className="form-hint">
          {hasUrlIssues
            ? "Fix invalid or duplicate URLs before saving."
            : normalizedSourceUrls.length > 0
            ? "Ready to research once the setup is saved."
            : "Add at least one source URL to continue."}
        </p>
        <button
          className="button button-primary"
          disabled={isSubmitting || hasUrlIssues || normalizedSourceUrls.length === 0}
          type="submit"
        >
          {isSubmitting ? "Saving..." : "Save setup"}
        </button>
      </div>
    </form>
  );
}

async function readFileAsBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
