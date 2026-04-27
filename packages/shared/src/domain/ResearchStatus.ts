export const researchStatuses = ["queued", "running", "completed", "failed", "needs_input"] as const;

export type ResearchStatus = (typeof researchStatuses)[number];
