﻿/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  RPN,
  FieldCollectionRecord,
  MarketingCampaign,
  RPNAppointment,
  RPNFollowUpTask,
  RPNInvitationPipelineItem,
  RPNProspectQuery,
  RPNWorkflowAnalytics,
} from "../types.ts";
import { localStorageService } from "./localStorageService.ts";
import { analyticsService } from "./analyticsService.ts";
import { asArray } from "../utils/safeData.ts";
import { CACHE_TTL, dataCacheService } from "./dataCacheService.ts";
import { readDiagnosticsService } from "./readDiagnosticsService.ts";
import { getSessionStaffId, getSessionStaffName } from "../utils/session.ts";

const RPN_KEY = "itred_rpns";
const COLLECTIONS_KEY = "itred_field_collections";
const CAMPAIGNS_KEY = "itred_marketing_campaigns";
const PROSPECTS_KEY = "itred_rpn_prospect_queries";
const APPOINTMENTS_KEY = "itred_rpn_appointments";
const FOLLOWUPS_KEY = "itred_rpn_followups";
const INVITATIONS_KEY = "itred_rpn_invitation_pipeline";

const topKey = (rows: string[]) => {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row || "Unspecified";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
};

const upsert = <
  T extends { id: string; createdAt?: string; updatedAt?: string },
>(
  items: T[],
  item: T,
) => {
  const now = new Date().toISOString();
  const next = {
    ...item,
    createdAt: item.createdAt || now,
    updatedAt: now,
  };
  const index = items.findIndex((row) => row.id === item.id);
  if (index >= 0) {
    items[index] = next;
  } else {
    items.push(next);
  }
  return items;
};

const dateOnly = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

export const rpnService = {
  getAll: (): RPN[] => {
    const cached = dataCacheService.getCached<RPN[]>(
      "rpn-list",
      CACHE_TTL.STAFF,
    );
    if (cached) return cached;
    const rpns = asArray<RPN>(localStorageService.get<RPN[]>(RPN_KEY));
    dataCacheService.setCached("rpn-list", rpns);
    readDiagnosticsService.track("rpnService", RPN_KEY, "getAll", rpns.length);
    return rpns;
  },

  saveAll: (rpns: RPN[]): void => {
    localStorageService.set(RPN_KEY, rpns);
    dataCacheService.clearCache("rpn-list");
  },

  getActive: (): RPN[] => {
    return rpnService.getAll().filter((rpn) => rpn.status === "active");
  },

  getRecent: (limit = 100): RPN[] => {
    return rpnService
      .getAll()
      .sort(
        (a, b) =>
          new Date((b as any).updatedAt || b.createdAt || 0).getTime() -
          new Date((a as any).updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, limit);
  },

  getById: (id: string): RPN | undefined => {
    return rpnService.getAll().find((r) => r.id === id);
  },

  update: (rpn: RPN): void => {
    const rpns = rpnService.getAll();
    const index = rpns.findIndex((r) => r.id === rpn.id);
    if (index >= 0) {
      rpns[index] = rpn;
    } else {
      rpns.push(rpn);
    }
    rpnService.saveAll(rpns);
  },

  delete: (id: string): void => {
    const rpns = rpnService.getAll().filter((r) => r.id !== id);
    rpnService.saveAll(rpns);
  },

  // Field Collections
  getCollections: (): FieldCollectionRecord[] => {
    return asArray<FieldCollectionRecord>(
      localStorageService.get<FieldCollectionRecord[]>(COLLECTIONS_KEY),
    );
  },

  saveCollections: (collections: FieldCollectionRecord[]): void => {
    localStorageService.set(COLLECTIONS_KEY, collections);
  },

  getCollectionsByRPN: (rpnId: string): FieldCollectionRecord[] => {
    return asArray<FieldCollectionRecord>(rpnService.getCollections()).filter(
      (c) => c.rpnId === rpnId,
    );
  },

  updateCollection: (record: FieldCollectionRecord): void => {
    const collections = rpnService.getCollections();
    const index = collections.findIndex((c) => c.id === record.id);

    if (index >= 0) {
      collections[index] = record;
    } else {
      collections.push(record);

      analyticsService.logEvent({
        eventType:
          record.type === "follow-up"
            ? "FOLLOW_UP_RECORDED"
            : "FIELD_COLLECTION_RECORDED",
        actorType: "rpn",
        actorName: "Field RPN",
        vendorId: record.vendorId,
        rpnId: record.rpnId,
        details: { type: record.type, rpnId: record.rpnId },
      });
    }
    rpnService.saveCollections(collections);
  },

  getCampaigns: (): MarketingCampaign[] => {
    return asArray<MarketingCampaign>(
      localStorageService.get<MarketingCampaign[]>(CAMPAIGNS_KEY),
    );
  },

  saveCampaigns: (campaigns: MarketingCampaign[]): void => {
    localStorageService.set(CAMPAIGNS_KEY, campaigns);
  },

  saveCampaign: (campaign: MarketingCampaign): void => {
    const campaigns = rpnService.getCampaigns();
    const index = campaigns.findIndex((item) => item.id === campaign.id);
    const nextCampaign = {
      ...campaign,
      updatedAt: new Date().toISOString(),
      createdAt: campaign.createdAt || new Date().toISOString(),
    };
    if (index >= 0) {
      campaigns[index] = nextCampaign;
    } else {
      campaigns.push(nextCampaign);
    }
    rpnService.saveCampaigns(campaigns);
  },

  getProspects: (): RPNProspectQuery[] => {
    return asArray<RPNProspectQuery>(
      localStorageService.get<RPNProspectQuery[]>(PROSPECTS_KEY),
    );
  },

  saveProspects: (prospects: RPNProspectQuery[]): void => {
    localStorageService.set(PROSPECTS_KEY, prospects);
  },

  saveProspect: (prospect: RPNProspectQuery): RPNProspectQuery => {
    const prospects = upsert(rpnService.getProspects(), prospect);
    rpnService.saveProspects(prospects);
    return prospects.find((item) => item.id === prospect.id) || prospect;
  },

  getAppointments: (): RPNAppointment[] => {
    return asArray<RPNAppointment>(
      localStorageService.get<RPNAppointment[]>(APPOINTMENTS_KEY),
    );
  },

  saveAppointments: (appointments: RPNAppointment[]): void => {
    localStorageService.set(APPOINTMENTS_KEY, appointments);
  },

  saveAppointment: (appointment: RPNAppointment): RPNAppointment => {
    const appointments = upsert(rpnService.getAppointments(), appointment);
    rpnService.saveAppointments(appointments);
    return (
      appointments.find((item) => item.id === appointment.id) || appointment
    );
  },

  getFollowUps: (): RPNFollowUpTask[] => {
    return asArray<RPNFollowUpTask>(
      localStorageService.get<RPNFollowUpTask[]>(FOLLOWUPS_KEY),
    );
  },

  saveFollowUps: (tasks: RPNFollowUpTask[]): void => {
    localStorageService.set(FOLLOWUPS_KEY, tasks);
  },

  saveFollowUp: (task: RPNFollowUpTask): RPNFollowUpTask => {
    const tasks = upsert(rpnService.getFollowUps(), task);
    rpnService.saveFollowUps(tasks);
    return tasks.find((item) => item.id === task.id) || task;
  },

  getInvitations: (): RPNInvitationPipelineItem[] => {
    return asArray<RPNInvitationPipelineItem>(
      localStorageService.get<RPNInvitationPipelineItem[]>(INVITATIONS_KEY),
    );
  },

  saveInvitations: (items: RPNInvitationPipelineItem[]): void => {
    localStorageService.set(INVITATIONS_KEY, items);
  },

  saveInvitation: (
    item: RPNInvitationPipelineItem,
  ): RPNInvitationPipelineItem => {
    const items = upsert(rpnService.getInvitations(), item);
    rpnService.saveInvitations(items);
    return items.find((row) => row.id === item.id) || item;
  },

  getWorkflowAnalytics: (): RPNWorkflowAnalytics => {
    const today = new Date().toISOString().split("T")[0];
    const prospects = rpnService.getProspects();
    const appointments = rpnService.getAppointments();
    const followUps = rpnService.getFollowUps();
    const invitations = rpnService.getInvitations();
    const converted = prospects.filter((p) => p.status === "Converted");
    const conversionDurations = converted
      .map((p) => {
        if (!p.conversionDate) return 0;
        const start = new Date(p.createdAt).getTime();
        const end = new Date(p.conversionDate).getTime();
        return Math.max(0, Math.round((end - start) / 86400000));
      })
      .filter((days) => days >= 0);

    return {
      totalProspects: prospects.length,
      prospectsToday: prospects.filter((p) => dateOnly(p.createdAt) === today)
        .length,
      invitationsToday: invitations.filter(
        (item) => dateOnly(item.invitationDate) === today,
      ).length,
      appointmentsBookedToday: appointments.filter(
        (item) => dateOnly(item.createdAt) === today,
      ).length,
      appointmentsCompletedToday: appointments.filter(
        (item) =>
          item.status === "Completed" && dateOnly(item.updatedAt) === today,
      ).length,
      conversionsToday: prospects.filter(
        (p) => p.status === "Converted" && dateOnly(p.conversionDate) === today,
      ).length,
      overdueFollowUps: followUps.filter(
        (task) =>
          task.status !== "Completed" &&
          !!task.dueDate &&
          new Date(task.dueDate).getTime() < Date.now(),
      ).length,
      conversionRate:
        prospects.length > 0
          ? Math.round((converted.length / prospects.length) * 100)
          : 0,
      bestSource: topKey(converted.map((p) => p.querySource)),
      bestSector: topKey(converted.map((p) => p.sector)),
      bestArea: topKey(converted.map((p) => p.suburb || p.city || p.location)),
      averageDaysToConversion:
        conversionDurations.length > 0
          ? Math.round(
              conversionDurations.reduce((sum, days) => sum + days, 0) /
                conversionDurations.length,
            )
          : 0,
    };
  },
};
