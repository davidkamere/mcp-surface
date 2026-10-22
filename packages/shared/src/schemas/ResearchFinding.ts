import { z } from "zod";
import { researchFindingKinds } from "../domain/ResearchFinding";

export const researchFindingSchema = z.object({
    id: z.string().min(1),
    platformId: z.string().min(1),
    researchJobId: z.string().min(1),
    researchSourceId: z.string().min(1),
    kind: z.enum(researchFindingKinds),
    title: z.string().min(1),
    summary: z.string().min(1),
    evidence: z.array(z.string()),
    provenanceUrl: z.string().min(1),
    createdAt: z.string().datetime(),
});
