/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  StatCard,
  DataPanel,
  TablePanel,
  StatusBadge,
  PrimaryButton,
  SecondaryButton,
  SearchInput,
} from "../components/CommonUI.tsx";
import {
  Activity as ActivityIcon,
  Users,
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  X,
  MapPin,
  Clock,
  Briefcase,
} from "lucide-react";
import { vendorService } from "../services/vendorService.ts";
import { staffService } from "../services/staffService.ts";
import { rpnService } from "../services/rpnService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { settingsService } from "../services/settingsService.ts";
import { permissionService } from "../services/permissionService.ts";
import { notificationService } from "../services/notificationService.ts";
import { Vendor, Staff, RPN, SystemSettings, PricingPlan } from "../types.ts";
import { asArray } from "../utils/safeData.ts";

export const RPNPerformanceDashboard: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [externalRpns, setExternalRpns] = useState<RPN[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({});
  const [plans, setPlans] = useState<PricingPlan[]>([]);

  const [search, setSearch] = useState("");
  const [selectedRpn, setSelectedRpn] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "portfolio" | "financial" | "churn" | "notes"
  >("portfolio");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [rawVendors, rawStaff, rawRpns, rawSettings, rawPlans] =
          await Promise.all([
            vendorService.getVendors(),
            staffService.getAllStaff(),
            rpnService.getAll(),
            settingsService.getSettings(),
            pricingPlanService.getPlans(),
          ]);

        setVendors(asArray<Vendor>(rawVendors));
        setStaffList(asArray<Staff>(rawStaff));
        setExternalRpns(asArray<RPN>(rawRpns));
        setSettings(rawSettings || {});
        setPlans(asArray<PricingPlan>(rawPlans));
      } catch (error) {
        console.error("Failed to load RPN performance data", error);
      }
    };
    loadData();
  }, []);

  const rpnData = useMemo(() => {
    const staffRpns = staffList
      .filter((s) => {
        const role = (s.role || "").toLowerCase();
        return (
          role.includes("rpn") ||
          role.includes("agent") ||
          role.includes("field") ||
          role.includes("sales")
        );
      })
      .map((s) => ({
        id: s.id,
        name: s.displayName || s.fullName,
        territory: s.assignedBranchId || "N/A",
        type: "staff",
      }));

    const extRpns = externalRpns.map((r) => ({
      id: r.id,
      name: r.name,
      territory: r.territory || r.cityTown || "N/A",
      type: "external",
    }));

    return [...staffRpns, ...extRpns];
  }, [staffList, externalRpns]);

  const rpnPerformance = useMemo(() => {
    const rpnSettings = settings.rpnPerformanceSettings || {
      dailyOnboardingThreshold: 4,
      weeklyOnboardingThreshold: 20,
      monthlyOnboardingThreshold: 80,
      churnWarningPercent: 15,
      churnWarningRate: 15,
      recurringVendorRetentionTarget: 85,
      minimumRecurringRevenueTarget: 0,
      overdueVendorFollowUpDays: 2,
      inactiveAssignedVendorDays: 14,
      minimumCollectionRatePercent: 70,
      graceDaysBeforeWarning: 3,
      subscriptionDueWarningDays: 3,
      subscriptionOverdueEscalationDays: 2,
      enableThresholdAlerts: true,
      requireApprovalForThresholdChange: false,
      updatedAt: new Date().toISOString(),
    };

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = startOfWeek.toISOString().split("T")[0];

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

    return rpnData.map((rpn) => {
      const rpnVendors = vendors.filter(
        (v) =>
          v.rpnId === rpn.id ||
          v.assignedRPNId === rpn.id ||
          v.onboardedByStaffId === rpn.id,
      );

      let vendorsOnboardedToday = 0;
      let vendorsOnboardedThisWeek = 0;
      let vendorsOnboardedThisMonth = 0;
      let vendorsOnboardedToDate = rpnVendors.length;

      let activeVendors = 0;
      let trialVendors = 0;
      let overdueVendors = 0;
      let dueSoonVendors = 0;
      let churnedVendors = 0;
      let recurringVendors = 0;
      let monthlyRecurringValue = 0;
      let lifetimeValueOnboarded = 0;
      let churnValueLost = 0;
      const assignedVendorFollowUps: Vendor[] = [];
      const retentionRiskVendors: Vendor[] = [];

      rpnVendors.forEach((v) => {
        const onboardedAt = v.onboardedAt
          ? v.onboardedAt.split("T")[0]
          : v.createdAt
            ? v.createdAt.split("T")[0]
            : "";

        if (onboardedAt === todayStr) vendorsOnboardedToday++;
        if (onboardedAt >= startOfWeekStr) vendorsOnboardedThisWeek++;
        if (onboardedAt >= startOfMonthStr) vendorsOnboardedThisMonth++;

        if (v.status === "active") activeVendors++;
        if (v.subscriptionStatus === "trial") trialVendors++;
        if (v.subscriptionStatus === "overdue") overdueVendors++;
        if (v.churnStatus === "churned") churnedVendors++;

        if (v.subscriptionDueDate) {
          const dueDate = new Date(v.subscriptionDueDate);
          const daysUntilDue = Math.ceil(
            (dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24),
          );
          const overdueDays = Math.max(0, -daysUntilDue);
          if (
            daysUntilDue >= 0 &&
            daysUntilDue <= rpnSettings.subscriptionDueWarningDays
          ) {
            dueSoonVendors++;
            assignedVendorFollowUps.push(v);
          }
          if (overdueDays >= rpnSettings.subscriptionOverdueEscalationDays) {
            if (!assignedVendorFollowUps.some((item) => item.id === v.id)) {
              assignedVendorFollowUps.push(v);
            }
            retentionRiskVendors.push(v);
          }
        }

        if (
          v.subscriptionStatus === "overdue" ||
          v.churnStatus === "at_risk" ||
          v.churnStatus === "churned" ||
          v.status === "cancelled"
        ) {
          if (!retentionRiskVendors.some((item) => item.id === v.id)) {
            retentionRiskVendors.push(v);
          }
        }

        const planValue =
          v.monthlyPlanValue ||
          plans.find((p) => p.id === v.planId)?.monthlyPrice ||
          0;

        if (
          v.subscriptionStatus === "active" ||
          v.subscriptionStatus === "paid"
        ) {
          recurringVendors++;
          monthlyRecurringValue += planValue;
        }

        if (v.churnStatus === "churned") {
          churnValueLost += planValue;
        }

        lifetimeValueOnboarded += v.lifetimeValue || planValue * 12;
      });

      const churnRate =
        vendorsOnboardedToDate > 0
          ? (churnedVendors / vendorsOnboardedToDate) * 100
          : 0;
      const retentionScore = Math.max(
        0,
        Math.round(
          100 -
            overdueVendors * 8 -
            churnedVendors * 15 -
            retentionRiskVendors.length * 5,
        ),
      );

      let thresholdStatus = "dormant";
      if (
        vendorsOnboardedThisMonth >= rpnSettings.monthlyOnboardingThreshold &&
        vendorsOnboardedThisWeek >= rpnSettings.weeklyOnboardingThreshold
      ) {
        thresholdStatus = "excellent";
      } else if (
        vendorsOnboardedThisMonth >= rpnSettings.monthlyOnboardingThreshold ||
        vendorsOnboardedThisWeek >= rpnSettings.weeklyOnboardingThreshold ||
        vendorsOnboardedToday >= rpnSettings.dailyOnboardingThreshold
      ) {
        thresholdStatus = "on_track";
      } else if (
        vendorsOnboardedThisMonth <
          rpnSettings.monthlyOnboardingThreshold * 0.5 &&
        vendorsOnboardedToDate > 0
      ) {
        thresholdStatus = "at_risk";
      } else if (vendorsOnboardedToDate > 0) {
        thresholdStatus = "below_target";
      }

      return {
        ...rpn,
        vendorsOnboardedToday,
        vendorsOnboardedThisWeek,
        vendorsOnboardedThisMonth,
        vendorsOnboardedToDate,
        activeVendors,
        trialVendors,
        overdueVendors,
        dueSoonVendors,
        churnedVendors,
        churnRate,
        retentionScore,
        retentionRiskCount: retentionRiskVendors.length,
        assignedVendorFollowUps,
        retentionRiskVendors,
        recurringVendors,
        monthlyRecurringValue,
        lifetimeValueOnboarded,
        churnValueLost,
        thresholdStatus,
        dailyVariance:
          vendorsOnboardedToday - rpnSettings.dailyOnboardingThreshold,
        weeklyVariance:
          vendorsOnboardedThisWeek - rpnSettings.weeklyOnboardingThreshold,
        monthlyVariance:
          vendorsOnboardedThisMonth - rpnSettings.monthlyOnboardingThreshold,
        vendors: rpnVendors,
      };
    });
  }, [rpnData, vendors, settings, plans]);

  useEffect(() => {
    if (!settings.rpnPerformanceSettings?.enableThresholdAlerts) return;
    if (rpnPerformance.length === 0) return;

    // Notification automation temporarily disabled until runtime stability confirmed.
    return;

    const evaluateRpnThresholdAlerts = async () => {
      const allNotifs = await notificationService.getAll();
      const today = new Date().toISOString().split("T")[0];
      const rpnSettings = settings.rpnPerformanceSettings!;

      rpnPerformance.forEach((rpn) => {
        const createAlert = async (
          alertType: string,
          priority: "medium" | "high" | "critical",
          title: string,
          message: string,
        ) => {
          const existing = allNotifs.find(
            (n) =>
              n.recordId === rpn.id &&
              n.recordType === "rpn" &&
              n.title.includes(alertType) &&
              n.createdAt.startsWith(today),
          );

          if (!existing) {
            await notificationService.createNotification({
              title: `${title} - ${rpn.name}`,
              message,
              type: "system_alert",
              priority,
              recordType: "rpn",
              recordId: rpn.id,
            });
            allNotifs.push({
              id: "temp",
              title: `${title} - ${rpn.name}`,
              message,
              type: "system_alert",
              priority,
              recordType: "rpn",
              recordId: rpn.id,
              status: "unread",
              createdAt: new Date().toISOString(),
            });
          }
        };

        if (rpn.vendorsOnboardedToday < rpnSettings.dailyOnboardingThreshold) {
          void createAlert(
            "Daily Threshold",
            "medium",
            "Daily Threshold Missed",
            `Variance: ${rpn.dailyVariance}. RPN ${rpn.name} onboarded ${rpn.vendorsOnboardedToday} vendors today. Target is ${rpnSettings.dailyOnboardingThreshold}. Action: Review daily activity.`,
          );
        }
        if (
          rpn.vendorsOnboardedThisWeek < rpnSettings.weeklyOnboardingThreshold
        ) {
          void createAlert(
            "Weekly Threshold",
            "high",
            "Weekly Threshold Missed",
            `Variance: ${rpn.weeklyVariance}. RPN ${rpn.name} onboarded ${rpn.vendorsOnboardedThisWeek} vendors this week. Target is ${rpnSettings.weeklyOnboardingThreshold}. Action: Schedule performance review.`,
          );
        }
        if (
          rpn.vendorsOnboardedThisMonth < rpnSettings.monthlyOnboardingThreshold
        ) {
          void createAlert(
            "Monthly Threshold",
            "high",
            "Monthly Threshold Missed",
            `Variance: ${rpn.monthlyVariance}. RPN ${rpn.name} onboarded ${rpn.vendorsOnboardedThisMonth} vendors this month. Target is ${rpnSettings.monthlyOnboardingThreshold}. Action: Escalate to management.`,
          );
        }
        if (rpn.churnRate > rpnSettings.churnWarningPercent) {
          void createAlert(
            "Churn Risk",
            "critical",
            "High Churn Risk",
            `Variance: +${(rpn.churnRate - rpnSettings.churnWarningPercent).toFixed(1)}%. RPN ${rpn.name} has a churn rate of ${rpn.churnRate.toFixed(1)}%. Warning threshold is ${rpnSettings.churnWarningPercent}%. Action: Implement retention strategy.`,
          );
        }

        const lastOnboarded = [...rpn.vendors].sort((a, b) => {
          const dA = a.onboardedAt || a.createdAt;
          const dB = b.onboardedAt || b.createdAt;
          return new Date(dB).getTime() - new Date(dA).getTime();
        })[0];

        if (lastOnboarded) {
          const lastDate = lastOnboarded.onboardedAt || lastOnboarded.createdAt;
          const daysSince = Math.floor(
            (new Date().getTime() - new Date(lastDate).getTime()) /
              (1000 * 3600 * 24),
          );
          if (daysSince > rpnSettings.graceDaysBeforeWarning) {
            void createAlert(
              "Inactivity",
              "high",
              "RPN Inactivity Alert",
              `Variance: +${daysSince - rpnSettings.graceDaysBeforeWarning} days. RPN ${rpn.name} has not onboarded a new vendor in ${daysSince} days. Grace period is ${rpnSettings.graceDaysBeforeWarning} days. Action: Check agent status.`,
            );
          }
        }

        const overduePct =
          rpn.vendorsOnboardedToDate > 0
            ? (rpn.overdueVendors / rpn.vendorsOnboardedToDate) * 100
            : 0;
        if (overduePct > 20) {
          void createAlert(
            "Overdue Portfolio",
            "critical",
            "High Overdue Portfolio",
            `Variance: +${(overduePct - 20).toFixed(1)}%. RPN ${rpn.name} has ${rpn.overdueVendors} overdue vendors (${overduePct.toFixed(1)}% of portfolio). Action: Immediate collection follow-up required.`,
          );
        }
      });
    };

    void evaluateRpnThresholdAlerts();
  }, [rpnPerformance, settings]);

  const filteredPerformance = useMemo(() => {
    const st = search.toLowerCase();
    return rpnPerformance
      .filter(
        (r) =>
          r.name.toLowerCase().includes(st) ||
          r.territory.toLowerCase().includes(st),
      )
      .sort(
        (a, b) => b.vendorsOnboardedThisMonth - a.vendorsOnboardedThisMonth,
      );
  }, [rpnPerformance, search]);

  const overviewStats = useMemo(() => {
    let onboardedToday = 0;
    let onboardedMonth = 0;
    let activeRecurring = 0;
    let totalMRR = 0;
    let totalChurnRateSum = 0;
    let totalChurnValue = 0;
    let dailyThresholdHits = 0;
    let atRiskRpns = 0;
    let assignedFollowUps = 0;
    let retentionRiskCount = 0;

    rpnPerformance.forEach((r) => {
      onboardedToday += r.vendorsOnboardedToday;
      onboardedMonth += r.vendorsOnboardedThisMonth;
      activeRecurring += r.recurringVendors;
      totalMRR += r.monthlyRecurringValue;
      totalChurnRateSum += r.churnRate;
      totalChurnValue += r.churnValueLost;
      assignedFollowUps += r.assignedVendorFollowUps.length;
      retentionRiskCount += r.retentionRiskCount;
      if (r.dailyVariance >= 0 && r.vendorsOnboardedToDate > 0)
        dailyThresholdHits++;
      if (r.thresholdStatus === "at_risk" || r.retentionScore < 70)
        atRiskRpns++;
    });

    const avgChurn =
      rpnPerformance.length > 0
        ? (totalChurnRateSum / rpnPerformance.length).toFixed(1)
        : "0.0";
    const compliance =
      rpnPerformance.filter((r) => r.vendorsOnboardedToDate > 0).length > 0
        ? (
            (dailyThresholdHits /
              rpnPerformance.filter((r) => r.vendorsOnboardedToDate > 0)
                .length) *
            100
          ).toFixed(1)
        : "0.0";

    const topRpn = [...rpnPerformance].sort(
      (a, b) => b.vendorsOnboardedThisMonth - a.vendorsOnboardedThisMonth,
    )[0];

    return {
      activeRpns: rpnPerformance.filter((r) => r.vendorsOnboardedToDate > 0)
        .length,
      onboardedToday,
      dailyCompliance: compliance,
      onboardedMonth,
      activeRecurring,
      totalMRR,
      avgChurn,
      totalChurnValue,
      atRiskRpns,
      assignedFollowUps,
      retentionRiskCount,
      topRpnName: topRpn ? topRpn.name : "N/A",
    };
  }, [rpnPerformance]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "excellent":
        return <StatusBadge status="Excellent" variant="success" />;
      case "on_track":
        return <StatusBadge status="On Track" variant="info" />;
      case "below_target":
        return <StatusBadge status="Below Target" variant="warning" />;
      case "at_risk":
        return <StatusBadge status="At Risk" variant="error" />;
      default:
        return <StatusBadge status="Dormant" variant="neutral" />;
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <PageHeader
        title="RPN Performance & Control Tower"
        subtitle="Monitor onboarding thresholds, vendor portfolio health, and financial contribution by field agents."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Active RPNs"
          value={overviewStats.activeRpns.toString()}
          icon={Users}
        />
        <StatCard
          label="Onboarded Today"
          value={overviewStats.onboardedToday.toString()}
          icon={ActivityIcon}
        />
        <StatCard
          label="Daily Compliance"
          value={`${overviewStats.dailyCompliance}%`}
          icon={Target}
          variant={
            Number(overviewStats.dailyCompliance) >= 80 ? "success" : "warning"
          }
        />
        <StatCard
          label="Onboarded This Month"
          value={overviewStats.onboardedMonth.toString()}
          icon={ActivityIcon}
        />
        <StatCard
          label="Recurring Vendors"
          value={overviewStats.activeRecurring.toString()}
          icon={Briefcase}
        />
        <StatCard
          label="Monthly Recurring"
          value={`$${overviewStats.totalMRR.toLocaleString()}`}
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          label="Avg Churn Rate"
          value={`${overviewStats.avgChurn}%`}
          icon={TrendingDown}
          variant={Number(overviewStats.avgChurn) > 15 ? "error" : "neutral"}
        />
        <StatCard
          label="Churn Value Lost"
          value={`$${overviewStats.totalChurnValue.toLocaleString()}`}
          icon={TrendingDown}
          variant={overviewStats.totalChurnValue > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Top RPN (Month)"
          value={overviewStats.topRpnName}
          icon={TrendingUp}
        />
        <StatCard
          label="At-Risk RPNs"
          value={overviewStats.atRiskRpns.toString()}
          icon={AlertTriangle}
          variant={overviewStats.atRiskRpns > 0 ? "error" : "success"}
        />
        <StatCard
          label="Assigned Follow-ups"
          value={overviewStats.assignedFollowUps.toString()}
          icon={Clock}
          variant={overviewStats.assignedFollowUps > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Retention Risks"
          value={overviewStats.retentionRiskCount.toString()}
          icon={AlertTriangle}
          variant={overviewStats.retentionRiskCount > 0 ? "error" : "neutral"}
        />
      </div>

      <div className="bg-stone-50 border border-stone-200 p-6 flex flex-wrap gap-4 items-center">
        <SearchInput
          placeholder="Search RPN Name or Territory..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-96"
        />
        {permissionService.canExport("rpnManagement") && (
          <SecondaryButton
            onClick={() => alert("Report generation queued.")}
            className="ml-auto"
          >
            <FileText size={14} className="mr-2" /> Export Performance Report
          </SecondaryButton>
        )}
      </div>

      <TablePanel
        title="RPN Network Matrix"
        subtitle="Detailed breakdown of agent performance metrics"
        headers={[
          "RPN Identity",
          "Territory",
          "Today",
          "Week",
          "Month",
          "Total Portfolio",
          "Active",
          "Follow-ups",
          "Retention",
          "Churn %",
          "MRR Value",
          "Threshold Status",
          "Actions",
        ]}
      >
        {filteredPerformance.map((rpn) => (
          <tr key={rpn.id} className="hover:bg-stone-50 transition-colors">
            <td className="px-6 py-4">
              <p className="text-xs font-bold uppercase text-brand-charcoal">
                {rpn.name}
              </p>
              <p className="text-[9px] text-stone-400 font-mono uppercase">
                {rpn.type}
              </p>
            </td>
            <td className="px-6 py-4 text-[10px] font-bold uppercase text-stone-500">
              {rpn.territory}
            </td>
            <td className="px-6 py-4 font-mono text-xs">
              <span
                className={
                  rpn.vendorsOnboardedToday > 0
                    ? "text-green-600 font-bold"
                    : "text-stone-400"
                }
              >
                {rpn.vendorsOnboardedToday}
              </span>
            </td>
            <td className="px-6 py-4 font-mono text-xs">
              <span
                className={
                  rpn.weeklyVariance >= 0
                    ? "text-green-600 font-bold"
                    : "text-brand-orange"
                }
              >
                {rpn.vendorsOnboardedThisWeek}
              </span>
            </td>
            <td className="px-6 py-4 font-mono text-xs font-bold text-brand-charcoal">
              {rpn.vendorsOnboardedThisMonth}
            </td>
            <td className="px-6 py-4 font-mono text-xs font-bold text-brand-charcoal">
              {rpn.vendorsOnboardedToDate}
            </td>
            <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">
              {rpn.activeVendors}
            </td>
            <td className="px-6 py-4 font-mono text-xs text-brand-orange font-bold">
              {rpn.assignedVendorFollowUps.length}
            </td>
            <td className="px-6 py-4 font-mono text-xs font-bold">
              <span
                className={
                  rpn.retentionScore >= 80
                    ? "text-emerald-600"
                    : rpn.retentionScore >= 60
                      ? "text-brand-orange"
                      : "text-red-500"
                }
              >
                {rpn.retentionScore}
              </span>
            </td>
            <td className="px-6 py-4 font-mono text-xs text-red-500 font-bold">
              {rpn.churnRate.toFixed(1)}%
            </td>
            <td className="px-6 py-4 font-mono text-xs text-emerald-600 font-bold">
              ${rpn.monthlyRecurringValue.toLocaleString()}
            </td>
            <td className="px-6 py-4">{getStatusBadge(rpn.thresholdStatus)}</td>
            <td className="px-6 py-4 text-right">
              <PrimaryButton size="sm" onClick={() => setSelectedRpn(rpn)}>
                View Details
              </PrimaryButton>
            </td>
          </tr>
        ))}
        {filteredPerformance.length === 0 && (
          <tr>
            <td
              colSpan={13}
              className="px-6 py-12 text-center text-[10px] uppercase font-bold text-stone-400"
            >
              No RPN records match the current filters.
            </td>
          </tr>
        )}
      </TablePanel>

      {selectedRpn && (
        <div className="fixed inset-0 z-50 flex justify-end bg-brand-charcoal/40 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 bg-brand-charcoal text-white flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tight">
                  {selectedRpn.name}
                </h2>
                <p className="text-[10px] uppercase text-white/50 tracking-widest mt-1 flex items-center gap-2">
                  <MapPin size={10} /> Territory: {selectedRpn.territory} |
                  Status: {selectedRpn.thresholdStatus.replace("_", " ")}
                </p>
              </div>
              <button
                onClick={() => setSelectedRpn(null)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex bg-stone-100 p-1 shrink-0 border-b border-stone-200">
              <button
                onClick={() => setActiveTab("portfolio")}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "portfolio" ? "bg-white shadow-sm text-brand-orange" : "text-stone-500 hover:text-brand-charcoal"}`}
              >
                Vendor Portfolio
              </button>
              <button
                onClick={() => setActiveTab("financial")}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "financial" ? "bg-white shadow-sm text-brand-orange" : "text-stone-500 hover:text-brand-charcoal"}`}
              >
                Financial Impact
              </button>
              <button
                onClick={() => setActiveTab("churn")}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === "churn" ? "bg-white shadow-sm text-brand-orange" : "text-stone-500 hover:text-brand-charcoal"}`}
              >
                Churn & Retention
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-stone-50 custom-scrollbar">
              {activeTab === "portfolio" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        Total Onboarded
                      </p>
                      <p className="text-xl font-bold font-mono">
                        {selectedRpn.vendorsOnboardedToDate}
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        Active Accounts
                      </p>
                      <p className="text-xl font-bold font-mono text-blue-600">
                        {selectedRpn.activeVendors}
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        Overdue / Risk
                      </p>
                      <p className="text-xl font-bold font-mono text-brand-orange">
                        {selectedRpn.overdueVendors}
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        Due Soon
                      </p>
                      <p className="text-xl font-bold font-mono text-brand-orange">
                        {selectedRpn.dueSoonVendors}
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        Retention Score
                      </p>
                      <p className="text-xl font-bold font-mono text-brand-charcoal">
                        {selectedRpn.retentionScore}
                      </p>
                    </div>
                  </div>

                  {selectedRpn.assignedVendorFollowUps.length > 0 && (
                    <DataPanel
                      title="Assigned Vendor Follow-up List"
                      subtitle="Subscription due/overdue vendors where RPN collections or retention follow-up is required."
                      className="border-l-4 border-l-brand-orange"
                    >
                      <div className="p-4 space-y-2">
                        {selectedRpn.assignedVendorFollowUps.map(
                          (v: Vendor) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between gap-3 border border-stone-200 bg-white p-3"
                            >
                              <div>
                                <p className="text-xs font-bold uppercase text-brand-charcoal">
                                  {v.name}
                                </p>
                                <p className="text-[10px] font-mono text-stone-500">
                                  Due:{" "}
                                  {v.subscriptionDueDate
                                    ? new Date(
                                        v.subscriptionDueDate,
                                      ).toLocaleDateString()
                                    : "N/A"}
                                </p>
                              </div>
                              <StatusBadge
                                status={v.subscriptionStatus}
                                variant={
                                  v.subscriptionStatus === "overdue"
                                    ? "error"
                                    : "warning"
                                }
                              />
                            </div>
                          ),
                        )}
                      </div>
                    </DataPanel>
                  )}

                  <TablePanel
                    headers={[
                      "Vendor",
                      "Sector/Loc",
                      "Plan",
                      "Status",
                      "Onboarded",
                      "Monthly Value",
                    ]}
                    title="Managed Accounts"
                  >
                    {selectedRpn.vendors.map((v: Vendor) => (
                      <tr
                        key={v.id}
                        className="hover:bg-white transition-colors border-b border-stone-100"
                      >
                        <td className="px-4 py-3 text-xs font-bold uppercase text-brand-charcoal truncate max-w-[150px]">
                          {v.name}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[10px] font-bold text-stone-500 uppercase">
                            {v.sector || "N/A"}
                          </p>
                          <p className="text-[9px] text-stone-400 uppercase">
                            {v.cityTown || "N/A"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-bold uppercase">
                          {plans.find((p) => p.id === v.planId)?.name ||
                            v.planId}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge
                              status={v.status}
                              variant={
                                v.status === "active" ? "success" : "neutral"
                              }
                            />
                            {v.churnStatus === "churned" && (
                              <StatusBadge status="churned" variant="error" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-stone-500">
                          {v.onboardedAt
                            ? new Date(v.onboardedAt).toLocaleDateString()
                            : v.createdAt
                              ? new Date(v.createdAt).toLocaleDateString()
                              : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono font-bold text-emerald-600">
                          $
                          {v.monthlyPlanValue ||
                            plans.find((p) => p.id === v.planId)
                              ?.monthlyPrice ||
                            0}
                        </td>
                      </tr>
                    ))}
                    {selectedRpn.vendors.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-[10px] text-stone-400 font-bold uppercase"
                        >
                          No vendors mapped to this RPN.
                        </td>
                      </tr>
                    )}
                  </TablePanel>
                </div>
              )}

              {activeTab === "financial" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white border-2 border-emerald-500 p-6">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 mb-2">
                        Monthly Recurring Revenue (MRR)
                      </p>
                      <p className="text-4xl font-black font-mono text-emerald-700">
                        ${selectedRpn.monthlyRecurringValue.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-emerald-600 mt-2 font-bold uppercase">
                        From {selectedRpn.recurringVendors} paying accounts
                      </p>
                    </div>
                    <div className="bg-white border-2 border-stone-200 p-6">
                      <p className="text-[10px] uppercase font-bold text-stone-400 mb-2">
                        Est. Lifetime Value Originated
                      </p>
                      <p className="text-4xl font-black font-mono text-brand-charcoal">
                        ${selectedRpn.lifetimeValueOnboarded.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-stone-400 mt-2 font-bold uppercase">
                        Based on 12-mo projected span
                      </p>
                    </div>
                  </div>

                  <DataPanel title="Revenue Protection Alerts">
                    <div className="p-4 space-y-3">
                      {selectedRpn.overdueVendors > 0 ? (
                        <div className="flex gap-3 text-brand-orange p-3 bg-orange-50 border border-orange-100">
                          <AlertTriangle
                            size={16}
                            className="shrink-0 mt-0.5"
                          />
                          <p className="text-xs font-bold leading-relaxed">
                            {selectedRpn.overdueVendors} vendors managed by this
                            RPN are currently overdue on subscription payments.
                            Immediate collection follow-up recommended.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold uppercase text-emerald-600 italic">
                          No overdue accounts in portfolio. Collections are
                          healthy.
                        </p>
                      )}
                    </div>
                  </DataPanel>
                </div>
              )}

              {activeTab === "churn" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        Total Churned
                      </p>
                      <p className="text-2xl font-bold font-mono text-red-500">
                        {selectedRpn.churnedVendors}
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        Churn Rate
                      </p>
                      <p
                        className={`text-2xl font-bold font-mono ${selectedRpn.churnRate > 15 ? "text-red-500" : "text-stone-700"}`}
                      >
                        {selectedRpn.churnRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 p-4">
                      <p className="text-[9px] uppercase font-bold text-stone-400 mb-1">
                        MRR Value Lost
                      </p>
                      <p className="text-2xl font-bold font-mono text-red-500">
                        ${selectedRpn.churnValueLost.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <TablePanel
                    headers={[
                      "Churned Vendor",
                      "Value Lost",
                      "Status",
                      "Reason / Notes",
                    ]}
                    title="Churn Register"
                  >
                    {selectedRpn.vendors
                      .filter(
                        (v: Vendor) =>
                          v.churnStatus === "churned" ||
                          v.status === "cancelled",
                      )
                      .map((v: Vendor) => (
                        <tr
                          key={v.id}
                          className="bg-red-50/20 border-b border-red-50"
                        >
                          <td className="px-4 py-3 text-xs font-bold uppercase text-brand-charcoal">
                            {v.name}
                          </td>
                          <td className="px-4 py-3 text-[10px] font-mono font-bold text-red-600">
                            $
                            {v.monthlyPlanValue ||
                              plans.find((p) => p.id === v.planId)
                                ?.monthlyPrice ||
                              0}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status="Churned" variant="error" />
                          </td>
                          <td className="px-4 py-3 text-[10px] font-medium text-stone-600 max-w-[200px] truncate">
                            {v.churnReason || "No reason provided."}
                          </td>
                        </tr>
                      ))}
                    {selectedRpn.vendors.filter(
                      (v: Vendor) =>
                        v.churnStatus === "churned" || v.status === "cancelled",
                    ).length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-[10px] text-stone-400 font-bold uppercase"
                        >
                          No churned vendors in portfolio.
                        </td>
                      </tr>
                    )}
                  </TablePanel>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
