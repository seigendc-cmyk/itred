/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStorageAdapter } from "./storageService.ts";
import { generateCAHLinkId } from "../utils/idGenerator.ts";

export type WhatsAppGroupStatus = "active" | "full" | "dormant" | "hidden";

export interface WhatsAppCommunityGroupLink {
  id: string;
  displayName: string;
  sector: string;
  category?: string;
  contactPersonName: string;
  contactPersonRole?: string;
  whatsappGroupUrl: string;
  description?: string;
  showInCatalogue: boolean;
  sortOrder: number;
  status: WhatsAppGroupStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingPhoneContact {
  id: string;
  contactPersonName: string;
  roleOrDepartment: string;
  phoneNumber: string;
  label?: string;
  availableHours?: string;
  showInCatalogue: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingWhatsappContact {
  id: string;
  contactPersonName: string;
  roleOrDepartment: string;
  whatsappNumber: string;
  label?: string;
  prefilledMessage?: string;
  showInCatalogue: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogueContactHubSettings {
  whatsappCommunityGroups: WhatsAppCommunityGroupLink[];
  marketingPhoneContacts: MarketingPhoneContact[];
  marketingWhatsappContacts: MarketingWhatsappContact[];
  updatedAt?: string;
}

const CONTACT_HUB_KEY = "itred_catalogue_contact_hub_settings";

const normalizeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as T[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj.data)) return obj.data.filter(Boolean) as T[];
  if (Array.isArray(obj.items)) return obj.items.filter(Boolean) as T[];
  if (Array.isArray(obj.docs)) return obj.docs.filter(Boolean) as T[];
  if (Array.isArray(obj.results)) return obj.results.filter(Boolean) as T[];
  if (Array.isArray(obj.whatsappCommunityGroups)) {
    return obj.whatsappCommunityGroups.filter(Boolean) as T[];
  }
  if (Array.isArray(obj.marketingPhoneContacts)) {
    return obj.marketingPhoneContacts.filter(Boolean) as T[];
  }
  if (Array.isArray(obj.marketingWhatsappContacts)) {
    return obj.marketingWhatsappContacts.filter(Boolean) as T[];
  }

  return [];
};

const safeString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
};

const safeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const nowIso = (): string => new Date().toISOString();

const createId = (prefix: string): string => {
  return generateCAHLinkId().replace("CAH", prefix.toUpperCase());
};

const cleanPhoneNumber = (value: string): string => {
  return safeString(value)
    .replace(/\+/g, "")
    .replace(/\s/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");
};

const sortByOrder = <T extends { sortOrder?: number }>(items: T[]): T[] => {
  return [...items].sort(
    (a, b) => safeNumber(a.sortOrder, 999) - safeNumber(b.sortOrder, 999),
  );
};

const getEmptySettings = (): CatalogueContactHubSettings => ({
  whatsappCommunityGroups: [],
  marketingPhoneContacts: [],
  marketingWhatsappContacts: [],
  updatedAt: nowIso(),
});

const normaliseSettings = (raw: unknown): CatalogueContactHubSettings => {
  if (!raw || typeof raw !== "object") {
    return getEmptySettings();
  }

  const data = raw as Partial<CatalogueContactHubSettings>;

  return {
    whatsappCommunityGroups: normalizeArray<WhatsAppCommunityGroupLink>(
      data.whatsappCommunityGroups,
    ),
    marketingPhoneContacts: normalizeArray<MarketingPhoneContact>(
      data.marketingPhoneContacts,
    ),
    marketingWhatsappContacts: normalizeArray<MarketingWhatsappContact>(
      data.marketingWhatsappContacts,
    ),
    updatedAt: safeString(data.updatedAt, nowIso()),
  };
};

export const contactHubService = {
  getSettings(): CatalogueContactHubSettings {
    try {
      const raw =
        getStorageAdapter().getItem<CatalogueContactHubSettings>(
          CONTACT_HUB_KEY,
        );

      return normaliseSettings(raw);
    } catch (error) {
      console.error("Failed to load contact hub settings", error);
      return getEmptySettings();
    }
  },

  saveSettings(
    settings: CatalogueContactHubSettings,
  ): CatalogueContactHubSettings {
    const cleaned: CatalogueContactHubSettings = {
      whatsappCommunityGroups: sortByOrder(
        normalizeArray<WhatsAppCommunityGroupLink>(
          settings.whatsappCommunityGroups,
        ).slice(0, 50),
      ),
      marketingPhoneContacts: sortByOrder(
        normalizeArray<MarketingPhoneContact>(
          settings.marketingPhoneContacts,
        ).slice(0, 10),
      ),
      marketingWhatsappContacts: sortByOrder(
        normalizeArray<MarketingWhatsappContact>(
          settings.marketingWhatsappContacts,
        ).slice(0, 10),
      ),
      updatedAt: nowIso(),
    };

    getStorageAdapter().setItem(CONTACT_HUB_KEY, cleaned);
    return cleaned;
  },

  getCatalogueContactHub(): CatalogueContactHubSettings {
    const settings = this.getSettings();

    return {
      whatsappCommunityGroups: sortByOrder(
        normalizeArray<WhatsAppCommunityGroupLink>(
          settings.whatsappCommunityGroups,
        )
          .filter((group) => group.showInCatalogue === true)
          .filter((group) => group.status !== "hidden")
          .slice(0, 50),
      ),
      marketingPhoneContacts: sortByOrder(
        normalizeArray<MarketingPhoneContact>(settings.marketingPhoneContacts)
          .filter((contact) => contact.showInCatalogue === true)
          .slice(0, 10),
      ),
      marketingWhatsappContacts: sortByOrder(
        normalizeArray<MarketingWhatsappContact>(
          settings.marketingWhatsappContacts,
        )
          .filter((contact) => contact.showInCatalogue === true)
          .slice(0, 10),
      ),
      updatedAt: settings.updatedAt || nowIso(),
    };
  },

  addWhatsAppGroup(
    input: Omit<WhatsAppCommunityGroupLink, "id" | "createdAt" | "updatedAt">,
  ): CatalogueContactHubSettings {
    const settings = this.getSettings();

    if (settings.whatsappCommunityGroups.length >= 50) {
      throw new Error("Maximum of 50 WhatsApp community group links allowed.");
    }

    const record: WhatsAppCommunityGroupLink = {
      id: createId("wa_group"),
      displayName: safeString(input.displayName, "Unnamed Group"),
      sector: safeString(input.sector, "General"),
      category: safeString(input.category),
      contactPersonName: safeString(input.contactPersonName, "SCI Contact"),
      contactPersonRole: safeString(input.contactPersonRole),
      whatsappGroupUrl: safeString(input.whatsappGroupUrl),
      description: safeString(input.description),
      showInCatalogue: input.showInCatalogue === true,
      sortOrder: safeNumber(
        input.sortOrder,
        settings.whatsappCommunityGroups.length + 1,
      ),
      status: input.status || "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    if (!record.whatsappGroupUrl) {
      throw new Error("WhatsApp Group URL is required.");
    }

    return this.saveSettings({
      ...settings,
      whatsappCommunityGroups: [...settings.whatsappCommunityGroups, record],
    });
  },

  addMarketingPhoneContact(
    input: Omit<MarketingPhoneContact, "id" | "createdAt" | "updatedAt">,
  ): CatalogueContactHubSettings {
    const settings = this.getSettings();

    if (settings.marketingPhoneContacts.length >= 10) {
      throw new Error("Maximum of 10 marketing phone contacts allowed.");
    }

    const record: MarketingPhoneContact = {
      id: createId("phone_contact"),
      contactPersonName: safeString(input.contactPersonName, "SCI Contact"),
      roleOrDepartment: safeString(input.roleOrDepartment, "Marketing"),
      phoneNumber: safeString(input.phoneNumber),
      label: safeString(input.label),
      availableHours: safeString(input.availableHours),
      showInCatalogue: input.showInCatalogue === true,
      sortOrder: safeNumber(
        input.sortOrder,
        settings.marketingPhoneContacts.length + 1,
      ),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    if (!record.phoneNumber) {
      throw new Error("Phone number is required.");
    }

    return this.saveSettings({
      ...settings,
      marketingPhoneContacts: [...settings.marketingPhoneContacts, record],
    });
  },

  addMarketingWhatsappContact(
    input: Omit<MarketingWhatsappContact, "id" | "createdAt" | "updatedAt">,
  ): CatalogueContactHubSettings {
    const settings = this.getSettings();

    if (settings.marketingWhatsappContacts.length >= 10) {
      throw new Error("Maximum of 10 marketing WhatsApp contacts allowed.");
    }

    const record: MarketingWhatsappContact = {
      id: createId("whatsapp_contact"),
      contactPersonName: safeString(input.contactPersonName, "SCI Contact"),
      roleOrDepartment: safeString(input.roleOrDepartment, "Marketing"),
      whatsappNumber: safeString(input.whatsappNumber),
      label: safeString(input.label),
      prefilledMessage: safeString(input.prefilledMessage),
      showInCatalogue: input.showInCatalogue === true,
      sortOrder: safeNumber(
        input.sortOrder,
        settings.marketingWhatsappContacts.length + 1,
      ),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    if (!record.whatsappNumber) {
      throw new Error("WhatsApp number is required.");
    }

    return this.saveSettings({
      ...settings,
      marketingWhatsappContacts: [
        ...settings.marketingWhatsappContacts,
        record,
      ],
    });
  },

  updateWhatsAppGroup(
    id: string,
    patch: Partial<WhatsAppCommunityGroupLink>,
  ): CatalogueContactHubSettings {
    const settings = this.getSettings();

    return this.saveSettings({
      ...settings,
      whatsappCommunityGroups: settings.whatsappCommunityGroups.map((group) =>
        group.id === id
          ? {
              ...group,
              ...patch,
              updatedAt: nowIso(),
            }
          : group,
      ),
    });
  },

  updateMarketingPhoneContact(
    id: string,
    patch: Partial<MarketingPhoneContact>,
  ): CatalogueContactHubSettings {
    const settings = this.getSettings();

    return this.saveSettings({
      ...settings,
      marketingPhoneContacts: settings.marketingPhoneContacts.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              ...patch,
              updatedAt: nowIso(),
            }
          : contact,
      ),
    });
  },

  updateMarketingWhatsappContact(
    id: string,
    patch: Partial<MarketingWhatsappContact>,
  ): CatalogueContactHubSettings {
    const settings = this.getSettings();

    return this.saveSettings({
      ...settings,
      marketingWhatsappContacts: settings.marketingWhatsappContacts.map(
        (contact) =>
          contact.id === id
            ? {
                ...contact,
                ...patch,
                updatedAt: nowIso(),
              }
            : contact,
      ),
    });
  },

  deleteWhatsAppGroup(id: string): CatalogueContactHubSettings {
    const settings = this.getSettings();

    return this.saveSettings({
      ...settings,
      whatsappCommunityGroups: settings.whatsappCommunityGroups.filter(
        (group) => group.id !== id,
      ),
    });
  },

  deleteMarketingPhoneContact(id: string): CatalogueContactHubSettings {
    const settings = this.getSettings();

    return this.saveSettings({
      ...settings,
      marketingPhoneContacts: settings.marketingPhoneContacts.filter(
        (contact) => contact.id !== id,
      ),
    });
  },

  deleteMarketingWhatsappContact(id: string): CatalogueContactHubSettings {
    const settings = this.getSettings();

    return this.saveSettings({
      ...settings,
      marketingWhatsappContacts: settings.marketingWhatsappContacts.filter(
        (contact) => contact.id !== id,
      ),
    });
  },

  cleanPhoneNumber,

  buildWhatsappUrl(number: string, message?: string): string {
    const cleanNumber = cleanPhoneNumber(number);
    const safeMessage = safeString(
      message,
      "Hello, I am interested in SCI Commerce services.",
    );

    if (!cleanNumber) return "#";

    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(safeMessage)}`;
  },

  buildCallUrl(number: string): string {
    const safeNumberValue = safeString(number);

    if (!safeNumberValue) return "#";

    return `tel:${safeNumberValue}`;
  },
};
