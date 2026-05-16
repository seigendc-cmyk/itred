/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Product,
  StaffTask,
  StaffTaskPriority,
  SystemSettings,
  Vendor,
  VendorReadinessResult,
} from "../types.ts";
import { taskService } from "./taskService.ts";
import { notificationService } from "./notificationService.ts";
import { staffAuditService } from "./staffAuditService.ts";

const dateKey = () => new Date().toISOString().split("T")[0];
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const hasText = (value?: string) => !!String(value || "").trim();
const hasImage = (...values: Array<string | undefined>) =>
  values.some((value) => hasText(value));
const productBelongsToVendor = (product: Product, vendorId: string) =>
  product.vendorId === vendorId;

const priorityForScore = (score: number, threshold: number): StaffTaskPriority => {
  if (score < 50) return "critical";
  if (score < 70) return "high";
  if (score < threshold) return "medium";
  return "low";
};

const priorityToSeverity = (
  priority: StaffTaskPriority,
): "info" | "warning" | "high" | "critical" => {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "medium") return "warning";
  return "info";
};

export const vendorReadinessService = {
  calculateVendorReadiness(
    vendor: Vendor,
    products: Product[],
  ): VendorReadinessResult {
    const vendorProducts = products.filter((product) =>
      productBelongsToVendor(product, vendor.id),
    );
    const activeProducts = vendorProducts.filter(
      (product) => product.status === "active",
    );
    const publishedProducts = activeProducts.filter(
      (product) => product.publishToCatalogue,
    );
    const missingItems: string[] = [];
    const recommendedActions: string[] = [];
    let score = 0;

    if (
      hasText(vendor.name) &&
      hasText(vendor.tradingName || vendor.catalogueDisplayName) &&
      hasText(vendor.ownerFullName) &&
      hasText(vendor.businessType)
    ) {
      score += 15;
    } else {
      missingItems.push("business identity");
      recommendedActions.push("Complete business identity fields.");
    }

    if (hasImage(vendor.logoUrl, vendor.logoAssetUrl, vendor.businessLogoUrl)) {
      score += 10;
    } else {
      missingItems.push("logo");
      recommendedActions.push("Upload vendor logo.");
    }

    if (
      hasImage(vendor.bannerUrl, vendor.bannerAssetUrl, vendor.businessBannerUrl)
    ) {
      score += 10;
    } else {
      missingItems.push("banner");
      recommendedActions.push("Upload vendor banner.");
    }

    if (hasText(vendor.whatsappNumber) || hasText(vendor.mainPhone)) {
      score += 10;
    } else {
      missingItems.push("WhatsApp/contact");
      recommendedActions.push("Add WhatsApp or main phone contact.");
    }

    const hasBranch = (vendor.branches || []).some(
      (branch) =>
        branch.status !== "suspended" &&
        hasText(branch.name) &&
        (hasText(branch.address) ||
          hasText(branch.streetAddress) ||
          hasText(vendor.streetAddress)) &&
        (hasText(branch.cityTown) || hasText(vendor.cityTown)),
    );
    const hasAddress =
      hasText(vendor.country) &&
      hasText(vendor.province) &&
      hasText(vendor.cityTown) &&
      (hasText(vendor.streetAddress) || hasText(vendor.suburb));
    if (hasBranch || hasAddress) {
      score += 15;
    } else {
      missingItems.push("branch/address");
      recommendedActions.push("Complete branch and address details.");
    }

    if (activeProducts.length > 0) {
      score += 15;
    } else {
      missingItems.push("active products");
      recommendedActions.push("Add or activate at least one product.");
    }

    if (publishedProducts.length > 0) {
      score += 10;
    } else {
      missingItems.push("published products");
      recommendedActions.push("Publish approved products to catalogue.");
    }

    if ((vendor.staff || []).some((staff) => hasText(staff.phone) || hasText(staff.whatsapp))) {
      score += 5;
    } else {
      missingItems.push("staff/sales contact");
      recommendedActions.push("Add a sales or staff contact.");
    }

    if (
      (vendor.deliveryStaff || []).some(
        (staff) => hasText(staff.phone) || hasText(staff.whatsapp),
      )
    ) {
      score += 5;
    } else {
      missingItems.push("delivery/contact support");
      recommendedActions.push("Add delivery/contact support.");
    }

    if (hasText(vendor.businessDescription) || hasText(vendor.catalogueSlogan)) {
      score += 5;
    } else {
      missingItems.push("description/terms");
      recommendedActions.push("Add a business description or catalogue terms.");
    }

    const boundedScore = Math.max(0, Math.min(100, score));
    return {
      vendorId: vendor.id,
      vendorName: vendor.name || vendor.tradingName || "Unnamed Vendor",
      score: boundedScore,
      level:
        boundedScore >= 80
          ? "Ready"
          : boundedScore >= 60
            ? "Needs Attention"
            : "Critical",
      missingItems,
      recommendedActions,
    };
  },

  async ensureReadinessTask(
    vendor: Vendor,
    products: Product[],
    settings: SystemSettings,
    reason = "Vendor readiness below threshold.",
  ): Promise<{ result: VendorReadinessResult; task?: StaffTask; skipped: boolean }> {
    const result = vendorReadinessService.calculateVendorReadiness(
      vendor,
      products,
    );
    const enabled = settings.enableReadinessAutoTasks ?? true;
    const threshold = settings.vendorReadinessTaskThreshold ?? 70;
    const cooldownDays = settings.readinessTaskCooldownDays ?? 3;

    if (!enabled || result.score >= threshold) {
      return { result, skipped: true };
    }

    const tasks = await taskService.getAll();
    const cooldownStart = new Date();
    cooldownStart.setDate(cooldownStart.getDate() - cooldownDays);
    const existing = tasks.find(
      (task) =>
        task.taskType === "vendor_readiness" &&
        task.vendorId === vendor.id &&
        !["completed", "reviewed", "cancelled"].includes(task.status) &&
        new Date(task.createdAt).getTime() >= cooldownStart.getTime(),
    );

    const priority = priorityForScore(result.score, threshold);
    const description = `Vendor readiness score is ${result.score}/100. Missing: ${
      result.missingItems.join(", ") || "No missing items listed"
    }. Complete the required profile and product readiness fields. ${reason}`;

    if (existing) {
      return { result, task: existing, skipped: true };
    }

    const task = await taskService.createTask({
      title: `Improve vendor readiness: ${result.vendorName}`,
      description,
      taskType: "vendor_readiness",
      assignedToStaffId: "DESK-VENDOR-QC",
      assignedToName: "Vendor Quality Control Desk",
      assignedByStaffId: "SCI-AUTO",
      assignedByName: "SCI Automation",
      module: "vendor_readiness",
      priority,
      dueDate: addDays(priority === "critical" ? 1 : 2),
      vendorId: vendor.id,
      vendorName: result.vendorName,
      assignedDesk: "Backoffice / Vendor Quality Control",
      sourceModule: "vendor_readiness",
      metadata: {
        score: result.score,
        level: result.level,
        missingItems: result.missingItems,
        recommendedActions: result.recommendedActions,
        reason,
      },
    });

    await Promise.allSettled([
      notificationService.createNotification({
        type: "vendor_readiness",
        priority,
        title: "Vendor readiness below threshold",
        message: `${result.vendorName} readiness is ${result.score}/100. Staff task created.`,
        targetRole: "Backoffice",
        recordType: "vendor",
        recordId: vendor.id,
        dedupeKey: `vendor_readiness:${vendor.id}:${dateKey()}`,
      }),
      staffAuditService.logAction({
        eventType: "STAFF_TASK_CREATED",
        module: "vendor_readiness",
        severity: priorityToSeverity(priority),
        action: "Auto-created vendor readiness task",
        recordType: "vendor",
        recordId: vendor.id,
        recordName: result.vendorName,
        afterSnapshot: { result, taskId: task.id },
      }),
    ]);

    return { result, task, skipped: false };
  },
};
