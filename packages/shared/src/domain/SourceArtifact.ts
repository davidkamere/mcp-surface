export const sourceArtifactKinds = ["url", "file", "document", "schema"] as const;

export type SourceArtifactKind = (typeof sourceArtifactKinds)[number];

export interface SourceArtifact {
  id: string;
  platformId: string;
  label: string;
  kind: SourceArtifactKind;
  uri: string;
  mimeType?: string | undefined;
  createdAt: string;
}
