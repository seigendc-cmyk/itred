/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityLog } from "../types.ts";
import { asArray } from "../utils/safeData.ts";
import { getStorageAdapter } from "./storageService.ts";

const EVENTS_KEY = "itred_activity_logs";

export const analyticsService = {
  getEvents: async (): Promise<ActivityLog[]> => {
    const data = await getStorageAdapter().getItem<ActivityLog[]>(EVENTS_KEY);
    return asArray<ActivityLog>(data);
  },

  logEvent: async (
    event: Omit<ActivityLog, "id" | "timestamp">,
  ): Promise<void> => {
    const events = await analyticsService.getEvents();
    const newEvent: ActivityLog = {
      ...event,
      id: `EV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };
    events.unshift(newEvent); // Newest first
    // Keep last 5000 events
    const limitedEvents = events.slice(0, 5000);
    await getStorageAdapter().setItem(EVENTS_KEY, limitedEvents);
  },

  clearEvents: async (): Promise<void> => {
    await getStorageAdapter().removeItem(EVENTS_KEY);
  },
};
