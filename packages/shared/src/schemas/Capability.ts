import { z } from "zod";
import {
    capabilityApprovalModes,
    capabilityParameterLocations,
    capabilityRiskLevels,
} from "../domain/Capability";

export const capabilityParameterSchema = z.object({
    name: z.string().min(1),
    in: z.enum(capabilityParameterLocations),
    required: z.boolean(),
    type: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
});

export const capabilitySchema = z.object({
    id: z.string().min(1),
    platformId: z.string().min(1),
    researchJobId: z.string().min(1),
    researchSourceIds: z.array(z.string().min(1)).default([]),
    key: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    description: z.string().min(1).optional(),
    method: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    parameters: z.array(capabilityParameterSchema),
    authRequired: z.boolean(),
    authSchemes: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    examples: z.array(z.string().min(1)).optional(),
    riskLevel: z.enum(capabilityRiskLevels),
    approvalMode: z.enum(capabilityApprovalModes),
    provenance: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
