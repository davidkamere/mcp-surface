export const capabilityParameterLocations = ["path", "query", "header", "body"] as const;
export const capabilityRiskLevels = ["read", "write", "destructive"] as const;
export const capabilityApprovalModes = ["none", "root_approval_required"] as const;

export type CapabilityParameterLocation = (typeof capabilityParameterLocations)[number];
export type CapabilityRiskLevel = (typeof capabilityRiskLevels)[number];
export type CapabilityApprovalMode = (typeof capabilityApprovalModes)[number];

export interface CapabilityParameter {
    name: string;
    in: CapabilityParameterLocation;
    required: boolean;
    type?: string | undefined;
    description?: string | undefined;
}

export interface Capability {
    id: string;
    platformId: string;
    researchJobId: string;
    researchSourceIds: string[];
    key: string;
    name: string;
    summary: string;
    description?: string | undefined;
    method?: string | undefined;
    path?: string | undefined;
    parameters: CapabilityParameter[];
    authRequired: boolean;
    authSchemes?: string[] | undefined;
    tags?: string[] | undefined;
    examples?: string[] | undefined;
    riskLevel: CapabilityRiskLevel;
    approvalMode: CapabilityApprovalMode;
    provenance: string[];
    createdAt: string;
    updatedAt: string;
}
