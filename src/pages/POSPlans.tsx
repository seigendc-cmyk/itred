import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Edit2, Plus, X } from "lucide-react";
import {
  BrandedAlertModal,
  FormField,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TablePanel,
} from "../components/CommonUI.tsx";
import { posGovernanceService } from "../services/posGovernanceService.ts";
import { PosPlan } from "../types/posGovernance.ts";

const blankPlan: Partial<PosPlan> = {
  planId: "",
  planName: "",
  monthlyPrice: 0,
  trialDays: 7,
  maxBranches: 1,
  maxWarehouses: 1,
  maxTerminals: 1,
  maxStaff: 2,
  maxProducts: 100,
  allowOfflineMode: true,
  allowCreditSales: false,
  allowLaybye: false,
  allowReturns: true,
  allowAssembly: false,
  allowConsignment: false,
  allowFinanceManager: false,
  allowBI: false,
  allowMarketplacePublish: false,
  allowPoolWisePublish: false,
  allowFiscalization: false,
  status: "active",
};

const numberFields: Array<keyof PosPlan> = [
  "monthlyPrice",
  "trialDays",
  "maxBranches",
  "maxWarehouses",
  "maxTerminals",
  "maxStaff",
  "maxProducts",
];

const featureFields: Array<keyof PosPlan> = [
  "allowOfflineMode",
  "allowCreditSales",
  "allowLaybye",
  "allowReturns",
  "allowAssembly",
  "allowConsignment",
  "allowFinanceManager",
  "allowBI",
  "allowMarketplacePublish",
  "allowPoolWisePublish",
  "allowFiscalization",
];

const inputClass =
  "w-full bg-stone-50 border-0 border-b-2 border-stone-300 focus:border-brand-orange focus:ring-0 outline-none rounded-none px-4 py-3 text-sm font-bold text-brand-charcoal";

export const POSPlans: React.FC = () => {
  const [plans, setPlans] = useState<PosPlan[]>([]);
  const [editing, setEditing] = useState<Partial<PosPlan> | null>(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({
    isOpen: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const sortedPlans = useMemo(
    () =>
      [...plans].sort((a, b) =>
        a.planName.localeCompare(b.planName, undefined, { sensitivity: "base" }),
      ),
    [plans],
  );

  const showAlert = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "success",
  ) => setAlert({ isOpen: true, message, type });

  const loadPlans = async () => {
    try {
      setPlans(await posGovernanceService.getPlans());
    } catch (error: any) {
      showAlert(error.message || "POS plans could not be loaded.", "error");
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing?.planName?.trim()) {
      showAlert("Plan name is required.", "warning");
      return;
    }
    setSaving(true);
    try {
      await posGovernanceService.savePlan(editing);
      await loadPlans();
      setEditing(null);
      showAlert("POS plan saved.");
    } catch (error: any) {
      showAlert(error.message || "POS plan was not saved.", "error");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof PosPlan, value: unknown) => {
    setEditing((current) => ({ ...(current || blankPlan), [field]: value }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Plans"
        actions={
          <PrimaryButton onClick={() => setEditing({ ...blankPlan })}>
            <Plus size={14} className="mr-2" />
            New POS Plan
          </PrimaryButton>
        }
      />

      {editing && (
        <form
          onSubmit={savePlan}
          className="border-2 border-stone-200 bg-white p-5 space-y-5"
        >
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-brand-charcoal">
                {editing.id ? "Edit POS Plan" : "Create POS Plan"}
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">
                POS entitlement template
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-9 w-9 border border-stone-200 flex items-center justify-center"
              aria-label="Close POS plan form"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Plan ID">
              <input
                className={inputClass}
                value={editing.planId || ""}
                onChange={(e) => setField("planId", e.target.value)}
                placeholder="POS-STARTER"
              />
            </FormField>
            <FormField label="Plan Name" required>
              <input
                className={inputClass}
                value={editing.planName || ""}
                onChange={(e) => setField("planName", e.target.value)}
                placeholder="POS Starter"
              />
            </FormField>
            <FormField label="Status">
              <select
                className={inputClass}
                value={editing.status || "active"}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
            {numberFields.map((field) => (
              <FormField key={field} label={String(field)}>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={Number(editing[field] || 0)}
                  onChange={(e) => setField(field, Number(e.target.value))}
                />
              </FormField>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {featureFields.map((field) => (
              <label
                key={field}
                className="border-2 border-stone-100 bg-stone-50 p-3 flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="accent-brand-orange"
                  checked={!!editing[field]}
                  onChange={(e) => setField(field, e.target.checked)}
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-charcoal">
                  {String(field).replace(/^allow/, "")}
                </span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setEditing(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" isLoading={saving}>
              Save POS Plan
            </PrimaryButton>
          </div>
        </form>
      )}

      <TablePanel
        title="POS Plan Catalogue"
        subtitle={`${sortedPlans.length} plans available to POS governance`}
        headers={[
          "Plan",
          "Price",
          "Trial",
          "Limits",
          "Features",
          "Status",
          "Actions",
        ]}
      >
        {sortedPlans.map((plan) => (
          <tr key={plan.id} className="text-xs hover:bg-stone-50">
            <td className="px-6 py-4">
              <p className="font-black uppercase text-brand-charcoal">
                {plan.planName}
              </p>
              <p className="text-[10px] font-mono text-stone-400">{plan.planId}</p>
            </td>
            <td className="px-6 py-4 font-mono font-bold">
              USD {plan.monthlyPrice.toFixed(2)}
            </td>
            <td className="px-6 py-4 font-bold">{plan.trialDays} days</td>
            <td className="px-6 py-4 text-[10px] font-bold uppercase text-stone-500">
              {plan.maxBranches} branches / {plan.maxTerminals} terminals /{" "}
              {plan.maxStaff} staff / {plan.maxProducts} products
            </td>
            <td className="px-6 py-4">
              <div className="flex flex-wrap gap-1 max-w-sm">
                {featureFields
                  .filter((field) => plan[field])
                  .slice(0, 5)
                  .map((field) => (
                    <span
                      key={field}
                      className="bg-orange-50 text-brand-orange px-2 py-1 text-[8px] font-black uppercase"
                    >
                      {String(field).replace(/^allow/, "")}
                    </span>
                  ))}
              </div>
            </td>
            <td className="px-6 py-4">
              <span
                className={`px-2 py-1 text-[9px] font-black uppercase ${
                  plan.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-stone-100 text-stone-500"
                }`}
              >
                {plan.status}
              </span>
            </td>
            <td className="px-6 py-4">
              <div className="flex gap-2">
                <button
                  className="h-8 w-8 border border-stone-200 flex items-center justify-center"
                  title="Edit plan"
                  onClick={() => setEditing(plan)}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  className="h-8 w-8 border border-stone-200 flex items-center justify-center"
                  title="Duplicate plan"
                  onClick={async () => {
                    await posGovernanceService.duplicatePlan(plan);
                    await loadPlans();
                    showAlert("POS plan duplicated.");
                  }}
                >
                  <Copy size={13} />
                </button>
                <button
                  className="h-8 w-8 border border-stone-200 flex items-center justify-center"
                  title={plan.status === "active" ? "Deactivate" : "Activate"}
                  onClick={async () => {
                    await posGovernanceService.updatePlanStatus(
                      plan,
                      plan.status === "active" ? "inactive" : "active",
                    );
                    await loadPlans();
                  }}
                >
                  {plan.status === "active" ? (
                    <X size={13} />
                  ) : (
                    <Check size={13} />
                  )}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </TablePanel>

      <BrandedAlertModal
        isOpen={alert.isOpen}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert((current) => ({ ...current, isOpen: false }))}
      />
    </div>
  );
};

export default POSPlans;
