/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Search,
  Filter,
  ChevronRight,
  MapPin,
  Phone,
  MessageSquare,
  Mail,
  Briefcase,
  Calendar,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Package,
  History,
  TrendingUp,
  Activity,
  PlusCircle,
  LayoutDashboard,
} from "lucide-react";
import {
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  SearchInput,
  ConfirmDialog,
  DataPanel,
  StatCard,
  FormField,
} from "../components/CommonUI.tsx";
import { rpnService } from "../services/rpnService.ts";
import { vendorService } from "../services/vendorService.ts";
import { logService } from "../services/logService.ts";
import { permissionService } from "../services/permissionService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import {
  RPN,
  RPNStatus,
  RPNLevel,
  FieldCollectionRecord,
  CollectionType,
  CollectionStatus,
  DeskType,
  Vendor,
} from "../types.ts";
import { asArray } from "../utils/safeData.ts";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const RPN_LEVELS: RPNLevel[] = ["Junior RPN", "Leader RPN", "IMM"];
const RPN_STATUSES: RPNStatus[] = ["active", "suspended", "inactive"];
const COLLECTION_TYPES: CollectionType[] = [
  "vendor profile",
  "itred_products",
  "price update",
  "image update",
  "subscription collection",
  "follow-up",
];
const COLLECTION_STATUSES: CollectionStatus[] = [
  "pending backend entry",
  "entered",
  "rejected",
  "needs clarification",
];

export const RPNManagement: React.FC = () => {
  // View State
  const [view, setView] = useState<
    "list" | "profile" | "form" | "collection_form"
  >("list");
  const [selectedRPN, setSelectedRPN] = useState<RPN | null>(null);

  // Data State
  const [rpns, setRpns] = useState<RPN[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [collections, setCollections] = useState<FieldCollectionRecord[]>([]);

  // Filter State
  const [search, setSearch] = useState("");
  const [rpnFilter, setRpnFilter] = useState("All");

  // Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rpnToDelete, setRpnToDelete] = useState<string | null>(null);

  // Form states
  const [rpnFormData, setRpnFormData] = useState<Partial<RPN>>({});
  const [collectionFormData, setCollectionFormData] = useState<
    Partial<FieldCollectionRecord>
  >({});

  const safeVendors = asArray<Vendor>(vendors);
  const safeRpns = asArray<RPN>(rpns);
  const safeCollections = asArray<FieldCollectionRecord>(collections);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const rawRpns = rpnService.getAll();
      const rawVendors = await vendorService.getVendors();
      const rawCollections = rpnService.getCollections();

      setRpns(asArray<RPN>(rawRpns));
      setVendors(asArray<Vendor>(rawVendors));
      setCollections(asArray<FieldCollectionRecord>(rawCollections));
    } catch (error) {
      console.warn(
        "RPN Management data failed to load. Using empty arrays.",
        error,
      );
      setRpns([]);
      setVendors([]);
      setCollections([]);
    }
  };

  const filteredRPNs = useMemo(() => {
    return safeRpns.filter(
      (r) =>
        (r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.id.toLowerCase().includes(search.toLowerCase())) &&
        (rpnFilter === "All" || r.status === rpnFilter),
    );
  }, [rpns, search, rpnFilter]);

  const stats = useMemo(() => {
    const activeVendors = safeVendors.filter(
      (v) => v.status === "active",
    ).length;
    const pendingCollections = safeCollections.filter(
      (c) => c.status === "pending backend entry",
    ).length;
    const collectionsThisMonth = safeCollections.length;

    // Vendors due this week or overdue
    const now = new Date();
    const vendorsOverdue = safeVendors.filter((v) => {
      if (!v.subscriptionDueDate || v.subscriptionStatus === "active")
        return false;
      const due = new Date(v.subscriptionDueDate);
      return due < now;
    }).length;

    const followUpsPending = safeVendors.filter((v) => {
      if (!v.nextFollowUpDate) return false;
      return new Date(v.nextFollowUpDate) <= now;
    }).length;

    return {
      activeVendors,
      pendingCollections,
      collectionsThisMonth,
      vendorsOverdue,
      followUpsPending,
    };
  }, [vendors, collections]);

  const handleDeleteRPN = () => {
    if (rpnToDelete) {
      const rpn = safeRpns.find((r) => r.id === rpnToDelete);
      rpnService.delete(rpnToDelete);
      analyticsService.logEvent({
        eventType: "RPN_UPDATED", // Using RPN_UPDATED with action detail
        actorType: "admin",
        actorName: "System Admin",
        rpnId: rpnToDelete,
        details: { action: "purged", name: rpn?.name },
      });
      loadData();
      setIsDeleteDialogOpen(false);
      setRpnToDelete(null);
    }
  };

  const startNewRPN = () => {
    setRpnFormData({
      id: `RPN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      status: "active",
      level: "Junior RPN",
      assignedVendors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setView("form");
  };

  const saveRPN = () => {
    if (!rpnFormData.name || !rpnFormData.phone) {
      alert("identity and contact required for node deployment.");
      return;
    }
    const rpnToSave = {
      ...rpnFormData,
      updatedAt: new Date().toISOString(),
    } as RPN;
    rpnService.update(rpnToSave);
    analyticsService.logEvent({
      eventType: selectedRPN ? "RPN_UPDATED" : "RPN_CREATED",
      actorType: "admin",
      actorName: "System Admin",
      rpnId: rpnToSave.id,
      details: { name: rpnToSave.name, level: rpnToSave.level },
    });
    loadData();
    setView("list");
  };

  const startCollectionRecord = (rpnId?: string) => {
    setCollectionFormData({
      id: `COL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      rpnId: rpnId || selectedRPN?.id || "",
      type: "itred_products",
      status: "pending backend entry",
      dateCollected: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setView("collection_form");
  };

  const saveCollection = () => {
    if (!collectionFormData.rpnId || !collectionFormData.vendorId) {
      alert("Mapping required: RPN and Vendor must be specified.");
      return;
    }
    const collectionToSave = {
      ...collectionFormData,
      updatedAt: new Date().toISOString(),
    } as FieldCollectionRecord;
    rpnService.updateCollection(collectionToSave);

    analyticsService.logEvent({
      eventType: "FIELD_COLLECTION_RECORDED",
      actorType: "rpn",
      actorName:
        safeRpns.find((r) => r.id === collectionToSave.rpnId)?.name ||
        "RPN Agent",
      rpnId: collectionToSave.rpnId,
      vendorId: collectionToSave.vendorId,
      details: {
        type: collectionToSave.type,
        productCount: collectionToSave.productCount,
        imageCount: collectionToSave.imageCount,
      },
    });

    loadData();
    if (selectedRPN) setView("profile");
    else setView("list");
  };

  const openRPNProfile = (rpn: RPN) => {
    setSelectedRPN(rpn);
    setView("profile");
  };

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    return `https://wa.me/${cleanPhone}`;
  };

  // --- Views ---

  if (view === "form") {
    return (
      <div className="space-y-8 pb-32">
        <div className="flex items-center justify-between bg-stone-50 p-6 border border-stone-200">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal transition-colors"
          >
            <ChevronRight size={14} className="rotate-180" /> Back to List
          </button>
          <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal">
            Add New Agent: {rpnFormData.id}
          </h3>
          {permissionService.canCreate("rpnManagement") && ( // Use rpnManagement for general RPN creation
            <PrimaryButton
              onClick={saveRPN}
              className="flex items-center gap-2"
            >
              Add Agent
            </PrimaryButton>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <DataPanel title="Agent Identity">
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  label="Legal Full Name"
                  required
                  className="md:col-span-2"
                >
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Legal Full Name
                  </label> */}
                  <input
                    value={rpnFormData.name || ""}
                    onChange={(e) =>
                      setRpnFormData({ ...rpnFormData, name: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50/50"
                  />
                </FormField>
                <FormField label="Mobile Phone" required>
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Mobile Phone
                  </label> */}
                  <input
                    value={rpnFormData.phone || ""}
                    onChange={(e) =>
                      setRpnFormData({ ...rpnFormData, phone: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none"
                  />
                </FormField>
                <FormField label="WhatsApp Channel">
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400 text-green-600">
                    WhatsApp Channel
                  </label> */}
                  <input
                    value={rpnFormData.whatsapp || ""}
                    onChange={(e) =>
                      setRpnFormData({
                        ...rpnFormData,
                        whatsapp: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold font-mono focus:border-brand-orange outline-none"
                  />
                </FormField>
                <FormField
                  label="Email Address (Secured)"
                  className="md:col-span-2"
                >
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Email Address (Secured)
                  </label> */}
                  <input
                    value={rpnFormData.email || ""}
                    onChange={(e) =>
                      setRpnFormData({ ...rpnFormData, email: e.target.value })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-bold focus:border-brand-orange outline-none"
                  />
                </FormField>
              </div>
            </DataPanel>

            <DataPanel title="Service Areas">
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {["Province", "CityTown", "District"].map((field) => (
                  <div key={field} className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      {" "}
                      {/* Use FormField component */}
                      {field.replace("Town", " / Town")}
                    </label>
                    <input
                      value={(rpnFormData as any)[field] || ""}
                      onChange={(e) =>
                        setRpnFormData({
                          ...rpnFormData,
                          [field]: e.target.value,
                        })
                      }
                      className="w-full border-2 border-stone-200 p-2 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                    />
                  </div>
                ))}
                <FormField
                  label="Assigned Territory Description"
                  className="md:col-span-3"
                >
                  {/* <label className="text-[10px] uppercase font-bold text-stone-400">
                    Assigned Territory Description
                  </label> */}
                  <textarea
                    value={rpnFormData.territory || ""}
                    onChange={(e) =>
                      setRpnFormData({
                        ...rpnFormData,
                        territory: e.target.value,
                      })
                    }
                    className="w-full border-2 border-stone-200 p-2.5 text-xs font-medium focus:border-brand-orange outline-none h-20 resize-none"
                    placeholder="List suburbs or specific commercial zones..."
                  />
                </FormField>
              </div>
            </DataPanel>
          </div>

          <div className="space-y-8">
            <div className="col-span-2 mt-8 pt-8 border-t border-stone-200">
              <h4 className="text-[11px] uppercase font-bold tracking-[0.25em] text-brand-charcoal mb-4">
                Personal, Address & KYC Details
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Sex
                  </label>
                  <select
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.sex || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        sex: e.target.value,
                      } as any)
                    }
                  >
                    <option value="">Select Sex...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.dateOfBirth || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        dateOfBirth: e.target.value,
                      } as any)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    National ID Number
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.nationalIdNumber || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        nationalIdNumber: e.target.value,
                      } as any)
                    }
                    placeholder="e.g. 63-123456-A-00"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Passport Number
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.passportNumber || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        passportNumber: e.target.value,
                      } as any)
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Highest Education
                  </label>
                  <select
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.highestEducation || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        highestEducation: e.target.value,
                      } as any)
                    }
                  >
                    <option value="">Select Education Level...</option>
                    <option value="primary">Primary</option>
                    <option value="ordinary_level">Ordinary Level</option>
                    <option value="advanced_level">Advanced Level</option>
                    <option value="certificate">Certificate</option>
                    <option value="diploma">Diploma</option>
                    <option value="degree">Degree</option>
                    <option value="postgraduate">Postgraduate</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Occupation / Skills
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.skills || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        skills: e.target.value,
                      } as any)
                    }
                    placeholder="Phone use, sales, training, stocktake..."
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Residential Address
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.residentialAddress || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        residentialAddress: e.target.value,
                      } as any)
                    }
                    placeholder="House number, street, area"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Suburb / Village
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.suburbOrVillage || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        suburbOrVillage: e.target.value,
                      } as any)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    District
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.district || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        district: e.target.value,
                      } as any)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Province
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.province || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        province: e.target.value,
                      } as any)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Country
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.country || "Zimbabwe"}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        country: e.target.value,
                      } as any)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Next of Kin Full Name
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.nextOfKinName || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        nextOfKinName: e.target.value,
                      } as any)
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Next of Kin Phone Number
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.nextOfKinPhone || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        nextOfKinPhone: e.target.value,
                      } as any)
                    }
                    placeholder="+263..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Next of Kin Relationship
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.nextOfKinRelationship || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        nextOfKinRelationship: e.target.value,
                      } as any)
                    }
                    placeholder="Parent, spouse, sibling..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Passport Size Image Upload
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange bg-white"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const base64 = await fileToBase64(file);
                      setrpnFormData({
                        ...rpnFormData,
                        passportPhotoUrl: base64,
                        passportPhotoName: file.name,
                        passportPhotoUpdatedAt: new Date().toISOString(),
                      } as any);
                    }}
                  />
                  {(rpnFormData as any)?.passportPhotoUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={(rpnFormData as any).passportPhotoUrl}
                        alt="RPN passport size"
                        className="w-16 h-16 object-cover border border-stone-200"
                      />
                      <span className="text-[9px] font-bold uppercase text-stone-400">
                        {(rpnFormData as any)?.passportPhotoName ||
                          "Image uploaded"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Notes / Vetting Comments
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border-2 border-stone-100 p-3 text-xs font-medium outline-none focus:border-brand-orange"
                    value={(rpnFormData as any)?.vettingNotes || ""}
                    onChange={(e) =>
                      setrpnFormData({
                        ...rpnFormData,
                        vettingNotes: e.target.value,
                      } as any)
                    }
                    placeholder="Interview notes, reference checks, field suitability..."
                  />
                </div>
              </div>
            </div>

            <DataPanel title="Agent Tier">
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Access Level
                  </label>
                  <div className="flex flex-col gap-2">
                    {" "}
                    {/* Use FormField component */}
                    {RPN_LEVELS.map((l) => (
                      <button
                        key={l}
                        onClick={() =>
                          setRpnFormData({ ...rpnFormData, level: l })
                        }
                        className={`w-full p-3 text-left border-2 transition-all ${rpnFormData.level === l ? "border-brand-charcoal bg-stone-50" : "border-stone-100 bg-white hover:border-stone-200"}`}
                      >
                        <p className="text-[10px] font-bold uppercase">{l}</p>
                        <p className="text-[8px] text-stone-400 mt-0.5">
                          Scale permissions for data ingestion
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {" "}
                  {/* Use FormField component */}
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Operational Status
                  </label>
                  <div className="flex gap-2">
                    {RPN_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setRpnFormData({ ...rpnFormData, status: s })
                        }
                        className={`flex-1 py-2 text-[9px] font-bold uppercase border ${rpnFormData.status === s ? "bg-brand-orange text-white border-brand-orange" : "bg-white text-stone-400 border-stone-100"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </DataPanel>
            {permissionService.canEdit("rpnManagement") && (
              <DataPanel title="Internal Documentation">
                <div className="p-6">
                  <textarea
                    value={rpnFormData.notes || ""}
                    onChange={(e) =>
                      setRpnFormData({ ...rpnFormData, notes: e.target.value })
                    }
                    className="w-full border-2 border-stone-100 p-2 text-xs font-medium outline-none h-40 bg-stone-50/50"
                    placeholder="Backend notes on reliability and performance..."
                  />
                </div>
              </DataPanel>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "collection_form") {
    return (
      <div className="space-y-8 pb-32 max-w-4xl mx-auto">
        <div className="flex items-center justify-between bg-stone-50 p-6 border border-stone-200">
          <button
            onClick={() => (selectedRPN ? setView("profile") : setView("list"))}
            className="flex items-center gap-2 text-[10px] font-bold uppercase text-stone-400 hover:text-brand-charcoal"
          >
            <ChevronRight size={14} className="rotate-180" /> Cancel Entry
          </button>
          <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal">
            New Field Collection Entry
          </h3>
          {permissionService.canCreate("rpnManagement") && (
            <PrimaryButton onClick={saveCollection}>
              Commit Record
            </PrimaryButton>
          )}
        </div>

        <DataPanel title="Collection Parameterization">
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-stone-400">
                  Target Vendor
                </label>
                <select
                  value={collectionFormData.vendorId || ""}
                  onChange={(e) =>
                    setCollectionFormData({
                      ...collectionFormData,
                      vendorId: e.target.value,
                    })
                  }
                  className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none bg-stone-50"
                >
                  <option value="">Select Vendor...</option>
                  {safeVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} [{v.id}]
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-stone-400">
                  Assigned RPN Agent
                </label>
                <select
                  value={collectionFormData.rpnId || ""}
                  onChange={(e) =>
                    setCollectionFormData({
                      ...collectionFormData,
                      rpnId: e.target.value,
                    })
                  }
                  className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                >
                  <option value="">Select RPN...</option>
                  {safeRpns.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-stone-400">
                  Operation Type
                </label>
                <select
                  value={collectionFormData.type || "itred_products"}
                  onChange={(e) =>
                    setCollectionFormData({
                      ...collectionFormData,
                      type: e.target.value as any,
                    })
                  }
                  className="w-full border-2 border-stone-200 p-3 text-xs font-bold uppercase focus:border-brand-orange outline-none"
                >
                  {COLLECTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-stone-400">
                  Collection Date
                </label>
                <input
                  type="date"
                  value={collectionFormData.dateCollected || ""}
                  onChange={(e) =>
                    setCollectionFormData({
                      ...collectionFormData,
                      dateCollected: e.target.value,
                    })
                  }
                  className="w-full border-2 border-stone-200 p-3 text-xs font-bold font-mono focus:border-brand-orange outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-stone-100">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-stone-400">
                  Products Collected
                </label>
                <input
                  type="number"
                  value={collectionFormData.productCount || 0}
                  onChange={(e) =>
                    setCollectionFormData({
                      ...collectionFormData,
                      productCount: parseInt(e.target.value),
                    })
                  }
                  className="w-full border-2 border-stone-200 p-3 text-xs font-bold font-mono focus:border-brand-orange outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-stone-400">
                  Images Synced
                </label>
                <input
                  type="number"
                  value={collectionFormData.imageCount || 0}
                  onChange={(e) =>
                    setCollectionFormData({
                      ...collectionFormData,
                      imageCount: parseInt(e.target.value),
                    })
                  }
                  className="w-full border-2 border-stone-200 p-3 text-xs font-bold font-mono focus:border-brand-orange outline-none"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-stone-400">
                  Status
                </label>
                <div className="flex gap-2">
                  {COLLECTION_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setCollectionFormData({
                          ...collectionFormData,
                          status: s,
                        })
                      }
                      className={`flex-1 py-3 text-[8px] font-bold uppercase border leading-none px-1 h-[46px] ${collectionFormData.status === s ? "bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-stone-400 border-stone-200"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-stone-400">
                Field Notes / Observations
              </label>
              <textarea
                value={collectionFormData.notes || ""}
                onChange={(e) =>
                  setCollectionFormData({
                    ...collectionFormData,
                    notes: e.target.value,
                  })
                }
                className="w-full border-2 border-stone-200 p-4 text-xs font-medium focus:border-brand-orange outline-none h-32 resize-none"
                placeholder="Describe collection context or issues detected..."
              />
            </div>
          </div>
        </DataPanel>
      </div>
    );
  }

  if (view === "profile" && selectedRPN) {
    const rpnVendors = safeVendors.filter(
      (v) => v.assignedRPNId === selectedRPN.id,
    );
    const rpnCollections = safeCollections.filter(
      (c) => c.rpnId === selectedRPN.id,
    );

    return (
      <div className="space-y-8 pb-32">
        {/* Profile Header */}
        <div className="bg-brand-charcoal text-white p-8">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex gap-6 items-start">
              <div className="w-20 h-20 bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white/40 text-2xl">
                {selectedRPN.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold uppercase tracking-tight">
                    {selectedRPN.name}
                  </h2>
                  <StatusBadge
                    status={selectedRPN.status}
                    variant={
                      selectedRPN.status === "active" ? "success" : "error"
                    }
                  />
                </div>
                <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
                  <Shield size={10} /> {selectedRPN.level} // ID:{" "}
                  {selectedRPN.id}
                </p>
                <div className="flex flex-wrap gap-4 mt-4">
                  <a
                    href={`tel:${selectedRPN.phone}`}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase transition-colors hover:text-brand-orange"
                  >
                    <Phone size={12} className="text-white/40" />{" "}
                    {selectedRPN.phone}
                  </a>
                  <a
                    href={getWhatsAppLink(selectedRPN.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[10px] font-bold uppercase transition-colors hover:text-green-400"
                  >
                    <MessageSquare size={12} className="text-white/40" />{" "}
                    {selectedRPN.whatsapp}
                  </a>
                </div>
              </div>
            </div>
            <div className="flex gap-2 self-start">
              <SecondaryButton
                onClick={() => setView("list")}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Back
              </SecondaryButton>
              <PrimaryButton
                onClick={() => setView("form")}
                className="bg-brand-orange hover:bg-brand-orange/90 border-0"
              >
                Edit Agent
              </PrimaryButton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Stats */}
          <div className="space-y-6">
            <div className="card bg-stone-50 border-stone-200">
              <h4 className="text-[10px] uppercase font-bold text-stone-400 mb-4 tracking-widest border-b border-stone-200 pb-2">
                Deployment Range
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <MapPin size={14} className="text-brand-orange" />
                  <div>
                    <p className="text-[10px] font-bold uppercase">
                      {selectedRPN.province}
                    </p>
                    <p className="text-[9px] text-stone-400 uppercase">
                      {selectedRPN.cityTown}
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-stone-100/50 mt-2">
                  <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                    Focus Zone
                  </p>
                  <p className="text-[10px] font-medium leading-relaxed">
                    {selectedRPN.territory}
                  </p>
                </div>
              </div>
            </div>

            <div className="card bg-stone-50 border-stone-200">
              <h4 className="text-[10px] uppercase font-bold text-stone-400 mb-4 tracking-widest border-b border-stone-200 pb-2">
                Performance Metrics
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-bold text-stone-400 uppercase mb-1">
                    Assigned
                  </p>
                  <p className="text-xl font-bold font-mono">
                    {rpnVendors.length}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-stone-400 uppercase mb-1">
                    Collections
                  </p>
                  <p className="text-xl font-bold font-mono">
                    {rpnCollections.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Areas */}
          <div className="lg:col-span-3 space-y-8">
            <TablePanel
              title="Assigned Vendors"
              subtitle="Vendors managed by this agent"
              actions={
                <SecondaryButton
                  onClick={() => startCollectionRecord()}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus size={12} /> Log Field Activity
                </SecondaryButton>
              }
              headers={[
                "Vendor Identity",
                "Status",
                "Last Collection",
                "Next Follow-up",
                "Actions",
              ]}
            >
              {rpnVendors.map((v) => (
                <tr key={v.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold uppercase">{v.name}</p>
                    <p className="text-[9px] font-mono text-stone-400 uppercase">
                      {v.id}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={v.status}
                      variant={v.status === "active" ? "success" : "warning"}
                    />
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono whitespace-nowrap">
                    {v.lastCollectionDate
                      ? new Date(v.lastCollectionDate).toLocaleDateString()
                      : "NO BUFFER"}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono text-brand-orange font-bold whitespace-nowrap">
                    {v.nextFollowUpDate
                      ? new Date(v.nextFollowUpDate).toLocaleDateString()
                      : "PENDING"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        const cleanPhone = v.whatsappNumber.replace(/\D/g, "");
                        window.open(`https://wa.me/${cleanPhone}`, "_blank");
                      }}
                      className="p-1.5 text-stone-400 hover:text-green-600 transition-colors"
                      title="Direct WhatsApp Contact"
                    >
                      <MessageSquare size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {rpnVendors.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-stone-300 italic text-[10px] uppercase font-bold"
                  >
                    No vendors assigned to this agent.
                  </td>
                </tr>
              )}
            </TablePanel>

            <TablePanel
              title="Field Data Stream"
              subtitle="Historical record of agent collection operations"
              headers={[
                "Operation ID",
                "Type",
                "Target Vendor",
                "Products",
                "Status",
                "Date",
              ]}
            >
              {rpnCollections
                .sort(
                  (a, b) =>
                    new Date(b.dateCollected).getTime() -
                    new Date(a.dateCollected).getTime(),
                )
                .map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4 text-[9px] font-mono text-stone-500">
                      {c.id}
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold uppercase">
                      {c.type}
                    </td>
                    <td className="px-6 py-4 text-xs uppercase font-medium">
                      {safeVendors.find((v) => v.id === c.vendorId)?.name ||
                        c.vendorId}
                    </td>
                    <td className="px-6 py-4 text-[10px] font-mono font-bold text-stone-400">
                      {c.productCount} SKUs
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={c.status}
                        variant={c.status === "entered" ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-6 py-4 text-[10px] font-mono whitespace-nowrap">
                      {new Date(c.dateCollected).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              {rpnCollections.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-stone-300 italic text-[10px] uppercase font-bold"
                  >
                    No field activities recorded.
                  </td>
                </tr>
              )}
            </TablePanel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32">
      {/* Registry Controls */}
      <div className="bg-stone-50 border border-stone-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal">
              RPN Management
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mt-1 uppercase italic tracking-wider">
              Agent Management // Directory V2.0
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              onClick={() => setView("list")}
              className="flex items-center gap-2"
            >
              <LayoutDashboard size={14} /> Network Overview
            </SecondaryButton>
            {permissionService.canCreate("addNewAgent") && (
              <PrimaryButton // Use rpnManagement for general RPN creation
                onClick={startNewRPN}
                className="flex items-center gap-2"
              >
                <PlusCircle size={14} /> Add New Agent
              </PrimaryButton>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border border-stone-200">
          <SearchInput
            placeholder="Search Agent Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={rpnFilter}
            onChange={(e) => setRpnFilter(e.target.value)}
            className="w-full border-2 border-stone-50 p-2 text-[10px] font-bold uppercase focus:outline-none bg-stone-50/50"
          >
            <option value="All">All Statuses</option>
            {RPN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <div className="hidden md:flex flex-col justify-center px-4 border-l border-stone-100">
            <p className="text-[9px] font-bold text-stone-400 uppercase">
              Assigned Vendors
            </p>
            <p className="text-sm font-bold font-mono">{safeVendors.length}</p>
          </div>
          <div className="hidden md:flex flex-col justify-center px-4 border-l border-stone-100">
            <p className="text-[9px] font-bold text-stone-400 uppercase">
              Pending Entries
            </p>
            <p className="text-sm font-bold font-mono text-brand-orange">
              {stats.pendingCollections}
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Active Vendors"
          value={stats.activeVendors.toString()}
          icon={Activity}
        />
        <StatCard
          label="Subscription Overdue"
          value={stats.vendorsOverdue.toString()}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          label="Pending Follow-ups"
          value={stats.followUpsPending.toString()}
          icon={AlertCircle}
        />
        <div className="card bg-brand-charcoal text-white flex flex-col justify-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">
            System Reliability
          </p>
          <p className="text-2xl font-bold font-mono">98.4%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <TablePanel
            title="Agent Registry"
            headers={[
              "Agent Identity",
              "Deployment Zone",
              "Contact",
              "Impact",
              "Actions",
            ]}
          >
            {filteredRPNs.map((rpn) => (
              <tr
                key={rpn.id}
                className="group hover:bg-stone-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-stone-400 group-hover:bg-brand-charcoal group-hover:text-white transition-colors">
                      {rpn.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-brand-charcoal">
                        {rpn.name}
                      </p>
                      <p className="text-[9px] font-mono text-stone-400 flex items-center gap-1 uppercase">
                        {rpn.id} <span className="opacity-50">|</span>{" "}
                        {rpn.level}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs font-bold text-stone-500 uppercase">
                    {rpn.province}
                  </p>
                  <p className="text-[9px] text-stone-400 uppercase mt-0.5">
                    {rpn.district}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <a
                      href={getWhatsAppLink(rpn.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-stone-400 hover:text-green-600 transition-colors"
                    >
                      <MessageSquare size={14} />
                    </a>
                    <a
                      href={`mailto:${rpn.email}`}
                      className="p-1.5 text-stone-400 hover:text-blue-500 transition-colors"
                    >
                      <Mail size={14} />
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold">
                      {
                        safeVendors.filter((v) => v.assignedRPNId === rpn.id)
                          .length
                      }
                    </span>
                    <div className="h-1 w-16 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-orange"
                        style={{
                          width: `${Math.min(100, (safeVendors.filter((v) => v.assignedRPNId === rpn.id).length / 20) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {permissionService.canView("rpnManagement") && (
                      <button
                        onClick={() => openRPNProfile(rpn)}
                        className="p-1.5 border border-stone-200 text-stone-400 hover:text-brand-charcoal transition-all bg-white"
                      >
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredRPNs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-20">
                  <EmptyState
                    title="No Agents Found"
                    description="No agents matching the search were found."
                    icon={Shield}
                    action={
                      <SecondaryButton onClick={() => setSearch("")}>
                        Clear Filters
                      </SecondaryButton>
                    }
                  />
                </td>
              </tr>
            )}
          </TablePanel>
        </div>

        <div className="space-y-8">
          <DataPanel
            title="Critical Interaction Queue"
            actions={<History size={14} className="text-stone-300" />}
          >
            <div className="p-4 space-y-3">
              {safeVendors
                .filter((v) => v.nextFollowUpDate && v.status === "active")
                .sort(
                  (a, b) =>
                    new Date(a.nextFollowUpDate!).getTime() -
                    new Date(b.nextFollowUpDate!).getTime(),
                )
                .slice(0, 5)
                .map((v) => {
                  const rpn = safeRpns.find((r) => r.id === v.assignedRPNId);
                  return (
                    <div
                      key={v.id}
                      className="p-3 border-l-2 border-brand-orange bg-stone-50 group hover:bg-stone-100 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[10px] font-bold uppercase text-brand-charcoal">
                          {v.name}
                        </p>
                        <span className="text-[9px] font-mono text-brand-orange font-bold">
                          DUE:{" "}
                          {new Date(v.nextFollowUpDate!).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[9px] text-stone-400 uppercase italic">
                        Agent: {rpn?.name || "UNASSIGNED"}
                      </p>
                      <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-stone-100 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            window.open(
                              getWhatsAppLink(v.whatsappNumber),
                              "_blank",
                            )
                          }
                          className="text-[8px] font-bold uppercase text-green-600 flex items-center gap-1 hover:underline"
                        >
                          <MessageSquare size={10} /> Contact Vendor
                        </button>
                      </div>
                    </div>
                  );
                })}
              {safeVendors.filter((v) => v.nextFollowUpDate).length === 0 && (
                <div className="p-12 text-center text-stone-300">
                  <Clock size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[9px] font-bold uppercase tracking-widest italic">
                    No pending follow-ups
                  </p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel
            title="Overdue Subscription Queue"
            actions={<AlertCircle size={14} className="text-red-400" />}
          >
            <div className="p-4 space-y-3">
              {safeVendors
                .filter(
                  (v) =>
                    v.subscriptionStatus === "overdue" ||
                    v.subscriptionStatus === "due",
                )
                .sort(
                  (a, b) =>
                    new Date(a.subscriptionDueDate!).getTime() -
                    new Date(b.subscriptionDueDate!).getTime(),
                )
                .slice(0, 5)
                .map((v) => (
                  <div
                    key={v.id}
                    className="p-3 border-l-2 border-red-500 bg-red-50 group hover:bg-red-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-[10px] font-bold uppercase text-red-900">
                        {v.name}
                      </p>
                      <span className="text-[9px] font-mono text-red-600 font-bold">
                        DUE:{" "}
                        {new Date(v.subscriptionDueDate!).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[9px] text-red-400 uppercase italic font-mono">
                      {v.id}
                    </p>
                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-red-100 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          window.open(
                            getWhatsAppLink(v.whatsappNumber),
                            "_blank",
                          )
                        }
                        className="text-[8px] font-bold uppercase text-green-700 flex items-center gap-1 hover:underline"
                      >
                        <MessageSquare size={10} /> Urgency Contact
                      </button>
                    </div>
                  </div>
                ))}
              {safeVendors.filter(
                (v) =>
                  v.subscriptionStatus === "overdue" ||
                  v.subscriptionStatus === "due",
              ).length === 0 && (
                <div className="p-12 text-center text-stone-300">
                  <CheckCircle2 size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[9px] font-bold uppercase tracking-widest italic">
                    All nodes synchronized
                  </p>
                </div>
              )}
            </div>
          </DataPanel>

          <DataPanel title="Live Field Protocol Log">
            <div className="p-4 space-y-4">
              {safeCollections.slice(0, 4).map((c) => (
                <div key={c.id} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                    <Activity size={12} className="text-stone-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase leading-tight">
                      {safeVendors.find((v) => v.id === c.vendorId)?.name ||
                        "UNKNOWN"}
                    </p>
                    <p className="text-[9px] text-stone-500 font-mono mt-0.5">
                      {c.type.toUpperCase()} recorded by{" "}
                      {safeRpns.find((r) => r.id === c.rpnId)?.name}
                    </p>
                    <p className="text-[8px] text-stone-300 mt-1 uppercase font-bold">
                      {new Date(c.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {safeCollections.length === 0 && (
                <div className="p-12 text-center text-stone-300 italic text-[10px] uppercase font-bold">
                  Node stream silent.
                </div>
              )}
            </div>
          </DataPanel>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Agent?"
        message="Deletion is permanent. All assignments will be removed and activity history archived."
        variant="danger"
        confirmLabel="Delete Agent"
        onConfirm={handleDeleteRPN}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
};
