export type BillingCycle = "weekly" | "monthly" | "annual" | "yearly";

export type PlanDateInput = {
  assignedAt?: Date | string | number | null;
  trialDays?: number | null;
  billingCycle?: BillingCycle | string | null;
  timezone?: string | null;
};

export type PlanDateResult = {
  assignedAtIso: string;
  trialStartAtIso: string | null;
  trialEndsAtIso: string | null;
  billingStartsAtIso: string;
  nextDueAtIso: string;
  timezone: string;
  trialDays: number;
  billingCycle: string;
};

export function calculatePlanAssignmentDates(
  input: PlanDateInput,
): PlanDateResult {
  const timezone = input.timezone || "Africa/Harare";
  const assignedAt = input.assignedAt ? new Date(input.assignedAt) : new Date();
  const trialDays = Math.max(0, Number(input.trialDays) || 0);
  const billingCycle = (input.billingCycle || "monthly").toLowerCase();

  let trialStartAtIso: string | null = null;
  let trialEndsAtIso: string | null = null;
  let billingStartsAtIso: string;

  if (trialDays > 0) {
    trialStartAtIso = assignedAt.toISOString();
    const trialEnd = new Date(assignedAt.getTime());
    trialEnd.setDate(trialEnd.getDate() + trialDays);
    trialEndsAtIso = trialEnd.toISOString();
    billingStartsAtIso = trialEndsAtIso;
  } else {
    billingStartsAtIso = assignedAt.toISOString();
  }

  const nextDue = new Date(billingStartsAtIso);
  if (billingCycle === "weekly") {
    nextDue.setDate(nextDue.getDate() + 7);
  } else if (billingCycle === "annual" || billingCycle === "yearly") {
    nextDue.setFullYear(nextDue.getFullYear() + 1);
  } else {
    nextDue.setMonth(nextDue.getMonth() + 1);
  }

  return {
    assignedAtIso: assignedAt.toISOString(),
    trialStartAtIso,
    trialEndsAtIso,
    billingStartsAtIso,
    nextDueAtIso: nextDue.toISOString(),
    timezone,
    trialDays,
    billingCycle,
  };
}
