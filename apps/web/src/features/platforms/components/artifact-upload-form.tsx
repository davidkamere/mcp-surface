import type { FormEvent } from "react";
import { useState } from "react";
import { FormField } from "../../../components/form-field";

interface ArtifactUploadFormProps {
  isUploading: boolean;
  error: string | null;
  onUpload: (input: {
    label: string;
    fileName: string;
    mimeType?: string;
    contentBase64: string;
  }) => Promise<void>;
}

export function ArtifactUploadForm({ isUploading, error, onUpload }: ArtifactUploadFormProps) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      return;
    }

    const contentBase64 = await readFileAsBase64(file);
    const payload = {
      label: label.trim() || file.name,
      fileName: file.name,
      contentBase64,
    } as {
      label: string;
      fileName: string;
      mimeType?: string;
      contentBase64: string;
    };

    if (file.type) {
      payload.mimeType = file.type;
    }

    await onUpload(payload);

    setLabel("");
    setFile(null);
  }

  return (
    <form className="panel form-panel compact-panel" onSubmit={handleSubmit}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Artifacts</p>
          <h2>Attach local reference files</h2>
        </div>
      </div>

      <FormField label="Label">
        <input
          className="text-input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="OpenAPI spec export"
        />
      </FormField>

      <FormField label="File">
        <input
          className="text-input file-input"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
      </FormField>

      {error ? <p className="error-text">{error}</p> : null}

      <button className="button button-secondary" disabled={isUploading || !file} type="submit">
        {isUploading ? "Uploading..." : "Upload artifact"}
      </button>
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
