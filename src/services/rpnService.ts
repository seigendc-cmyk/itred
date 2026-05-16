/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RPN, FieldCollectionRecord, MarketingCampaign } from "../types.ts";
import { localStorageService } from "./localStorageService.ts";
import { analyticsService } from "./analyticsService.ts";
import { asArray } from "../utils/safeData.ts";

const RPN_KEY = "itred_rpns";
const COLLECTIONS_KEY = "itred_field_collections";
const CAMPAIGNS_KEY = "itred_marketing_campaigns";

export const rpnService = {
  getAll: (): RPN[] => {
    return asArray<RPN>(localStorageService.get<RPN[]>(RPN_KEY));
  },

  saveAll: (rpns: RPN[]): void => {
    localStorageService.set(RPN_KEY, rpns);
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
};
