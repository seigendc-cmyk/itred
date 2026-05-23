import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Plus,
  ExternalLink,
  Copy,
  Search,
  Trash2,
  Edit3,
  X,
  Check,
  AlertCircle,
  MessageSquare,
  Users,
  Globe,
  ShieldCheck,
  Briefcase,
  LayoutGrid,
  List,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
} from "lucide-react";
import {
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  StatCard,
  ConfirmDialog,
  BrandedAlertModal,
} from "./CommonUI.tsx";
import { cahService } from "../services/cahService.ts";
import { logService } from "../services/logService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { vendorService } from "../services/vendorService.ts";
import { asArray } from "../utils/safeData.ts";
import { generateCAHLinkId } from "../utils/idGenerator.ts";
import {
  getSession,
  getSessionRole,
  getSessionStaffId,
  getSessionStaffName,
  hasValidSession,
} from "../utils/session.ts";
import {
  CAHLink,
  CAHLinkType,
  CAHTargetAudience,
  CAHStatus,
  Vendor,
  ActivityLog,
} from "../types.ts";

const LINK_TYPES: CAHLinkType[] = [
  "WhatsApp Community",
  "WhatsApp Group",
  "WhatsApp Channel",
  "WhatsApp Customer Support",
];

const AUDIENCES: CAHTargetAudience[] = [
  "customers",
  "itred_vendors",
  "RPN",
  "backend staff",
  "mixed",
];

const STATUSES: CAHStatus[] = ["active", "inactive", "archived"];

const getSafeUrl = (link: Partial<CAHLink> | null | undefined): string => {
  return link?.whatsappUrl || (link as any)?.url || "";
};

const getRandomIcon = (type: string) => {
  if (type.includes("Community")) return <Users size={20} />;
  if (type.includes("Group")) return <MessageSquare size={20} />;
  if (type.includes("Channel")) return <Globe size={20} />;
  if (type.includes("Support")) return <ShieldCheck size={20} />;
  return <Layers size={20} />;
};

export const CAHLinksPanel: React.FC = () => {
  const validateWhatsAppUrl = (url: string): boolean => {
    return (
      url.startsWith("https://chat.whatsapp.com") ||
      url.startsWith("https://whatsapp.com/channel") ||
      url.startsWith("https://wa.me")
    );
  };

  const [links, setLinks] = useState<CAHLink[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<ActivityLog[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Partial<CAHLink> | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");
  const [formError, setFormError] = useState("");
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({
    isOpen: false,
    title: "seiGEN Commerce",
    message: "",
    type: "info",
  });

  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    action: () => void;
    variant: "danger" | "warning" | "success";
  } | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [countModalLink, setCountModalLink] = useState<CAHLink | null>(null);
  const [newCountValue, setNewCountValue] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");

  const safeLinks = asArray<CAHLink>(links);
  const safeVendors = asArray<Vendor>(vendors);
  const safeEvents = asArray<ActivityLog>(events);

  const showBrandedAlert = (message: string, type: "warning" | "error" | "info" = "warning") => {
    setAlertConfig({
      isOpen: true,
      title: "seiGEN Commerce",
      message,
      type,
    });
  };

  const requireSession = () => {
    const session = getSession();
    if (!hasValidSession(session)) {
      showBrandedAlert("Session expired. Please login again.", "warning");
      return null;
    }
    return session;
  };

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rawVendors, rawEvents] = await Promise.all([
        vendorService.getVendors(),
        analyticsService.getEvents(),
      ]);

      let rawLinks: CAHLink[] = [];
      try {
        rawLinks = await cahService.loadCAHLinksFromFirebase();
      } catch (e) {
        console.warn("Failed to load CAH links from Firebase", e);
        rawLinks = cahService.getLinks();
      }

      setLinks(asArray<CAHLink>(rawLinks));
      setVendors(asArray<Vendor>(rawVendors));
      setEvents(asArray<ActivityLog>(rawEvents));
    } catch (error) {
      console.warn("CAH Links data failed to load. Using empty arrays.", error);
      setLinks([]);
      setVendors([]);
      setEvents([]);
    }
  };

  const linkUsages = useMemo(() => {
    const usages: Record<string, string[]> = {};

    safeEvents
      .filter(
        (event) =>
          event.eventType === "CATALOGUE_GENERATED" && event.details?.linkIds,
      )
      .forEach((event) => {
        const linkIds = asArray<string>(event.details?.linkIds);
        const vendor = safeVendors.find((v) => v.id === event.vendorId);

        if (!vendor) return;

        linkIds.forEach((id) => {
          if (!usages[id]) usages[id] = [];

          if (!usages[id].includes(vendor.name)) {
            usages[id].push(vendor.name);
          }
        });
      });

    return usages;
  }, [safeEvents, safeVendors]);

  const sectors = useMemo(() => {
    return Array.from(
      new Set(safeLinks.map((link) => link.sector).filter(Boolean)),
    );
  }, [safeLinks]);

  const provinces = useMemo(() => {
    return Array.from(
      new Set(safeLinks.map((link) => link.province).filter(Boolean)),
    );
  }, [safeLinks]);

  const analytics = useMemo(() => {
    const followersByType = safeLinks.reduce(
      (acc, link) => {
        acc[link.type] =
          (acc[link.type] || 0) + (link.currentFollowerCount || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const followersBySector = safeLinks.reduce(
      (acc, link) => {
        const sector = link.sector || "Unspecified";
        acc[sector] = (acc[sector] || 0) + (link.currentFollowerCount || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const followersByLocation = safeLinks.reduce(
      (acc, link) => {
        const location = link.province || "Regional";
        acc[location] = (acc[location] || 0) + (link.currentFollowerCount || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const topGrowing = safeLinks
      .filter(
        (link) => link.followerGrowth !== undefined && link.followerGrowth > 0,
      )
      .sort((a, b) => (b.followerGrowth || 0) - (a.followerGrowth || 0))
      .slice(0, 5);

    const needsUpdate = safeLinks
      .filter((link) => {
        if (!link.followerCountUpdatedAt) return true;

        const lastUpdate = new Date(link.followerCountUpdatedAt);
        const now = new Date();

        const daysSinceUpdate =
          (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

        return daysSinceUpdate > 30;
      })
      .sort((a, b) => {
        const aDate = a.followerCountUpdatedAt
          ? new Date(a.followerCountUpdatedAt)
          : new Date(0);
        const bDate = b.followerCountUpdatedAt
          ? new Date(b.followerCountUpdatedAt)
          : new Date(0);

        return aDate.getTime() - bDate.getTime();
      });

    const totalFollowers = safeLinks.reduce(
      (acc, link) => acc + (link.currentFollowerCount || 0),
      0,
    );

    const trackedProvinces = Array.from(
      new Set(safeLinks.map((link) => link.province).filter(Boolean)),
    ).length;

    return {
      followersByType,
      followersBySector,
      followersByLocation,
      topGrowing,
      needsUpdate,
      totalFollowers,
      trackedProvinces,
    };
  }, [safeLinks]);

  const filteredLinks = useMemo(() => {
    const searchText = search.toLowerCase();

    return safeLinks.filter((link) => {
      const linkUrl = getSafeUrl(link);

      const matchesSearch =
        (link.name || "").toLowerCase().includes(searchText) ||
        (link.description || "").toLowerCase().includes(searchText) ||
        linkUrl.toLowerCase().includes(searchText);

      const matchesType = typeFilter === "all" || link.type === typeFilter;

      const matchesAudience =
        audienceFilter === "all" || link.targetAudience === audienceFilter;

      const matchesSector =
        sectorFilter === "all" || link.sector === sectorFilter;

      const matchesProvince =
        provinceFilter === "all" || link.province === provinceFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesAudience &&
        matchesSector &&
        matchesProvince
      );
    });
  }, [
    safeLinks,
    search,
    typeFilter,
    audienceFilter,
    sectorFilter,
    provinceFilter,
  ]);

  const groupedLinks = useMemo(() => {
    const groups: Record<string, CAHLink[]> = {};

    filteredLinks.forEach((link) => {
      if (!groups[link.type]) groups[link.type] = [];
      groups[link.type].push(link);
    });

    return groups;
  }, [filteredLinks]);

  const stats = useMemo(() => {
    return {
      total: safeLinks.length,
      active: safeLinks.filter((link) => link.status === "active").length,
      whatsapp: safeLinks.filter((link) => {
        const linkUrl = getSafeUrl(link);
        return linkUrl.includes("whatsapp.com") || linkUrl.includes("wa.me");
      }).length,
      customers: safeLinks.filter((link) => link.targetAudience === "customers")
        .length,
      totalFollowers: safeLinks.reduce(
        (sum, link) => sum + (link.currentFollowerCount || 0),
        0,
      ),
      growing: safeLinks.filter((link) => (link.followerGrowth || 0) > 0)
        .length,
      needsUpdate: safeLinks.filter((link) => {
        if (!link.followerCountUpdatedAt) return true;

        const lastUpdate = new Date(link.followerCountUpdatedAt);
        const now = new Date();

        const daysSinceUpdate =
          (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

        return daysSinceUpdate > 30;
      }).length,
    };
  }, [safeLinks]);

  const handleAddWhatsAppLink = () => {
    const activeCount = safeLinks.filter(
      (link) => link.status === "active",
    ).length;

    if (activeCount >= 100) {
      setConfirmConfig({
        title: "Active Link Limit Reached",
        message:
          "You can only have up to 100 active WhatsApp links. Please archive or deactivate existing links before creating new ones.",
        variant: "warning",
        action: () => {},
      });
      setIsConfirmOpen(true);
      return;
    }

    setEditingLink({
      id: generateCAHLinkId(),
      type: "WhatsApp Channel",
      name: "",
      url: "",
      whatsappUrl: "",
      targetAudience: "customers",
      status: "active",
      sector: "",
      province: "",
      cityTown: "",
      showInCatalogue: true,
    } as Partial<CAHLink>);

    setFormError("");
    setIsFormOpen(true);
  };

  const handleEditLink = (link: CAHLink) => {
    const normalizedUrl = getSafeUrl(link);

    setEditingLink({
      ...link,
      url: normalizedUrl,
      whatsappUrl: normalizedUrl,
    });

    setFormError("");
    setIsFormOpen(true);
  };

  const handleSaveLink = async () => {
    setFormError("");
    const session = requireSession();
    if (!session) return;
    const staffId = getSessionStaffId(session);
    const staffName = getSessionStaffName(session);

    const normalizedUrl = getSafeUrl(editingLink).trim();

    if (!editingLink?.name?.trim() || !normalizedUrl) {
      setFormError("Name and WhatsApp URL are required.");
      return;
    }

    if (editingLink.status === "active" && !editingLink.createdAt) {
      const activeCount = safeLinks.filter(
        (link) => link.status === "active",
      ).length;

      if (activeCount >= 100) {
        setFormError("You can only have up to 100 active WhatsApp links.");
        return;
      }
    }

    const linkToSave = {
      ...editingLink,
      url: normalizedUrl,
      whatsappUrl: normalizedUrl,
      updatedBy: staffId,
      updatedByName: staffName,
      updatedAt: new Date().toISOString(),
      createdBy: editingLink.createdBy || staffId,
      createdByName: (editingLink as any).createdByName || staffName,
      createdAt: editingLink.createdAt || new Date().toISOString(),
    } as CAHLink;

    const existingLink = safeLinks.find((link) => link.id === linkToSave.id);

    const followerCountChanged =
      existingLink &&
      existingLink.currentFollowerCount !== linkToSave.currentFollowerCount;

    try {
      await cahService.saveLinkToFirebase(linkToSave);
    } catch (e) {
      console.warn("Firebase save failed, falling back to local storage", e);
      cahService.saveLink(linkToSave);
    }

    try {
      if (followerCountChanged) {
        analyticsService.logEvent({
          eventType: "CAH_FOLLOWER_COUNT_UPDATED",
          actorType: getSessionRole(session),
          actorName: staffName,
          cahId: linkToSave.id,
          details: {
            previousCount: existingLink?.currentFollowerCount || 0,
            newCount: linkToSave.currentFollowerCount || 0,
            growth: linkToSave.followerGrowth || 0,
            growthPercentage: linkToSave.followerGrowthPercentage || 0,
          },
        });

        logService.add({
          userId: staffId,
          action: "CAH_FOLLOWER_COUNT_UPDATED",
          entityType: "cah",
          entityId: linkToSave.id,
          details: `Follower count updated from ${
            existingLink?.currentFollowerCount || 0
          } to ${linkToSave.currentFollowerCount || 0} for CAH link "${
            linkToSave.name
          }".`,
          severity: "info",
        });
      }

      analyticsService.logEvent({
        eventType: editingLink.createdAt
          ? "WHATSAPP_ACCESS_LINK_UPDATED"
          : "WHATSAPP_ACCESS_LINK_CREATED",
        actorType: getSessionRole(session),
        actorName: staffName,
        cahId: linkToSave.id,
        details: {
          name: linkToSave.name,
          type: linkToSave.type,
          url: linkToSave.whatsappUrl,
        },
      });

      logService.add({
        userId: staffId,
        action: editingLink.createdAt
          ? "WHATSAPP_ACCESS_LINK_UPDATED"
          : "WHATSAPP_ACCESS_LINK_CREATED",
        entityType: "cah",
        entityId: linkToSave.id,
        details: `CAH Link "${linkToSave.name}" for ${linkToSave.targetAudience} was modified.`,
        severity: "info",
      });
    } catch (auditError) {
      console.error("CAH link audit logging failed", auditError);
    }

    void loadData();
    setIsFormOpen(false);
    setEditingLink(null);
  };

  const handleDeleteLink = (id: string) => {
    setConfirmConfig({
      title: "Confirm Deletion",
      message: "Permanently archive and delete this WhatsApp link?",
      variant: "danger",
      action: async () => {
        const session = requireSession();
        if (!session) return;
        try {
          await cahService.deleteLinkFromFirebase(id);
        } catch (e) {
          cahService.deleteLink(id);
        }

        try {
          logService.add({
            userId: getSessionStaffId(session),
            action: "CAH_LINK_DELETED",
            entityType: "cah",
            entityId: id,
            details: "CAH link removed from hub.",
            severity: "warning",
          });
        } catch (auditError) {
          console.error("CAH link audit logging failed", auditError);
        }

        void loadData();
      },
    });

    setIsConfirmOpen(true);
  };

  const copyToClipboard = async (url: string) => {
    await navigator.clipboard.writeText(url);
  };

  const getGrowthBadge = (link: CAHLink) => {
    const growth = link.followerGrowth || 0;
    const growthPercent = link.followerGrowthPercentage || 0;

    if (growth > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-[8px] font-bold uppercase border border-green-200">
          <TrendingUp size={8} />+{growth} (
          {growthPercent > 0 ? `+${growthPercent.toFixed(1)}%` : "NEW"})
        </span>
      );
    }

    if (growth < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-[8px] font-bold uppercase border border-red-200">
          <TrendingDown size={8} />
          {growth} ({growthPercent.toFixed(1)}%)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-600 text-[8px] font-bold uppercase border border-stone-200">
        <Minus size={8} />
        FLAT
      </span>
    );
  };

  const getNeedsUpdateBadge = (link: CAHLink) => {
    if (!link.followerCountUpdatedAt) return null;

    const lastUpdate = new Date(link.followerCountUpdatedAt);
    const now = new Date();

    const daysSinceUpdate =
      (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate > 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-[8px] font-bold uppercase border border-orange-200">
          <Clock size={8} />
          UPDATE DUE
        </span>
      );
    }

    return null;
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <StatCard
          label="Total Links"
          value={stats.total.toString()}
          icon={Layers}
        />
        <StatCard
          label="Active Links"
          value={stats.active.toString()}
          icon={Check}
          variant={stats.active > 0 ? "neutral" : "warning"}
        />
        <StatCard
          label="WhatsApp Links"
          value={stats.whatsapp.toString()}
          icon={MessageSquare}
        />
        <StatCard
          label="Total Members"
          value={stats.totalFollowers.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="Growing Links (30d)"
          value={stats.growing.toString()}
          icon={TrendingUp}
          variant={stats.growing > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="Update Due (30d)"
          value={stats.needsUpdate.toString()}
          icon={Clock}
          variant={stats.needsUpdate > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="bg-stone-50 border border-stone-200 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal">
              WhatsApp Access Hub Links
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mt-1 uppercase italic tracking-wider">
              Manage WhatsApp Access Hub Links
            </p>
          </div>

          <PrimaryButton
            onClick={handleAddWhatsAppLink}
            className="flex items-center gap-2"
          >
            <Plus size={14} /> Add WhatsApp Link
          </PrimaryButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-white border border-stone-200 p-2 shadow-sm">
          <div className="md:col-span-2 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              size={16}
            />
            <input
              type="search"
              placeholder="Search Links..."
              className="w-full pl-10 pr-4 py-2 border-2 border-stone-100 outline-none focus:border-brand-orange text-xs font-bold uppercase"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <select
            className="form-input text-[10px] font-bold uppercase"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">Any Link Type</option>
            {LINK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            className="form-input text-[10px] font-bold uppercase"
            value={audienceFilter}
            onChange={(event) => setAudienceFilter(event.target.value)}
          >
            <option value="all">Any Audience</option>
            {AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {audience.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            className="form-input text-[10px] font-bold uppercase"
            value={sectorFilter}
            onChange={(event) => setSectorFilter(event.target.value)}
          >
            <option value="all">Any Sector</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          <select
            className="form-input text-[10px] font-bold uppercase"
            value={provinceFilter}
            onChange={(event) => setProvinceFilter(event.target.value)}
          >
            <option value="all">Any Province</option>
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex-1 flex items-center justify-center border p-2 ${
                viewMode === "table"
                  ? "bg-stone-100 text-brand-charcoal"
                  : "text-stone-300"
              }`}
            >
              <List size={14} />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex-1 flex items-center justify-center border p-2 ${
                viewMode === "grid"
                  ? "bg-stone-100 text-brand-charcoal"
                  : "text-stone-300"
              }`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="space-y-10">
          {Object.entries(groupedLinks).map(([type, linksInGroup]) => (
            <div key={type} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                <span className="p-1 px-2 bg-brand-charcoal text-white text-[10px] font-bold uppercase">
                  {type}
                </span>
                <span className="text-[10px] text-stone-400 font-mono">
                  ({linksInGroup.length} ASSETS)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] gap-6">
                {linksInGroup.map((link) => {
                  const linkUrl = getSafeUrl(link);

                  return (
                    <div
                      key={link.id}
                    className="bg-white border-2 border-stone-100 p-5 min-w-0 flex flex-col hover:border-brand-orange transition-all group relative"
                    >
                      <div className="absolute top-4 right-4 flex gap-1 flex-wrap">
                        <StatusBadge
                          status={link.status}
                          variant={
                            link.status === "active" ? "success" : "neutral"
                          }
                        />
                        {getGrowthBadge(link)}
                        {getNeedsUpdateBadge(link)}
                      </div>

                      <div className="w-10 h-10 bg-stone-50 flex items-center justify-center mb-4 text-stone-400 group-hover:text-brand-orange transition-colors">
                        {getRandomIcon(link.type)}
                      </div>

                      <h4
                        className="text-xs font-bold uppercase text-brand-charcoal line-clamp-1"
                        title={link.name}
                      >
                        {link.name}
                      </h4>

                      <p className="text-[10px] text-stone-400 mt-1 line-clamp-2 min-h-[30px] leading-relaxed italic">
                        {link.description || "No technical brief provided."}
                      </p>

                      <div className="mt-4 pt-4 border-t border-stone-50 space-y-2">
                        <div className="flex justify-between text-[8px] font-bold uppercase text-stone-400">
                          <span>Target Audience</span>
                          <span className="text-brand-charcoal">
                            {link.targetAudience}
                          </span>
                        </div>

                        <div className="flex justify-between text-[8px] font-bold uppercase text-stone-400">
                          <span>Geographic Reach</span>
                          <span className="text-brand-charcoal">
                            {link.cityTown || "Regional"}
                          </span>
                        </div>

                        {link.currentFollowerCount !== undefined && (
                          <div className="flex justify-between text-[8px] font-bold uppercase text-stone-400">
                            <span>Members/Followers</span>
                            <span className="text-brand-charcoal">
                              {link.currentFollowerCount.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {link.followerCountUpdatedAt && (
                          <div className="flex justify-between text-[8px] font-bold uppercase text-stone-400">
                            <span>Last Count Update</span>
                            <span className="text-brand-charcoal">
                              {new Date(
                                link.followerCountUpdatedAt,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {link.showInCatalogue !== undefined && (
                          <div className="flex justify-between text-[8px] font-bold uppercase text-stone-400">
                            <span>Show in Catalogue</span>
                            <span className="text-brand-charcoal">
                              {link.showInCatalogue ? "Yes" : "No"}
                            </span>
                          </div>
                        )}

                        {linkUsages[link.id]?.length > 0 && (
                          <div className="mt-4 p-2 bg-stone-50 space-y-1">
                            <p className="text-[7px] font-bold uppercase text-stone-400 flex items-center gap-1">
                              <FileText size={8} /> Active Deployments (
                              {linkUsages[link.id].length})
                            </p>

                            <div className="flex flex-wrap gap-1">
                              {linkUsages[link.id].slice(0, 3).map((name) => (
                                <span
                                  key={name}
                                  className="text-[8px] px-1 bg-white border border-stone-100 font-bold truncate max-w-[80px]"
                                >
                                  {name}
                                </span>
                              ))}

                              {linkUsages[link.id].length > 3 && (
                                <span className="text-[8px] px-1 font-bold">
                                  +{linkUsages[link.id].length - 3} MORE
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto pt-6 flex gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(linkUrl, "_blank")}
                          className="flex-1 bg-stone-100 hover:bg-stone-200 text-brand-charcoal p-2 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={12} />
                          <span className="text-[9px] font-bold uppercase">
                            Launch
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void copyToClipboard(linkUrl)}
                          className="p-2 border border-stone-100 hover:border-brand-orange text-stone-400 hover:text-brand-orange transition-all"
                        >
                          <Copy size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCountModalLink(link);
                            setNewCountValue(
                              link.currentFollowerCount?.toString() || "0",
                            );
                            setIsCountModalOpen(true);
                          }}
                          className="p-2 border border-stone-100 hover:border-green-500 text-stone-400 hover:text-green-600 transition-all"
                          title="Quick Update Follower Count"
                        >
                          <Users size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditLink(link)}
                          className="p-2 border border-stone-100 hover:border-brand-orange text-stone-400 hover:text-brand-orange transition-all"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredLinks.length === 0 && (
            <div className="py-32">
              <EmptyState
                icon={MessageSquare}
                title="No Links"
                description="No distribution links matching the current filters were found in the registry."
                action={
                  <SecondaryButton
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                      setAudienceFilter("all");
                    }}
                  >
                    Reset Filters
                  </SecondaryButton>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <TablePanel
          title="Distribution Registry"
          subtitle={`${filteredLinks.length} WhatsApp Access Hub links tracked`}
          headers={[
            "Link Name",
            "Type / Audience",
            "Location / Sector",
            "Deployments",
            "Status",
            "Actions",
          ]}
        >
          {filteredLinks.map((link) => {
            const linkUrl = getSafeUrl(link);

            return (
              <tr key={link.id} className="hover:bg-stone-50">
                <td className="px-6 py-4">
                  <p className="text-xs font-bold uppercase text-brand-charcoal">
                    {link.name}
                  </p>
                  <p className="text-[9px] text-stone-400 italic mt-0.5 line-clamp-1">
                    {link.id}
                  </p>
                </td>

                <td className="px-6 py-4">
                  <p className="text-xs font-bold uppercase text-stone-600">
                    {link.type}
                  </p>
                  <p className="text-[9px] text-stone-400 uppercase mt-0.5">
                    {link.targetAudience}
                  </p>
                </td>

                <td className="px-6 py-4">
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    {link.sector || "N/A"}
                  </p>
                  <p className="text-[9px] text-stone-400 uppercase mt-0.5">
                    {link.cityTown || "N/A"}, {link.province || "Regional"}
                  </p>
                </td>

                <td className="px-6 py-4">
                  {linkUsages[link.id]?.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-bold text-brand-orange">
                        {linkUsages[link.id].length} CATALOGUES
                      </p>
                      <p className="text-[8px] text-stone-400 uppercase truncate max-w-[120px]">
                        {linkUsages[link.id].join(", ")}
                      </p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-300 font-bold uppercase">
                      ZERO DEPLOYMENTS
                    </span>
                  )}
                </td>

                <td className="px-6 py-4">
                  <StatusBadge
                    status={link.status}
                    variant={link.status === "active" ? "success" : "neutral"}
                  />
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(linkUrl, "_blank")}
                      className="p-1.5 text-stone-400 hover:text-brand-charcoal transition-all"
                    >
                      <ExternalLink size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditLink(link)}
                      className="p-1.5 text-stone-400 hover:text-brand-charcoal transition-all"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteLink(link.id)}
                      className="p-1.5 text-stone-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {filteredLinks.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-32">
                <EmptyState
                  icon={MessageSquare}
                  title="No Data Lines"
                  description="Filter matrix returned 0 results."
                />
              </td>
            </tr>
          )}
        </TablePanel>
      )}

      <div className="space-y-8">
        <div className="bg-stone-50 border border-stone-200 p-6">
          <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal mb-6">
            WhatsApp Access Hub Analytics
          </h3>

          <div className="grid grid-cols-1 md:[grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] gap-6">
            <div className="bg-white border border-stone-200 p-4">
              <h4 className="text-xs font-bold uppercase text-stone-600 mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Top Growing Links
              </h4>
              <div className="space-y-2">
                {analytics.topGrowing.length > 0 ? (
                  analytics.topGrowing.map((link) => (
                    <div
                      key={link.id}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="truncate flex-1">{link.name}</span>
                      <span className="text-green-600 font-bold ml-2">
                        +{link.followerGrowth}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 text-xs">No growing links</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4">
              <h4 className="text-xs font-bold uppercase text-stone-600 mb-3 flex items-center gap-2">
                <Clock size={14} /> Need Updates
              </h4>
              <div className="space-y-2">
                {analytics.needsUpdate.length > 0 ? (
                  analytics.needsUpdate.slice(0, 5).map((link) => (
                    <div
                      key={link.id}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="truncate flex-1">{link.name}</span>
                      <span className="text-orange-600 font-bold ml-2">
                        {link.followerCountUpdatedAt
                          ? `${Math.floor(
                              (new Date().getTime() -
                                new Date(
                                  link.followerCountUpdatedAt,
                                ).getTime()) /
                                (1000 * 60 * 60 * 24),
                            )}d ago`
                          : "Never"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 text-xs">All links updated</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4">
              <h4 className="text-xs font-bold uppercase text-stone-600 mb-3 flex items-center gap-2">
                <ShieldCheck size={14} /> Follower Reach
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-stone-500 uppercase tracking-[0.2em]">
                    Total Members
                  </span>
                  <span className="text-brand-charcoal font-bold">
                    {analytics.totalFollowers.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-stone-500 uppercase tracking-[0.2em]">
                    Provinces Tracked
                  </span>
                  <span className="text-brand-charcoal font-bold">
                    {analytics.trackedProvinces}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4">
              <h4 className="text-xs font-bold uppercase text-stone-600 mb-3 flex items-center gap-2">
                <Users size={14} /> By Type
              </h4>
              <div className="space-y-2">
                {Object.entries(analytics.followersByType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([type, count]) => (
                    <div
                      key={type}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="truncate flex-1">{type}</span>
                      <span className="font-bold ml-2">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4">
              <h4 className="text-xs font-bold uppercase text-stone-600 mb-3 flex items-center gap-2">
                <Briefcase size={14} /> By Sector
              </h4>
              <div className="space-y-2">
                {Object.entries(analytics.followersBySector)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([sector, count]) => (
                    <div
                      key={sector}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="truncate flex-1">{sector}</span>
                      <span className="font-bold ml-2">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4">
              <h4 className="text-xs font-bold uppercase text-stone-600 mb-3 flex items-center gap-2">
                <Globe size={14} /> By Location
              </h4>
              <div className="space-y-2">
                {Object.entries(analytics.followersByLocation)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([location, count]) => (
                    <div
                      key={location}
                      className="flex justify-between items-center text-xs"
                    >
                      <span className="truncate flex-1">{location}</span>
                      <span className="font-bold ml-2">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white border border-stone-200 p-4">
            <h4 className="text-xs font-bold uppercase text-stone-600 mb-4 flex items-center gap-2">
              <FileText size={14} /> Growth Table
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-stone-100 uppercase text-stone-500">
                    <th className="px-3 py-2">Link</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">Previous</th>
                    <th className="px-3 py-2">Growth</th>
                    <th className="px-3 py-2">%</th>
                  </tr>
                </thead>
                <tbody className="text-stone-600">
                  {analytics.topGrowing.length > 0 ? (
                    analytics.topGrowing.map((link) => (
                      <tr key={link.id} className="border-t border-stone-100">
                        <td className="px-3 py-2 truncate max-w-xs">
                          {link.name}
                        </td>
                        <td className="px-3 py-2">
                          {(link.currentFollowerCount || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {(link.previousFollowerCount || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {(link.followerGrowth || 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {(link.followerGrowthPercentage || 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-stone-400"
                      >
                        No growth entries available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-brand-charcoal/40 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 border-l border-stone-200">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight">
                  {editingLink?.createdAt
                    ? "Edit WhatsApp Link"
                    : "Add WhatsApp Link"}
                </h2>
                <p className="text-[10px] uppercase font-bold text-stone-400 mt-1">
                  Link ID: {editingLink?.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-stone-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm font-bold uppercase">
                  {formError}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Display Name
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-sm font-bold uppercase outline-none focus:border-brand-orange"
                    value={editingLink?.name || ""}
                    onChange={(event) =>
                      setEditingLink({
                        ...editingLink!,
                        name: event.target.value,
                      })
                    }
                    placeholder="E.G. GWERU SECTOR CHANNEL"
                  />
                </div>

                <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Link Type
                    </label>
                    <select
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.type || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          type: event.target.value as CAHLinkType,
                        })
                      }
                    >
                      {LINK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Target Audience
                    </label>
                    <select
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.targetAudience || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          targetAudience: event.target
                            .value as CAHTargetAudience,
                        })
                      }
                    >
                      {AUDIENCES.map((audience) => (
                        <option key={audience} value={audience}>
                          {audience.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    WhatsApp URL
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      className="w-full border-2 border-stone-100 p-3 pl-10 text-xs font-mono outline-none focus:border-brand-orange"
                      value={getSafeUrl(editingLink)}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          url: event.target.value,
                          whatsappUrl: event.target.value,
                        })
                      }
                      placeholder="https://chat.whatsapp.com/... or https://whatsapp.com/channel/... or https://wa.me/263..."
                    />
                    <MessageSquare
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300"
                      size={16}
                    />
                  </div>

                  {getSafeUrl(editingLink) &&
                    !validateWhatsAppUrl(getSafeUrl(editingLink)) && (
                      <p className="flex items-center gap-1 text-[9px] text-brand-orange font-bold uppercase mt-1 italic">
                        <AlertCircle size={10} /> Non-standard WhatsApp link
                        detected.
                      </p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Sector Affiliation
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.sector || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          sector: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Province
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.province || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          province: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    City / Town
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                    value={editingLink?.cityTown || ""}
                    onChange={(event) =>
                      setEditingLink({
                        ...editingLink!,
                        cityTown: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border-2 border-stone-100 p-3 text-xs font-medium outline-none focus:border-brand-orange"
                    value={editingLink?.description || ""}
                    onChange={(event) =>
                      setEditingLink({
                        ...editingLink!,
                        description: event.target.value,
                      })
                    }
                    placeholder="Describe the purpose of this group or channel..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-4 pt-4 border-t border-stone-100">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Category
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.category || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          category: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      District
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.district || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          district: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Location Link
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-mono outline-none focus:border-brand-orange"
                    value={editingLink?.locationLink || ""}
                    onChange={(event) =>
                      setEditingLink({
                        ...editingLink!,
                        locationLink: event.target.value,
                      })
                    }
                    placeholder="https://maps.google.com/..."
                  />
                </div>

                <div className="pt-4 border-t border-stone-100 space-y-4">
                  <h4 className="text-[10px] uppercase font-bold text-brand-charcoal mb-2">
                    Customer Support Details
                  </h4>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Support Number
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-mono outline-none focus:border-brand-orange"
                      value={editingLink?.supportWhatsappNumber || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          supportWhatsappNumber: event.target.value,
                        })
                      }
                      placeholder="e.g. 263771234567"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Support Message Template
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border-2 border-stone-100 p-3 text-xs font-medium outline-none focus:border-brand-orange"
                      value={editingLink?.supportMessageTemplate || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          supportMessageTemplate: event.target.value,
                        })
                      }
                      placeholder="Hello iTred Support, I need help..."
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100 space-y-4 bg-stone-50 p-4 border border-stone-200">
                  <h4 className="text-[10px] uppercase font-bold text-brand-charcoal mb-2 flex items-center gap-2">
                    <Users size={12} /> Member / Follower Tracking
                  </h4>

                  <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-stone-400">
                        Current Count
                      </label>
                      <input
                        type="number"
                        className="w-full border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange bg-white"
                        value={editingLink?.currentFollowerCount || 0}
                        onChange={(event) => {
                          const newValue = parseInt(event.target.value) || 0;
                          const previousValue =
                            editingLink?.currentFollowerCount || 0;
                          const growth = newValue - previousValue;
                          const growthPercentage =
                            previousValue > 0
                              ? (growth / previousValue) * 100
                              : 0;

                          setEditingLink((previous) => ({
                            ...previous!,
                            previousFollowerCount:
                              previous?.currentFollowerCount,
                            currentFollowerCount: newValue,
                            followerCountUpdatedAt: new Date().toISOString(),
                            followerCountUpdatedBy:
                              getSessionStaffName(getSession(), "Unknown staff"),
                            followerGrowth: growth,
                            followerGrowthPercentage: growthPercentage,
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-stone-400">
                        Previous Count
                      </label>
                      <input
                        type="number"
                        className="w-full border-2 border-stone-100 p-3 text-xs font-bold outline-none bg-stone-100 text-stone-500"
                        value={editingLink?.previousFollowerCount || 0}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-stone-400">
                        Growth
                      </label>
                      <input
                        type="number"
                        className={`w-full border-2 border-stone-100 p-3 text-xs font-bold outline-none ${
                          (editingLink?.followerGrowth || 0) > 0
                            ? "bg-green-50 text-green-700"
                            : (editingLink?.followerGrowth || 0) < 0
                              ? "bg-red-50 text-red-700"
                              : "bg-stone-100 text-stone-500"
                        }`}
                        value={editingLink?.followerGrowth || 0}
                        readOnly
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-stone-400">
                        Growth %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className={`w-full border-2 border-stone-100 p-3 text-xs font-bold outline-none ${
                          (editingLink?.followerGrowthPercentage || 0) > 0
                            ? "bg-green-50 text-green-700"
                            : (editingLink?.followerGrowthPercentage || 0) < 0
                              ? "bg-red-50 text-red-700"
                              : "bg-stone-100 text-stone-500"
                        }`}
                        value={
                          editingLink?.followerGrowthPercentage?.toFixed(2) ||
                          "0.00"
                        }
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Growth Notes
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs outline-none focus:border-brand-orange bg-white"
                      value={editingLink?.followerGrowthNotes || ""}
                      onChange={(event) =>
                        setEditingLink({
                          ...editingLink!,
                          followerGrowthNotes: event.target.value,
                        })
                      }
                      placeholder="e.g. +50 from weekend campaign"
                    />
                  </div>

                  {editingLink?.followerCountUpdatedAt && (
                    <div className="text-[8px] uppercase font-bold text-stone-400 mt-2 space-y-1">
                      <p>
                        Last Updated:{" "}
                        {new Date(
                          editingLink.followerCountUpdatedAt,
                        ).toLocaleString()}
                      </p>
                      {editingLink.followerCountUpdatedBy && (
                        <p>Updated By: {editingLink.followerCountUpdatedBy}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-4">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Deployment Status
                  </label>
                  <div className="flex gap-2">
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setEditingLink({
                            ...editingLink!,
                            status,
                          })
                        }
                        className={`flex-1 py-3 text-[10px] font-bold uppercase border transition-all ${
                          editingLink?.status === status
                            ? "bg-brand-charcoal text-white border-brand-charcoal"
                            : "bg-white text-stone-300 border-stone-100 hover:border-stone-200"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-stone-100 bg-stone-50 flex gap-4">
              <SecondaryButton
                className="flex-1"
                onClick={() => setIsFormOpen(false)}
              >
                Abort Deployment
              </SecondaryButton>

              <PrimaryButton className="flex-1" onClick={handleSaveLink}>
                Commit to Hub Registry
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {confirmConfig && (
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          variant={confirmConfig.variant}
          onConfirm={() => {
            confirmConfig.action();
            setIsConfirmOpen(false);
          }}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}

      {countModalLink && (
        <ConfirmDialog
          isOpen={isCountModalOpen}
          title="Update Member / Follower Count"
          message={`Update count for "${countModalLink.name}":`}
          variant="warning"
          onConfirm={() => {
            const session = requireSession();
            if (!session) return;
            const staffId = getSessionStaffId(session);
            const staffName = getSessionStaffName(session);
            const count = parseInt(newCountValue) || 0;
            const previousCount = countModalLink.currentFollowerCount || 0;
            const growth = count - previousCount;
            const growthPercentage =
              previousCount > 0 ? (growth / previousCount) * 100 : 0;

            const updatedLink = {
              ...countModalLink,
              previousFollowerCount: previousCount,
              currentFollowerCount: count,
              followerCountUpdatedAt: new Date().toISOString(),
              followerCountUpdatedBy: staffName,
              followerGrowth: growth,
              followerGrowthPercentage: growthPercentage,
              updatedBy: staffId,
              updatedAt: new Date().toISOString(),
            };

            cahService.saveLink(updatedLink);

            try {
              analyticsService.logEvent({
                eventType: "CAH_FOLLOWER_COUNT_UPDATED",
                actorType: getSessionRole(session),
                actorName: staffName,
                cahId: countModalLink.id,
                details: {
                  previousCount,
                  newCount: count,
                  growth,
                  growthPercentage,
                },
              });

              logService.add({
                userId: staffId,
                action: "CAH_FOLLOWER_COUNT_UPDATED",
                entityType: "cah",
                entityId: countModalLink.id,
                details: `Follower count updated from ${previousCount} to ${count} for CAH link "${countModalLink.name}".`,
                severity: "info",
              });
            } catch (auditError) {
              console.error("CAH follower audit logging failed", auditError);
            }

            void loadData();
            setIsCountModalOpen(false);
          }}
          onCancel={() => setIsCountModalOpen(false)}
        >
          <div className="mt-4">
            <input
              type="number"
              value={newCountValue}
              onChange={(event) => setNewCountValue(event.target.value)}
              placeholder="0"
              className="form-input w-full"
              autoFocus
            />
          </div>
        </ConfirmDialog>
      )}

      <BrandedAlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() =>
          setAlertConfig((previous) => ({ ...previous, isOpen: false }))
        }
      />
    </div>
  );
};

export default CAHLinksPanel;
