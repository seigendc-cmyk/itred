/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalRequest } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { notificationService } from "./notificationService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { taskService } from "./taskService.ts";
import { vendorService } from "./vendorService.ts";
import { productService } from "./productService.ts";
import { catalogueService } from "./catalogueService.ts";
import { rpnService } from "./rpnService.ts";

const STORAGE_KEY = "itred_approval_requests";

export const approvalService = {
  getAll: async (): Promise<ApprovalRequest[]> => {
    const data =
      await getStorageAdapter().getItem<ApprovalRequest[]>(STORAGE_KEY);
    return data || [];
  },

  getPending: async (): Promise<ApprovalRequest[]> => {
    const all = await approvalService.getAll();
    return all.filter((r) => r.status === "pending");
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
      createdByStaffId: request.submittedByStaffId,
      createdByName: request.submittedByName,
      targetRole: "Admin", // Can be enhanced later depending on requestType
    });

    void staffAuditService.logAction({
      eventType: "APPROVAL_SUBMITTED",
      module: "approval",
      action: `Submitted ${request.requestType} approval request`,
      severity:
        request.riskLevel === "critical"
          ? "critical"
          : request.riskLevel === "high"
            ? "high"
            : "info",
      recordType: request.recordType,
      recordId: request.recordId,
      recordName: request.recordName,
    });
  },

  approveRequest: async (
    id: string,
    managerId: string,
    managerName: string,
    comment?: string,
  ): Promise<void> => {
    const all = await approvalService.getAll();
    const req = all.find((r) => r.id === id);
    if (req) {
      req.status = "approved";
      req.reviewedAt = new Date().toISOString();
      req.reviewedByStaffId = managerId;
      req.reviewedByName = managerName;
      req.managerComment = comment;
      await getStorageAdapter().setItem(STORAGE_KEY, all);

      try {
        if (
          req.requestType === "vendor_create" ||
          req.requestType === "vendor_update"
        ) {
          if (req.afterSnapshot) {
            const v = { ...req.afterSnapshot };
            if (v.status === "pending_review") v.status = "active";
            await vendorService.updateVendor(v);
          }
        } else if (
          req.requestType === "product_create" ||
          req.requestType === "product_update"
        ) {
          if (req.afterSnapshot) {
            const p = { ...req.afterSnapshot };
            if (p.status === "pending_review") p.status = "active";
            await productService.saveProduct(p);
          }
        } else if (req.requestType === "catalogue_deploy") {
          await catalogueService.markAsDeployed(req.recordId);
        } else if (req.requestType === "rpn_agent_update") {
          if (req.afterSnapshot) {
            await rpnService.update(req.afterSnapshot);
          }
        }
      } catch (err) {
        console.error("Failed to apply approved snapshot", err);
      }

      try {
        const notifs = await notificationService.getAll();
        const relatedNotif = notifs.find(
          (n) =>
            n.recordType === "approval_request" &&
            n.recordId === req.id &&
            n.status === "unread",
        );
        if (relatedNotif) {
          await notificationService.markAsResolved(relatedNotif.id);
        }
      } catch (err) {}

      await notificationService.createNotification({
        title: "Approval Granted",
        message: `Your ${req.requestType} request was approved.`,
        type: "approval_request",
        priority: "low",
        recordType: "approval_request",
        recordId: req.id,
        assignedToStaffId: req.submittedByStaffId,
        assignedToName: req.submittedByName,
        createdByStaffId: managerId,
        createdByName: managerName,
      });

      void staffAuditService.logAction({
        eventType: "APPROVAL_APPROVED",
        module: "approval",
        action: `Approved request ${req.id}`,
        severity: "info",
        recordType: req.recordType,
        recordId: req.recordId,
        recordName: req.recordName,
        managerComment: comment,
      });
    }
  },

  rejectRequest: async (
    id: string,
    managerId: string,
    managerName: string,
    comment?: string,
  ): Promise<void> => {
    const all = await approvalService.getAll();
    const req = all.find((r) => r.id === id);
    if (req) {
      req.status = "rejected";
      req.reviewedAt = new Date().toISOString();
      req.reviewedByStaffId = managerId;
      req.reviewedByName = managerName;
      req.managerComment = comment;
      await getStorageAdapter().setItem(STORAGE_KEY, all);

      await notificationService.createNotification({
        title: "Approval Rejected",
        message: `Your ${req.requestType} request was rejected by ${managerName}.`,
        type: "approval_request",
        priority: "high",
        recordType: "approval_request",
        recordId: req.id,
        assignedToStaffId: req.submittedByStaffId,
        assignedToName: req.submittedByName,
        createdByStaffId: managerId,
        createdByName: managerName,
      });

      void staffAuditService.logAction({
        eventType: "APPROVAL_REJECTED",
        module: "approval",
        action: `Rejected request ${req.id}`,
        severity: "warning",
        recordType: req.recordType,
        recordId: req.recordId,
        recordName: req.recordName,
        managerComment: comment,
      });
    }
  },

  returnForCorrection: async (
    id: string,
    managerId: string,
    managerName: string,
    correctionNotes: string,
  ): Promise<void> => {
    const all = await approvalService.getAll();
    const req = all.find((r) => r.id === id);
    if (req) {
      req.status = "returned_for_correction";
      req.reviewedAt = new Date().toISOString();
      req.reviewedByStaffId = managerId;
      req.reviewedByName = managerName;
      req.correctionNotes = correctionNotes;
      await getStorageAdapter().setItem(STORAGE_KEY, all);

      await notificationService.createNotification({
        title: "Correction Required",
        message: `Your ${req.requestType} request was returned. See task board for details.`,
        type: "approval_request",
        priority: "high",
        recordType: "approval_request",
        recordId: req.id,
        assignedToStaffId: req.submittedByStaffId,
        assignedToName: req.submittedByName,
        createdByStaffId: managerId,
        createdByName: managerName,
      });

      await taskService.createTask({
        title: `Correction Required: ${req.requestType}`,
        description: correctionNotes,
        taskType: "catalogue_review",
        assignedToStaffId: req.submittedByStaffId,
        assignedToName: req.submittedByName,
        assignedByStaffId: managerId,
        assignedByName: managerName,
        module: "Approval Queue",
        relatedRecordType: req.recordType,
        relatedRecordId: req.recordId,
        priority: "high",
        dueDate: new Date().toISOString().split("T")[0],
        notes: "",
        reviewNotes: "",
      });

      void staffAuditService.logAction({
        eventType: "APPROVAL_RETURNED",
        module: "approval",
        action: `Returned request ${req.id} for correction`,
        severity: "warning",
        recordType: req.recordType,
        recordId: req.recordId,
        recordName: req.recordName,
        reason: correctionNotes,
      });
    }
  },

  cancelRequest: async (id: string, staffId: string): Promise<void> => {
    const all = await approvalService.getAll();
    const req = all.find((r) => r.id === id);
    if (req && req.submittedByStaffId === staffId && req.status === "pending") {
      req.status = "cancelled";
      await getStorageAdapter().setItem(STORAGE_KEY, all);

      void staffAuditService.logAction({
        eventType: "RECORD_UPDATED",
        module: "approval",
        action: `Cancelled request ${req.id}`,
        severity: "info",
        recordType: req.recordType,
        recordId: req.recordId,
      });
    }
  },
};
