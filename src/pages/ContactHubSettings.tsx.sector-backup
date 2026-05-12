/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { PageHeader, DataPanel, StatusBadge } from "../components/CommonUI.tsx";
import {
  Plus,
  Trash2,
  Save,
  MessageCircle,
  Phone,
  Users,
  Link as LinkIcon,
} from "lucide-react";
import {
  contactHubService,
  CatalogueContactHubSettings,
  WhatsAppCommunityGroupLink,
  MarketingPhoneContact,
  MarketingWhatsappContact,
  WhatsAppGroupStatus,
} from "../services/contactHubService.ts";

const emptySettings: CatalogueContactHubSettings = {
  whatsappCommunityGroups: [],
  marketingPhoneContacts: [],
  marketingWhatsappContacts: [],
  updatedAt: new Date().toISOString(),
};

const createId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const safeString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
};

const normalizeArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as T[];
  }

  return [];
};

const statusOptions: WhatsAppGroupStatus[] = [
  "active",
  "full",
  "dormant",
  "hidden",
];

export const ContactHubSettings: React.FC = () => {
  const [settings, setSettings] =
    useState<CatalogueContactHubSettings>(emptySettings);
  const [activeTab, setActiveTab] = useState<"groups" | "phones" | "whatsapp">(
    "groups",
  );
  const [notice, setNotice] = useState<string>("");

  useEffect(() => {
    try {
      const loaded = contactHubService.getSettings();
      setSettings({
        whatsappCommunityGroups: normalizeArray<WhatsAppCommunityGroupLink>(
          loaded.whatsappCommunityGroups,
        ),
        marketingPhoneContacts: normalizeArray<MarketingPhoneContact>(
          loaded.marketingPhoneContacts,
        ),
        marketingWhatsappContacts: normalizeArray<MarketingWhatsappContact>(
          loaded.marketingWhatsappContacts,
        ),
        updatedAt: loaded.updatedAt || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to load Contact Hub settings", error);
      setSettings(emptySettings);
    }
  }, []);

  const groupCount = useMemo(
    () => settings.whatsappCommunityGroups.length,
    [settings.whatsappCommunityGroups],
  );

  const phoneCount = useMemo(
    () => settings.marketingPhoneContacts.length,
    [settings.marketingPhoneContacts],
  );

  const whatsappCount = useMemo(
    () => settings.marketingWhatsappContacts.length,
    [settings.marketingWhatsappContacts],
  );

  const saveSettings = () => {
    try {
      const saved = contactHubService.saveSettings(settings);
      setSettings(saved);
      setNotice("Catalogue Contact Hub settings saved successfully.");
      setTimeout(() => setNotice(""), 3000);
    } catch (error) {
      console.error("Failed to save Contact Hub settings", error);
      setNotice("Could not save settings. Check console for details.");
    }
  };

  const addWhatsAppGroup = () => {
    if (settings.whatsappCommunityGroups.length >= 50) {
      setNotice("Maximum of 50 WhatsApp Community Group links reached.");
      return;
    }

    const newGroup: WhatsAppCommunityGroupLink = {
      id: createId("wa_group"),
      displayName: "",
      sector: "",
      category: "",
      contactPersonName: "",
      contactPersonRole: "",
      whatsappGroupUrl: "",
      description: "",
      showInCatalogue: true,
      sortOrder: settings.whatsappCommunityGroups.length + 1,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSettings((prev) => ({
      ...prev,
      whatsappCommunityGroups: [...prev.whatsappCommunityGroups, newGroup],
    }));
  };

  const updateWhatsAppGroup = (
    id: string,
    patch: Partial<WhatsAppCommunityGroupLink>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      whatsappCommunityGroups: prev.whatsappCommunityGroups.map((group) =>
        group.id === id
          ? {
              ...group,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : group,
      ),
    }));
  };

  const deleteWhatsAppGroup = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      whatsappCommunityGroups: prev.whatsappCommunityGroups.filter(
        (group) => group.id !== id,
      ),
    }));
  };

  const addPhoneContact = () => {
    if (settings.marketingPhoneContacts.length >= 10) {
      setNotice("Maximum of 10 marketing phone contacts reached.");
      return;
    }

    const newContact: MarketingPhoneContact = {
      id: createId("phone_contact"),
      contactPersonName: "",
      roleOrDepartment: "",
      phoneNumber: "",
      label: "",
      availableHours: "",
      showInCatalogue: true,
      sortOrder: settings.marketingPhoneContacts.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSettings((prev) => ({
      ...prev,
      marketingPhoneContacts: [...prev.marketingPhoneContacts, newContact],
    }));
  };

  const updatePhoneContact = (
    id: string,
    patch: Partial<MarketingPhoneContact>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      marketingPhoneContacts: prev.marketingPhoneContacts.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : contact,
      ),
    }));
  };

  const deletePhoneContact = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      marketingPhoneContacts: prev.marketingPhoneContacts.filter(
        (contact) => contact.id !== id,
      ),
    }));
  };

  const addWhatsappContact = () => {
    if (settings.marketingWhatsappContacts.length >= 10) {
      setNotice("Maximum of 10 marketing WhatsApp contacts reached.");
      return;
    }

    const newContact: MarketingWhatsappContact = {
      id: createId("whatsapp_contact"),
      contactPersonName: "",
      roleOrDepartment: "",
      whatsappNumber: "",
      label: "",
      prefilledMessage:
        "Hello, I want more information about SCI Commerce services.",
      showInCatalogue: true,
      sortOrder: settings.marketingWhatsappContacts.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSettings((prev) => ({
      ...prev,
      marketingWhatsappContacts: [
        ...prev.marketingWhatsappContacts,
        newContact,
      ],
    }));
  };

  const updateWhatsappContact = (
    id: string,
    patch: Partial<MarketingWhatsappContact>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      marketingWhatsappContacts: prev.marketingWhatsappContacts.map(
        (contact) =>
          contact.id === id
            ? {
                ...contact,
                ...patch,
                updatedAt: new Date().toISOString(),
              }
            : contact,
      ),
    }));
  };

  const deleteWhatsappContact = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      marketingWhatsappContacts: prev.marketingWhatsappContacts.filter(
        (contact) => contact.id !== id,
      ),
    }));
  };

  return (
    <div className="pb-20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8 mt-8">
        <PageHeader
          title="Catalogue Contact Hub"
          subtitle="Manage WhatsApp Community links, marketing phone contacts, and marketing WhatsApp contacts for exported HTML catalogues."
        />

        <button
          onClick={saveSettings}
          className="btn btn-primary flex items-center gap-2 self-start"
        >
          <Save size={16} />
          Save Settings
        </button>
      </div>

      {notice && (
        <div className="mb-6 p-4 border-2 border-orange-100 bg-orange-50 text-brand-charcoal text-xs font-bold uppercase tracking-widest">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SummaryCard
          label="WhatsApp Community Groups"
          value={`${groupCount}/50`}
          icon={<Users size={20} />}
        />
        <SummaryCard
          label="Marketing Phone Contacts"
          value={`${phoneCount}/10`}
          icon={<Phone size={20} />}
        />
        <SummaryCard
          label="Marketing WhatsApp Contacts"
          value={`${whatsappCount}/10`}
          icon={<MessageCircle size={20} />}
        />
      </div>

      <div className="flex bg-stone-100 p-1 mb-8 w-full md:w-max">
        <TabButton
          active={activeTab === "groups"}
          label="Community Groups"
          onClick={() => setActiveTab("groups")}
        />
        <TabButton
          active={activeTab === "phones"}
          label="Phone Contacts"
          onClick={() => setActiveTab("phones")}
        />
        <TabButton
          active={activeTab === "whatsapp"}
          label="WhatsApp Contacts"
          onClick={() => setActiveTab("whatsapp")}
        />
      </div>

      {activeTab === "groups" && (
        <DataPanel
          title="WhatsApp Community Groups"
          subtitle="Add up to 50 sector WhatsApp group links to appear inside exported global HTML catalogues."
        >
          <div className="p-6">
            <button
              onClick={addWhatsAppGroup}
              className="btn btn-secondary flex items-center gap-2 mb-6"
              disabled={settings.whatsappCommunityGroups.length >= 50}
            >
              <Plus size={16} />
              Add WhatsApp Group
            </button>

            <div className="space-y-5">
              {settings.whatsappCommunityGroups.length > 0 ? (
                settings.whatsappCommunityGroups.map((group) => (
                  <div
                    key={group.id}
                    className="border-2 border-stone-100 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <LinkIcon size={16} className="text-brand-orange" />
                          <h3 className="text-xs font-bold uppercase tracking-widest">
                            {safeString(
                              group.displayName,
                              "New WhatsApp Group",
                            )}
                          </h3>
                        </div>
                        <StatusBadge
                          status={group.status || "active"}
                          variant={
                            group.status === "hidden" || group.status === "full"
                              ? "warning"
                              : "success"
                          }
                        />
                      </div>

                      <button
                        onClick={() => deleteWhatsAppGroup(group.id)}
                        className="p-2 border border-red-100 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="Display Name"
                        value={group.displayName}
                        onChange={(value) =>
                          updateWhatsAppGroup(group.id, {
                            displayName: value,
                          })
                        }
                      />
                      <Field
                        label="Sector"
                        value={group.sector}
                        onChange={(value) =>
                          updateWhatsAppGroup(group.id, { sector: value })
                        }
                      />
                      <Field
                        label="Category"
                        value={group.category || ""}
                        onChange={(value) =>
                          updateWhatsAppGroup(group.id, { category: value })
                        }
                      />
                      <Field
                        label="Contact Person Name"
                        value={group.contactPersonName}
                        onChange={(value) =>
                          updateWhatsAppGroup(group.id, {
                            contactPersonName: value,
                          })
                        }
                      />
                      <Field
                        label="Contact Person Role"
                        value={group.contactPersonRole || ""}
                        onChange={(value) =>
                          updateWhatsAppGroup(group.id, {
                            contactPersonRole: value,
                          })
                        }
                      />
                      <Field
                        label="WhatsApp Group URL"
                        value={group.whatsappGroupUrl}
                        onChange={(value) =>
                          updateWhatsAppGroup(group.id, {
                            whatsappGroupUrl: value,
                          })
                        }
                      />
                      <Field
                        label="Sort Order"
                        type="number"
                        value={String(group.sortOrder || 0)}
                        onChange={(value) =>
                          updateWhatsAppGroup(group.id, {
                            sortOrder: Number(value || 0),
                          })
                        }
                      />
                      <div>
                        <label className="form-label">Status</label>
                        <select
                          className="form-input"
                          value={group.status}
                          onChange={(e) =>
                            updateWhatsAppGroup(group.id, {
                              status: e.target.value as WhatsAppGroupStatus,
                            })
                          }
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-input min-h-[90px]"
                          value={group.description || ""}
                          onChange={(e) =>
                            updateWhatsAppGroup(group.id, {
                              description: e.target.value,
                            })
                          }
                        />
                      </div>

                      <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={group.showInCatalogue === true}
                          onChange={(e) =>
                            updateWhatsAppGroup(group.id, {
                              showInCatalogue: e.target.checked,
                            })
                          }
                        />
                        Show in Catalogue
                      </label>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No WhatsApp Community Groups added yet." />
              )}
            </div>
          </div>
        </DataPanel>
      )}

      {activeTab === "phones" && (
        <DataPanel
          title="Marketing Phone Contacts"
          subtitle="Add up to 10 call contacts to appear in exported catalogues."
        >
          <div className="p-6">
            <button
              onClick={addPhoneContact}
              className="btn btn-secondary flex items-center gap-2 mb-6"
              disabled={settings.marketingPhoneContacts.length >= 10}
            >
              <Plus size={16} />
              Add Phone Contact
            </button>

            <div className="space-y-5">
              {settings.marketingPhoneContacts.length > 0 ? (
                settings.marketingPhoneContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    title={safeString(
                      contact.contactPersonName,
                      "New Phone Contact",
                    )}
                    icon={<Phone size={16} />}
                    onDelete={() => deletePhoneContact(contact.id)}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="Contact Person Name"
                        value={contact.contactPersonName}
                        onChange={(value) =>
                          updatePhoneContact(contact.id, {
                            contactPersonName: value,
                          })
                        }
                      />
                      <Field
                        label="Role / Department"
                        value={contact.roleOrDepartment}
                        onChange={(value) =>
                          updatePhoneContact(contact.id, {
                            roleOrDepartment: value,
                          })
                        }
                      />
                      <Field
                        label="Phone Number"
                        value={contact.phoneNumber}
                        onChange={(value) =>
                          updatePhoneContact(contact.id, {
                            phoneNumber: value,
                          })
                        }
                      />
                      <Field
                        label="Label"
                        value={contact.label || ""}
                        onChange={(value) =>
                          updatePhoneContact(contact.id, { label: value })
                        }
                      />
                      <Field
                        label="Available Hours"
                        value={contact.availableHours || ""}
                        onChange={(value) =>
                          updatePhoneContact(contact.id, {
                            availableHours: value,
                          })
                        }
                      />
                      <Field
                        label="Sort Order"
                        type="number"
                        value={String(contact.sortOrder || 0)}
                        onChange={(value) =>
                          updatePhoneContact(contact.id, {
                            sortOrder: Number(value || 0),
                          })
                        }
                      />

                      <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={contact.showInCatalogue === true}
                          onChange={(e) =>
                            updatePhoneContact(contact.id, {
                              showInCatalogue: e.target.checked,
                            })
                          }
                        />
                        Show in Catalogue
                      </label>
                    </div>
                  </ContactCard>
                ))
              ) : (
                <EmptyState message="No marketing phone contacts added yet." />
              )}
            </div>
          </div>
        </DataPanel>
      )}

      {activeTab === "whatsapp" && (
        <DataPanel
          title="Marketing WhatsApp Contacts"
          subtitle="Add up to 10 WhatsApp contacts to appear in exported catalogues."
        >
          <div className="p-6">
            <button
              onClick={addWhatsappContact}
              className="btn btn-secondary flex items-center gap-2 mb-6"
              disabled={settings.marketingWhatsappContacts.length >= 10}
            >
              <Plus size={16} />
              Add WhatsApp Contact
            </button>

            <div className="space-y-5">
              {settings.marketingWhatsappContacts.length > 0 ? (
                settings.marketingWhatsappContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    title={safeString(
                      contact.contactPersonName,
                      "New WhatsApp Contact",
                    )}
                    icon={<MessageCircle size={16} />}
                    onDelete={() => deleteWhatsappContact(contact.id)}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field
                        label="Contact Person Name"
                        value={contact.contactPersonName}
                        onChange={(value) =>
                          updateWhatsappContact(contact.id, {
                            contactPersonName: value,
                          })
                        }
                      />
                      <Field
                        label="Role / Department"
                        value={contact.roleOrDepartment}
                        onChange={(value) =>
                          updateWhatsappContact(contact.id, {
                            roleOrDepartment: value,
                          })
                        }
                      />
                      <Field
                        label="WhatsApp Number"
                        value={contact.whatsappNumber}
                        onChange={(value) =>
                          updateWhatsappContact(contact.id, {
                            whatsappNumber: value,
                          })
                        }
                      />
                      <Field
                        label="Label"
                        value={contact.label || ""}
                        onChange={(value) =>
                          updateWhatsappContact(contact.id, {
                            label: value,
                          })
                        }
                      />
                      <Field
                        label="Sort Order"
                        type="number"
                        value={String(contact.sortOrder || 0)}
                        onChange={(value) =>
                          updateWhatsappContact(contact.id, {
                            sortOrder: Number(value || 0),
                          })
                        }
                      />

                      <div className="md:col-span-2">
                        <label className="form-label">
                          Pre-filled WhatsApp Message
                        </label>
                        <textarea
                          className="form-input min-h-[90px]"
                          value={contact.prefilledMessage || ""}
                          onChange={(e) =>
                            updateWhatsappContact(contact.id, {
                              prefilledMessage: e.target.value,
                            })
                          }
                        />
                      </div>

                      <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                        <input
                          type="checkbox"
                          checked={contact.showInCatalogue === true}
                          onChange={(e) =>
                            updateWhatsappContact(contact.id, {
                              showInCatalogue: e.target.checked,
                            })
                          }
                        />
                        Show in Catalogue
                      </label>
                    </div>
                  </ContactCard>
                ))
              ) : (
                <EmptyState message="No marketing WhatsApp contacts added yet." />
              )}
            </div>
          </div>
        </DataPanel>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="bg-white border-2 border-stone-100 p-6">
    <div className="text-brand-orange mb-4">{icon}</div>
    <div className="text-2xl font-black tracking-tighter text-brand-charcoal">
      {value}
    </div>
    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 mt-1">
      {label}
    </div>
  </div>
);

const TabButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
      active ? "bg-white shadow-sm text-brand-charcoal" : "text-stone-400"
    }`}
  >
    {label}
  </button>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}> = ({ label, value, onChange, type = "text" }) => (
  <div>
    <label className="form-label">{label}</label>
    <input
      type={type}
      className="form-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const ContactCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  onDelete: () => void;
  children: React.ReactNode;
}> = ({ title, icon, onDelete, children }) => (
  <div className="border-2 border-stone-100 bg-white p-5">
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-center gap-2">
        <div className="text-brand-orange">{icon}</div>
        <h3 className="text-xs font-bold uppercase tracking-widest">{title}</h3>
      </div>

      <button
        onClick={onDelete}
        className="p-2 border border-red-100 text-red-500 hover:bg-red-50"
      >
        <Trash2 size={16} />
      </button>
    </div>

    {children}
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-8 border-2 border-dashed border-stone-200 text-center">
    <p className="text-xs text-stone-400 italic">{message}</p>
  </div>
);
