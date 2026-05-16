/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  StatCard,
  DataPanel,
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  SearchInput,
  FormField,
} from "../components/CommonUI.tsx";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  DollarSign,
  Download,
  Megaphone,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { vendorService } from "../services/vendorService.ts";
import { staffService } from "../services/staffService.ts";
import { rpnService } from "../services/rpnService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { settingsService } from "../services/settingsService.ts";
import { subscriptionService } from "../services/subscriptionService.ts";
import { permissionService } from "../services/permissionService.ts";
import { notificationService } from "../services/notificationService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import {
  CollectionRecord,
  MarketingCampaign,
  MarketingCampaignType,
  PricingPlan,
  RPN,
  Staff,
  SystemSettings,
  Vendor,
} from "../types.ts";
import { asArray } from "../utils/safeData.ts";

type DashboardTab =
  | "executive"
  | "scorecards"
  | "onboarding"
  | "portfolio"
  | "revenue"
  | "areaSector"
  | "trends"
  | "resilience"
  | "bonus"
  | "campaigns"
  | "alerts";

type RpnNode = {
  id: string;
  name: string;
  territory: string;
  province?: string;
  cityTown?: string;
  district?: string;
  status?: string;
  startDate?: string;
  type: "staff" | "external";
};

type RpnScorecard = RpnNode & {
  vendors: Vendor[];
  activeDaysWorked: number;
  onboardingToday: number;
  onboardingWeek: number;
  onboardingMonth: number;
  onboardingYear: number;
  onboardingTotal: number;
  dailyTarget: number;
  weeklyTarget: number;
  monthlyTarget: number;
  targetAchievement: number;
  daysTargetMet: number;
  daysTargetMissed: number;
  goodStreak: number;
  missedStreak: number;
  activeVendors: number;
  returningVendors: number;
  churnedVendors: number;
  overdueVendors: number;
  churnRiskVendors: number;
  retentionRate: number;
  churnRate: number;
  actualRevenueWeek: number;
  actualRevenueMonth: number;
  actualRevenueYear: number;
  actualRevenueLifetime: number;
  estimatedRevenueMonth: number;
  estimatedRevenueLifetime: number;
  revenuePerVendor: number;
  averageVendorValue: number;
  commissionPayable: number;
  bestSector: string;
  weakestSector: string;
  bestArea: string;
  weakestArea: string;
  fastestGrowingSector: string;
  bestDayOfWeek: string;
  bestDayOfMonth: string;
  bestWeekOfMonth: string;
  sectorDiversity: number;
  areaDiversity: number;
  resilienceScore: number;
  resilienceLabel: string;
  bonusEligible: boolean;
  bonusRecommendation: string;
  supportRecommendation: string;
  campaignAttributedVendors: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  alerts: string[];
};

const tabs: { id: DashboardTab; label: string }[] = [
  { id: "executive", label: "Executive Summary" },
  { id: "scorecards", label: "RPN Scorecards" },
  { id: "onboarding", label: "Onboarding Tracker" },
  { id: "portfolio", label: "Active Vendor Portfolio" },
  { id: "revenue", label: "Revenue Contribution" },
  { id: "areaSector", label: "Area & Sector Performance" },
  { id: "trends", label: "Daily/Weekly/Monthly Trends" },
  { id: "resilience", label: "Market Resilience" },
  { id: "bonus", label: "Bonus & Support Review" },
  { id: "campaigns", label: "Campaign Intelligence" },
  { id: "alerts", label: "Underperformance Alerts" },
];

const campaignTypes: MarketingCampaignType[] = [
  "Radio",
  "TV",
  "Roadshow",
  "WhatsApp",
  "Flyer",
  "Social Media",
  "Referral",
  "Commerce Access Hub",
  "Other",
];

const defaultRpnSettings = {
  dailyOnboardingTarget: 2,
  weeklyOnboardingTarget: 10,
  monthlyOnboardingTarget: 40,
  minimumActiveVendorRetentionRate: 85,
  bonusEligibilityTargetPercent: 100,
  underperformanceAlertDays: 3,
  churnRiskThreshold: 15,
  minimumRevenueContributionTarget: 0,
  campaignAttributionWindowDays: 14,
  dailyOnboardingThreshold: 2,
  weeklyOnboardingThreshold: 10,
  monthlyOnboardingThreshold: 40,
  churnWarningPercent: 15,
  minimumCollectionRatePercent: 70,
  graceDaysBeforeWarning: 3,
  subscriptionDueWarningDays: 3,
  subscriptionOverdueEscalationDays: 2,
  enableThresholdAlerts: true,
  requireApprovalForThresholdChange: false,
  updatedAt: new Date().toISOString(),
};

const formatMoney = (value: number) =>
  `$${Math.round(value || 0).toLocaleString()}`;

const dateOnly = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const daysBetween = (start: Date, end: Date) =>
  Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
};

const countBy = <T,>(items: T[], getKey: (item: T) => string) => {
  const record: Record<string, number> = {};
  items.forEach((item) => {
    const key = getKey(item) || "Unspecified";
    record[key] = (record[key] || 0) + 1;
  });
  return record;
};

const topKey = (record: Record<string, number>, fallback = "N/A") =>
  Object.entries(record).sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;

const getPlanValue = (vendor: Vendor, plans: PricingPlan[]) =>
  vendor.monthlyPlanValue ||
  plans.find((plan) => plan.id === vendor.planId)?.monthlyPrice ||
  0;

const buildCsv = (rows: RpnScorecard[]) => {
  const header = [
    "RPN",
    "Territory",
    "Today",
    "Week",
    "Month",
    "Target %",
    "Active Vendors",
    "Retention %",
    "Churn %",
    "Actual Month Revenue",
    "Estimated Month Revenue",
    "Resilience",
    "Bonus",
    "Support Recommendation",
  ];
  const body = rows.map((row) =>
    [
      row.name,
      row.territory,
      row.onboardingToday,
      row.onboardingWeek,
      row.onboardingMonth,
      row.targetAchievement.toFixed(1),
      row.activeVendors,
      row.retentionRate.toFixed(1),
      row.churnRate.toFixed(1),
      row.actualRevenueMonth,
      row.estimatedRevenueMonth,
      row.resilienceScore,
      row.bonusRecommendation,
      row.supportRecommendation,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
};

export const RPNPerformanceDashboard: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [externalRpns, setExternalRpns] = useState<RPN[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({});
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>("executive");
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [campaignForm, setCampaignForm] = useState<Partial<MarketingCampaign>>({
    campaignType: "Radio",
    status: "active",
    assignedRpnIds: [],
  });

  useEffect(() => {
    const loadData = async () => {
      const [rawVendors, rawStaff, rawRpns, rawSettings, rawPlans] =
        await Promise.all([
          vendorService.getVendors(),
          staffService.getAllStaff(),
          Promise.resolve(rpnService.getAll()),
          settingsService.getSettings(),
          pricingPlanService.getPlans(),
        ]);
      setVendors(asArray<Vendor>(rawVendors));
      setStaffList(asArray<Staff>(rawStaff));
      setExternalRpns(asArray<RPN>(rawRpns));
      setSettings(rawSettings || {});
      setPlans(asArray<PricingPlan>(rawPlans));
      setCollections(asArray<CollectionRecord>(subscriptionService.getAllCollections()));
      setCampaigns(asArray<MarketingCampaign>(rpnService.getCampaigns()));
    };
    void loadData();
  }, []);

  const rpnSettings = useMemo(
    () => ({
      ...defaultRpnSettings,
      ...(settings.rpnPerformanceSettings || {}),
    }),
    [settings.rpnPerformanceSettings],
  );

  const dailyTarget =
    rpnSettings.dailyOnboardingTarget ?? rpnSettings.dailyOnboardingThreshold;
  const weeklyTarget =
    rpnSettings.weeklyOnboardingTarget ?? rpnSettings.weeklyOnboardingThreshold;
  const monthlyTarget =
    rpnSettings.monthlyOnboardingTarget ??
    rpnSettings.monthlyOnboardingThreshold;
  const retentionTarget =
    rpnSettings.minimumActiveVendorRetentionRate ??
    rpnSettings.recurringVendorRetentionTarget ??
    85;
  const churnThreshold =
    rpnSettings.churnRiskThreshold ?? rpnSettings.churnWarningPercent ?? 15;
  const revenueTarget =
    rpnSettings.minimumRevenueContributionTarget ??
    rpnSettings.minimumRecurringRevenueTarget ??
    0;

  const rpnNodes = useMemo<RpnNode[]>(() => {
    const staffRpns = staffList
      .filter((staff) => {
        const role = (staff.role || "").toLowerCase();
        return (
          role.includes("rpn") ||
          role.includes("agent") ||
          role.includes("field") ||
          role.includes("sales")
        );
      })
      .map((staff) => ({
        id: staff.id,
        name: staff.displayName || staff.fullName,
        territory: staff.assignedBranchId || "Unassigned",
        status: staff.status,
        startDate: (staff as any).createdAt,
        type: "staff" as const,
      }));

    const external = externalRpns.map((rpn) => ({
      id: rpn.id,
      name: rpn.name,
      territory: rpn.territory || rpn.cityTown || rpn.district || "Unassigned",
      province: rpn.province,
      cityTown: rpn.cityTown,
      district: rpn.district,
      status: rpn.status,
      startDate: rpn.createdAt,
      type: "external" as const,
    }));

    return [...staffRpns, ...external];
  }, [externalRpns, staffList]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const onboarded = dateOnly(vendor.onboardedAt || vendor.createdAt);
      if (dateFrom && onboarded && onboarded < dateFrom) return false;
      if (dateTo && onboarded && onboarded > dateTo) return false;
      if (
        regionFilter &&
        !`${vendor.province} ${vendor.cityTown} ${vendor.district} ${vendor.suburb}`
          .toLowerCase()
          .includes(regionFilter.toLowerCase())
      )
        return false;
      if (
        sectorFilter &&
        !vendor.sector?.toLowerCase().includes(sectorFilter.toLowerCase())
      )
        return false;
      if (
        campaignFilter &&
        vendor.campaignCode !== campaignFilter &&
        vendor.campaignSource !== campaignFilter
      )
        return false;
      return true;
    });
  }, [campaignFilter, dateFrom, dateTo, regionFilter, sectorFilter, vendors]);

  const collectionByVendor = useMemo(() => {
    const map = new Map<string, CollectionRecord[]>();
    collections
      .filter((collection) => collection.status === "approved")
      .forEach((collection) => {
        map.set(collection.vendorId, [
          ...(map.get(collection.vendorId) || []),
          collection,
        ]);
      });
    return map;
  }, [collections]);

  const scorecards = useMemo<RpnScorecard[]>(() => {
    const now = new Date();
    const today = dateOnly(now.toISOString());
    const weekStart = dateOnly(startOfWeek(now).toISOString());
    const monthStart = dateOnly(new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    const yearStart = `${now.getFullYear()}-01-01`;

    return rpnNodes.map((rpn) => {
      const rpnVendors = filteredVendors.filter(
        (vendor) =>
          vendor.rpnId === rpn.id ||
          vendor.assignedRPNId === rpn.id ||
          vendor.onboardedByStaffId === rpn.id,
      );

      const onboardDate = (vendor: Vendor) =>
        dateOnly(vendor.onboardedAt || vendor.createdAt);
      const onboardingToday = rpnVendors.filter((v) => onboardDate(v) === today).length;
      const onboardingWeek = rpnVendors.filter((v) => onboardDate(v) >= weekStart).length;
      const onboardingMonth = rpnVendors.filter((v) => onboardDate(v) >= monthStart).length;
      const onboardingYear = rpnVendors.filter((v) => onboardDate(v) >= yearStart).length;
      const activeVendors = rpnVendors.filter((v) => v.status === "active").length;
      const returningVendors = rpnVendors.filter((v) =>
        ["active", "paid"].includes(v.subscriptionStatus),
      ).length;
      const churnedVendors = rpnVendors.filter(
        (v) => v.churnStatus === "churned" || v.status === "cancelled",
      ).length;
      const overdueVendors = rpnVendors.filter(
        (v) => v.subscriptionStatus === "overdue",
      ).length;
      const churnRiskVendors = rpnVendors.filter(
        (v) =>
          v.churnStatus === "at_risk" ||
          v.subscriptionStatus === "overdue" ||
          v.status === "dormant",
      ).length;

      const retentionRate =
        rpnVendors.length > 0 ? (activeVendors / rpnVendors.length) * 100 : 0;
      const churnRate =
        rpnVendors.length > 0 ? (churnedVendors / rpnVendors.length) * 100 : 0;
      const targetAchievement =
        monthlyTarget > 0 ? (onboardingMonth / monthlyTarget) * 100 : 0;

      const byDate = countBy(rpnVendors, onboardDate);
      const sortedDates = Object.keys(byDate).sort();
      const daysTargetMet = Object.values(byDate).filter(
        (count) => count >= dailyTarget,
      ).length;
      const daysTargetMissed = Object.values(byDate).filter(
        (count) => count < dailyTarget,
      ).length;
      let goodStreak = 0;
      let missedStreak = 0;
      [...sortedDates].reverse().every((key) => {
        if ((byDate[key] || 0) >= dailyTarget) {
          goodStreak++;
          return true;
        }
        return false;
      });
      [...sortedDates].reverse().every((key) => {
        if ((byDate[key] || 0) < dailyTarget) {
          missedStreak++;
          return true;
        }
        return false;
      });

      const areaCounts = countBy(
        rpnVendors,
        (v) => v.suburb || v.cityTown || v.district || "Unspecified",
      );
      const sectorCounts = countBy(rpnVendors, (v) => v.sector || "Unspecified");
      const bestSector = topKey(sectorCounts);
      const bestArea = topKey(areaCounts);
      const weakestSector =
        Object.entries(sectorCounts).sort((a, b) => a[1] - b[1])[0]?.[0] ||
        "N/A";
      const weakestArea =
        Object.entries(areaCounts).sort((a, b) => a[1] - b[1])[0]?.[0] ||
        "N/A";

      const dayCounts = countBy(rpnVendors, (v) => {
        const date = new Date(v.onboardedAt || v.createdAt);
        return Number.isNaN(date.getTime())
          ? "N/A"
          : date.toLocaleDateString(undefined, { weekday: "long" });
      });
      const monthDayCounts = countBy(rpnVendors, (v) => {
        const date = new Date(v.onboardedAt || v.createdAt);
        return Number.isNaN(date.getTime()) ? "N/A" : String(date.getDate());
      });
      const weekOfMonthCounts = countBy(rpnVendors, (v) => {
        const date = new Date(v.onboardedAt || v.createdAt);
        return Number.isNaN(date.getTime())
          ? "N/A"
          : `Week ${Math.ceil(date.getDate() / 7)}`;
      });

      const sumCollections = (from?: string) =>
        rpnVendors.reduce((total, vendor) => {
          const vendorCollections = collectionByVendor.get(vendor.id) || [];
          return (
            total +
            vendorCollections
              .filter((collection) => !from || collection.collectionDate >= from)
              .reduce((sum, collection) => sum + collection.amountCollected, 0)
          );
        }, 0);
      const actualRevenueWeek = sumCollections(weekStart);
      const actualRevenueMonth = sumCollections(monthStart);
      const actualRevenueYear = sumCollections(yearStart);
      const actualRevenueLifetime = sumCollections();
      const estimatedRevenueMonth = rpnVendors.reduce(
        (sum, vendor) => sum + getPlanValue(vendor, plans),
        0,
      );
      const estimatedRevenueLifetime = rpnVendors.reduce(
        (sum, vendor) =>
          sum + (vendor.lifetimeValue || getPlanValue(vendor, plans) * 12),
        0,
      );
      const revenuePerVendor =
        rpnVendors.length > 0 ? actualRevenueLifetime / rpnVendors.length : 0;
      const averageVendorValue =
        rpnVendors.length > 0 ? estimatedRevenueLifetime / rpnVendors.length : 0;
      const commissionPayable = actualRevenueMonth * 0.05;
      const activeDaysWorked = rpn.startDate
        ? daysBetween(new Date(rpn.startDate), now) + 1
        : sortedDates.length;

      const sectorDiversity = Object.keys(sectorCounts).length;
      const areaDiversity = Object.keys(areaCounts).length;
      const campaignAttributedVendors = rpnVendors.filter(
        (v) => v.campaignCode || v.campaignSource || v.heardAboutUsVia,
      ).length;
      const revenueGrowth = actualRevenueMonth > 0 ? 10 : 0;
      const resilienceScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            targetAchievement * 0.28 +
              retentionRate * 0.22 +
              Math.min(100, (actualRevenueMonth / Math.max(1, revenueTarget || 1)) * 100) *
                0.16 +
              Math.min(100, sectorDiversity * 12) * 0.1 +
              Math.min(100, areaDiversity * 10) * 0.08 +
              Math.max(0, 100 - churnRate * 4) * 0.12 +
              Math.min(100, goodStreak * 15 + revenueGrowth) * 0.04,
          ),
        ),
      );
      const resilienceLabel =
        resilienceScore >= 80
          ? "Strong Performer"
          : resilienceScore >= 60
            ? "Resilient"
            : resilienceScore >= 40
              ? "Needs Support"
              : "Weak";
      const bonusEligible =
        targetAchievement >= rpnSettings.bonusEligibilityTargetPercent &&
        retentionRate >= retentionTarget &&
        churnRate <= churnThreshold &&
        actualRevenueMonth >= revenueTarget;
      const supportRecommendation =
        onboardingMonth < monthlyTarget * 0.5 && retentionRate >= retentionTarget
          ? "Needs Better Leads"
          : onboardingMonth >= monthlyTarget && churnRate > churnThreshold
            ? "Train on vendor quality"
            : sectorDiversity <= 1 && rpnVendors.length > 3
              ? "Needs Campaign Support"
              : actualRevenueMonth < revenueTarget
                ? "Push plan upgrades"
                : missedStreak >= rpnSettings.underperformanceAlertDays
                  ? "Manager intervention"
                  : "Maintain field plan";
      const alerts = [
        missedStreak >= rpnSettings.underperformanceAlertDays
          ? `Missed daily target ${missedStreak} days in a row`
          : "",
        onboardingWeek < weeklyTarget ? "Below weekly onboarding target" : "",
        churnRate > churnThreshold ? "High churn risk" : "",
        actualRevenueMonth < revenueTarget ? "Revenue below expected" : "",
      ].filter(Boolean);
      const riskLevel =
        alerts.length >= 3 || resilienceScore < 40
          ? "Critical"
          : alerts.length >= 2
            ? "High"
            : alerts.length === 1
              ? "Medium"
              : "Low";

      return {
        ...rpn,
        vendors: rpnVendors,
        activeDaysWorked,
        onboardingToday,
        onboardingWeek,
        onboardingMonth,
        onboardingYear,
        onboardingTotal: rpnVendors.length,
        dailyTarget,
        weeklyTarget,
        monthlyTarget,
        targetAchievement,
        daysTargetMet,
        daysTargetMissed,
        goodStreak,
        missedStreak,
        activeVendors,
        returningVendors,
        churnedVendors,
        overdueVendors,
        churnRiskVendors,
        retentionRate,
        churnRate,
        actualRevenueWeek,
        actualRevenueMonth,
        actualRevenueYear,
        actualRevenueLifetime,
        estimatedRevenueMonth,
        estimatedRevenueLifetime,
        revenuePerVendor,
        averageVendorValue,
        commissionPayable,
        bestSector,
        weakestSector,
        bestArea,
        weakestArea,
        fastestGrowingSector: bestSector,
        bestDayOfWeek: topKey(dayCounts),
        bestDayOfMonth: topKey(monthDayCounts),
        bestWeekOfMonth: topKey(weekOfMonthCounts),
        sectorDiversity,
        areaDiversity,
        resilienceScore,
        resilienceLabel,
        bonusEligible,
        bonusRecommendation: bonusEligible ? "Bonus Eligible" : "Not Eligible",
        supportRecommendation,
        campaignAttributedVendors,
        riskLevel,
        alerts,
      };
    });
  }, [
    collectionByVendor,
    dailyTarget,
    filteredVendors,
    monthlyTarget,
    plans,
    retentionTarget,
    revenueTarget,
    rpnNodes,
    rpnSettings.bonusEligibilityTargetPercent,
    rpnSettings.underperformanceAlertDays,
    churnThreshold,
    weeklyTarget,
  ]);

  const visibleScorecards = useMemo(() => {
    const query = search.toLowerCase();
    return scorecards
      .filter(
        (rpn) =>
          rpn.name.toLowerCase().includes(query) ||
          rpn.territory.toLowerCase().includes(query) ||
          rpn.bestSector.toLowerCase().includes(query),
      )
      .sort((a, b) => b.resilienceScore - a.resilienceScore);
  }, [scorecards, search]);

  const executive = useMemo(() => {
    const activeVendors = vendors.filter((v) => v.status === "active").length;
    const returningVendors = vendors.filter((v) =>
      ["active", "paid"].includes(v.subscriptionStatus),
    ).length;
    const churnedVendors = vendors.filter(
      (v) => v.churnStatus === "churned" || v.status === "cancelled",
    ).length;
    const topOnboarding = [...scorecards].sort(
      (a, b) => b.onboardingMonth - a.onboardingMonth,
    )[0];
    const topRevenue = [...scorecards].sort(
      (a, b) => b.actualRevenueMonth - a.actualRevenueMonth,
    )[0];
    const highestRisk = [...scorecards].sort(
      (a, b) => a.resilienceScore - b.resilienceScore,
    )[0];
    const avgRetention =
      scorecards.length > 0
        ? scorecards.reduce((sum, item) => sum + item.retentionRate, 0) /
          scorecards.length
        : 0;
    return {
      totalRpn: scorecards.length,
      activeRpn: scorecards.filter((r) => r.status !== "inactive").length,
      today: scorecards.reduce((sum, item) => sum + item.onboardingToday, 0),
      week: scorecards.reduce((sum, item) => sum + item.onboardingWeek, 0),
      month: scorecards.reduce((sum, item) => sum + item.onboardingMonth, 0),
      activeVendors,
      returningVendors,
      churnedVendors,
      revenueWeek: scorecards.reduce((sum, item) => sum + item.actualRevenueWeek, 0),
      revenueMonth: scorecards.reduce((sum, item) => sum + item.actualRevenueMonth, 0),
      revenueYear: scorecards.reduce((sum, item) => sum + item.actualRevenueYear, 0),
      avgRetention,
      campaignAttributed: vendors.filter(
        (v) => v.campaignCode || v.campaignSource || v.heardAboutUsVia,
      ).length,
      topOnboarding: topOnboarding?.name || "N/A",
      topRevenue: topRevenue?.name || "N/A",
      highestRisk: highestRisk?.name || "N/A",
    };
  }, [scorecards, vendors]);

  const campaignMatrix = useMemo(() => {
    return campaigns.map((campaign) => {
      const matchedVendors = vendors.filter(
        (vendor) =>
          vendor.campaignCode === campaign.campaignCode ||
          vendor.campaignSource === campaign.campaignName,
      );
      const active = matchedVendors.filter((v) => v.status === "active").length;
      const churned = matchedVendors.filter(
        (v) => v.churnStatus === "churned" || v.status === "cancelled",
      ).length;
      const revenue = matchedVendors.reduce((sum, vendor) => {
        const actual = (collectionByVendor.get(vendor.id) || []).reduce(
          (total, collection) => total + collection.amountCollected,
          0,
        );
        return sum + actual;
      }, 0);
      const byRpn = countBy(matchedVendors, (v) => {
        const id = v.rpnId || v.assignedRPNId || v.onboardedByStaffId || "";
        return scorecards.find((rpn) => rpn.id === id)?.name || "Unassigned";
      });
      const retention = matchedVendors.length
        ? (active / matchedVendors.length) * 100
        : 0;
      const roi = campaign.budget > 0 ? revenue / campaign.budget : 0;
      const recommendation =
        matchedVendors.length === 0
          ? "Stop or retarget sector"
          : roi >= 2 && retention >= retentionTarget
            ? "Scale to more areas"
            : retention < retentionTarget
              ? "Support RPN"
              : "Continue";
      return {
        ...campaign,
        vendorsOnboarded: matchedVendors.length,
        activeVendors: active,
        churnedVendors: churned,
        revenue,
        retention,
        costPerVendor:
          matchedVendors.length > 0 ? campaign.budget / matchedVendors.length : 0,
        roi,
        bestRpn: topKey(byRpn),
        weakRpn:
          Object.entries(byRpn).sort((a, b) => a[1] - b[1])[0]?.[0] || "N/A",
        bestArea: topKey(countBy(matchedVendors, (v) => v.suburb || v.cityTown)),
        bestSector: topKey(countBy(matchedVendors, (v) => v.sector)),
        recommendation,
      };
    });
  }, [campaigns, collectionByVendor, retentionTarget, scorecards, vendors]);

  useEffect(() => {
    if (!rpnSettings.enableThresholdAlerts || scorecards.length === 0) return;
    const today = new Date().toISOString().split("T")[0];
    scorecards.forEach((rpn) => {
      rpn.alerts.forEach((alert) => {
        const alertType = alert.toLowerCase().replace(/\s+/g, "_");
        void notificationService.createNotification({
          title: `RPN Performance Alert: ${rpn.name}`,
          message: alert,
          type: "system_alert",
          priority: rpn.riskLevel === "Critical" ? "critical" : "high",
          targetRole: "RPN Manager",
          recordType: "rpn",
          recordId: rpn.id,
          dedupeKey: `${alertType}:${rpn.id}:${today}`,
        });
      });
    });
    campaignMatrix
      .filter(
        (campaign) =>
          campaign.budget > 0 &&
          (campaign.vendorsOnboarded === 0 || campaign.retention < retentionTarget),
      )
      .forEach((campaign) => {
        void notificationService.createNotification({
          title: `Campaign Performance Alert: ${campaign.campaignName}`,
          message:
            campaign.vendorsOnboarded === 0
              ? "Campaign spending is active but onboarding is low."
              : "Campaign onboarding exists but retention is below target.",
          type: "system_alert",
          priority: "high",
          targetRole: "Admin",
          recordType: "marketing_campaign",
          recordId: campaign.id,
          dedupeKey: `campaign_performance:${campaign.id}:${today}`,
        });
      });
  }, [
    campaignMatrix,
    retentionTarget,
    rpnSettings.enableThresholdAlerts,
    scorecards,
  ]);

  const isManagerView =
    permissionService.canViewRpnFinancials() ||
    permissionService.canSetRpnThresholds();

  const currentSession = (() => {
    try {
      return JSON.parse(localStorage.getItem("activeStaffSession") || "{}");
    } catch {
      return {};
    }
  })();

  const currentRpn =
    !isManagerView && scorecards.find((rpn) => rpn.id === currentSession.staffId);

  const saveCampaign = () => {
    if (!campaignForm.campaignName || !campaignForm.startDate) return;
    const now = new Date().toISOString();
    const campaign: MarketingCampaign = {
      id:
        campaignForm.id ||
        `CMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      campaignName: campaignForm.campaignName,
      campaignType: campaignForm.campaignType || "Other",
      startDate: campaignForm.startDate,
      endDate: campaignForm.endDate || campaignForm.startDate,
      targetArea: campaignForm.targetArea || "",
      targetSector: campaignForm.targetSector || "",
      budget: Number(campaignForm.budget || 0),
      message: campaignForm.message || "",
      channelPartner: campaignForm.channelPartner || "",
      assignedRpnIds: campaignForm.assignedRpnIds || [],
      campaignCode:
        campaignForm.campaignCode ||
        `SCI-${String(Date.now()).slice(-6)}`.toUpperCase(),
      status: campaignForm.status || "active",
      createdAt: campaignForm.createdAt || now,
      updatedAt: now,
    };
    rpnService.saveCampaign(campaign);
    setCampaigns(rpnService.getCampaigns());
    setCampaignForm({ campaignType: "Radio", status: "active", assignedRpnIds: [] });
    void staffAuditService.logAction({
      eventType: campaignForm.id ? "RECORD_UPDATED" : "RECORD_CREATED",
      module: "analytics",
      action: `${campaignForm.id ? "Updated" : "Created"} marketing campaign ${campaign.campaignName}`,
      severity: "info",
      recordType: "marketing_campaign",
      recordId: campaign.id,
      recordName: campaign.campaignName,
      afterSnapshot: campaign,
    });
  };

  const exportCsv = () => {
    const blob = new Blob([buildCsv(visibleScorecards)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rpn-performance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (currentRpn) {
    return (
      <div className="space-y-6 pb-20">
        <PageHeader title="My RPN Performance" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="My Target Today" value={String(currentRpn.dailyTarget)} icon={Target} />
          <StatCard label="Onboarded Today" value={String(currentRpn.onboardingToday)} icon={Users} />
          <StatCard
            label="Left To Target"
            value={String(Math.max(0, currentRpn.dailyTarget - currentRpn.onboardingToday))}
            icon={Activity}
            variant="warning"
          />
          <StatCard label="My Active Vendors" value={String(currentRpn.activeVendors)} icon={Briefcase} />
          <StatCard label="Follow-up Vendors" value={String(currentRpn.overdueVendors)} icon={AlertTriangle} variant="warning" />
          <StatCard label="Best Sector" value={currentRpn.bestSector} icon={BarChart3} />
          <StatCard label="Commission Estimate" value={formatMoney(currentRpn.commissionPayable)} icon={DollarSign} variant="success" />
          <StatCard label="Monthly Progress" value={`${currentRpn.targetAchievement.toFixed(0)}%`} icon={TrendingUp} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="RPN Performance & Marketing Campaign Intelligence"
        subtitle="Management control layer for onboarding, retention, revenue, campaign ROI and support eligibility."
        actions={
          permissionService.canExport("rpnManagement") && (
            <SecondaryButton onClick={exportCsv}>
              <Download size={14} className="mr-2" /> Export CSV
            </SecondaryButton>
          )
        }
      />

      <div className="bg-white border border-stone-200 p-3 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 px-3 py-2 text-[10px] font-black uppercase border ${
              activeTab === tab.id
                ? "bg-brand-charcoal text-white border-brand-charcoal"
                : "bg-white text-stone-500 border-stone-200 hover:border-brand-orange"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-stone-50 border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-3 sticky top-0 z-10">
        <SearchInput
          placeholder="Search RPN, sector, territory..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="md:col-span-2"
        />
        <input
          value={regionFilter}
          onChange={(event) => setRegionFilter(event.target.value)}
          placeholder="Region / area"
          className="border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
        />
        <input
          value={sectorFilter}
          onChange={(event) => setSectorFilter(event.target.value)}
          placeholder="Sector"
          className="border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
        />
        <select
          value={campaignFilter}
          onChange={(event) => setCampaignFilter(event.target.value)}
          className="border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange bg-white"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.campaignCode}>
              {campaign.campaignName}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
          />
        </div>
      </div>

      {activeTab === "executive" && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <StatCard label="Total RPN" value={String(executive.totalRpn)} icon={Users} />
          <StatCard label="Active RPN" value={String(executive.activeRpn)} icon={ShieldCheck} />
          <StatCard label="Vendors Today" value={String(executive.today)} icon={Activity} />
          <StatCard label="Vendors Week" value={String(executive.week)} icon={CalendarDays} />
          <StatCard label="Vendors Month" value={String(executive.month)} icon={Target} />
          <StatCard label="Active Vendors" value={String(executive.activeVendors)} icon={Briefcase} />
          <StatCard label="Returning Vendors" value={String(executive.returningVendors)} icon={TrendingUp} />
          <StatCard label="Churned Vendors" value={String(executive.churnedVendors)} icon={TrendingDown} variant="error" />
          <StatCard label="Revenue Week" value={formatMoney(executive.revenueWeek)} icon={DollarSign} variant="success" />
          <StatCard label="Revenue Month" value={formatMoney(executive.revenueMonth)} icon={DollarSign} variant="success" />
          <StatCard label="Revenue YTD" value={formatMoney(executive.revenueYear)} icon={DollarSign} />
          <StatCard label="Avg Retention" value={`${executive.avgRetention.toFixed(1)}%`} icon={ShieldCheck} />
          <StatCard label="Campaign Vendors" value={String(executive.campaignAttributed)} icon={Megaphone} />
          <StatCard label="Top Onboarding" value={executive.topOnboarding} icon={Users} />
          <StatCard label="Top Revenue" value={executive.topRevenue} icon={DollarSign} />
          <StatCard label="Highest Risk" value={executive.highestRisk} icon={AlertTriangle} variant="warning" />
        </div>
      )}

      {activeTab === "scorecards" && (
        <ScorecardTable scorecards={visibleScorecards} />
      )}

      {activeTab === "onboarding" && (
        <OnboardingTracker scorecards={visibleScorecards} />
      )}

      {activeTab === "portfolio" && (
        <PortfolioTable scorecards={visibleScorecards} plans={plans} />
      )}

      {activeTab === "revenue" && (
        <RevenueTable scorecards={visibleScorecards} />
      )}

      {activeTab === "areaSector" && (
        <AreaSectorTable scorecards={visibleScorecards} />
      )}

      {activeTab === "trends" && (
        <TrendTable scorecards={visibleScorecards} />
      )}

      {activeTab === "resilience" && (
        <ResilienceTable scorecards={visibleScorecards} />
      )}

      {activeTab === "bonus" && (
        <BonusTable scorecards={visibleScorecards} />
      )}

      {activeTab === "campaigns" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <DataPanel title="Create Campaign" className="xl:col-span-1">
            <div className="p-4 space-y-3">
              <FormField label="Campaign Name">
                <input
                  value={campaignForm.campaignName || ""}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({
                      ...prev,
                      campaignName: event.target.value,
                    }))
                  }
                  className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
                />
              </FormField>
              <FormField label="Campaign Type">
                <select
                  value={campaignForm.campaignType || "Other"}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({
                      ...prev,
                      campaignType: event.target.value as MarketingCampaignType,
                    }))
                  }
                  className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange bg-white"
                >
                  {campaignTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Start">
                  <input
                    type="date"
                    value={campaignForm.startDate || ""}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                    className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
                  />
                </FormField>
                <FormField label="End">
                  <input
                    type="date"
                    value={campaignForm.endDate || ""}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({
                        ...prev,
                        endDate: event.target.value,
                      }))
                    }
                    className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Area">
                  <input
                    value={campaignForm.targetArea || ""}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({
                        ...prev,
                        targetArea: event.target.value,
                      }))
                    }
                    className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
                  />
                </FormField>
                <FormField label="Sector">
                  <input
                    value={campaignForm.targetSector || ""}
                    onChange={(event) =>
                      setCampaignForm((prev) => ({
                        ...prev,
                        targetSector: event.target.value,
                      }))
                    }
                    className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
                  />
                </FormField>
              </div>
              <FormField label="Budget">
                <input
                  type="number"
                  value={campaignForm.budget || 0}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({
                      ...prev,
                      budget: Number(event.target.value),
                    }))
                  }
                  className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
                />
              </FormField>
              <FormField label="Message">
                <textarea
                  value={campaignForm.message || ""}
                  onChange={(event) =>
                    setCampaignForm((prev) => ({
                      ...prev,
                      message: event.target.value,
                    }))
                  }
                  className="w-full border border-stone-200 p-2 text-xs font-bold outline-none focus:border-brand-orange"
                  rows={3}
                />
              </FormField>
              <PrimaryButton onClick={saveCampaign}>Save Campaign</PrimaryButton>
            </div>
          </DataPanel>
          <CampaignTable campaigns={campaignMatrix} />
        </div>
      )}

      {activeTab === "alerts" && (
        <AlertTable scorecards={visibleScorecards} campaigns={campaignMatrix} />
      )}
    </div>
  );
};

const ScorecardTable: React.FC<{ scorecards: RpnScorecard[] }> = ({
  scorecards,
}) => (
  <TablePanel
    title="RPN Scorecards"
    headers={[
      "RPN",
      "Area",
      "Targets",
      "Onboarding",
      "Achievement",
      "Portfolio",
      "Revenue",
      "Best Sector",
      "Risk",
      "Recommendation",
    ]}
  >
    {scorecards.map((rpn) => (
      <tr key={rpn.id} className="hover:bg-stone-50">
        <td className="px-4 py-3 text-xs font-black uppercase">{rpn.name}</td>
        <td className="px-4 py-3 text-[10px] font-bold uppercase">{rpn.territory}</td>
        <td className="px-4 py-3 text-[10px] font-mono">
          D{rpn.dailyTarget} / W{rpn.weeklyTarget} / M{rpn.monthlyTarget}
        </td>
        <td className="px-4 py-3 text-[10px] font-mono">
          {rpn.onboardingToday} / {rpn.onboardingWeek} / {rpn.onboardingMonth}
        </td>
        <td className="px-4 py-3 text-[10px] font-black">
          {rpn.targetAchievement.toFixed(1)}%
        </td>
        <td className="px-4 py-3 text-[10px] font-mono">
          {rpn.activeVendors} active, {rpn.churnedVendors} churned
        </td>
        <td className="px-4 py-3 text-[10px] font-bold text-emerald-700">
          {formatMoney(rpn.actualRevenueMonth)}
        </td>
        <td className="px-4 py-3 text-[10px] font-bold uppercase">{rpn.bestSector}</td>
        <td className="px-4 py-3">
          <StatusBadge
            status={rpn.riskLevel}
            variant={rpn.riskLevel === "Low" ? "success" : rpn.riskLevel === "Medium" ? "warning" : "error"}
          />
        </td>
        <td className="px-4 py-3 text-[10px] font-bold uppercase">{rpn.supportRecommendation}</td>
      </tr>
    ))}
  </TablePanel>
);

const OnboardingTracker: React.FC<{ scorecards: RpnScorecard[] }> = ({
  scorecards,
}) => (
  <TablePanel
    title="Onboarding Tracker"
    headers={["RPN", "Day", "Week", "Month", "Year", "Since Start", "Met", "Missed", "Good Streak", "Missed Streak"]}
  >
    {scorecards.map((rpn) => (
      <tr key={rpn.id}>
        <td className="px-4 py-3 text-xs font-black uppercase">{rpn.name}</td>
        <td className="px-4 py-3 font-mono text-xs">{rpn.onboardingToday}</td>
        <td className="px-4 py-3 font-mono text-xs">{rpn.onboardingWeek}</td>
        <td className="px-4 py-3 font-mono text-xs">{rpn.onboardingMonth}</td>
        <td className="px-4 py-3 font-mono text-xs">{rpn.onboardingYear}</td>
        <td className="px-4 py-3 font-mono text-xs">{rpn.onboardingTotal}</td>
        <td className="px-4 py-3 font-mono text-xs text-emerald-600">{rpn.daysTargetMet}</td>
        <td className="px-4 py-3 font-mono text-xs text-orange-600">{rpn.daysTargetMissed}</td>
        <td className="px-4 py-3 font-mono text-xs">{rpn.goodStreak}</td>
        <td className="px-4 py-3 font-mono text-xs">{rpn.missedStreak}</td>
      </tr>
    ))}
  </TablePanel>
);

const PortfolioTable: React.FC<{
  scorecards: RpnScorecard[];
  plans: PricingPlan[];
}> = ({ scorecards, plans }) => (
  <div className="space-y-6">
    {scorecards.map((rpn) => (
      <DataPanel
        key={rpn.id}
        title={`${rpn.name} Portfolio`}
        subtitle={`${rpn.activeVendors} active, ${rpn.returningVendors} recurring, ${rpn.overdueVendors} overdue, ${rpn.churnRiskVendors} churn risk`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              {rpn.vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-stone-100">
                  <td className="px-4 py-3 text-xs font-black uppercase">{vendor.name}</td>
                  <td className="px-4 py-3 text-[10px] uppercase">{vendor.sector}</td>
                  <td className="px-4 py-3 text-[10px] uppercase">{vendor.suburb || vendor.cityTown}</td>
                  <td className="px-4 py-3 text-[10px]">{dateOnly(vendor.onboardedAt || vendor.createdAt) || "N/A"}</td>
                  <td className="px-4 py-3 text-[10px] uppercase">{plans.find((p) => p.id === vendor.planId)?.name || vendor.planId}</td>
                  <td className="px-4 py-3"><StatusBadge status={vendor.subscriptionStatus} /></td>
                  <td className="px-4 py-3 text-[10px] font-bold">{formatMoney(vendor.lifetimeValue || getPlanValue(vendor, plans))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>
    ))}
  </div>
);

const RevenueTable: React.FC<{ scorecards: RpnScorecard[] }> = ({
  scorecards,
}) => (
  <TablePanel
    title="Revenue Contribution"
    subtitle="Actual Revenue comes from approved payment records. Estimated Revenue uses plan value when payment data is missing."
    headers={["RPN", "Actual Week", "Actual Month", "Actual Year", "Actual Lifetime", "Estimated Month", "Estimated Lifetime", "Commission", "Revenue/Vendor", "Avg Vendor Value"]}
  >
    {scorecards.map((rpn) => (
      <tr key={rpn.id}>
        <td className="px-4 py-3 text-xs font-black uppercase">{rpn.name}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.actualRevenueWeek)}</td>
        <td className="px-4 py-3 text-xs font-mono text-emerald-700">{formatMoney(rpn.actualRevenueMonth)}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.actualRevenueYear)}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.actualRevenueLifetime)}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.estimatedRevenueMonth)}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.estimatedRevenueLifetime)}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.commissionPayable)}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.revenuePerVendor)}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.averageVendorValue)}</td>
      </tr>
    ))}
  </TablePanel>
);

const AreaSectorTable: React.FC<{ scorecards: RpnScorecard[] }> = ({
  scorecards,
}) => (
  <TablePanel
    title="Area & Sector Performance"
    headers={["RPN", "Strongest Area", "Weakest Area", "Best Sector", "Weakest Sector", "Fastest Growing Sector", "Area Diversity", "Sector Diversity", "Output"]}
  >
    {scorecards.map((rpn) => (
      <tr key={rpn.id}>
        <td className="px-4 py-3 text-xs font-black uppercase">{rpn.name}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{rpn.bestArea}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{rpn.weakestArea}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{rpn.bestSector}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{rpn.weakestSector}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{rpn.fastestGrowingSector}</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.areaDiversity}</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.sectorDiversity}</td>
        <td className="px-4 py-3 text-[10px] font-bold">
          {rpn.bestArea} is this RPN's strongest area. {rpn.bestSector} gives the strongest onboarding signal.
        </td>
      </tr>
    ))}
  </TablePanel>
);

const TrendTable: React.FC<{ scorecards: RpnScorecard[] }> = ({ scorecards }) => (
  <TablePanel
    title="Daily / Weekly / Monthly Trends"
    headers={["RPN", "Best Day", "Best Month Day", "Best Week", "Zero/Missed Days", "Advice"]}
  >
    {scorecards.map((rpn) => (
      <tr key={rpn.id}>
        <td className="px-4 py-3 text-xs font-black uppercase">{rpn.name}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{rpn.bestDayOfWeek}</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.bestDayOfMonth}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{rpn.bestWeekOfMonth}</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.daysTargetMissed}</td>
        <td className="px-4 py-3 text-[10px] font-bold">
          Deploy field support around {rpn.bestDayOfWeek}; use campaign pushes during {rpn.bestWeekOfMonth}.
        </td>
      </tr>
    ))}
  </TablePanel>
);

const ResilienceTable: React.FC<{ scorecards: RpnScorecard[] }> = ({
  scorecards,
}) => (
  <TablePanel
    title="Market Resilience"
    headers={["RPN", "Score", "Label", "Target %", "Retention %", "Churn %", "Diversity", "Recommendation"]}
  >
    {scorecards.map((rpn) => (
      <tr key={rpn.id}>
        <td className="px-4 py-3 text-xs font-black uppercase">{rpn.name}</td>
        <td className="px-4 py-3 text-xs font-black">{rpn.resilienceScore}</td>
        <td className="px-4 py-3"><StatusBadge status={rpn.resilienceLabel} variant={rpn.resilienceScore >= 60 ? "success" : "warning"} /></td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.targetAchievement.toFixed(1)}%</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.retentionRate.toFixed(1)}%</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.churnRate.toFixed(1)}%</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.areaDiversity} areas / {rpn.sectorDiversity} sectors</td>
        <td className="px-4 py-3 text-[10px] font-bold uppercase">{rpn.supportRecommendation}</td>
      </tr>
    ))}
  </TablePanel>
);

const BonusTable: React.FC<{ scorecards: RpnScorecard[] }> = ({ scorecards }) => (
  <TablePanel
    title="Bonus & Support Review"
    headers={["RPN", "Achievement", "Retention", "Revenue", "Churn", "Resilience", "Bonus", "Support"]}
  >
    {scorecards.map((rpn) => (
      <tr key={rpn.id}>
        <td className="px-4 py-3 text-xs font-black uppercase">{rpn.name}</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.targetAchievement.toFixed(1)}%</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.retentionRate.toFixed(1)}%</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(rpn.actualRevenueMonth)}</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.churnRate.toFixed(1)}%</td>
        <td className="px-4 py-3 text-xs font-mono">{rpn.resilienceScore}</td>
        <td className="px-4 py-3"><StatusBadge status={rpn.bonusRecommendation} variant={rpn.bonusEligible ? "success" : "neutral"} /></td>
        <td className="px-4 py-3 text-[10px] font-bold uppercase">{rpn.supportRecommendation}</td>
      </tr>
    ))}
  </TablePanel>
);

const CampaignTable: React.FC<{ campaigns: any[] }> = ({ campaigns }) => (
  <TablePanel
    title="Campaign Matrix"
    className="xl:col-span-2"
    headers={["Campaign", "Type", "Area", "Sector", "Dates", "Budget", "Vendors", "Active", "Revenue", "Retention", "CPV", "ROI", "Best RPN", "Weak RPN", "Recommendation"]}
  >
    {campaigns.map((campaign) => (
      <tr key={campaign.id}>
        <td className="px-4 py-3 text-xs font-black uppercase">{campaign.campaignName}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{campaign.campaignType}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{campaign.targetArea || "All"}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{campaign.targetSector || "All"}</td>
        <td className="px-4 py-3 text-[10px] font-mono">{campaign.startDate} - {campaign.endDate}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(campaign.budget)}</td>
        <td className="px-4 py-3 text-xs font-mono">{campaign.vendorsOnboarded}</td>
        <td className="px-4 py-3 text-xs font-mono">{campaign.activeVendors}</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(campaign.revenue)}</td>
        <td className="px-4 py-3 text-xs font-mono">{campaign.retention.toFixed(1)}%</td>
        <td className="px-4 py-3 text-xs font-mono">{formatMoney(campaign.costPerVendor)}</td>
        <td className="px-4 py-3 text-xs font-mono">{campaign.roi.toFixed(2)}x</td>
        <td className="px-4 py-3 text-[10px] uppercase">{campaign.bestRpn}</td>
        <td className="px-4 py-3 text-[10px] uppercase">{campaign.weakRpn}</td>
        <td className="px-4 py-3 text-[10px] font-bold uppercase">{campaign.recommendation}</td>
      </tr>
    ))}
  </TablePanel>
);

const AlertTable: React.FC<{ scorecards: RpnScorecard[]; campaigns: any[] }> = ({
  scorecards,
  campaigns,
}) => (
  <DataPanel title="Underperformance Alerts">
    <div className="p-4 space-y-3">
      {scorecards.flatMap((rpn) =>
        rpn.alerts.map((alert) => (
          <div key={`${rpn.id}-${alert}`} className="border border-orange-200 bg-orange-50 p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-orange-900">{rpn.name}</p>
              <p className="text-[10px] font-bold text-orange-800">{alert}</p>
            </div>
            <StatusBadge status={rpn.riskLevel} variant={rpn.riskLevel === "Medium" ? "warning" : "error"} />
          </div>
        )),
      )}
      {campaigns
        .filter((campaign) => campaign.recommendation !== "Continue")
        .map((campaign) => (
          <div key={campaign.id} className="border border-stone-200 bg-white p-3">
            <p className="text-xs font-black uppercase text-brand-charcoal">{campaign.campaignName}</p>
            <p className="text-[10px] font-bold text-stone-500">
              {campaign.recommendation}: budget {formatMoney(campaign.budget)}, vendors {campaign.vendorsOnboarded}, retention {campaign.retention.toFixed(1)}%.
            </p>
          </div>
        ))}
    </div>
  </DataPanel>
);
