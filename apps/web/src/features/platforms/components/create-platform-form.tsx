import { type FormEvent, useState } from "react";
import type { CreatePlatformInput, SourceArtifactKind } from "@mcpsurface/shared";
import { normalizeSlug } from "@mcpsurface/shared";
import { FormField } from "../../../components/form-field";

interface CreatePlatformFormProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: CreatePlatformInput) => Promise<void>;
}

export function CreatePlatformForm({ isSubmitting, error, onSubmit }: CreatePlatformFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sourceUrls, setSourceUrls] = useState([""]);
  const [artifactsText, setArtifactsText] = useState("");

  const normalizedSourceUrls = sourceUrls.map((line) => line.trim()).filter(Boolean);
  const urlIssues = buildUrlIssues(sourceUrls);
  const hasUrlIssues = urlIssues.some(Boolean);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreatePlatformInput = {
      name: name.trim(),
      slug: normalizeSlug(slug || name),
      sourceUrls: normalizedSourceUrls,
      sourceArtifacts: artifactsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => parseArtifactLine(line)),
    };

    await onSubmit(payload);
  }

  return (
    <form className="panel form-panel create-platform-form" onSubmit={handleSubmit}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Create platform</p>
          <h1>New platform</h1>
        </div>
      </div>

      <div className="create-platform-main">
        <div className="setup-block">
          <div className="setup-block-header">
            <div>
              <p className="eyebrow">Step 1</p>
              <h3>Identity</h3>
            </div>
          </div>

          <FormField label="Platform name">
            <input
              className="text-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Stripe Docs Assistant"
              required
            />
          </FormField>

          <FormField label="Slug">
            <input
              className="text-input"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="stripe-docs-assistant"
            />
          </FormField>
        </div>

        <div className="setup-block">
          <div className="setup-block-header">
            <div>
              <p className="eyebrow">Step 2</p>
              <h3>Entry points</h3>
            </div>
            <button className="button button-secondary" onClick={addSourceUrlRow} type="button">
              Add URL
            </button>
          </div>

          <div className="setup-url-list">
            {sourceUrls.map((value, index) => (
              <div className="setup-url-entry" key={`create-url-${index}`}>
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
              <p className="eyebrow">Optional</p>
              <h3>Artifacts</h3>
            </div>
          </div>

          <FormField
            label="Artifact definitions"
            hint='One artifact per line using "label|uri|kind|mimeType".'
          >
            <textarea
              className="text-area"
              value={artifactsText}
              onChange={(event) => setArtifactsText(event.target.value)}
              placeholder={"OpenAPI Spec|https://api.example.com/openapi.json|schema|application/json"}
              rows={4}
            />
          </FormField>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="setup-footer">
        <p className="form-hint">
          {hasUrlIssues
            ? "Fix invalid or duplicate URLs before continuing."
            : "The platform will open into setup after creation."}
        </p>
        <button
          className="button button-primary"
          disabled={isSubmitting || hasUrlIssues || normalizedSourceUrls.length === 0 || !name.trim()}
          type="submit"
        >
          {isSubmitting ? "Creating..." : "Create platform"}
        </button>
      </div>
    </form>
  );

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
}

function parseArtifactLine(line: string) {
  const [label = "", uri = "", kind = "document", mimeType = ""] = line.split("|").map((part) => part.trim());

  return {
    label,
    uri,
    kind: kind as SourceArtifactKind,
    mimeType: mimeType || undefined,
  };
}

function buildUrlIssues(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return values.map((value) => {
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
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
