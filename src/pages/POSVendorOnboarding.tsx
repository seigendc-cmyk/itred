import React, { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, RefreshCw, ShieldOff } from "lucide-react";
import {
  BrandedAlertModal,
  FormField,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TablePanel,
} from "../components/CommonUI.tsx";
import { posGovernanceService } from "../services/posGovernanceService.ts";
import {
  posVendorOnboardingService,
  buildOnboardingWhatsAppMessage,
} from "../services/posVendorOnboardingService.ts";
import { PosGovernanceData, PosPlan } from "../types/posGovernance.ts";
import {
  PosVendorOnboardingForm,
  PosVendorOnboardingRow,
  VendorOnboardingAuditEntry,
  VendorOnboardingLifecycle,
} from "../types/posVendorOnboarding.ts";

const lifecycleOptions: VendorOnboardingLifecycle[] = [
  "ISSUED",
  "RPN_OPENED",
  "PROFILE_COMPLETION_PENDING",
  "WAREHOUSE_SETUP_PENDING",
  "BRANCH_SETUP_PENDING",
  "TERMINAL_SETUP_PENDING",
  "STAFF_SETUP_PENDING",
  "READY_FOR_POS",
  "EXPIRED",
  "CANCELLED",
];

const blankForm: PosVendorOnboardingForm = {
  vendorName: "",
  tradingName: "",
  sector: "",
  category: "",
  contactPerson: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  district: "",
  suburb: "",
  city: "",
  posPlanId: "",
  posPlanName: "",
  posActivationType: "trial",
  expiryDate: "",
  notes: "",
  rpnName: "",
  rpnPhone: "",
  rpnEmail: "",
};

const inputClass =
  "w-full bg-stone-50 border-0 border-b-2 border-stone-300 focus:border-brand-orange focus:ring-0 outline-none rounded-none px-4 py-3 text-sm font-bold text-brand-charcoal";

const badge = (value: string) => (
  <span className="bg-stone-100 px-2 py-1 text-[9px] font-black uppercase text-stone-600">
    {value}
  </span>
);

const readinessItems: Array<{
  label: string;
  lifecycle?: VendorOnboardingLifecycle;
}> = [
  { label: "Vendor skeleton", lifecycle: "ISSUED" },
  { label: "Onboarding code issued", lifecycle: "ISSUED" },
  { label: "Platform activation", lifecycle: "ISSUED" },
  { label: "Profile completion", lifecycle: "PROFILE_COMPLETION_PENDING" },
  { label: "Warehouse setup", lifecycle: "WAREHOUSE_SETUP_PENDING" },
  { label: "Branch setup", lifecycle: "BRANCH_SETUP_PENDING" },
  { label: "Terminal setup", lifecycle: "TERMINAL_SETUP_PENDING" },
  { label: "Staff setup", lifecycle: "STAFF_SETUP_PENDING" },
  { label: "Ready for POS", lifecycle: "READY_FOR_POS" },
];

const lifecycleIndex = (value: VendorOnboardingLifecycle) =>
  lifecycleOptions.indexOf(value);

const isReadinessComplete = (
  current: VendorOnboardingLifecycle,
  target?: VendorOnboardingLifecycle,
) => {
  if (!target) return false;
  if (current === "READY_FOR_POS") return true;
  if (current === "CANCELLED" || current === "EXPIRED") return false;
  return lifecycleIndex(current) >= lifecycleIndex(target);
};

const readinessStatus = (
  row: PosVendorOnboardingRow | null,
  target?: VendorOnboardingLifecycle,
  governanceData?: PosGovernanceData,
) => {
  if (!row) return "Missing";
  if (row.status === "cancelled" || row.onboardingStatus === "CANCELLED") {
    return "Cancelled";
  }
  if (row.status === "expired" || row.onboardingStatus === "EXPIRED") {
    return "Expired";
  }
  if (target === "STAFF_SETUP_PENDING") {
    return governanceData?.staffAccess.some(
      (item) =>
        item.vendorId === row.vendorId &&
        item.status === "active" &&
        !!(item.branchId || item.branchIds?.length) &&
        !!(item.terminalId || item.terminalIds?.length) &&
        !!item.roleId,
    )
      ? "Ready"
      : "Pending";
  }
  if (target === "READY_FOR_POS") {
    const platformReady = governanceData?.subscriptions.some(
      (item) =>
        item.vendorId === row.vendorId &&
        ["active", "trial"].includes(item.subscriptionStatus),
    );
    const branchReady = governanceData?.branches.some((item) => item.vendorId === row.vendorId);
    const terminalReady = governanceData?.terminals.some((item) => item.vendorId === row.vendorId);
    const roleReady = governanceData?.roles.some((item) => item.vendorId === row.vendorId);
    const staffReady = governanceData?.staffAccess.some(
      (item) =>
        item.vendorId === row.vendorId &&
        item.status === "active" &&
        !!(item.branchId || item.branchIds?.length) &&
        !!(item.terminalId || item.terminalIds?.length) &&
        !!item.roleId,
    );
    return platformReady && branchReady && terminalReady && roleReady && staffReady
      ? "Ready"
      : "Pending";
  }
  return isReadinessComplete(row.onboardingStatus, target) ? "Ready" : "Pending";
};

export const POSVendorOnboarding: React.FC = () => {
  const [form, setForm] = useState<PosVendorOnboardingForm>(blankForm);
  const [plans, setPlans] = useState<PosPlan[]>([]);
  const [governanceData, setGovernanceData] = useState<PosGovernanceData>({
    plans: [],
    subscriptions: [],
    branches: [],
    warehouses: [],
    terminals: [],
    staffAccess: [],
    roles: [],
    entitlementSnapshots: [],
    activationLogs: [],
  });
  const [rows, setRows] = useState<PosVendorOnboardingRow[]>([]);
  const [audit, setAudit] = useState<VendorOnboardingAuditEntry[]>([]);
  const [selectedRow, setSelectedRow] = useState<PosVendorOnboardingRow | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({
    isOpen: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status === "active"),
    [plans],
  );

  const currentMessage =
    selectedRow?.whatsappMessage ||
    buildOnboardingWhatsAppMessage(
      form.vendorName || "Vendor",
      "Generated after save",
      "Generated after save",
    );

  const showAlert = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "success",
  ) => setAlert({ isOpen: true, message, type });

  const load = async () => {
    const [remotePlans, remoteRows, remoteAudit, remoteGovernanceData] = await Promise.all([
      posGovernanceService.getPlans().catch(() => []),
      posVendorOnboardingService.getRows(),
      posVendorOnboardingService.getAudit().catch(() => []),
      posGovernanceService.getData(),
    ]);
    setPlans(remotePlans);
    setRows(remoteRows);
    setAudit(remoteAudit);
    setGovernanceData(remoteGovernanceData);
  };

  useEffect(() => {
    void load().catch((error: any) =>
      showAlert(error.message || "Onboarding data could not be loaded.", "error"),
    );
  }, []);

  const setField = <K extends keyof PosVendorOnboardingForm>(
    key: K,
    value: PosVendorOnboardingForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const copyMessage = async (
    message: string,
    row: PosVendorOnboardingRow | null = selectedRow,
  ) => {
    await navigator.clipboard.writeText(message);
    await posVendorOnboardingService
      .logWhatsappAction(row, "whatsapp_message_copied", "WhatsApp message copied.")
      .catch(() => undefined);
    showAlert("WhatsApp onboarding message copied.");
  };

  const openWhatsApp = (
    phone: string,
    message: string,
    row: PosVendorOnboardingRow | null = selectedRow,
  ) => {
    void posVendorOnboardingService
      .logWhatsappAction(row, "whatsapp_message_opened", "WhatsApp link opened.")
      .catch(() => undefined);
    window.open(
      posVendorOnboardingService.whatsappLink(phone, message),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const saveOnboarding = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await posVendorOnboardingService.createOnboarding(form);
      setSelectedRow({
        ...created.codeRecord,
        vendorSkeleton: created.vendorSkeleton,
      });
      setForm(blankForm);
      await load();
      showAlert("POS vendor onboarding issued.");
    } catch (error: any) {
      showAlert(error.message || "POS vendor onboarding was not created.", "error");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: () => Promise<void>, message: string) => {
    try {
      await action();
      await load();
      showAlert(message);
    } catch (error: any) {
      showAlert(error.message || "Onboarding action failed.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Vendor POS Onboarding" />

      <div className="border-l-4 border-brand-orange bg-stone-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
          Backend Office onboarding bridge
        </p>
        <p className="mt-1 text-xs font-bold text-brand-charcoal">
          Create the private-tenant vendor skeleton and setup code only. Branch,
          terminal, staff, inventory and sales setup stay inside the vendor POS app.
        </p>
      </div>

      <form
        onSubmit={saveOnboarding}
        className="border-2 border-stone-200 bg-white p-5 space-y-5"
      >
        <FormBlock title="Vendor Information">
          <TextField
            label="Vendor Name"
            required
            value={form.vendorName}
            onChange={(value) => setField("vendorName", value)}
          />
          <TextField
            label="Trading Name"
            value={form.tradingName}
            onChange={(value) => setField("tradingName", value)}
          />
          <TextField
            label="Sector"
            value={form.sector}
            onChange={(value) => setField("sector", value)}
          />
          <TextField
            label="Category"
            value={form.category}
            onChange={(value) => setField("category", value)}
          />
          <TextField
            label="Contact Person"
            value={form.contactPerson}
            onChange={(value) => setField("contactPerson", value)}
          />
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(value) => setField("phone", value)}
          />
          <TextField
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(value) => setField("whatsapp", value)}
          />
          <TextField
            label="Email"
            value={form.email}
            onChange={(value) => setField("email", value)}
          />
          <TextField
            label="Address"
            value={form.address}
            onChange={(value) => setField("address", value)}
          />
          <TextField
            label="District"
            value={form.district}
            onChange={(value) => setField("district", value)}
          />
          <TextField
            label="Suburb"
            value={form.suburb}
            onChange={(value) => setField("suburb", value)}
          />
          <TextField
            label="City"
            value={form.city}
            onChange={(value) => setField("city", value)}
          />
        </FormBlock>

        <FormBlock title="POS Activation">
          <FormField label="POS Plan">
            <select
              className={inputClass}
              value={form.posPlanId}
              onChange={(event) => {
                const plan = plans.find((item) => item.id === event.target.value);
                setForm((current) => ({
                  ...current,
                  posPlanId: event.target.value,
                  posPlanName: plan?.planName || "",
                }));
              }}
            >
              <option value="">Select POS plan...</option>
              {activePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.planName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Activation Type">
            <select
              className={inputClass}
              value={form.posActivationType}
              onChange={(event) =>
                setField(
                  "posActivationType",
                  event.target.value as PosVendorOnboardingForm["posActivationType"],
                )
              }
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
            </select>
          </FormField>
          <FormField label="Expiry Date">
            <input
              className={inputClass}
              type="date"
              value={form.expiryDate}
              onChange={(event) => setField("expiryDate", event.target.value)}
            />
          </FormField>
          <FormField label="Notes">
            <input
              className={inputClass}
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </FormField>
        </FormBlock>

        <FormBlock title="RPN Information">
          <TextField
            label="RPN Name"
            value={form.rpnName}
            onChange={(value) => setField("rpnName", value)}
          />
          <TextField
            label="RPN Phone"
            value={form.rpnPhone}
            onChange={(value) => setField("rpnPhone", value)}
          />
          <TextField
            label="RPN Email"
            value={form.rpnEmail}
            onChange={(value) => setField("rpnEmail", value)}
          />
        </FormBlock>

        <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
          <SecondaryButton type="button" onClick={() => setForm(blankForm)}>
            Clear
          </SecondaryButton>
          <PrimaryButton type="submit" isLoading={saving}>
            Issue Onboarding Code
          </PrimaryButton>
        </div>
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        <TablePanel
          title="Onboarding Status"
          subtitle="Code-based setup records for private vendor tenants"
          headers={[
            "Vendor",
            "Vendor ID",
            "Code",
            "POS Plan",
            "Activation Type",
            "Code Status",
            "Onboarding Lifecycle",
            "RPN",
            "Issued Date",
            "Expiry",
            "Actions",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id} className="text-xs hover:bg-stone-50 align-top">
              <td className="px-6 py-4 font-black uppercase">{row.vendorName}</td>
              <td className="px-6 py-4 font-mono">{row.vendorId}</td>
              <td className="px-6 py-4 font-mono font-black text-brand-orange">
                {row.code}
              </td>
              <td className="px-6 py-4">{row.posPlanName || "-"}</td>
              <td className="px-6 py-4">{badge(row.posActivationType)}</td>
              <td className="px-6 py-4">{badge(row.status)}</td>
              <td className="px-6 py-4">
                <select
                  className="bg-stone-50 border border-stone-200 px-2 py-2 text-[10px] font-black uppercase"
                  value={row.onboardingStatus}
                  onChange={(event) =>
                    runAction(
                      () =>
                        posVendorOnboardingService.updateLifecycle(
                          row,
                          event.target.value as VendorOnboardingLifecycle,
                        ),
                      "Onboarding lifecycle updated.",
                    )
                  }
                >
                  {lifecycleOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4">
                <p className="font-bold">{row.rpnName || "-"}</p>
                <p className="text-[10px] text-stone-400">{row.rpnPhone || ""}</p>
              </td>
              <td className="px-6 py-4 font-mono">{row.issuedAt}</td>
              <td className="px-6 py-4 font-mono">{row.expiresAt}</td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  <IconButton
                    title="Copy WhatsApp message"
                    onClick={() => copyMessage(row.whatsappMessage, row)}
                  >
                    <Copy size={13} />
                  </IconButton>
                  <IconButton
                    title="Open WhatsApp link"
                    onClick={() =>
                      openWhatsApp(
                        row.rpnPhone || row.vendorSkeleton?.whatsapp || "",
                        row.whatsappMessage,
                        row,
                      )
                    }
                  >
                    <ExternalLink size={13} />
                  </IconButton>
                  <IconButton
                    title="Re-send code"
                    onClick={() =>
                      runAction(
                        () => posVendorOnboardingService.reissueCode(row),
                        "Onboarding code reissued.",
                      )
                    }
                  >
                    <RefreshCw size={13} />
                  </IconButton>
                  <SecondaryButton
                    size="sm"
                    onClick={() =>
                      runAction(
                        () => posVendorOnboardingService.cancelCode(row),
                        "Onboarding code cancelled.",
                      )
                    }
                  >
                    Cancel Code
                  </SecondaryButton>
                  <SecondaryButton size="sm" onClick={() => setSelectedRow(row)}>
                    View Vendor
                  </SecondaryButton>
                  <SecondaryButton
                    size="sm"
                    onClick={() =>
                      runAction(
                        () =>
                          posVendorOnboardingService.updateLifecycle(
                            row,
                            "READY_FOR_POS",
                          ),
                        "Vendor marked ready for POS.",
                      )
                    }
                  >
                    Mark Ready
                  </SecondaryButton>
                  <IconButton
                    title="Suspend POS access"
                    onClick={() =>
                      runAction(
                        () => posVendorOnboardingService.suspendPosAccess(row),
                        "POS access suspended.",
                      )
                    }
                  >
                    <ShieldOff size={13} />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="text-xs">
              <td className="px-6 py-8 text-stone-500 font-bold" colSpan={11}>
                No onboarding records yet. Use the form above to issue the first
                Vendor Setup Code.
              </td>
            </tr>
          )}
        </TablePanel>

        <aside className="space-y-5">
          <div className="border-2 border-stone-200 bg-white p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">
              WhatsApp Message
            </h3>
            <pre className="mt-3 max-h-80 overflow-auto border border-stone-200 bg-stone-50 p-3 text-[10px] whitespace-pre-wrap">
              {currentMessage}
            </pre>
            <div className="mt-4 flex gap-2">
              <SecondaryButton
                type="button"
                size="sm"
                onClick={() => copyMessage(currentMessage)}
              >
                Copy Message
              </SecondaryButton>
              <SecondaryButton
                type="button"
                size="sm"
                onClick={() =>
                  openWhatsApp(
                    selectedRow?.rpnPhone || form.whatsapp,
                    currentMessage,
                  )
                }
              >
                Open WhatsApp Link
              </SecondaryButton>
            </div>
          </div>

          <div className="border-2 border-stone-200 bg-white p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">
              Support Visibility Checklist
            </h3>
            <div className="mt-4 space-y-2">
              {readinessItems.map((item) => {
                const status = readinessStatus(selectedRow, item.lifecycle, governanceData);
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between border border-stone-200 bg-stone-50 px-3 py-2"
                  >
                    <span className="text-[10px] font-black uppercase">
                      {item.label}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase ${
                        status === "Ready"
                          ? "text-emerald-700"
                          : status === "Expired" || status === "Cancelled"
                            ? "text-red-600"
                            : status === "Missing"
                              ? "text-amber-600"
                              : "text-stone-400"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <TablePanel
        title="Onboarding Audit"
        subtitle="Backend Office support-side onboarding events"
        headers={["Timestamp", "Action", "Vendor ID", "Code", "Actor"]}
      >
        {audit
          .slice()
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime(),
          )
          .slice(0, 50)
          .map((entry) => (
            <tr key={entry.id} className="text-xs hover:bg-stone-50">
              <td className="px-6 py-4 font-mono">{entry.timestamp}</td>
              <td className="px-6 py-4 font-black uppercase">{entry.action}</td>
              <td className="px-6 py-4 font-mono">{entry.vendorId}</td>
              <td className="px-6 py-4 font-mono">{entry.code || "-"}</td>
              <td className="px-6 py-4">{entry.actor}</td>
            </tr>
          ))}
        {audit.length === 0 && (
          <tr className="text-xs">
            <td className="px-6 py-8 text-stone-500 font-bold" colSpan={5}>
              No onboarding audit events yet.
            </td>
          </tr>
        )}
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

const FormBlock: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section>
    <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-brand-charcoal">
      {title}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{children}</div>
  </section>
);

const TextField: React.FC<{
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}> = ({ label, value, required, onChange }) => (
  <FormField label={label} required={required}>
    <input
      className={inputClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
    />
  </FormField>
);

const IconButton: React.FC<{
  title: string;
  children: React.ReactNode;
  onClick: () => void;
}> = ({ title, children, onClick }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className="h-8 w-8 border border-stone-200 bg-white flex items-center justify-center text-brand-charcoal hover:border-brand-orange hover:text-brand-orange"
  >
    {children}
  </button>
);

export default POSVendorOnboarding;
