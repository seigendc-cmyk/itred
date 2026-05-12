/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  WhatsAppActivityLog,
  WhatsAppActivityType,
  WhatsAppSourceType,
} from "../types.ts";
import { whatsappActivityService } from "../services/whatsappActivityService.ts";
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

  useEffect(() => {
    if (isOpen) {
      setFormData({
        activityDate: new Date().toISOString().split("T")[0],
        sourceType: "WHATSAPP_GROUP",
        ...initialData,
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!formData.sourceType || !formData.sourceName) {
      alert("Source Type and Source Name are required fields.");
      return;
    }

    const logToSave: WhatsAppActivityLog = {
      id: `WA-${Date.now()}`,
      activityDate:
        formData.activityDate || new Date().toISOString().split("T")[0],
      activityType: formData.activityType || "OTHER",
      sourceType: formData.sourceType as WhatsAppSourceType,
      sourceName: formData.sourceName || "Unspecified WhatsApp Source",
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
    };

    whatsappActivityService.saveLog(logToSave);
    alert(
      `WhatsApp ${
        formData.activityType?.replace("_", " ").toLowerCase() || "activity"
      } logged successfully.`,
    );
    if (onSaved) onSaved();
    onClose();
  };

  const inputClass =
    "w-full border-2 border-stone-200 p-3 text-xs font-bold outline-none focus:border-brand-orange bg-white rounded-none uppercase";

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
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-stone-400">
                Source Name *
              </label>
              <input
                type="text"
                className={inputClass}
                value={formData.sourceName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, sourceName: e.target.value })
                }
                placeholder="e.g. Traders Group"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    </div>
  );
};
