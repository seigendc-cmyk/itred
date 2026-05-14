/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalRequest } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { notificationService } from "./notificationService.ts";
import { logService } from "./logService.ts";

const STORAGE_KEY = "itred_approval_requests";

export const approvalService = {
  getAll: async (): Promise<ApprovalRequest[]> => {
    const data =
      await getStorageAdapter().getItem<ApprovalRequest[]>(STORAGE_KEY);
    return data || [];
  },

  getById: async (id: string): Promise<ApprovalRequest | undefined> => {
    const all = await approvalService.getAll();
    return all.find((r) => r.id === id);
  },

  create: async (request: ApprovalRequest): Promise<void> => {
    const all = await approvalService.getAll();
    all.push(request);
    await getStorageAdapter().setItem(STORAGE_KEY, all);
  },

  updateStatus: async (
    id: string,
    status: ApprovalRequest["status"],
  ): Promise<void> => {
    const all = await approvalService.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx >= 0) {
      all[idx].status = status;
      await getStorageAdapter().setItem(STORAGE_KEY, all);
    }
  },

  delete: async (id: string): Promise<void> => {
    const all = await approvalService.getAll();
    await getStorageAdapter().setItem(
      STORAGE_KEY,
      all.filter((r) => r.id !== id),
    );
  },

  submitApprovalRequest: async (
    request: Omit<ApprovalRequest, "id" | "status" | "submittedAt">,
  ): Promise<void> => {
    const newReq: ApprovalRequest = {
      ...request,
      id: `APP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };

    await approvalService.create(newReq);

    await notificationService.createNotification({
      title: "New Approval Request",
      message: `${request.submittedByName} submitted a ${request.requestType} for approval.`,
      type: "approval_request",
      priority: request.riskLevel === "critical" ? "critical" : "high",
      recordType: "approval_request",
      recordId: newReq.id,
      targetRole: "Admin",
    });

    await logService.add({
      action: "APPROVAL_REQUEST_SUBMITTED",
      userId: request.submittedByStaffId,
      entityType: request.recordType,
      entityId: request.recordId,
      details: { requestType: request.requestType, approvalId: newReq.id },
    });
  },

  approveRequest: async (
    id: string,
    managerId: string,
    comment?: string,
  ): Promise<void> => {
    const all = await approvalService.getAll();
    const req = all.find((r) => r.id === id);
    if (req) {
      req.status = "approved";
      req.reviewedAt = new Date().toISOString();
      req.reviewedByStaffId = managerId;
      req.managerComment = comment;
      await getStorageAdapter().setItem(STORAGE_KEY, all);
    }
  },

  rejectRequest: async (
    id: string,
    managerId: string,
    comment?: string,
  ): Promise<void> => {
    const all = await approvalService.getAll();
    const req = all.find((r) => r.id === id);
    if (req) {
      req.status = "rejected";
      req.reviewedAt = new Date().toISOString();
      req.reviewedByStaffId = managerId;
      req.managerComment = comment;
      await getStorageAdapter().setItem(STORAGE_KEY, all);
    }
  },

  returnForCorrection: async (
    id: string,
    managerId: string,
    correctionNotes: string,
  ): Promise<void> => {
    const all = await approvalService.getAll();
    const req = all.find((r) => r.id === id);
    if (req) {
      req.status = "returned_for_correction";
      req.reviewedAt = new Date().toISOString();
      req.reviewedByStaffId = managerId;
      req.correctionNotes = correctionNotes;
      await getStorageAdapter().setItem(STORAGE_KEY, all);
    }
  },
};
