/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { analyticsService } from "./analyticsService.ts";

export const logService = {
  getAll: analyticsService.getEvents,
  add: async (log: any) => {
    // Adapter for old userId based calls
    const actorType =
      log.userId === "admin" || log.userId?.includes("ADM")
        ? "admin"
        : "system";
    void analyticsService.logEvent({
      eventType: (log.action || "SYSTEM_EVENT") as any,
      actorType: actorType as any,
      actorName: log.userId || "System",
      details: log.details,
      vendorId: log.entityType === "vendor" ? log.entityId : null,
      productId: log.entityType === "product" ? log.entityId : null,
    });
  },
  clear: analyticsService.clearEvents,
};
