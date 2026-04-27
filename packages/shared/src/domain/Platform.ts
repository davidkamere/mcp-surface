import type { SourceArtifact } from "./SourceArtifact";

export const MASKED_RUNTIME_CONFIG_VALUE = "__mcpsurface_masked_secret__";

export interface PlatformRuntimeConfigEntry {
  key: string;
  value: string;
}

export interface Platform {
  id: string;
  name: string;
  slug: string;
  sourceUrls: string[];
  sourceArtifacts: SourceArtifact[];
  runtimeConfig: PlatformRuntimeConfigEntry[];
  createdByUserId: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}
