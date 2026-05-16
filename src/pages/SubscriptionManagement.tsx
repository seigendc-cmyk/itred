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
  EmptyState,
  PrimaryButton,
} from "../components/CommonUI.tsx";
import { Wallet, Calendar, Download, Clock } from "lucide-react";
import { vendorService } from "../services/vendorService.ts";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { pdfService } from "../services/pdfService.ts";
import { rpnService } from "../services/rpnService.ts";
import { Vendor, PricingPlan, Subscription, RPN } from "../types.ts";
import { asArray } from "../utils/safeData.ts";

export const SubscriptionManagement: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [rpns, setRpns] = useState<RPN[]>([]);

  const loadData = async () => {
    try {
      const rawVendors = await Promise.resolve(vendorService.getVendors());
      void vendorService.evaluateSubscriptionRpnAlerts();
      const rawPlans = await Promise.resolve(pricingPlanService.getPlans());
      const rawRpns = await Promise.resolve(rpnService.getAll());
      setVendors(asArray<Vendor>(rawVendors));
      setPlans(asArray<PricingPlan>(rawPlans));
      setRpns(asArray<RPN>(rawRpns));
    } catch (error) {
      console.error("Failed to load collections data", error);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const collections = useMemo(() => {
    return vendors.filter(
      (v) =>
        v.subscriptionStatus === "due" ||
        v.subscriptionStatus === "overdue" ||
        v.subscriptionStatus === "active" ||
        v.subscriptionStatus === "suspended",
    );
  }, [vendors]);

  const overdueCollections = collections.filter(
    (v) => v.subscriptionStatus === "overdue",
  );
  const dueSubscriptions = collections.filter(
    (v) => v.subscriptionStatus === "due",
  );
  const recentFollowUps = collections
    .filter((v) => v.lastCollectionDate || v.nextFollowUpDate)
    .sort((a, b) => {
      const dateA = a.nextFollowUpDate
        ? new Date(a.nextFollowUpDate).getTime()
        : 0;
      const dateB = b.nextFollowUpDate
        ? new Date(b.nextFollowUpDate).getTime()
        : 0;
      return dateB - dateA;
    });

  const handleExportPDF = () => {
    const subs: Subscription[] = vendors.map((v) => ({
      id: v.id,
      vendorId: v.id,
      vendorNameSnapshot: v.name,
      planId: v.planId,
      amountDue: plans.find((p) => p.id === v.planId)?.monthlyPrice || 0,
      currency: plans.find((p) => p.id === v.planId)?.currency || "USD",
      billingPeriod: "monthly",
      startDate: v.subscriptionStartDate || "",
      dueDate: v.subscriptionDueDate || "",
      gracePeriodDays: 7,
      status: v.subscriptionStatus,
      followUpStatus: "not started",
      createdBy: "system",
      updatedBy: "system",
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    pdfService.generateSubscriptionReport(
      { type: "statement", title: "Collections Report" },
      { subs, collections: [], vendors, plans, rpns },
    );
  };

  const renderTableRows = (data: Vendor[]) => {
    return data.map((v) => {
      const plan = plans.find((p) => p.id === v.planId);
      return (
        <tr key={v.id} className="hover:bg-stone-50">
          <td className="px-6 py-4">
            <p className="font-bold text-xs uppercase text-brand-charcoal">
              {v.name}
            </p>
            <p className="text-[10px] text-stone-500 font-mono">
              {v.systemCode}
            </p>
          </td>
          <td className="px-6 py-4">
            <span className="text-xs font-bold uppercase">
              {plan?.name || v.planId}
            </span>
          </td>
          <td className="px-6 py-4 font-mono text-xs font-bold text-brand-charcoal">
            {plan?.currency || "USD"} {plan?.monthlyPrice?.toFixed(2) || "0.00"}
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-stone-400" />
              <span className="text-xs">
                {v.subscriptionDueDate
                  ? new Date(v.subscriptionDueDate).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-stone-400" />
              <span className="text-xs">
                {v.nextFollowUpDate
                  ? new Date(v.nextFollowUpDate).toLocaleDateString()
                  : "Unscheduled"}
              </span>
            </div>
          </td>
          <td className="px-6 py-4">
            <StatusBadge
              status={v.subscriptionStatus}
              variant={
                v.subscriptionStatus === "overdue"
                  ? "error"
                  : v.subscriptionStatus === "due"
                    ? "warning"
                    : "success"
              }
            />
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="pb-20">
      <PageHeader
        title="Collections & Subscriptions"
        subtitle="Manage vendor subscriptions, monitor dues, and track follow-ups."
        actions={
          <PrimaryButton
            onClick={handleExportPDF}
            disabled={collections.length === 0}
          >
            <Download size={14} className="mr-2" /> Export Report
          </PrimaryButton>
        }
      />

      {collections.length === 0 ? (
        <DataPanel>
          <div className="p-12">
            <EmptyState
              title="No Collections"
              description="No collection records yet. Collection follow-ups will appear here once subscriptions or payment records are created."
              icon={Wallet}
            />
          </div>
        </DataPanel>
      ) : (
        <div className="space-y-8">
          {overdueCollections.length > 0 && (
            <TablePanel
              title="Overdue Collections"
              subtitle="Critical accounts requiring immediate attention"
              headers={[
                "Vendor/business name",
                "Plan",
                "Amount due",
                "Due Date",
                "Next follow-up date",
                "Status",
              ]}
            >
              {renderTableRows(overdueCollections)}
            </TablePanel>
          )}
          {dueSubscriptions.length > 0 && (
            <TablePanel
              title="Due Subscriptions"
              subtitle="Accounts pending payment in current cycle"
              headers={[
                "Vendor/business name",
                "Plan",
                "Amount due",
                "Due Date",
                "Next follow-up date",
                "Status",
              ]}
            >
              {renderTableRows(dueSubscriptions)}
            </TablePanel>
          )}
          {recentFollowUps.length > 0 && (
            <TablePanel
              title="Recent Collection Follow-ups"
              subtitle="Accounts with recent activity or scheduled follow-ups"
              headers={[
                "Vendor/business name",
                "Plan",
                "Amount due",
                "Due Date",
                "Next follow-up date",
                "Status",
              ]}
            >
              {renderTableRows(recentFollowUps.slice(0, 10))}
            </TablePanel>
          )}
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;
