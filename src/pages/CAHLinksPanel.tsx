import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layers,
  Plus,
  ExternalLink,
  Copy,
  Search,
  Filter,
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
  MoreVertical,
  ChevronRight,
  Share2,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BarChart3,
} from "lucide-react";
import {
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  DataPanel,
  StatCard,
  ConfirmDialog,
} from "./CommonUI.tsx";
import { cahService } from "../services/cahService.ts";
import { logService } from "../services/logService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { permissionService } from "../services/permissionService.ts";
import { vendorService } from "../services/vendorService.ts";
import { asArray } from "../utils/safeData.ts";
import {
  CAHLink,
  CAHLinkType,
  CAHTargetAudience,
  CAHStatus,
  Vendor,
  ActivityLog,
  WhatsAppActivityLog,
  WhatsAppSourceType,
} from "../types.ts";
import { WhatsAppActivityQuickLog } from "../components/WhatsAppActivityQuickLog.tsx";

const LINK_TYPES: CAHLinkType[] = [
  "WhatsApp Channel",
  "WhatsApp Community",
  "Sector Group",
  "Vendor Support Group",
  "Customer Discovery Group",
  "RPN Support Group",
  "Catalogue Distribution Group",
  "Other",
];

const AUDIENCES: CAHTargetAudience[] = [
  "customers",
  "itred_vendors",
  "RPN",
  "backend staff",
  "mixed",
];
const STATUSES: CAHStatus[] = ["active", "inactive", "archived"];

export const CAHLinksPanel: React.FC = () => {
  const navigate = useNavigate();

  const [links, setLinks] = useState<CAHLink[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<ActivityLog[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Partial<CAHLink> | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");

  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogData, setQuickLogData] = useState<Partial<WhatsAppActivityLog>>({});

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLinks(asArray<CAHLink>(cahService.getLinks()));
    setVendors(asArray<Vendor>(await vendorService.getVendors()));
    setEvents(asArray<ActivityLog>(await analyticsService.getEvents()));
  };

  const linkUsages = useMemo(() => {
    const usages: Record<string, string[]> = {};
    const safeEvents = asArray<ActivityLog>(events);
    const safeVendors = asArray<Vendor>(vendors);

    safeEvents
      .filter(
        (e) => e.eventType === "CATALOGUE_GENERATED" && e.details?.linkIds,
      )
      .forEach((event) => {
        const linkIds = event.details?.linkIds as string[];
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
  }, [events, vendors]);

  const sectors = useMemo(
    () => Array.from(new Set(asArray<CAHLink>(links).map((l) => l.sector).filter(Boolean))),
    [links],
  );
  const provinces = useMemo(
    () => Array.from(new Set(asArray<CAHLink>(links).map((l) => l.province).filter(Boolean))),
    [links],
  );

  const analytics = useMemo(() => {
    const safeLinks = asArray<CAHLink>(links);
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
      .filter((l) => l.followerGrowth !== undefined && l.followerGrowth > 0)
      .sort((a, b) => (b.followerGrowth || 0) - (a.followerGrowth || 0))
      .slice(0, 5);

    const needsUpdate = safeLinks
      .filter((l) => {
        if (!l.followerCountUpdatedAt) return true;
        const lastUpdate = new Date(l.followerCountUpdatedAt);
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
  }, [links]);

  const filteredLinks = useMemo(() => {
    const safeLinks = asArray<CAHLink>(links);
    return safeLinks.filter((l) => {
      const matchesSearch =
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.description.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || l.type === typeFilter;
      const matchesAudience =
        audienceFilter === "all" || l.targetAudience === audienceFilter;
      const matchesStatus = statusFilter === "all" || l.status === statusFilter;
      const matchesSector = sectorFilter === "all" || l.sector === sectorFilter;
      const matchesProvince =
        provinceFilter === "all" || l.province === provinceFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesAudience &&
        matchesStatus &&
        matchesSector &&
        matchesProvince
      );
    });
  }, [
    links,
    search,
    typeFilter,
    audienceFilter,
    statusFilter,
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
      const safeLinks = asArray<CAHLink>(links);
      return {
      total: safeLinks.length,
      active: safeLinks.filter((l) => l.status === "active").length,
      whatsapp: safeLinks.filter(
        (l) =>
          l.whatsappUrl?.includes("whatsapp.com") ||
          l.whatsappUrl?.includes("wa.me"),
      ).length,
      customers: safeLinks.filter((l) => l.targetAudience === "customers").length,
      totalFollowers: safeLinks.reduce(
        (sum, l) => sum + (l.currentFollowerCount || 0),
        0,
      ),
      linksWithCounts: safeLinks.filter((l) => l.currentFollowerCount !== undefined)
        .length,
      growing: safeLinks.filter((l) => (l.followerGrowth || 0) > 0).length,
      declining: safeLinks.filter((l) => (l.followerGrowth || 0) < 0).length,
      needsUpdate: safeLinks.filter((l) => {
        if (!l.followerCountUpdatedAt) return true;
        const lastUpdate = new Date(l.followerCountUpdatedAt);
        const now = new Date();
        const daysSinceUpdate =
          (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate > 30;
      }).length
    };},
    [links],
  );

  const handleCreateLink = () => {
    setEditingLink({
      id: `CAH-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      type: "WhatsApp Channel",
      targetAudience: "customers",
      status: "active",
      sector: "",
      province: "",
      cityTown: "",
    });
    setIsFormOpen(true);
  };

  const handleEditLink = (link: CAHLink) => {
    setEditingLink(link);
    setIsFormOpen(true);
  };

  const handleSaveLink = () => {
    if (!editingLink?.name || !editingLink?.whatsappUrl) {
      alert("Name and URL are required.");
      return;
    }

    if (!cahService.validateWhatsAppUrl(editingLink.whatsappUrl)) {
      if (
        !confirm(
          "The URL does not appear to be a standard WhatsApp link. Continue anyway?",
        )
      ) {
        return;
      }
    }

    const linkToSave = {
      ...editingLink,
      updatedBy: "STAFF-ADM",
      createdBy: editingLink.createdBy || "STAFF-ADM",
    } as CAHLink;

    // Check if follower count was updated
    const existingLink = links.find((l) => l.id === linkToSave.id);
    const followerCountChanged =
      existingLink &&
      existingLink.currentFollowerCount !== linkToSave.currentFollowerCount;

    cahService.saveLink(linkToSave);

    if (followerCountChanged) {
      analyticsService.logEvent({
        eventType: "CAH_FOLLOWER_COUNT_UPDATED",
        actorType: "admin",
        actorName: "System Admin",
        cahId: linkToSave.id,
        details: {
          previousCount: existingLink?.currentFollowerCount || 0,
          newCount: linkToSave.currentFollowerCount || 0,
          growth: linkToSave.followerGrowth || 0,
          growthPercentage: linkToSave.followerGrowthPercentage || 0,
        },
      });

      logService.add({
        userId: "STAFF-ADM",
        action: "CAH_FOLLOWER_COUNT_UPDATED",
        entityType: "cah",
        entityId: linkToSave.id,
        details: `Follower count updated from ${existingLink?.currentFollowerCount || 0} to ${linkToSave.currentFollowerCount || 0} for CAH link "${linkToSave.name}".`,
        severity: "info",
      });
    }

    analyticsService.logEvent({
      eventType: "CAH_LINK_CREATED",
      actorType: "admin",
      actorName: "System Admin",
      cahId: linkToSave.id,
      details: { name: linkToSave.name, type: linkToSave.type },
    });

    logService.add({
      userId: "STAFF-ADM",
      action: editingLink.createdAt ? "CAH_LINK_UPDATED" : "CAH_LINK_CREATED",
      entityType: "cah",
      entityId: linkToSave.id,
      details: `CAH Link "${linkToSave.name}" for ${linkToSave.targetAudience} was modified.`,
      severity: "info",
    });

    loadData();
    setIsFormOpen(false);
    setEditingLink(null);
  };

  const handleDeleteLink = (id: string) => {
    if (
      confirm("Permanently archive and delete this CAH link from distribution?")
    ) {
      cahService.deleteLink(id);
      logService.add({
        userId: "STAFF-ADM",
        action: "CAH_LINK_DELETED",
        entityType: "cah",
        entityId: id,
        details: "CAH link removed from hub.",
        severity: "warning",
      });
      loadData();
    }
  };

  const handleLogActivity = (link: CAHLink) => {
    let st = "OTHER";
    if (link.type.includes("Community")) st = "WHATSAPP_COMMUNITY";
    else if (link.type.includes("Group")) st = "WHATSAPP_GROUP";
    else if (link.type.includes("Channel")) st = "WHATSAPP_CHANNEL";

    setQuickLogData({
      activityType: "OTHER",
      sourceName: link.name,
      sourceType: st as WhatsAppSourceType,
      whatsappUrl: link.whatsappUrl || (link as any).url || "",
      sector: link.sector || "",
      province: link.province || "",
      cityTown: link.cityTown || "",
      leadStatus: "NOT_APPLICABLE",
      priority: "MEDIUM",
    });
    setIsQuickLogOpen(true);
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard.");
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
    } else if (growth < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-[8px] font-bold uppercase border border-red-200">
          <TrendingDown size={8} />
          {growth} ({growthPercent.toFixed(1)}%)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-600 text-[8px] font-bold uppercase border border-stone-200">
          <Minus size={8} />
          FLAT
        </span>
      );
    }
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
      {/* Infrastructure Bar */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <StatCard
          label="Hub Assets"
          value={stats.total.toString()}
          icon={Layers}
        />
        <StatCard
          label="Live Streams"
          value={stats.active.toString()}
          icon={Check}
          variant={stats.active > 0 ? "neutral" : "warning"}
        />
        <StatCard
          label="WhatsApp Nodes"
          value={stats.whatsapp.toString()}
          icon={MessageSquare}
        />
        <StatCard
          label="Total Followers"
          value={stats.totalFollowers.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="Growing Links"
          value={stats.growing.toString()}
          icon={TrendingUp}
          variant={stats.growing > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="Need Updates"
          value={stats.needsUpdate.toString()}
          icon={Clock}
          variant={stats.needsUpdate > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Control Console */}
      <div className="bg-stone-50 border border-stone-200 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal">
              Commerce Access Hub (CAH) Control
            </h3>
            <p className="text-[10px] text-stone-400 font-mono mt-1 uppercase italic tracking-wider">
              Distribution Links // WhatsApp Community Management
            </p>
          </div>
          {permissionService.canCreate("accessHub") && <PrimaryButton
            onClick={handleCreateLink}
            className="flex items-center gap-2"
          >
            <Plus size={14} /> Deploy New Distribution Link
          </PrimaryButton>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-white border border-stone-200 p-2 shadow-sm">
          <div className="md:col-span-2 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              size={16}
            />
            <input
              type="text"
              placeholder="SEARCH ASSETS..."
              className="w-full pl-10 pr-4 py-2 border-2 border-stone-100 outline-none focus:border-brand-orange text-xs font-bold uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border border-stone-100 p-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Any Link Type</option>
            {LINK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="border border-stone-100 p-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
          >
            <option value="all">Any Audience</option>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {a.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            className="border border-stone-100 p-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
          >
            <option value="all">Any Sector</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="border border-stone-100 p-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
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
              onClick={() => setViewMode("table")}
              className={`flex-1 flex items-center justify-center border p-2 ${viewMode === "table" ? "bg-stone-100 text-brand-charcoal" : "text-stone-300"}`}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex-1 flex items-center justify-center border p-2 ${viewMode === "grid" ? "bg-stone-100 text-brand-charcoal" : "text-stone-300"}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Asset Display */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {linksInGroup.map((link) => (
                  <div
                    key={link.id}
                    className="bg-white border-2 border-stone-100 p-5 flex flex-col hover:border-brand-orange transition-all group relative"
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
                    <h4 className="text-xs font-bold uppercase text-brand-charcoal line-clamp-1">
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
                        onClick={() => window.open(link.whatsappUrl, "_blank")}
                        className="flex-1 bg-stone-100 hover:bg-stone-200 text-brand-charcoal p-2 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink size={12} />
                        <span className="text-[9px] font-bold uppercase">
                          Launch
                        </span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(link.whatsappUrl)}
                        className="p-2 border border-stone-100 hover:border-brand-orange text-stone-400 hover:text-brand-orange transition-all"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLogActivity(link)}
                        className="p-2 border border-stone-100 hover:border-brand-orange text-stone-400 hover:text-brand-orange transition-all"
                        title="Log Activity"
                      >
                        <MessageSquare size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("/whatsapp-community-bi")}
                        className="p-2 border border-stone-100 hover:border-brand-orange text-stone-400 hover:text-brand-orange transition-all"
                        title="View BI"
                      >
                        <BarChart3 size={12} />
                      </button>
                      <button
                        onClick={() => {
                          const newCount = prompt(
                            `Update follower/member count for "${link.name}":`,
                            link.currentFollowerCount?.toString() || "0",
                          );
                          if (newCount !== null) {
                            const count = parseInt(newCount) || 0;
                            const prevCount = link.currentFollowerCount || 0;
                            const growth = count - prevCount;
                            const growthPercentage =
                              prevCount > 0 ? (growth / prevCount) * 100 : 0;

                            const updatedLink = {
                              ...link,
                              previousFollowerCount: prevCount,
                              currentFollowerCount: count,
                              followerCountUpdatedAt: new Date().toISOString(),
                              followerCountUpdatedBy: "STAFF-ADM",
                              followerGrowth: growth,
                              followerGrowthPercentage: growthPercentage,
                              updatedBy: "STAFF-ADM",
                              updatedAt: new Date().toISOString(),
                            };

                            cahService.saveLink(updatedLink);

                            analyticsService.logEvent({
                              eventType: "CAH_FOLLOWER_COUNT_UPDATED",
                              actorType: "admin",
                              actorName: "System Admin",
                              cahId: link.id,
                              details: {
                                previousCount: prevCount,
                                newCount: count,
                                growth: growth,
                                growthPercentage: growthPercentage,
                              },
                            });

                            logService.add({
                              userId: "STAFF-ADM",
                              action: "CAH_FOLLOWER_COUNT_UPDATED",
                              entityType: "cah",
                              entityId: link.id,
                              details: `Follower count updated from ${prevCount} to ${count} for CAH link "${link.name}".`,
                              severity: "info",
                            });

                            loadData();
                          }
                        }}
                        className="p-2 border border-stone-100 hover:border-green-500 text-stone-400 hover:text-green-600 transition-all"
                        title="Quick Update Follower Count"
                      >
                        <Users size={12} />
                      </button>}
                      {permissionService.canEdit("accessHub") && <button
                        onClick={() => handleEditLink(link)}
                        className="p-2 border border-stone-100 hover:border-brand-orange text-stone-400 hover:text-brand-orange transition-all"
                      >
                        <Edit3 size={12} />
                      </button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredLinks.length === 0 && (
            <div className="py-32">
              <EmptyState
                icon={Layers}
                title="Hub Silent"
                description="No distribution links matching the current filters were found in the registry."
                action={
                  <SecondaryButton
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                      setAudienceFilter("all");
                    }}
                  >
                    Reset Console
                  </SecondaryButton>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <TablePanel
          title="Distribution Registry"
          subtitle={`${filteredLinks.length} links tracked in total`}
          headers={[
            "Link Name",
            "Type / Audience",
            "Location / Sector",
            "Deployments",
            "Status",
            "Actions",
          ]}
        >
          {filteredLinks.map((link) => (
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
                  {permissionService.canView("accessHub") && <button
                    onClick={() => window.open(link.whatsappUrl, "_blank")}
                    className="p-1.5 text-stone-400 hover:text-brand-charcoal transition-all"
                    title="Launch Link"
                  >
                    <ExternalLink size={14} />
                  </button>}
                  <button
                    onClick={() => handleLogActivity(link)}
                    className="p-1.5 text-stone-400 hover:text-brand-charcoal transition-all"
                    title="Log Activity"
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button
                    onClick={() => navigate("/whatsapp-community-bi")}
                    className="p-1.5 text-stone-400 hover:text-brand-charcoal transition-all"
                    title="View BI"
                  >
                    <BarChart3 size={14} />
                  </button>
                  {permissionService.canEdit("accessHub") && <button
                    onClick={() => handleEditLink(link)}
                    className="p-1.5 text-stone-400 hover:text-brand-charcoal transition-all"
                  >
                    <Edit3 size={14} />
                  </button>}
                  {permissionService.canDelete("accessHub") && <button
                    onClick={() => handleDeleteLink(link.id)}
                    className="p-1.5 text-stone-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>}
                </div>
              </td>
            </tr>
          ))}
          {filteredLinks.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-32">
                <EmptyState
                  icon={Layers}
                  title="No Data Lines"
                  description="Filter matrix returned 0 results."
                />
              </td>
            </tr>
          )}
        </TablePanel>
      )}

      {/* Analytics Dashboard */}
      <div className="space-y-8">
        <div className="bg-stone-50 border border-stone-200 p-6">
          <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal mb-6">
            CAH Growth Analytics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Top Growing CAH Links */}
            <div className="bg-white border border-stone-200 p-4">
              <h4 className="text-xs font-bold uppercase text-stone-600 mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Top Growing Links
              </h4>
              <div className="space-y-2">
                {analytics.topGrowing.length > 0 ? (
                  analytics.topGrowing.map((link, index) => (
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

            {/* Links Needing Updates */}
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
                          ? `${Math.floor((new Date().getTime() - new Date(link.followerCountUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))}d ago`
                          : "Never"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 text-xs">All links updated</p>
                )}
              </div>
            </div>

            {/* Follower Reach Summary */}
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

            {/* Followers by Type */}
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

            {/* Followers by Sector */}
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

            {/* Followers by Location */}
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

      {/* Editor Sidebar */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-brand-charcoal/40 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 border-l border-stone-200">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight">
                  {editingLink?.createdAt
                    ? "Modify Hub Protocol"
                    : "Deploy New Distribution Link"}
                </h2>
                <p className="text-[10px] uppercase font-bold text-stone-400 mt-1">
                  Registry Serial: {editingLink?.id}
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-stone-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Distribution Asset Name
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-sm font-bold uppercase outline-none focus:border-brand-orange"
                    value={editingLink?.name || ""}
                    onChange={(e) =>
                      setEditingLink({ ...editingLink!, name: e.target.value })
                    }
                    placeholder="E.G. GWERU SECTOR CHANNEL"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Link Type / Protocol
                    </label>
                    <select
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.type || ""}
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          type: e.target.value as CAHLinkType,
                        })
                      }
                    >
                      {LINK_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
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
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          targetAudience: e.target.value as CAHTargetAudience,
                        })
                      }
                    >
                      {AUDIENCES.map((a) => (
                        <option key={a} value={a}>
                          {a.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    WhatsApp Link URL
                  </label>
                  <div className="relative">
                    <input
                      type="url" className="w-full border-2 border-stone-100 p-3 pl-10 text-xs font-mono outline-none focus:border-brand-orange"
                      value={editingLink?.whatsappUrl || ""}
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          whatsappUrl: e.target.value,
                        })
                      }
                      placeholder="https://chat.whatsapp.com/... or https://whatsapp.com/channel/... or https://wa.me/263..."
                    />
                    <MessageSquare
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300"
                      size={16}
                    />
                  </div>
                  {editingLink?.whatsappUrl &&
                    !cahService.validateWhatsAppUrl(
                      editingLink.whatsappUrl,
                    ) && (
                      <p className="flex items-center gap-1 text-[9px] text-brand-orange font-bold uppercase mt-1">
                        <AlertCircle size={10} /> Non-Standard WhatsApp link
                        detected.
                      </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Sector Affiliation
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.sector || ""}
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          sector: e.target.value,
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
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          province: e.target.value,
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
                    onChange={(e) =>
                      setEditingLink({
                        ...editingLink!,
                        cityTown: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Technical Brief / Intent
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border-2 border-stone-100 p-3 text-xs font-medium outline-none focus:border-brand-orange"
                    value={editingLink?.description || ""}
                    onChange={(e) =>
                      setEditingLink({
                        ...editingLink!,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe the purpose of this group or channel..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Category
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange"
                      value={editingLink?.category || ""}
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          category: e.target.value,
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
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          district: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-stone-400">
                    Location/Booth Link
                  </label>
                  <input
                    className="w-full border-2 border-stone-100 p-3 text-xs font-mono outline-none focus:border-brand-orange"
                    value={editingLink?.locationLink || ""}
                    onChange={(e) =>
                      setEditingLink({
                        ...editingLink!,
                        locationLink: e.target.value,
                      })
                    }
                    placeholder="https://maps.google.com/..."
                  />
                </div>

                <div className="pt-4 border-t border-stone-100 space-y-4">
                  <h4 className="text-[10px] uppercase font-bold text-brand-charcoal mb-2">
                    Customer Support Configuration
                  </h4>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-stone-400">
                      Support WhatsApp Number
                    </label>
                    <input
                      className="w-full border-2 border-stone-100 p-3 text-xs font-mono outline-none focus:border-brand-orange"
                      value={editingLink?.supportWhatsappNumber || ""}
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          supportWhatsappNumber: e.target.value,
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
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          supportMessageTemplate: e.target.value,
                        })
                      }
                      placeholder="Hello iTred Support, I need help..."
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100 space-y-4 bg-stone-50 p-4 border border-stone-200">
                  <h4 className="text-[10px] uppercase font-bold text-brand-charcoal mb-2">
                    Follower / Member Tracking
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-stone-400">
                        Current Count
                      </label>
                      <input
                        type="number"
                        className="w-full border-2 border-stone-100 p-3 text-xs font-bold outline-none focus:border-brand-orange bg-white"
                        value={editingLink?.currentFollowerCount || 0}
                        onChange={(e) => {
                          const newVal = parseInt(e.target.value) || 0;
                          const prevVal =
                            editingLink?.currentFollowerCount || 0;
                          const growth = newVal - prevVal;
                          const growthPercentage =
                            prevVal > 0 ? (growth / prevVal) * 100 : 0;

                          setEditingLink((prev) => ({
                            ...prev!,
                            previousFollowerCount: prev?.currentFollowerCount,
                            currentFollowerCount: newVal,
                            followerCountUpdatedAt: new Date().toISOString(),
                            followerCountUpdatedBy: "STAFF-ADM",
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
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                      onChange={(e) =>
                        setEditingLink({
                          ...editingLink!,
                          followerGrowthNotes: e.target.value,
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
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setEditingLink({ ...editingLink!, status: s })
                        }
                        className={`flex-1 py-3 text-[10px] font-bold uppercase border transition-all ${editingLink?.status === s ? "bg-brand-charcoal text-white border-brand-charcoal" : "bg-white text-stone-300 border-stone-100 hover:border-stone-200"}`}
                      >
                        {s}
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
                Discard
              </SecondaryButton>
              <PrimaryButton className="flex-1" onClick={handleSaveLink}>
                Commit to Hub Registry
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      <WhatsAppActivityQuickLog
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        initialData={quickLogData}
      />
    </div>
  );
};

const LinkIcon = ({ size }: { size: number }) => <Layers size={size} />;
