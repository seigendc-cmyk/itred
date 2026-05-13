/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import {
  WhatsAppActivityLog,
  WhatsAppActivityType,
  WhatsAppSourceType,
  WhatsAppSource,
} from "../types.ts";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
import { whatsappSourceService } from "../services/whatsappSourceService.ts";
import { notificationService } from "../services/notificationService.ts";
import { PrimaryButton, SecondaryButton } from "./CommonUI.tsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: Partial<WhatsAppActivityLog>;
  onSaved?: () => void;
}

export const WhatsAppActivityQuickLog: React.FC<Props> = ({
  isOpen,
  onClose,
  initialData,
  onSaved,
}) => {
  const [formData, setFormData] = useState<Partial<WhatsAppActivityLog>>({});
  const [sources, setSources] = useState<WhatsAppSource[]>([]);
  const [sourceSearch, setSourceSearch] = useState("");
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [newSourceData, setNewSourceData] = useState<Partial<WhatsAppSource>>(
    {},
  );

  const sessionStr = localStorage.getItem("activeStaffSession");
  let session: any = {};
  if (sessionStr) {
    try {
      session = JSON.parse(sessionStr);
    } catch (e) {}
  }

  useEffect(() => {
    if (isOpen) {
      setFormData({
        activityDate: new Date().toISOString().split("T")[0],
        sourceType: "WHATSAPP_GROUP",
        ...initialData,
      });
      setSourceSearch(initialData.sourceName || "");
      setSources(whatsappSourceService.getSources());
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const cleanObj = (obj: any) => {
    const cleaned = { ...obj };
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === undefined) delete cleaned[key];
    });
    return cleaned;
  };

  const handleSave = () => {
    if (!formData.sourceType || !formData.sourceName) {
      notificationService.toast(
        "Source Type and Source Name are required fields.",
        "info",
      );
      return;
    }

    const logToSave: WhatsAppActivityLog = {
      id: `WA-${Date.now()}`,
      activityDate:
        formData.activityDate || new Date().toISOString().split("T")[0],
      activityType: formData.activityType || "OTHER",
      sourceType: formData.sourceType as WhatsAppSourceType,
      sourceName: formData.sourceName || "Unspecified WhatsApp Source",
      sourceId: formData.sourceId,
      communityId: formData.communityId,
      communityName: formData.communityName,
      whatsappUrl: formData.whatsappUrl || "",
      sector: formData.sector || "",
      category: formData.category || "",
      province: formData.province || "",
      cityTown: formData.cityTown || "",
      district: formData.district || "",
      vendorId: formData.vendorId || "",
      vendorName: formData.vendorName || "",
      catalogueId: formData.catalogueId || "",
      storefrontId: formData.storefrontId || "",
      productName: formData.productName || "",
      customerNeed: formData.customerNeed || "",
      leadStatus: formData.leadStatus || "NOT_APPLICABLE",
      priority: formData.priority || "MEDIUM",
      enquiryCount: Number(formData.enquiryCount) || 0,
      responseStatus: formData.responseStatus || "NOT_REQUIRED",
      assignedRpnName: formData.assignedRpnName || "",
      loggedBy: "System",
      notes: formData.notes || "",
      followUpRequired: !!formData.followUpRequired,
      followUpDate: formData.followUpDate || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      capturedByStaffId:
        formData.capturedByStaffId || session.staffId || "unknown",
      capturedByStaffName:
        formData.capturedByStaffName || session.staffName || "Unknown Staff",
      capturedByRole: formData.capturedByRole || session.role || "Unknown Role",
      capturedAt: formData.capturedAt || new Date().toISOString(),
      assignedToType: formData.assignedToType || "RPN",
      assignedStaffId: formData.assignedStaffId || "",
      assignedStaffName: formData.assignedStaffName || "",
    };

    whatsappActivityService.saveLog(cleanObj(logToSave));
    notificationService.toast(
      `WhatsApp ${formData.activityType?.replace("_", " ").toLowerCase() || "activity"} logged successfully.`,
    );
    if (onSaved) onSaved();
    onClose();
  };

  const inputClass =
    "w-full border-2 border-stone-200 p-3 text-xs font-bold outline-none focus:border-brand-orange bg-white rounded-none uppercase";

  const matchingSources = sources.filter((s) => {
    const terms = sourceSearch
      .toLowerCase()
      .split(" ")
      .filter((t) => t.length > 0);
    const text = [
      s.communityName,
      s.sourceName,
      s.sector,
      s.category,
      s.province,
      s.cityTown,
      s.district,
      s.whatsappUrl,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((term) => text.includes(term));
  });

  const handleSelectSource = (s: WhatsAppSource) => {
    setSourceSearch(s.sourceName);
    setFormData({
      ...formData,
      sourceId: s.id,
      sourceName: s.sourceName,
      sourceType: s.sourceType,
      whatsappUrl: s.whatsappUrl || formData.whatsappUrl,
      communityId: s.communityId || formData.communityId,
      communityName: s.communityName || formData.communityName,
      sector: s.sector || formData.sector,
      category: s.category || formData.category,
      province: s.province || formData.province,
      cityTown: s.cityTown || formData.cityTown,
      district: s.district || formData.district,
    });
    setShowSourceDropdown(false);
  };

  const uniqueCommunities = useMemo(() => {
    return Array.from(
      new Set(sources.map((s) => s.communityName).filter(Boolean)),
    ) as string[];
  }, [sources]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-charcoal/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-t-4 border-t-brand-orange">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-charcoal">
              Log WhatsApp Activity
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-brand-charcoal"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6 bg-white flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Source Type *
              </label>
              <select
                className={inputClass}
                value={formData.sourceType || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sourceType: e.target.value as WhatsAppSourceType,
                  })
                }
              >
                <option value="WHATSAPP_COMMUNITY">WhatsApp Community</option>
                <option value="WHATSAPP_GROUP">WhatsApp Group</option>
                <option value="WHATSAPP_CHANNEL">WhatsApp Channel</option>
                <option value="DIRECT_WHATSAPP">Direct WhatsApp</option>
                <option value="BROADCAST_LIST">Broadcast List</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-2 relative">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                WhatsApp Group / Channel *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    className={inputClass}
                    value={sourceSearch}
                    onChange={(e) => {
                      setSourceSearch(e.target.value);
                      setShowSourceDropdown(true);
                      setFormData({
                        ...formData,
                        sourceName: e.target.value,
                        sourceId: undefined,
                      });
                    }}
                    onFocus={() => setShowSourceDropdown(true)}
                    onBlur={() =>
                      setTimeout(() => setShowSourceDropdown(false), 200)
                    }
                    placeholder="Search or type new group..."
                  />
                  {showSourceDropdown && sourceSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-brand-charcoal shadow-2xl max-h-60 overflow-y-auto z-50">
                      {matchingSources.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 border-b border-stone-100 cursor-pointer hover:bg-orange-50 transition-colors"
                          onMouseDown={() => handleSelectSource(s)}
                        >
                          <p className="text-xs font-bold uppercase">
                            {s.sourceName}
                          </p>
                          <p className="text-[10px] text-stone-400 font-bold uppercase truncate">
                            {[
                              s.sourceType,
                              s.communityName,
                              s.sector,
                              s.cityTown,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        </div>
                      ))}
                      <div
                        className="p-3 bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors border-t border-stone-200"
                        onMouseDown={() => {
                          setNewSourceData({
                            sourceName: sourceSearch,
                            sourceType: formData.sourceType || "WHATSAPP_GROUP",
                            status: "active",
                            communityName: formData.communityName || "",
                            sector: formData.sector || "",
                            category: formData.category || "",
                            province: formData.province || "",
                            cityTown: formData.cityTown || "",
                            district: formData.district || "",
                            whatsappUrl: formData.whatsappUrl || "",
                          });
                          setIsSourceModalOpen(true);
                        }}
                      >
                        <p className="text-xs font-bold uppercase text-brand-orange flex items-center gap-2">
                          <Plus size={14} /> Add "{sourceSearch}" as New Group
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Community Name
              </label>
              <input
                list="quicklog-community-list"
                type="text"
                className={inputClass}
                value={formData.communityName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, communityName: e.target.value })
                }
                placeholder="Search community..."
              />
              <datalist id="quicklog-community-list">
                {uniqueCommunities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                WhatsApp URL
              </label>
              <input
                type="url"
                className={inputClass}
                value={formData.whatsappUrl || ""}
                onChange={(e) =>
                  setFormData({ ...formData, whatsappUrl: e.target.value })
                }
                placeholder="https://chat.whatsapp.com/..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Assigned RPN Name
              </label>
              <input
                type="text"
                className={inputClass}
                value={formData.assignedRpnName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, assignedRpnName: e.target.value })
                }
                placeholder="e.g. John Doe"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Enquiry Count
              </label>
              <input
                type="number"
                className={inputClass}
                value={formData.enquiryCount || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enquiryCount: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Activity Type
              </label>
              <select
                className={inputClass}
                value={formData.activityType || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activityType: e.target.value as WhatsAppActivityType,
                  })
                }
              >
                <option value="CATALOGUE_SHARED">Catalogue Shared</option>
                <option value="STOREFRONT_SHARED">Storefront Shared</option>
                <option value="PRODUCT_ENQUIRY">Product Enquiry</option>
                <option value="VENDOR_REFERRAL">Vendor Referral</option>
                <option value="MEMBER_COUNT_UPDATE">Member Count Update</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="p-6 bg-orange-50 border border-orange-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 accent-brand-orange"
                checked={!!formData.followUpRequired}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    followUpRequired: e.target.checked,
                  })
                }
              />
              <span className="text-sm font-bold uppercase text-brand-charcoal">
                Follow-up Required
              </span>
            </label>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-500">
                Follow-up Date
              </label>
              <input
                type="date"
                className={`${inputClass} border-orange-200 bg-white`}
                value={formData.followUpDate || ""}
                onChange={(e) =>
                  setFormData({ ...formData, followUpDate: e.target.value })
                }
                disabled={!formData.followUpRequired}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-stone-400">
              Notes & Context
            </label>
            <textarea
              className={`${inputClass} min-h-[80px] resize-y`}
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional details..."
            />
          </div>
          <div className="space-y-2 pt-4 border-t border-stone-100">
            <label className="text-[10px] font-bold uppercase text-stone-400">
              Captured By (System)
            </label>
            <input
              type="text"
              className={`${inputClass} bg-stone-50 text-stone-500 border-dashed cursor-not-allowed`}
              disabled
              value={
                formData.capturedByStaffName ||
                session.staffName ||
                "Unknown Staff"
              }
            />
          </div>
        </div>
        <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-4 shrink-0">
          <SecondaryButton onClick={onClose} className="flex-1 py-4">
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} className="flex-1 py-4">
            Save Activity
          </PrimaryButton>
        </div>
      </div>

      {isSourceModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-2xl flex flex-col shadow-2xl border-t-4 border-t-brand-orange">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-brand-charcoal">
                Add WhatsApp Group / Channel
              </h2>
              <button
                onClick={() => setIsSourceModalOpen(false)}
                className="text-stone-400 hover:text-brand-charcoal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Source Name / Group *
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.sourceName || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        sourceName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Source Type
                  </label>
                  <select
                    className={inputClass}
                    value={newSourceData.sourceType || "WHATSAPP_GROUP"}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        sourceType: e.target.value as any,
                      })
                    }
                  >
                    <option value="WHATSAPP_COMMUNITY">
                      WhatsApp Community
                    </option>
                    <option value="WHATSAPP_GROUP">WhatsApp Group</option>
                    <option value="WHATSAPP_CHANNEL">WhatsApp Channel</option>
                    <option value="BROADCAST_LIST">Broadcast List</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Community Name
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.communityName || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        communityName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    WhatsApp URL
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.whatsappUrl || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        whatsappUrl: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Sector
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.sector || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        sector: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Category
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.category || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        category: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    Province
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.province || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        province: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400">
                    City / Town
                  </label>
                  <input
                    className={inputClass}
                    value={newSourceData.cityTown || ""}
                    onChange={(e) =>
                      setNewSourceData({
                        ...newSourceData,
                        cityTown: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-4 shrink-0">
              <SecondaryButton
                onClick={() => setIsSourceModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                className="flex-1"
                onClick={() => {
                  if (!newSourceData.sourceName)
                    return alert("Source name required");
                  const sourceToSave: WhatsAppSource = cleanObj({
                    ...newSourceData,
                    id: `WS-${Date.now()}`,
                    sourceType: newSourceData.sourceType || "WHATSAPP_GROUP",
                    status: newSourceData.status || "active",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                  whatsappSourceService.saveSource(sourceToSave);
                  setSources(whatsappSourceService.getSources());
                  handleSelectSource(sourceToSave);
                  setIsSourceModalOpen(false);
                }}
              >
                Save Source & Select
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
