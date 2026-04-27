import { z } from "zod";
import { researchStatuses } from "../domain/ResearchStatus";

export const researchStatusSchema = z.enum(researchStatuses);
