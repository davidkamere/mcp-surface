import type { ApprovalRequest } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const APPROVAL_REQUESTS_FILE_NAME = "approval-requests.json";

export class ApprovalsRepository {
  async listApprovals(): Promise<ApprovalRequest[]> {
    return readJsonFile<ApprovalRequest[]>(APPROVAL_REQUESTS_FILE_NAME, []);
  }

  async saveApprovals(approvals: ApprovalRequest[]): Promise<void> {
    await writeJsonFile(APPROVAL_REQUESTS_FILE_NAME, approvals);
  }
}
