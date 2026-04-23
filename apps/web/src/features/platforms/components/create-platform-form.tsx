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
  const [sourceUrls, setSourceUrls] = useState("");
  const [artifactsText, setArtifactsText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreatePlatformInput = {
      name: name.trim(),
      slug: normalizeSlug(slug || name),
      sourceUrls: sourceUrls
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      sourceArtifacts: artifactsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => parseArtifactLine(line)),
    };

    await onSubmit(payload);
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Create platform</p>
          <h1>Define the surface area you want to research and generate.</h1>
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

      <FormField label="Slug" hint="Lowercase and dash-separated. Leave rough input and we normalize it.">
        <input
          className="text-input"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="stripe-docs-assistant"
        />
      </FormField>

      <FormField label="Source URLs" hint="One URL per line.">
        <textarea
          className="text-area"
          value={sourceUrls}
          onChange={(event) => setSourceUrls(event.target.value)}
          placeholder={"https://docs.example.com\nhttps://api.example.com/openapi.json"}
          required
          rows={6}
        />
      </FormField>

      <FormField
        label="Optional artifacts"
        hint='One artifact per line using "label|uri|kind|mimeType". Kind defaults to "document".'
      >
        <textarea
          className="text-area"
          value={artifactsText}
          onChange={(event) => setArtifactsText(event.target.value)}
          placeholder={"OpenAPI Spec|https://api.example.com/openapi.json|schema|application/json"}
          rows={4}
        />
      </FormField>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="button button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating..." : "Create platform"}
      </button>
    </form>
  );
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
