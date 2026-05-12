/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  DataPanel,
  TablePanel,
  StatusBadge,
  StatCard,
} from "../components/CommonUI.tsx";
import {
  Users,
  Package,
  Layers,
  TrendingUp,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  ArrowUpRight,
  ShieldAlert,
  MessageCircle,
  Phone,
  Share2,
  MousePointer2,
} from "lucide-react";
import { analyticsService } from "../services/analyticsService.ts";
import { ActivityLog, EventType } from "../types.ts";

type SafeActivityLog = ActivityLog & {
  id?: string;
  eventType?: string;
  timestamp?: string | number | Date;
  vendorId?: string;
  productId?: string;
  sector?: string;
  groupId?: string;
  campaignId?: string;
  rpnId?: string;
  source?: string;
};

const normalizeEvents = (value: unknown): SafeActivityLog[] => {
  if (Array.isArray(value)) {
    return value.filter(Boolean) as SafeActivityLog[];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const possibleObject = value as Record<string, unknown>;

  if (Array.isArray(possibleObject.data)) {
    return possibleObject.data.filter(Boolean) as SafeActivityLog[];
  }

  if (Array.isArray(possibleObject.events)) {
    return possibleObject.events.filter(Boolean) as SafeActivityLog[];
  }

  if (Array.isArray(possibleObject.items)) {
    return possibleObject.items.filter(Boolean) as SafeActivityLog[];
  }

  if (Array.isArray(possibleObject.docs)) {
    return possibleObject.docs.filter(Boolean) as SafeActivityLog[];
  }

  return [];
};

const getSafeTimestamp = (timestamp: unknown): number => {
  if (!timestamp) return 0;

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  if (typeof timestamp === "number") {
    return timestamp;
  }

  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (
    typeof timestamp === "object" &&
    timestamp !== null &&
    "toDate" in timestamp &&
    typeof (timestamp as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return (timestamp as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }

  return 0;
};

const formatTimestamp = (timestamp: unknown): string => {
  const safeTime = getSafeTimestamp(timestamp);

  if (!safeTime) {
    return "No timestamp";
  }

  try {
    return new Date(safeTime).toLocaleString();
  } catch {
    return "Invalid timestamp";
  }
};

const getEventType = (event: SafeActivityLog): string => {
  return event?.eventType || "SYSTEM_EVENT";
};

const getEventId = (event: SafeActivityLog, index: number): string => {
  return (
    event?.id ||
    `${getEventType(event)}-${getSafeTimestamp(event?.timestamp)}-${index}`
  );
};

export const Analytics: React.FC = () => {
  const [events, setEvents] = useState<SafeActivityLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const loadEvents = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const result = await Promise.resolve(analyticsService.getEvents());
        const safeEvents = normalizeEvents(result);

        if (mounted) {
          setEvents(safeEvents);
        }
      } catch (error) {
        console.error("Failed to load analytics events", error);

        if (mounted) {
          setEvents([]);
          setLoadError(
            "Analytics data could not be loaded. Check Firebase permissions and storageService fallback handling.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      mounted = false;
    };
  }, []);

  const safeEvents = useMemo(() => {
    return Array.isArray(events) ? events : [];
  }, [events]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};

    safeEvents.forEach((event) => {
      const type = getEventType(event);
      counts[type] = (counts[type] || 0) + 1;
    });

    const getCount = (type: EventType | string) => counts[type] || 0;

    const catalogueViews =
      getCount("CATALOGUE_VIEWED") +
      getCount("CATALOGUE_VIEW") +
      getCount("itred_catalogue_viewed");

    const productViews =
      getCount("PRODUCT_VIEWED") +
      getCount("PRODUCT_VIEW") +
      getCount("itred_product_viewed");

    const whatsappClicks =
      getCount("WHATSAPP_ENQUIRY_CLICKED") +
      getCount("WHATSAPP_CLICKED") +
      getCount("WHATSAPP_HIT") +
      getCount("itred_whatsapp_hit");

    const phoneClicks =
      getCount("PHONE_CALL_CLICKED") +
      getCount("CALL_CLICKED") +
      getCount("PHONE_HIT");

    const shareClicks =
      getCount("CATALOGUE_SHARED") +
      getCount("SHARE_CLICKED") +
      getCount("PRODUCT_SHARED");

    const leadsCreated =
      getCount("LEAD_CREATED") +
      getCount("WHATSAPP_LEAD_CREATED") +
      getCount("CUSTOMER_ENQUIRY_CREATED");

    return {
      totalEvents: safeEvents.length,

      vendorsCreated: getCount("VENDOR_CREATED"),
      productsCreated: getCount("PRODUCT_CREATED"),
      productsUpdated: getCount("PRODUCT_UPDATED"),
      imagesUploaded: getCount("PRODUCT_IMAGE_UPLOADED"),
      imagesCompressed: getCount("PRODUCT_IMAGE_COMPRESSED"),
      cataloguesGenerated: getCount("CATALOGUE_GENERATED"),
      cataloguesDownloaded: getCount("CATALOGUE_DOWNLOADED"),
      cahLinksCreated: getCount("CAH_LINK_CREATED"),
      followUps: getCount("FOLLOW_UP_RECORDED"),
      collections: getCount("FIELD_COLLECTION_RECORDED"),

      catalogueViews,
      productViews,
      whatsappClicks,
      phoneClicks,
      shareClicks,
      leadsCreated,
    };
  }, [safeEvents]);

  const recentEvents = useMemo(() => {
    return [...safeEvents]
      .sort(
        (a, b) => getSafeTimestamp(b.timestamp) - getSafeTimestamp(a.timestamp),
      )
      .slice(0, 20);
  }, [safeEvents]);

  const sectorBreakdown = useMemo(() => {
    const sectorCounts: Record<string, number> = {};

    safeEvents.forEach((event) => {
      const sector = event?.sector || "Unknown Sector";
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });

    return Object.entries(sectorCounts)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [safeEvents]);

  const hasNoEvents = !loading && safeEvents.length === 0;

  return (
    <div className="pb-20">
      <PageHeader
        title="Performance Analytics"
        subtitle="iTred tracking for vendor activity, catalogue views, WhatsApp hits, product interest, lead generation, and field operations."
      />

      {loadError && (
        <div className="mt-6 p-4 border-2 border-red-100 bg-red-50 text-red-700 flex gap-3">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1">
              Analytics Load Warning
            </p>
            <p className="text-xs leading-relaxed">{loadError}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-8 p-6 border-2 border-stone-100 bg-white text-stone-500 text-xs font-bold uppercase tracking-widest">
          Loading performance analytics...
        </div>
      )}

      {hasNoEvents && (
        <div className="mt-8 p-6 border-2 border-orange-100 bg-orange-50 text-brand-charcoal">
          <div className="flex items-start gap-4">
            <MousePointer2
              size={22}
              className="text-brand-orange shrink-0 mt-0.5"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2">
                No Performance Analytics Yet
              </p>
              <p className="text-sm leading-relaxed text-stone-600">
                Start by sharing tracked catalogue links, recording WhatsApp
                enquiry clicks, logging product views, or capturing vendor lead
                updates. Once events are recorded, this dashboard will show
                sector and vendor performance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 mt-8">
        <StatCard
          label="Vendor Growth"
          value={stats.vendorsCreated.toString()}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          label="Product Velocity"
          value={stats.productsCreated.toString()}
          icon={Package}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          label="WhatsApp Hits"
          value={stats.whatsappClicks.toString()}
          icon={MessageCircle}
          trend={{ value: 18, isPositive: true }}
        />
        <StatCard
          label="Catalogues Generated"
          value={stats.cataloguesGenerated.toString()}
          icon={FileText}
          trend={{ value: 22, isPositive: true }}
        />
      </div>

      {/* WhatsApp Intelligence Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <MiniMetric
          label="Catalogue Views"
          value={stats.catalogueViews}
          icon={<FileText size={16} />}
        />
        <MiniMetric
          label="Product Views"
          value={stats.productViews}
          icon={<Package size={16} />}
        />
        <MiniMetric
          label="WhatsApp Clicks"
          value={stats.whatsappClicks}
          icon={<MessageCircle size={16} />}
        />
        <MiniMetric
          label="Phone Clicks"
          value={stats.phoneClicks}
          icon={<Phone size={16} />}
        />
        <MiniMetric
          label="Shares"
          value={stats.shareClicks}
          icon={<Share2 size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Performance Metrics */}
        <div className="lg:col-span-2 space-y-8">
          <DataPanel
            title="Operation Breakdown"
            subtitle="Detailed count of administrative, WhatsApp, catalogue, product and field actions."
          >
            <div className="p-8 grid grid-cols-2 md:grid-cols-3 gap-8">
              <StatItem
                label="Price Updates"
                value={stats.productsUpdated}
                icon={<TrendingUp size={16} />}
              />
              <StatItem
                label="Field Collections"
                value={stats.collections}
                icon={<Layers size={16} />}
              />
              <StatItem
                label="Follow-ups"
                value={stats.followUps}
                icon={<CheckCircle2 size={16} />}
              />
              <StatItem
                label="Downloads"
                value={stats.cataloguesDownloaded}
                icon={<ArrowUpRight size={16} />}
              />
              <StatItem
                label="CAH Links"
                value={stats.cahLinksCreated}
                icon={<TrendingUp size={16} />}
              />
              <StatItem
                label="Leads Created"
                value={stats.leadsCreated}
                icon={<MessageCircle size={16} />}
              />
            </div>
          </DataPanel>

          <TablePanel
            title="Real-time Event Feed"
            subtitle="The last 20 atomic operations recorded in the iTred environment."
            headers={["Event Type", "Timestamp", "Context", "Status"]}
          >
            {recentEvents.length > 0 ? (
              recentEvents.map((event, index) => (
                <tr
                  key={getEventId(event, index)}
                  className="hover:bg-stone-50 border-b border-stone-100 last:border-0"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-brand-orange" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">
                        {getEventType(event).replace(/_/g, " ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-stone-400 font-mono">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="px-6 py-4 text-[10px] font-bold text-stone-600">
                    {event.vendorId
                      ? `Vendor: ${String(event.vendorId).substring(0, 8)}...`
                      : event.sector
                        ? `Sector: ${event.sector}`
                        : "System wide"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status="processed" variant="success" />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-xs text-stone-400 italic"
                >
                  No events recorded yet. Start by generating tracked catalogue
                  links or recording WhatsApp enquiry clicks.
                </td>
              </tr>
            )}
          </TablePanel>
        </div>

        {/* Right Side: System Health / Summary */}
        <div className="space-y-8">
          <DataPanel title="Data Density" subtitle="System resource usage.">
            <div className="p-6 space-y-6">
              <ProgressItem label="Product Catalogue Coverage" percent={85} />
              <ProgressItem label="Vendor Onboarding Rate" percent={64} />
              <ProgressItem label="Price Accuracy Index" percent={92} />
              <ProgressItem label="Image Coverage Index" percent={78} />
            </div>
          </DataPanel>

          <DataPanel
            title="Sector Activity"
            subtitle="Top sectors by recorded analytics events."
          >
            <div className="p-6 space-y-4">
              {sectorBreakdown.length > 0 ? (
                sectorBreakdown.map((item) => (
                  <div
                    key={item.sector}
                    className="flex items-center justify-between border-b border-stone-100 pb-3 last:border-0 last:pb-0"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                      {item.sector}
                    </span>
                    <span className="text-sm font-black text-brand-charcoal">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-stone-400 italic">
                  No sector activity available yet.
                </p>
              )}
            </div>
          </DataPanel>

          <div className="card bg-brand-charcoal text-white p-8">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp size={20} className="text-brand-orange" />
              <h3 className="text-xs uppercase font-bold tracking-[0.2em]">
                Growth Insight
              </h3>
            </div>
            <p className="text-sm italic leading-relaxed opacity-80 mb-6">
              {stats.totalEvents > 0
                ? `The system has recorded ${stats.totalEvents.toLocaleString()} analytics events. WhatsApp hits, catalogue views, product views and lead activity will become the basis for sector oversight and vendor intelligence reports.`
                : "No analytics events have been recorded yet. Start by deploying tracked catalogue links and capturing WhatsApp enquiry clicks."}
            </p>
            <div className="pt-6 border-t border-white/10 text-[9px] uppercase font-bold tracking-widest text-stone-400">
              Generated at {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="p-6 border-2 border-red-50 text-red-700 bg-red-50 flex gap-4">
            <ShieldAlert size={20} className="shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1">
                System Alert
              </p>
              <p className="text-[10px] leading-relaxed">
                If analytics collections fail to load, confirm Firestore rules
                allow authenticated reads for analytics collections and public
                create access for click/hit event collections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatItem: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-stone-400">
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-widest leading-none">
        {label}
      </span>
    </div>
    <div className="text-xl font-bold tracking-tighter">
      {Number(value || 0).toLocaleString()}
    </div>
  </div>
);

const MiniMetric: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="bg-white border-2 border-stone-100 p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="text-stone-400">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest text-brand-orange">
        Live
      </span>
    </div>
    <div className="text-2xl font-black tracking-tighter text-brand-charcoal">
      {Number(value || 0).toLocaleString()}
    </div>
    <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-stone-400">
      {label}
    </div>
  </div>
);

const ProgressItem: React.FC<{ label: string; percent: number }> = ({
  label,
  percent,
}) => {
  const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
        <span>{label}</span>
        <span className="text-brand-orange">{safePercent}%</span>
      </div>
      <div className="w-full h-1 bg-stone-100 overflow-hidden">
        <div
          className="h-full bg-brand-charcoal transition-all duration-500"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
};
