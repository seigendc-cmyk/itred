/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Subscription, CollectionRecord } from '../types.ts';
import { localStorageService } from './localStorageService.ts';

const SUBSCRIPTIONS_KEY = 'itred_subscriptions';
const COLLECTIONS_KEY = 'itred_collections';

export const subscriptionService = {
  // Subscriptions
  getAllSubscriptions: (): Subscription[] => {
    return localStorageService.get<Subscription[]>(SUBSCRIPTIONS_KEY) || [];
  },

  getSubscriptionById: (id: string): Subscription | undefined => {
    return subscriptionService.getAllSubscriptions().find(s => s.id === id);
  },

  getSubscriptionByVendor: (vendorId: string): Subscription | undefined => {
    return subscriptionService.getAllSubscriptions().find(s => s.vendorId === vendorId);
  },

  saveSubscription: (sub: Subscription): void => {
    const subs = subscriptionService.getAllSubscriptions();
    const index = subs.findIndex(s => s.id === sub.id);
    if (index >= 0) {
      subs[index] = { ...sub, updatedAt: new Date().toISOString() };
    } else {
      subs.push({ ...sub, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    localStorageService.set(SUBSCRIPTIONS_KEY, subs);
  },

  deleteSubscription: (id: string): void => {
    const subs = subscriptionService.getAllSubscriptions().filter(s => s.id !== id);
    localStorageService.set(SUBSCRIPTIONS_KEY, subs);
  },

  // Collections
  getAllCollections: (): CollectionRecord[] => {
    return localStorageService.get<CollectionRecord[]>(COLLECTIONS_KEY) || [];
  },

  saveCollection: (record: CollectionRecord): void => {
    const collections = subscriptionService.getAllCollections();
    const index = collections.findIndex(c => c.id === record.id);
    if (index >= 0) {
      collections[index] = record;
    } else {
      collections.push({ ...record, createdAt: new Date().toISOString() });
    }
    localStorageService.set(COLLECTIONS_KEY, collections);

    // If it's a new approved collection, we might want to update the subscription status
    if (record.status === 'approved') {
      const sub = subscriptionService.getSubscriptionByVendor(record.vendorId);
      if (sub) {
        sub.status = 'paid';
        sub.lastPaymentDate = record.collectionDate;
        sub.lastCollectionAmount = record.amountCollected;
        sub.collectionMethod = record.collectionMethod;
        subscriptionService.saveSubscription(sub);
      }
    }
  },

  approveCollection: (collectionId: string, adminId: string): void => {
    const collections = subscriptionService.getAllCollections();
    const index = collections.findIndex(c => c.id === collectionId);
    if (index >= 0) {
      const record = collections[index];
      record.status = 'approved';
      record.approvedBy = adminId;
      record.approvedAt = new Date().toISOString();
      subscriptionService.saveCollection(record);
    }
  }
};
