/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CashBankAccount,
  ChartOfAccount,
  RPN,
  RpnCompensationPlan,
  RpnCompensationLedgerEntry,
  RpnCompensationReportFilters,
  RpnCompensationStatementReport,
  RpnCompensationPolicy,
  RpnCompensationRun,
  RpnCompensationRunLine,
  RpnPayablesLedgerReport,
  RpnPortfolioRevenueReport,
  RpnChurnRetentionReport,
  RpnCashbookPaymentReport,
  RpnProfitabilityReport,
  RpnCompensationException,
  RpnOnboardingLog,
  RpnPaymentBatch,
  RpnVendorAssignment,
  Vendor,
  VendorSubscriptionPayment,
} from "../types.ts";
import { financeLedgerService } from "./financeLedgerService.ts";
import { financeService } from "./financeService.ts";
import { rpnService } from "./rpnService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { subscriptionService } from "./subscriptionService.ts";
import { vendorService } from "./vendorService.ts";
import { getSession } from "../utils/session.ts";

const PLANS_KEY = "itred_rpn_compensation_plans";
const POLICIES_KEY = "itred_rpn_compensation_policies";
const ASSIGNMENTS_KEY = "itred_rpn_vendor_assignments";
const ONBOARDING_LOGS_KEY = "itred_rpn_onboarding_logs";
const RUNS_KEY = "itred_rpn_compensation_runs";
const LEDGER_KEY = "itred_rpn_compensation_transaction_ledger";

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const readList = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeList = <T>(key: string, value: T[]) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const money = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const monthsBetween = (start?: string, end = today()) => {
  if (!start) return 0;
  const first = new Date(start);
  const last = new Date(end);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return 0;
  return Math.max(
    0,
    (last.getFullYear() - first.getFullYear()) * 12 +
      (last.getMonth() - first.getMonth()),
  );
};

const assignedRpnId = (vendor: Vendor) =>
  vendor.assignedRPNId || vendor.rpnId || vendor.assignedStaffId || "";

const audit = (
  action: string,
  recordType: string,
  recordId: string,
  beforeSnapshot: unknown,
  afterSnapshot: unknown,
  severity: "info" | "warning" | "high" = "info",
) => {
  try {
    void staffAuditService.logAction({
      eventType: beforeSnapshot ? "RECORD_UPDATED" : "RECORD_CREATED",
      module: "rpn",
      severity,
      action,
      recordType,
      recordId,
      beforeSnapshot,
      afterSnapshot,
    });
  } catch (error) {
    console.warn("RPN compensation audit failed", error);
  }
};

const defaultPlan = (): RpnCompensationPlan => ({
  id: "RPN-COMP-DEFAULT",
  name: "Default RPN Compensation Plan",
  isActive: true,
  wageEnabled: true,
  dailyVendorTarget: 3,
  wageRatePerVendor: 5,
  maxDailyWagePayable: 25,
  portfolioCeiling: 80,
  recurringCommissionEnabled: true,
  recurringCommissionRate: 5,
  churnBonusEnabled: true,
  churnThresholdPercent: 5,
  churnBonusType: "percentage_of_recurring_revenue",
  churnBonusValue: 2,
  autoDisableWageAfterThreshold: false,
  switchToCommissionOnlyAfterMonths: 6,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const getPlans = (): RpnCompensationPlan[] => {
  const plans = readList<RpnCompensationPlan>(PLANS_KEY);
  if (plans.length > 0) return plans;
  const plan = defaultPlan();
  writeList(PLANS_KEY, [plan]);
  return [plan];
};

const getPolicies = (): RpnCompensationPolicy[] =>
  readList<RpnCompensationPolicy>(POLICIES_KEY);

const savePolicies = (policies: RpnCompensationPolicy[]) =>
  writeList(POLICIES_KEY, policies);

const getPlanForRpn = (rpnId: string) => {
  const policies = getPolicies();
  const policy = policies.find((item) => item.rpnId === rpnId);
  const plans = getPlans();
  const plan =
    plans.find((item) => item.id === policy?.planId) ||
    plans.find((item) => item.isActive) ||
    plans[0] ||
    defaultPlan();
  return { plan, policy };
};

const ensureAccount = (
  accountCode: string,
  accountName: string,
  accountType: ChartOfAccount["accountType"],
  normalBalance: ChartOfAccount["normalBalance"],
): ChartOfAccount => {
  const existing = financeService
    .getChartOfAccounts()
    .find(
      (account) =>
        account.accountCode === accountCode ||
        account.accountName.toLowerCase() === accountName.toLowerCase(),
    );
  if (existing) return existing;
  return financeService.saveChartOfAccount({
    id: "",
    accountCode,
    accountName,
    accountType,
    normalBalance,
    isSystemAccount: true,
    status: "active",
    createdAt: "",
    updatedAt: "",
  });
};

const ensureCompensationAccounts = () => {
  financeService.seedDefaultChartOfAccounts();
  return {
    wageExpense: ensureAccount("5070", "RPN Wage Expense", "Expense", "Debit"),
    recurringExpense: ensureAccount(
      "5010",
      "RPN Recurring Commission Expense",
      "Expense",
      "Debit",
    ),
    churnBonusExpense: ensureAccount(
      "5080",
      "RPN Retention / Churn Bonus Expense",
      "Expense",
      "Debit",
    ),
    payables: ensureAccount("2010", "RPN Payables", "Liability", "Credit"),
  };
};

const saveRun = (run: RpnCompensationRun) => {
  const runs = readList<RpnCompensationRun>(RUNS_KEY);
  const existing = runs.find((item) => item.id === run.id);
  const next = existing
    ? runs.map((item) => (item.id === run.id ? run : item))
    : [...runs, run];
  writeList(RUNS_KEY, next);
  return run;
};

const saveLedgerEntries = (entries: RpnCompensationLedgerEntry[]) => {
  writeList(LEDGER_KEY, entries);
};

const getLedgerEntries = (): RpnCompensationLedgerEntry[] => {
  const rows = readList<RpnCompensationLedgerEntry>(LEDGER_KEY).sort(
    (a, b) =>
      new Date(a.transactionDate).getTime() -
        new Date(b.transactionDate).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  let running = 0;
  return rows.map((entry) => {
    running += money(entry.debitAmount) - money(entry.creditAmount);
    return { ...entry, runningBalance: money(running) };
  });
};

const upsertLedgerEntries = (entries: RpnCompensationLedgerEntry[]) => {
  const existing = readList<RpnCompensationLedgerEntry>(LEDGER_KEY);
  const next = [
    ...existing.filter((entry) => !entries.some((item) => item.id === entry.id)),
    ...entries,
  ];
  saveLedgerEntries(next);
};

const createLedgerEntry = (
  patch: Omit<RpnCompensationLedgerEntry, "id" | "runningBalance" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): RpnCompensationLedgerEntry => ({
  ...patch,
  id: patch.id || makeId("RPN-LED"),
  runningBalance: 0,
  createdAt: patch.createdAt || nowIso(),
});

const matchesFilters = (
  entry: RpnCompensationLedgerEntry,
  filters: RpnCompensationReportFilters = {},
) => {
  if (filters.dateFrom && entry.transactionDate < filters.dateFrom) return false;
  if (filters.dateTo && entry.transactionDate > filters.dateTo) return false;
  if (filters.rpnId && entry.rpnId !== filters.rpnId) return false;
  if (filters.vendorId && entry.vendorId !== filters.vendorId) return false;
  if (filters.compensationRunId && entry.compensationRunId !== filters.compensationRunId) return false;
  if (filters.status && entry.status !== filters.status) return false;
  if (filters.transactionType && entry.transactionType !== filters.transactionType) return false;
  return true;
};

const filteredLedger = (filters: RpnCompensationReportFilters = {}) =>
  getLedgerEntries().filter((entry) => matchesFilters(entry, filters));

const sumLedger = (
  rows: RpnCompensationLedgerEntry[],
  predicate: (entry: RpnCompensationLedgerEntry) => boolean,
) =>
  money(
    rows
      .filter(predicate)
      .reduce((sum, entry) => sum + entry.debitAmount - entry.creditAmount, 0),
  );

const activeAssignments = () =>
  readList<RpnVendorAssignment>(ASSIGNMENTS_KEY).filter(
    (assignment) => assignment.status === "active",
  );

const confirmedPayments = (
  periodFrom: string,
  periodTo: string,
): VendorSubscriptionPayment[] =>
  subscriptionService.getAllPayments().filter((payment) => {
    const paidDate = (payment.paymentDate || payment.updatedAt || "").slice(0, 10);
    return (
      payment.paymentStatus === "paid" &&
      payment.amountPaid > 0 &&
      paidDate >= periodFrom &&
      paidDate <= periodTo
    );
  });

export const rpnCompensationService = {
  getCompensationPlans: getPlans,
  getPolicies,
  getVendorAssignments: () => readList<RpnVendorAssignment>(ASSIGNMENTS_KEY),
  getOnboardingLogs: () => readList<RpnOnboardingLog>(ONBOARDING_LOGS_KEY),
  getCompensationRuns: () => readList<RpnCompensationRun>(RUNS_KEY),
  getTransactionLedger: (filters: RpnCompensationReportFilters = {}) =>
    filteredLedger(filters),

  createCompensationPlan(
    patch: Partial<RpnCompensationPlan>,
  ): RpnCompensationPlan {
    const plans = getPlans();
    const plan: RpnCompensationPlan = {
      ...defaultPlan(),
      ...patch,
      id: patch.id || makeId("RPN-COMP-PLAN"),
      createdAt: patch.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    writeList(PLANS_KEY, [...plans.filter((item) => item.id !== plan.id), plan]);
    audit("Created RPN compensation plan", "rpn_compensation_plan", plan.id, null, plan);
    return plan;
  },

  updateCompensationPlan(
    id: string,
    patch: Partial<RpnCompensationPlan>,
  ): RpnCompensationPlan {
    const plans = getPlans();
    const existing = plans.find((plan) => plan.id === id);
    if (!existing) throw new Error("Compensation plan not found.");
    const updated = { ...existing, ...patch, id, updatedAt: nowIso() };
    writeList(
      PLANS_KEY,
      plans.map((plan) => (plan.id === id ? updated : plan)),
    );
    audit("Updated RPN compensation plan", "rpn_compensation_plan", id, existing, updated);
    return updated;
  },

  assignVendorToRpn(
    vendorId: string,
    rpnId: string,
    reason = "Portfolio assignment",
    vendorName?: string,
  ): RpnVendorAssignment {
    const assignments = readList<RpnVendorAssignment>(ASSIGNMENTS_KEY);
    const rpn = rpnService.getById(rpnId);
    const now = nowIso();
    const released = assignments.map((assignment) =>
      assignment.vendorId === vendorId && assignment.status === "active"
        ? {
            ...assignment,
            status: "transferred" as const,
            releasedAt: now,
            releaseReason: reason,
            transferredToRpnId: rpnId,
            updatedAt: now,
          }
        : assignment,
    );
    const assignment: RpnVendorAssignment = {
      id: makeId("RPN-ASG"),
      vendorId,
      vendorName: vendorName || vendorId,
      rpnId,
      rpnName: rpn?.name || rpnId,
      status: "active",
      assignedAt: today(),
      createdAt: now,
      updatedAt: now,
    };
    writeList(ASSIGNMENTS_KEY, [...released, assignment]);
    audit("Assigned vendor to RPN compensation portfolio", "rpn_vendor_assignment", assignment.id, null, assignment);
    return assignment;
  },

  releaseVendorFromRpn(vendorId: string, reason = "Released"): void {
    const assignments = readList<RpnVendorAssignment>(ASSIGNMENTS_KEY);
    const now = nowIso();
    const next = assignments.map((assignment) =>
      assignment.vendorId === vendorId && assignment.status === "active"
        ? {
            ...assignment,
            status: "released" as const,
            releasedAt: now,
            releaseReason: reason,
            updatedAt: now,
          }
        : assignment,
    );
    writeList(ASSIGNMENTS_KEY, next);
    audit("Released vendor from RPN compensation portfolio", "rpn_vendor_assignment", vendorId, assignments, next, "warning");
  },

  getRpnPortfolio(rpnId: string): RpnVendorAssignment[] {
    return activeAssignments().filter(
      (assignment) => assignment.rpnId === rpnId,
    );
  },

  checkPortfolioCeiling(rpnId: string) {
    const { plan } = getPlanForRpn(rpnId);
    const portfolioCount =
      activeAssignments().filter((assignment) => assignment.rpnId === rpnId)
        .length ||
      rpnService
        .getAll()
        .find((rpn) => rpn.id === rpnId)?.assignedVendors?.length ||
      0;
    return {
      rpnId,
      portfolioCount,
      portfolioCeiling: plan.portfolioCeiling,
      exceeded: portfolioCount > plan.portfolioCeiling,
    };
  },

  recordOnboardingForWage(
    log: Partial<RpnOnboardingLog>,
  ): RpnOnboardingLog {
    const logs = readList<RpnOnboardingLog>(ONBOARDING_LOGS_KEY);
    const rpn = log.rpnId ? rpnService.getById(log.rpnId) : undefined;
    const saved: RpnOnboardingLog = {
      id: log.id || makeId("RPN-WAGE"),
      rpnId: log.rpnId || "",
      rpnName: log.rpnName || rpn?.name || "",
      vendorId: log.vendorId || "",
      vendorName: log.vendorName || "",
      onboardingDate: log.onboardingDate || today(),
      status: log.status || "pending",
      qualifiesForWage: !!log.qualifiesForWage,
      rejectionReason: log.rejectionReason,
      approvedBy: log.approvedBy,
      approvedAt: log.approvedAt,
      createdAt: log.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    writeList(
      ONBOARDING_LOGS_KEY,
      [...logs.filter((item) => item.id !== saved.id), saved],
    );
    audit("Recorded RPN onboarding wage log", "rpn_onboarding_log", saved.id, null, saved);
    return saved;
  },

  calculateDailyWage(rpnId: string, date: string): number {
    const { plan, policy } = getPlanForRpn(rpnId);
    const wageEnabled = policy?.wageEnabledOverride ?? plan.wageEnabled;
    if (!wageEnabled || policy?.commissionOnly) return 0;
    const qualifying = readList<RpnOnboardingLog>(ONBOARDING_LOGS_KEY).filter(
      (log) =>
        log.rpnId === rpnId &&
        log.onboardingDate === date &&
        log.status === "approved" &&
        log.qualifiesForWage,
    ).length;
    return Math.min(
      qualifying * plan.wageRatePerVendor,
      plan.maxDailyWagePayable,
    );
  },

  calculateMonthlyRecurringCommission(
    rpnId: string,
    periodFrom: string,
    periodTo: string,
  ): { recurringRevenue: number; commissionAmount: number } {
    const { plan, policy } = getPlanForRpn(rpnId);
    if (!plan.recurringCommissionEnabled) {
      return { recurringRevenue: 0, commissionAmount: 0 };
    }
    const portfolioVendorIds = new Set(
      activeAssignments()
        .filter((assignment) => assignment.rpnId === rpnId)
        .map((assignment) => assignment.vendorId),
    );
    const payments = confirmedPayments(periodFrom, periodTo).filter(
      (payment) =>
        payment.rpnId === rpnId || portfolioVendorIds.has(payment.vendorId),
    );
    const recurringRevenue = payments.reduce(
      (sum, payment) => sum + money(payment.amountPaid),
      0,
    );
    const rate =
      policy?.recurringCommissionRateOverride ?? plan.recurringCommissionRate;
    return {
      recurringRevenue: money(recurringRevenue),
      commissionAmount: money(recurringRevenue * (rate / 100)),
    };
  },

  calculateChurnRate(rpnId: string, periodFrom: string, periodTo: string) {
    const assignments = readList<RpnVendorAssignment>(ASSIGNMENTS_KEY).filter(
      (assignment) => assignment.rpnId === rpnId,
    );
    const openingActive = assignments.filter(
      (assignment) =>
        assignment.assignedAt <= periodFrom &&
        (!assignment.releasedAt || assignment.releasedAt >= periodFrom),
    ).length;
    const churned = assignments.filter(
      (assignment) =>
        assignment.status !== "active" &&
        (assignment.releasedAt || "").slice(0, 10) >= periodFrom &&
        (assignment.releasedAt || "").slice(0, 10) <= periodTo,
    ).length;
    const churnRatePercent =
      openingActive > 0 ? money((churned / openingActive) * 100) : 0;
    return { openingActive, churned, churnRatePercent };
  },

  calculateChurnBonus(
    rpnId: string,
    periodFrom: string,
    periodTo: string,
    recurringRevenue?: number,
  ): number {
    const { plan } = getPlanForRpn(rpnId);
    if (!plan.churnBonusEnabled) return 0;
    const churn = rpnCompensationService.calculateChurnRate(
      rpnId,
      periodFrom,
      periodTo,
    );
    if (churn.churnRatePercent > plan.churnThresholdPercent) return 0;
    if (plan.churnBonusType === "fixed") return money(plan.churnBonusValue);
    const revenue =
      recurringRevenue ??
      rpnCompensationService.calculateMonthlyRecurringCommission(
        rpnId,
        periodFrom,
        periodTo,
      ).recurringRevenue;
    return money(revenue * (plan.churnBonusValue / 100));
  },

  async generateCompensationRun(
    periodFrom: string,
    periodTo: string,
  ): Promise<RpnCompensationRun> {
    const rpns = rpnService.getAll().filter((rpn) => rpn.status === "active");
    const vendorList = await vendorService.getVendors();
    const assignments = readList<RpnVendorAssignment>(ASSIGNMENTS_KEY);
    if (assignments.length === 0) {
      const seeded = vendorList
        .filter((vendor) => assignedRpnId(vendor))
        .map((vendor) => {
          const rpn = rpns.find((item) => item.id === assignedRpnId(vendor));
          return {
            id: makeId("RPN-ASG"),
            vendorId: vendor.id,
            vendorName: vendor.name,
            rpnId: assignedRpnId(vendor),
            rpnName: rpn?.name || vendor.rpnName || assignedRpnId(vendor),
            status: "active" as const,
            assignedAt: vendor.onboardedAt?.slice(0, 10) || vendor.createdAt?.slice(0, 10) || periodFrom,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
        });
      if (seeded.length > 0) writeList(ASSIGNMENTS_KEY, seeded);
    }

    const runId = makeId("RPN-RUN");
    const lines: RpnCompensationRunLine[] = rpns.map((rpn) => {
      const { plan, policy } = getPlanForRpn(rpn.id);
      const portfolio = activeAssignments().filter(
        (assignment) => assignment.rpnId === rpn.id,
      );
      const onboardingLogs = readList<RpnOnboardingLog>(ONBOARDING_LOGS_KEY).filter(
        (log) =>
          log.rpnId === rpn.id &&
          log.onboardingDate >= periodFrom &&
          log.onboardingDate <= periodTo &&
          log.status === "approved" &&
          log.qualifiesForWage,
      );
      const wageDays = Array.from(new Set(onboardingLogs.map((log) => log.onboardingDate)));
      const wageAmount = wageDays.reduce(
        (sum, day) => sum + rpnCompensationService.calculateDailyWage(rpn.id, day),
        0,
      );
      const recurring = rpnCompensationService.calculateMonthlyRecurringCommission(
        rpn.id,
        periodFrom,
        periodTo,
      );
      const churn = rpnCompensationService.calculateChurnRate(
        rpn.id,
        periodFrom,
        periodTo,
      );
      const churnBonusAmount = rpnCompensationService.calculateChurnBonus(
        rpn.id,
        periodFrom,
        periodTo,
        recurring.recurringRevenue,
      );
      const workedMonths = monthsBetween(rpn.createdAt, periodTo);
      const readyForCommissionOnly =
        plan.autoDisableWageAfterThreshold &&
        workedMonths >= plan.switchToCommissionOnlyAfterMonths &&
        !policy?.commissionOnly;
      return {
        id: makeId("RPN-RUN-LINE"),
        runId,
        rpnId: rpn.id,
        rpnName: rpn.name,
        planId: plan.id,
        portfolioCount: portfolio.length,
        portfolioCeiling: plan.portfolioCeiling,
        openingActivePortfolio: churn.openingActive,
        churnedVendors: churn.churned,
        churnRatePercent: churn.churnRatePercent,
        qualifyingOnboardings: onboardingLogs.length,
        wageAmount: money(wageAmount),
        recurringRevenue: recurring.recurringRevenue,
        recurringCommissionAmount: recurring.commissionAmount,
        churnBonusAmount,
        totalPayable: money(wageAmount + recurring.commissionAmount + churnBonusAmount),
        commissionOnly: !!policy?.commissionOnly,
        overPortfolioCeiling: portfolio.length > plan.portfolioCeiling,
        readyForCommissionOnly,
      };
    });
    const run: RpnCompensationRun = {
      id: runId,
      periodFrom,
      periodTo,
      status: "draft",
      lines,
      wageTotal: money(lines.reduce((sum, line) => sum + line.wageAmount, 0)),
      recurringCommissionTotal: money(
        lines.reduce((sum, line) => sum + line.recurringCommissionAmount, 0),
      ),
      churnBonusTotal: money(
        lines.reduce((sum, line) => sum + line.churnBonusAmount, 0),
      ),
      totalPayable: money(lines.reduce((sum, line) => sum + line.totalPayable, 0)),
      createdBy: getSession()?.staffName || getSession()?.displayName,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveRun(run);
    upsertLedgerEntries(
      lines.flatMap((line) => {
        const base = {
          rpnId: line.rpnId,
          rpnName: line.rpnName,
          transactionDate: periodTo,
          periodFrom,
          periodTo,
          sourceType: "run_line" as const,
          sourceId: line.id,
          compensationRunId: runId,
          currency: "USD",
          status: "draft" as const,
          createdBy: getSession()?.staffName || getSession()?.displayName,
        };
        return [
          line.wageAmount > 0
            ? createLedgerEntry({
                ...base,
                id: `${line.id}-wage`,
                transactionType: "onboarding_wage",
                debitAmount: line.wageAmount,
                creditAmount: 0,
                description: `Onboarding wage earned by ${line.rpnName}`,
              })
            : null,
          line.recurringCommissionAmount > 0
            ? createLedgerEntry({
                ...base,
                id: `${line.id}-commission`,
                transactionType: "recurring_commission",
                debitAmount: line.recurringCommissionAmount,
                creditAmount: 0,
                description: `Recurring commission earned by ${line.rpnName}`,
              })
            : null,
          line.churnBonusAmount > 0
            ? createLedgerEntry({
                ...base,
                id: `${line.id}-bonus`,
                transactionType: "churn_bonus",
                debitAmount: line.churnBonusAmount,
                creditAmount: 0,
                description: `Churn retention bonus earned by ${line.rpnName}`,
              })
            : null,
        ].filter(Boolean) as RpnCompensationLedgerEntry[];
      }),
    );
    audit("Generated RPN compensation run", "rpn_compensation_run", run.id, null, run);
    return run;
  },

  approveCompensationRun(runId: string): RpnCompensationRun {
    const runs = readList<RpnCompensationRun>(RUNS_KEY);
    const run = runs.find((item) => item.id === runId);
    if (!run) throw new Error("Compensation run not found.");
    if (run.status !== "draft" && run.status !== "reviewed") {
      throw new Error("Only draft or reviewed runs can be approved.");
    }
    const session = getSession();
    const updated: RpnCompensationRun = {
      ...run,
      status: "approved",
      approvedBy: session?.staffName || session?.displayName,
      approvedAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveRun(updated);
    upsertLedgerEntries(
      getLedgerEntries()
        .filter((entry) => entry.compensationRunId === runId)
        .map((entry) => ({ ...entry, status: "approved" as const })),
    );
    audit("Approved RPN compensation run", "rpn_compensation_run", runId, run, updated);
    return updated;
  },

  postCompensationRunToCOA(runId: string): RpnCompensationRun {
    const runs = readList<RpnCompensationRun>(RUNS_KEY);
    const run = runs.find((item) => item.id === runId);
    if (!run) throw new Error("Compensation run not found.");
    if (run.status !== "approved") throw new Error("Run must be approved before posting.");
    const accounts = ensureCompensationAccounts();
    const reference = `RPN-COMP-${run.id}`;
    const ledgerEntryIds: string[] = [];
    const postDebit = (account: ChartOfAccount, amount: number, description: string) => {
      if (amount <= 0) return;
      const entry = financeLedgerService.saveLedgerEntry({
        id: "",
        transactionNumber: "",
        transactionDate: run.periodTo,
        transactionType: "Journal",
        accountId: account.id,
        description,
        debit: amount,
        credit: 0,
        amount,
        reference,
        status: "posted",
        createdAt: "",
        updatedAt: "",
      });
      ledgerEntryIds.push(entry.id);
    };
    postDebit(accounts.wageExpense, run.wageTotal, "RPN wage expense");
    postDebit(
      accounts.recurringExpense,
      run.recurringCommissionTotal,
      "RPN recurring commission expense",
    );
    postDebit(
      accounts.churnBonusExpense,
      run.churnBonusTotal,
      "RPN retention / churn bonus expense",
    );
    if (run.totalPayable > 0) {
      const payable = financeLedgerService.saveLedgerEntry({
        id: "",
        transactionNumber: "",
        transactionDate: run.periodTo,
        transactionType: "Journal",
        accountId: accounts.payables.id,
        description: "RPN compensation payable",
        debit: 0,
        credit: run.totalPayable,
        amount: run.totalPayable,
        reference,
        status: "posted",
        createdAt: "",
        updatedAt: "",
      });
      ledgerEntryIds.push(payable.id);
    }
    const updated: RpnCompensationRun = {
      ...run,
      status: "posted",
      postedAt: nowIso(),
      posting: {
        id: makeId("RPN-POST"),
        runId,
        ledgerEntryIds,
        postedAt: nowIso(),
        postedBy: getSession()?.staffName || getSession()?.displayName,
        status: "posted",
      },
      updatedAt: nowIso(),
    };
    saveRun(updated);
    upsertLedgerEntries([
      ...getLedgerEntries()
        .filter((entry) => entry.compensationRunId === runId)
        .map((entry) => ({
          ...entry,
          status: "posted" as const,
          coaDebitAccountId:
            entry.transactionType === "onboarding_wage"
              ? accounts.wageExpense.id
              : entry.transactionType === "recurring_commission"
                ? accounts.recurringExpense.id
                : entry.transactionType === "churn_bonus"
                  ? accounts.churnBonusExpense.id
                  : entry.coaDebitAccountId,
          coaCreditAccountId: accounts.payables.id,
        })),
      createLedgerEntry({
        rpnId: "BATCH",
        rpnName: "RPN Compensation Batch",
        transactionDate: run.periodTo,
        periodFrom: run.periodFrom,
        periodTo: run.periodTo,
        transactionType: "coa_posting",
        sourceType: "coa",
        sourceId: updated.posting?.id || runId,
        compensationRunId: runId,
        debitAmount: 0,
        creditAmount: 0,
        currency: "USD",
        status: "posted",
        coaCreditAccountId: accounts.payables.id,
        journalEntryId: ledgerEntryIds.join(","),
        description: "RPN compensation run posted to COA",
        createdBy: getSession()?.staffName || getSession()?.displayName,
      }),
    ]);
    audit("Posted RPN compensation run to COA", "rpn_compensation_run", runId, run, updated);
    return updated;
  },

  payCompensationRun(runId: string, paymentAccountId: string): RpnCompensationRun {
    const runs = readList<RpnCompensationRun>(RUNS_KEY);
    const run = runs.find((item) => item.id === runId);
    if (!run) throw new Error("Compensation run not found.");
    if (run.status !== "posted") throw new Error("Only posted runs can be paid.");
    const cashBank = financeService
      .getCashBankAccounts()
      .find((account) => account.id === paymentAccountId) as CashBankAccount | undefined;
    if (!cashBank) throw new Error("Payment cash/bank account not found.");
    const accounts = ensureCompensationAccounts();
    const reference = `RPN-PAY-${run.id}`;
    const debit = financeLedgerService.saveLedgerEntry({
      id: "",
      transactionNumber: "",
      transactionDate: today(),
      transactionType: "Payment",
      accountId: accounts.payables.id,
      description: "RPN compensation paid",
      payeeName: "RPN Compensation Batch",
      debit: run.totalPayable,
      credit: 0,
      amount: run.totalPayable,
      reference,
      status: "posted",
      createdAt: "",
      updatedAt: "",
    });
    const credit = financeLedgerService.saveLedgerEntry({
      id: "",
      transactionNumber: "",
      transactionDate: today(),
      transactionType: "Payment",
      accountId: cashBank.accountId,
      cashBankAccountId: cashBank.id,
      description: "Cashbook payment for RPN compensation",
      payeeName: "RPN Compensation Batch",
      debit: 0,
      credit: run.totalPayable,
      amount: run.totalPayable,
      reference,
      status: "posted",
      createdAt: "",
      updatedAt: "",
    });
    const batch: RpnPaymentBatch = {
      id: makeId("RPN-PAY-BATCH"),
      runId,
      paymentAccountId,
      ledgerEntryIds: [debit.id, credit.id],
      paidAt: nowIso(),
      paidBy: getSession()?.staffName || getSession()?.displayName,
      totalPaid: run.totalPayable,
      status: "paid",
    };
    const updated: RpnCompensationRun = {
      ...run,
      status: "paid",
      paidAt: batch.paidAt,
      paymentAccountId,
      paymentBatch: batch,
      updatedAt: nowIso(),
    };
    saveRun(updated);
    upsertLedgerEntries([
      ...getLedgerEntries()
        .filter((entry) => entry.compensationRunId === runId)
        .map((entry) =>
          entry.status === "posted" ? { ...entry, status: "paid" as const } : entry,
        ),
      ...run.lines
        .filter((line) => line.totalPayable > 0)
        .map((line) =>
          createLedgerEntry({
            rpnId: line.rpnId,
            rpnName: line.rpnName,
            transactionDate: today(),
            periodFrom: run.periodFrom,
            periodTo: run.periodTo,
            transactionType: "payment",
            sourceType: "cashbook",
            sourceId: batch.id,
            compensationRunId: runId,
            debitAmount: 0,
            creditAmount: line.totalPayable,
            currency: "USD",
            status: "paid",
            coaDebitAccountId: accounts.payables.id,
            coaCreditAccountId: cashBank.accountId,
            cashbookEntryId: credit.id,
            description: `RPN compensation paid to ${line.rpnName}`,
            createdBy: batch.paidBy,
          }),
        ),
    ]);
    audit("Paid RPN compensation run from cashbook", "rpn_compensation_run", runId, run, updated);
    return updated;
  },

  moveRpnToCommissionOnly(
    rpnId: string,
    recurringCommissionRateOverride?: number,
  ): RpnCompensationPolicy {
    const { plan, policy } = getPlanForRpn(rpnId);
    const policies = getPolicies();
    const session = getSession();
    const updated: RpnCompensationPolicy = {
      id: policy?.id || makeId("RPN-POLICY"),
      rpnId,
      planId: policy?.planId || plan.id,
      wageEnabledOverride: false,
      commissionOnly: true,
      recurringCommissionRateOverride:
        recurringCommissionRateOverride ?? policy?.recurringCommissionRateOverride,
      movedToCommissionOnlyAt: nowIso(),
      movedToCommissionOnlyBy: session?.staffName || session?.displayName,
      notes: policy?.notes,
      createdAt: policy?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    savePolicies(
      policy
        ? policies.map((item) => (item.id === policy.id ? updated : item))
        : [...policies, updated],
    );
    audit("Moved RPN to commission-only compensation", "rpn_compensation_policy", updated.id, policy, updated, "warning");
    return updated;
  },

  reverseLedgerEntry(entryId: string, reason = "Manual reversal"): RpnCompensationLedgerEntry {
    const entry = getLedgerEntries().find((item) => item.id === entryId);
    if (!entry) throw new Error("RPN ledger entry not found.");
    const reversalType =
      entry.transactionType === "onboarding_wage"
        ? "wage_reversal"
        : entry.transactionType === "recurring_commission"
          ? "commission_reversal"
          : entry.transactionType === "churn_bonus"
            ? "bonus_reversal"
            : "manual_adjustment";
    const reversal = createLedgerEntry({
      rpnId: entry.rpnId,
      rpnName: entry.rpnName,
      transactionDate: today(),
      periodFrom: entry.periodFrom,
      periodTo: entry.periodTo,
      transactionType: reversalType,
      sourceType: "reversal",
      sourceId: entry.id,
      compensationRunId: entry.compensationRunId,
      vendorId: entry.vendorId,
      debitAmount: entry.creditAmount,
      creditAmount: entry.debitAmount,
      currency: entry.currency,
      status: "reversed",
      coaDebitAccountId: entry.coaCreditAccountId,
      coaCreditAccountId: entry.coaDebitAccountId,
      description: `${reason}: ${entry.description}`,
      createdBy: getSession()?.staffName || getSession()?.displayName,
    });
    upsertLedgerEntries([{ ...entry, status: "reversed" }, reversal]);
    audit("Created RPN compensation reversal ledger entry", "rpn_compensation_ledger", reversal.id, entry, reversal, "warning");
    return reversal;
  },

  generateCompensationStatements(
    filters: RpnCompensationReportFilters = {},
  ): RpnCompensationStatementReport[] {
    const rows = filteredLedger(filters);
    const runs = readList<RpnCompensationRun>(RUNS_KEY);
    const rpns = rpnService.getAll();
    return rpns
      .filter((rpn) => !filters.rpnId || rpn.id === filters.rpnId)
      .map((rpn) => {
        const rpnRows = rows.filter((entry) => entry.rpnId === rpn.id);
        const runLine = runs
          .flatMap((run) => run.lines)
          .reverse()
          .find((line) => line.rpnId === rpn.id);
        const payments = Math.abs(sumLedger(rpnRows, (entry) => entry.transactionType === "payment"));
        const reversals = Math.abs(
          sumLedger(rpnRows, (entry) => entry.transactionType.includes("reversal")),
        );
        const wageEarned = sumLedger(rpnRows, (entry) => entry.transactionType === "onboarding_wage");
        const recurringCommissionEarned = sumLedger(
          rpnRows,
          (entry) => entry.transactionType === "recurring_commission",
        );
        const churnBonusEarned = sumLedger(rpnRows, (entry) => entry.transactionType === "churn_bonus");
        const adjustments = sumLedger(rpnRows, (entry) => entry.transactionType === "manual_adjustment");
        const totalEarned = money(wageEarned + recurringCommissionEarned + churnBonusEarned + adjustments - reversals);
        return {
          rpnId: rpn.id,
          rpnName: rpn.name,
          periodFrom: filters.dateFrom || "",
          periodTo: filters.dateTo || "",
          wageEarned,
          recurringCommissionEarned,
          churnBonusEarned,
          adjustments,
          reversals,
          totalEarned,
          amountPaid: payments,
          balanceDue: money(totalEarned - payments),
          portfolioVendorCount: runLine?.portfolioCount || 0,
          returningVendorCount: runLine?.recurringRevenue ? 1 : 0,
          churnRatePercent: runLine?.churnRatePercent || 0,
          commissionRate: runLine?.recurringRevenue
            ? money((runLine.recurringCommissionAmount / runLine.recurringRevenue) * 100)
            : 0,
          wageStatus: runLine?.commissionOnly
            ? "commission_only"
            : wageEarned > 0
              ? "enabled"
              : "disabled",
        };
      });
  },

  generatePayablesLedgerReport(
    filters: RpnCompensationReportFilters = {},
  ): RpnPayablesLedgerReport[] {
    return rpnCompensationService.generateCompensationStatements(filters).map((row) => ({
      rpnId: row.rpnId,
      rpnName: row.rpnName,
      openingBalance: 0,
      wageEarned: row.wageEarned,
      commissionEarned: row.recurringCommissionEarned,
      bonusEarned: row.churnBonusEarned,
      adjustments: row.adjustments,
      reversals: row.reversals,
      payments: row.amountPaid,
      closingBalance: row.balanceDue,
    }));
  },

  generatePortfolioRevenueReport(
    filters: RpnCompensationReportFilters = {},
  ): RpnPortfolioRevenueReport[] {
    return readList<RpnCompensationRun>(RUNS_KEY)
      .filter((run) => (!filters.compensationRunId || run.id === filters.compensationRunId))
      .flatMap((run) => run.lines)
      .filter((line) => !filters.rpnId || line.rpnId === filters.rpnId)
      .map((line) => {
        const totalRpnCost = money(line.wageAmount + line.recurringCommissionAmount + line.churnBonusAmount);
        return {
          rpnId: line.rpnId,
          rpnName: line.rpnName,
          openingPortfolioVendors: line.openingActivePortfolio,
          newVendorsOnboarded: line.qualifyingOnboardings,
          returningVendors: line.recurringRevenue > 0 ? 1 : 0,
          churnedVendors: line.churnedVendors,
          grossVendorRevenueReceived: line.recurringRevenue,
          wageCost: line.wageAmount,
          commissionCost: line.recurringCommissionAmount,
          bonusCost: line.churnBonusAmount,
          totalRpnCost,
          netRpnContribution: money(line.recurringRevenue - totalRpnCost),
          portfolioCeilingUsagePercent:
            line.portfolioCeiling > 0
              ? money((line.portfolioCount / line.portfolioCeiling) * 100)
              : 0,
        };
      });
  },

  generateChurnRetentionReport(
    filters: RpnCompensationReportFilters = {},
  ): RpnChurnRetentionReport[] {
    const plans = getPlans();
    return readList<RpnCompensationRun>(RUNS_KEY)
      .flatMap((run) => run.lines)
      .filter((line) => !filters.rpnId || line.rpnId === filters.rpnId)
      .map((line) => {
        const threshold =
          plans.find((plan) => plan.id === line.planId)?.churnThresholdPercent || 0;
        return {
          rpnId: line.rpnId,
          rpnName: line.rpnName,
          openingActiveVendors: line.openingActivePortfolio,
          returningVendors: line.recurringRevenue > 0 ? 1 : 0,
          churnedVendors: line.churnedVendors,
          churnPercentage: line.churnRatePercent,
          churnThreshold: threshold,
          bonusQualification: line.churnRatePercent <= threshold,
          bonusAmount: line.churnBonusAmount,
          highChurnWarning: line.churnRatePercent > threshold,
        };
      });
  },

  generateCashbookPaymentReport(
    filters: RpnCompensationReportFilters = {},
  ): RpnCashbookPaymentReport[] {
    const cash = financeService.getCashBankAccounts();
    return readList<RpnCompensationRun>(RUNS_KEY)
      .filter((run) => run.paymentBatch)
      .flatMap((run) =>
        run.lines.map((line) => ({
          paymentDate: run.paymentBatch?.paidAt?.slice(0, 10) || "",
          rpnId: line.rpnId,
          rpnName: line.rpnName,
          amount: line.totalPayable,
          paymentAccount:
            cash.find((account) => account.id === run.paymentAccountId)?.accountName ||
            run.paymentAccountId ||
            "",
          paymentMethod: "cashbook",
          reference: `RPN-PAY-${run.id}`,
          cashbookEntryId: run.paymentBatch?.ledgerEntryIds?.join(","),
          compensationRunId: run.id,
          paidBy: run.paymentBatch?.paidBy,
          status: run.status,
        })),
      )
      .filter((row) => !filters.rpnId || row.rpnId === filters.rpnId)
      .filter((row) => !filters.paymentStatus || row.status === filters.paymentStatus);
  },

  generateProfitabilityReport(
    filters: RpnCompensationReportFilters = {},
  ): RpnProfitabilityReport[] {
    return rpnCompensationService.generatePortfolioRevenueReport(filters).map((row) => ({
      rpnId: row.rpnId,
      rpnName: row.rpnName,
      grossRevenueFromAssignedVendors: row.grossVendorRevenueReceived,
      wageCost: row.wageCost,
      commissionCost: row.commissionCost,
      bonusCost: row.bonusCost,
      totalRpnCost: row.totalRpnCost,
      netContribution: row.netRpnContribution,
      costToRevenuePercentage:
        row.grossVendorRevenueReceived > 0
          ? money((row.totalRpnCost / row.grossVendorRevenueReceived) * 100)
          : 0,
      churnImpact: row.churnedVendors,
      portfolioProductivity:
        row.openingPortfolioVendors > 0
          ? money(row.grossVendorRevenueReceived / row.openingPortfolioVendors)
          : 0,
    }));
  },

  generateExceptionReport(
    filters: RpnCompensationReportFilters = {},
  ): RpnCompensationException[] {
    const exceptions: RpnCompensationException[] = [];
    const assignments = activeAssignments();
    const byVendor = new Map<string, RpnVendorAssignment[]>();
    assignments.forEach((assignment) =>
      byVendor.set(assignment.vendorId, [...(byVendor.get(assignment.vendorId) || []), assignment]),
    );
    byVendor.forEach((rows, vendorId) => {
      if (rows.length > 1) {
        exceptions.push({
          id: `duplicate-${vendorId}`,
          severity: "critical",
          type: "duplicate_active_assignment",
          message: `Vendor ${vendorId} is assigned to more than one active RPN.`,
          vendorId,
        });
      }
    });
    confirmedPayments(filters.dateFrom || "0000-01-01", filters.dateTo || "9999-12-31").forEach((payment) => {
      if (!assignments.some((assignment) => assignment.vendorId === payment.vendorId)) {
        exceptions.push({
          id: `receipt-no-rpn-${payment.id}`,
          severity: "high",
          type: "receipt_without_assignment",
          message: `${payment.vendorName} has a confirmed receipt with no active RPN assignment.`,
          vendorId: payment.vendorId,
        });
      }
    });
    readList<RpnOnboardingLog>(ONBOARDING_LOGS_KEY)
      .filter((log) => log.status !== "approved" && log.qualifiesForWage)
      .forEach((log) =>
        exceptions.push({
          id: `unapproved-wage-${log.id}`,
          severity: "critical",
          type: "unapproved_onboarding_wage",
          message: `${log.vendorName} wage log qualifies for wage but is not approved.`,
          rpnId: log.rpnId,
          vendorId: log.vendorId,
        }),
      );
    readList<RpnCompensationRun>(RUNS_KEY).forEach((run) => {
      if (run.status === "posted") {
        exceptions.push({
          id: `posted-unpaid-${run.id}`,
          severity: "high",
          type: "posted_unpaid",
          message: `Compensation run ${run.id} is posted but unpaid.`,
          compensationRunId: run.id,
        });
      }
      run.lines.forEach((line) => {
        if (line.overPortfolioCeiling) {
          exceptions.push({
            id: `ceiling-${run.id}-${line.rpnId}`,
            severity: "warning",
            type: "portfolio_ceiling",
            message: `${line.rpnName} is above portfolio ceiling.`,
            rpnId: line.rpnId,
            compensationRunId: run.id,
          });
        }
        if (line.recurringCommissionAmount < 0 || line.recurringCommissionAmount > line.recurringRevenue) {
          exceptions.push({
            id: `unusual-commission-${run.id}-${line.rpnId}`,
            severity: "critical",
            type: "unusual_commission",
            message: `${line.rpnName} has unusual commission values.`,
            rpnId: line.rpnId,
            compensationRunId: run.id,
          });
        }
        if (line.commissionOnly && line.wageAmount > 0) {
          exceptions.push({
            id: `commission-only-wage-${run.id}-${line.rpnId}`,
            severity: "critical",
            type: "commission_only_wage",
            message: `${line.rpnName} is commission-only but still receiving wage.`,
            rpnId: line.rpnId,
            compensationRunId: run.id,
          });
        }
      });
    });
    return exceptions.filter((item) => !filters.rpnId || item.rpnId === filters.rpnId);
  },
};
