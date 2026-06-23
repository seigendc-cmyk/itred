import React, { useEffect, useMemo, useState } from "react";
import {
  BrandedAlertModal,
  FormField,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TablePanel,
} from "../components/CommonUI.tsx";
import { posGovernanceService } from "../services/posGovernanceService.ts";
import { permissionService } from "../services/permissionService.ts";
import { vendorService } from "../services/vendorService.ts";
import { Vendor } from "../types.ts";
import {
  POS_PERMISSION_KEYS,
  PosBranch,
  PosGovernanceData,
  PosPlan,
  PosRole,
  PosStaffAccess,
  PosTerminal,
  PosWarehouse,
} from "../types/posGovernance.ts";

type TabKey =
  | "activation"
  | "entitlements"
  | "tenantVisibility"
  | "diagnostics"
  | "analytics"
  | "logs";

const tabs: Array<{ id: TabKey; label: string; supportOnly?: boolean }> = [
  { id: "activation", label: "Platform Activation" },
  { id: "entitlements", label: "POS Plans & Entitlements" },
  { id: "tenantVisibility", label: "Tenant Setup Visibility" },
  { id: "diagnostics", label: "Support Diagnostics", supportOnly: true },
  { id: "analytics", label: "Vendor Analytics" },
  { id: "logs", label: "Audit Logs" },
];

const inputClass =
  "w-full bg-stone-50 border-0 border-b-2 border-stone-300 focus:border-brand-orange focus:ring-0 outline-none rounded-none px-4 py-3 text-sm font-bold text-brand-charcoal";

const statusBadge = (status?: string) => (
  <span className="px-2 py-1 text-[9px] font-black uppercase bg-stone-100 text-stone-600">
    {status || "not_activated"}
  </span>
);

const vendorName = (vendors: Vendor[], vendorId: string) => {
  const vendor = vendors.find((item) => item.id === vendorId);
  return vendor?.tradingName || vendor?.name || vendorId || "Private tenant";
};

const latestDate = (...values: Array<string | null | undefined>) =>
  values
    .filter(Boolean)
    .sort(
      (a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime(),
    )[0] || "-";

const tenantReadinessScore = (
  branches: number,
  warehouses: number,
  terminals: number,
  staffAccess: number,
  roles: number,
) => {
  const checks = [branches > 0, warehouses > 0, terminals > 0, staffAccess > 0, roles > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const generateTemporaryAccessCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

export const POSGovernance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("activation");
  const currentStaff = permissionService.getCurrentStaff();
  const canViewDiagnostics =
    permissionService.isSysAdmin() ||
    String(currentStaff?.desk || "").toLowerCase().includes("support");
  const visibleTabs = tabs.filter((tab) => !tab.supportOnly || canViewDiagnostics);

  useEffect(() => {
    if (activeTab === "diagnostics" && !canViewDiagnostics) {
      setActiveTab("activation");
    }
  }, [activeTab, canViewDiagnostics]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [data, setData] = useState<PosGovernanceData>({
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
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [activation, setActivation] = useState({
    vendorId: "",
    planId: "",
    status: "trial" as "trial" | "active",
    paymentReference: "",
    expiresAt: "",
  });
  const [branch, setBranch] = useState<Partial<PosBranch>>({});
  const [warehouse, setWarehouse] = useState<Partial<PosWarehouse>>({});
  const [terminal, setTerminal] = useState<Partial<PosTerminal>>({});
  const [role, setRole] = useState<Partial<PosRole>>({ permissions: [] });
  const [access, setAccess] = useState<Partial<PosStaffAccess>>({
    branchIds: [],
    terminalIds: [],
    accessStatus: "active",
    status: "active",
    temporaryAccessCode: generateTemporaryAccessCode(),
    mustChangePin: true,
    pinMode: "temporary_plaintext_prototype",
    source: "backend_office_staff_setup",
  });
  const [snapshotVendorId, setSnapshotVendorId] = useState("");
  const [alert, setAlert] = useState({
    isOpen: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const activePlans = useMemo(
    () => data.plans.filter((plan) => plan.status === "active"),
    [data.plans],
  );

  const tenantRows = useMemo(
    () =>
      vendors.map((vendor) => {
        const vendorId = vendor.id;
        const subscription = data.subscriptions.find((item) => item.vendorId === vendorId);
        const branches = data.branches.filter((item) => item.vendorId === vendorId);
        const warehouses = data.warehouses.filter((item) => item.vendorId === vendorId);
        const terminals = data.terminals.filter((item) => item.vendorId === vendorId);
        const staffAccess = data.staffAccess.filter((item) => item.vendorId === vendorId);
        const roles = data.roles.filter((item) => item.vendorId === vendorId);
        const snapshots = data.entitlementSnapshots.filter((item) => item.vendorId === vendorId);

        return {
          vendor,
          subscription,
          branches,
          warehouses,
          terminals,
          staffAccess,
          roles,
          snapshots,
          readiness: tenantReadinessScore(
            branches.length,
            warehouses.length,
            terminals.length,
            staffAccess.length,
            roles.length,
          ),
          lastCheck: latestDate(
            subscription?.updatedAt,
            branches[0]?.updatedAt,
            warehouses[0]?.updatedAt,
            terminals[0]?.updatedAt,
            staffAccess[0]?.updatedAt,
            roles[0]?.updatedAt,
            snapshots[0]?.updatedAt,
          ),
        };
      }),
    [vendors, data],
  );

  const branchesForAccess = useMemo(
    () =>
      data.branches.filter((item) => !access.vendorId || item.vendorId === access.vendorId),
    [data.branches, access.vendorId],
  );

  const terminalsForAccess = useMemo(
    () =>
      data.terminals.filter(
        (item) =>
          (!access.vendorId || item.vendorId === access.vendorId) &&
          (!access.branchId || item.branchId === access.branchId),
      ),
    [data.terminals, access.vendorId, access.branchId],
  );

  const rolesForAccess = useMemo(
    () => data.roles.filter((item) => !access.vendorId || item.vendorId === access.vendorId),
    [data.roles, access.vendorId],
  );

  const showAlert = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "success",
  ) => setAlert({ isOpen: true, message, type });

  const load = async () => {
    setLoading(true);
    try {
      const [remoteData, remoteVendors] = await Promise.all([
        posGovernanceService.getData(),
        vendorService.getVendors(),
      ]);
      setData(remoteData);
      setVendors(remoteVendors);
    } catch (error: any) {
      showAlert(error.message || "POS platform data could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (action: () => Promise<void>, success: string) => {
    setWorking(true);
    try {
      await action();
      await load();
      showAlert(success);
    } catch (error: any) {
      showAlert(error.message || "POS platform action failed.", "error");
    } finally {
      setWorking(false);
    }
  };

  const activateVendor = () =>
    run(async () => {
      if (!activation.vendorId || !activation.planId) {
        throw new Error("Select a private tenant and active POS plan.");
      }
      await posGovernanceService.activateVendor({
        vendorId: activation.vendorId,
        planId: activation.planId,
        subscriptionStatus: activation.status,
        paymentReference: activation.paymentReference,
        expiresAt: activation.expiresAt,
        activationSource: "console",
      });
    }, "Platform activation saved.");

  const saveBranch = () =>
    run(async () => {
      if (!branch.vendorId) throw new Error("Private tenant is required.");
      await posGovernanceService.saveBranch(branch);
      setBranch({});
    }, "Branch visibility record saved.");

  const saveWarehouse = () =>
    run(async () => {
      if (!warehouse.vendorId) throw new Error("Private tenant is required.");
      await posGovernanceService.saveWarehouse(warehouse);
      setWarehouse({});
    }, "Warehouse visibility record saved.");

  const saveTerminal = () =>
    run(async () => {
      if (!terminal.vendorId || !terminal.branchId) {
        throw new Error("Private tenant and branch record are required.");
      }
      await posGovernanceService.saveTerminal(terminal);
      setTerminal({});
    }, "Terminal visibility record saved.");

  const saveRole = () =>
    run(async () => {
      if (!role.vendorId || !role.roleName) {
        throw new Error("Private tenant and role name are required.");
      }
      await posGovernanceService.saveRole(role);
      setRole({ permissions: [] });
    }, "POS role visibility record saved.");

  const saveAccess = () =>
    run(async () => {
      if (!access.vendorId || !access.displayName || !access.branchId || !access.terminalId) {
        throw new Error("Private tenant, display name, branch and terminal are required.");
      }
      await posGovernanceService.saveStaffAccess(access);
      setAccess({
        branchIds: [],
        terminalIds: [],
        accessStatus: "active",
        status: "active",
        temporaryAccessCode: generateTemporaryAccessCode(),
        mustChangePin: true,
        pinMode: "temporary_plaintext_prototype",
        source: "backend_office_staff_setup",
      });
    }, "Tenant staff access saved.");

  const updateAccessStatus = (row: PosStaffAccess, status: PosStaffAccess["status"]) =>
    run(async () => {
      await posGovernanceService.saveStaffAccess({
        ...row,
        status,
        accessStatus: status === "active" ? "active" : "disabled",
      });
    }, status === "active" ? "Staff access enabled." : "Staff access disabled.");

  const resetAccessCode = (row: PosStaffAccess) =>
    run(async () => {
      await posGovernanceService.saveStaffAccess({
        ...row,
        temporaryAccessCode: generateTemporaryAccessCode(),
        accessCodeLastResetAt: new Date().toISOString(),
        accessStatus: "pending_pin_reset",
        mustChangePin: true,
      });
    }, "Temporary PIN/access code reset.");

  const editAccess = (row: PosStaffAccess) =>
    setAccess({
      ...row,
      branchId: row.branchId || row.branchIds?.[0] || "",
      terminalId: row.terminalId || row.terminalIds?.[0] || "",
      accessStatus: row.accessStatus || "pending_pin_reset",
      temporaryAccessCode: row.temporaryAccessCode || generateTemporaryAccessCode(),
      mustChangePin: row.mustChangePin ?? true,
    });

  const copyLoginDetails = async (row: PosStaffAccess) => {
    const terminalRecord = data.terminals.find(
      (item) => item.id === (row.terminalId || row.terminalIds?.[0]),
    );
    const branchRecord = data.branches.find(
      (item) => item.id === (row.branchId || row.branchIds?.[0]),
    );
    const message = [
      "iTred POS Staff Access",
      "",
      "Tenant:",
      vendorName(vendors, row.vendorId),
      "",
      "Branch:",
      row.branchName || branchRecord?.branchName || "-",
      "",
      "Terminal:",
      `${row.terminalName || terminalRecord?.terminalName || "-"} / ${terminalRecord?.deskName || row.terminalName || "-"}`,
      "",
      "Staff:",
      row.displayName,
      "",
      "Temporary Access Code:",
      row.temporaryAccessCode || row.accessCode || "-",
      "",
      "Instructions:",
      "1. Open iTred POS",
      "2. Sign in with Google",
      "3. Enter Vendor Setup Code if required",
      "4. Select branch, terminal and staff",
      "5. Enter temporary access code",
      "",
      "Generated by:",
      "Digital Commerce / seiGEN Commerce OS",
    ].join("\n");
    await navigator.clipboard.writeText(message);
    showAlert("POS staff login details copied.");
  };

  const subscriptionByVendor = (vendorId: string) =>
    data.subscriptions.find((item) => item.vendorId === vendorId);

  if (loading) {
    return (
      <div className="p-8 text-xs font-black uppercase tracking-widest text-stone-400">
        Loading POS platform governance...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="POS Governance" />

      <div className="border-l-4 border-brand-orange bg-stone-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
          Platform governance console
        </p>
        <p className="mt-1 text-xs font-bold text-brand-charcoal">
          iTred Console handles POS activation, licensing, entitlement visibility,
          support diagnostics and platform analytics. Each vendor remains a
          private tenant; operational work stays in the vendor POS app.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 border-2 text-[10px] font-black uppercase tracking-widest ${
              activeTab === tab.id
                ? "border-brand-charcoal bg-brand-charcoal text-white"
                : "border-stone-200 bg-white text-stone-500"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "activation" && (
        <div className="space-y-5">
          <div className="border-2 border-stone-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">
                Platform activation
              </h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Controls POS access only. It does not operate the vendor business.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <VendorSelect
                label="Private Tenant"
                value={activation.vendorId}
                vendors={vendors}
                onChange={(vendorId) =>
                  setActivation((current) => ({ ...current, vendorId }))
                }
              />
              <FormField label="POS Plan" required>
                <select
                  className={inputClass}
                  value={activation.planId}
                  onChange={(e) =>
                    setActivation((current) => ({
                      ...current,
                      planId: e.target.value,
                    }))
                  }
                >
                  <option value="">Select active plan...</option>
                  {activePlans.map((plan: PosPlan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.planName}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Access Status">
                <select
                  className={inputClass}
                  value={activation.status}
                  onChange={(e) =>
                    setActivation((current) => ({
                      ...current,
                      status: e.target.value as "trial" | "active",
                    }))
                  }
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active Paid</option>
                </select>
              </FormField>
              <FormField label="Payment / Invoice Reference">
                <input
                  className={inputClass}
                  value={activation.paymentReference}
                  onChange={(e) =>
                    setActivation((current) => ({
                      ...current,
                      paymentReference: e.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label="Platform Access Expires">
                <input
                  className={inputClass}
                  type="date"
                  value={activation.expiresAt}
                  onChange={(e) =>
                    setActivation((current) => ({
                      ...current,
                      expiresAt: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-3">
              <PrimaryButton onClick={activateVendor} isLoading={working}>
                {activation.status === "trial" ? "Activate Trial" : "Activate Paid Plan"}
              </PrimaryButton>
            </div>
          </div>

          <TablePanel
            title="Private Tenant POS Access"
            subtitle="Platform access, subscription and entitlement visibility"
            headers={[
              "Private Tenant",
              "POS Plan",
              "Access Status",
              "Activated",
              "Expiry / Trial",
              "Payment Ref",
              "Source",
              "Support Actions",
            ]}
          >
            {vendors.map((vendor) => {
              const subscription = subscriptionByVendor(vendor.id);
              return (
                <tr key={vendor.id} className="text-xs hover:bg-stone-50">
                  <td className="px-6 py-4 font-black uppercase">
                    {vendor.tradingName || vendor.name}
                  </td>
                  <td className="px-6 py-4">{subscription?.planName || "None"}</td>
                  <td className="px-6 py-4">
                    {statusBadge(subscription?.subscriptionStatus)}
                  </td>
                  <td className="px-6 py-4">{subscription?.activatedAt || "-"}</td>
                  <td className="px-6 py-4">
                    {subscription?.expiresAt || subscription?.trialEndsAt || "-"}
                  </td>
                  <td className="px-6 py-4">{subscription?.paymentReference || "-"}</td>
                  <td className="px-6 py-4">{subscription?.activationSource || "-"}</td>
                  <td className="px-6 py-4">
                    {subscription ? (
                      <div className="flex gap-2">
                        <SecondaryButton
                          size="sm"
                          onClick={() =>
                            run(
                              () =>
                                posGovernanceService.updateSubscriptionStatus(
                                  subscription,
                                  "active",
                                ),
                              "Platform access renewed/reactivated.",
                            )
                          }
                        >
                          Renew Access
                        </SecondaryButton>
                        <SecondaryButton
                          size="sm"
                          onClick={() =>
                            run(
                              () =>
                                posGovernanceService.updateSubscriptionStatus(
                                  subscription,
                                  "suspended",
                                ),
                              "Platform access suspended.",
                            )
                          }
                        >
                          Suspend Access
                        </SecondaryButton>
                        <SecondaryButton
                          size="sm"
                          onClick={() => setSnapshotVendorId(vendor.id)}
                        >
                          Snapshot
                        </SecondaryButton>
                      </div>
                    ) : (
                      <span className="text-stone-400">Not activated</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </TablePanel>

          {snapshotVendorId && (
            <SnapshotPanel
              snapshots={data.entitlementSnapshots.filter(
                (item) => item.vendorId === snapshotVendorId,
              )}
              onClose={() => setSnapshotVendorId("")}
            />
          )}
        </div>
      )}

      {activeTab === "entitlements" && (
        <div className="space-y-5">
          <TablePanel
            title="POS Plans & Entitlements"
            subtitle="Plan availability and platform entitlement templates"
            headers={["Plan", "Price", "Limits", "Enabled Entitlements", "Status"]}
          >
            {data.plans.map((plan) => (
              <tr key={plan.id} className="text-xs hover:bg-stone-50">
                <td className="px-6 py-4">
                  <p className="font-black uppercase">{plan.planName}</p>
                  <p className="font-mono text-[10px] text-stone-400">{plan.planId}</p>
                </td>
                <td className="px-6 py-4 font-mono">
                  USD {Number(plan.monthlyPrice || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase">
                  {plan.maxBranches} branches / {plan.maxTerminals} terminals /{" "}
                  {plan.maxStaff} staff / {plan.maxProducts} products
                </td>
                <td className="px-6 py-4 text-[10px] font-bold uppercase text-stone-500">
                  {[
                    plan.allowOfflineMode && "offline",
                    plan.allowCreditSales && "credit",
                    plan.allowLaybye && "laybye",
                    plan.allowReturns && "returns",
                    plan.allowFinanceManager && "finance",
                    plan.allowBI && "bi",
                    plan.allowMarketplacePublish && "marketplace",
                  ]
                    .filter(Boolean)
                    .join(", ") || "base access"}
                </td>
                <td className="px-6 py-4">{statusBadge(plan.status)}</td>
              </tr>
            ))}
          </TablePanel>

          <TablePanel
            title="Latest Entitlement Snapshots"
            subtitle="Support-side snapshot visibility for private tenants"
            headers={["Private Tenant", "Plan", "Access Status", "Generated", "Limits"]}
          >
            {data.entitlementSnapshots
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.generatedAt).getTime() -
                  new Date(a.generatedAt).getTime(),
              )
              .slice(0, 25)
              .map((snapshot) => (
                <tr key={snapshot.id} className="text-xs hover:bg-stone-50">
                  <td className="px-6 py-4">{vendorName(vendors, snapshot.vendorId)}</td>
                  <td className="px-6 py-4 font-bold">{snapshot.planName}</td>
                  <td className="px-6 py-4">{statusBadge(snapshot.subscriptionStatus)}</td>
                  <td className="px-6 py-4 font-mono">{snapshot.generatedAt}</td>
                  <td className="px-6 py-4 text-[10px] font-bold uppercase">
                    {snapshot.limits.maxBranches} branches /{" "}
                    {snapshot.limits.maxTerminals} terminals /{" "}
                    {snapshot.limits.maxStaff} staff
                  </td>
                </tr>
              ))}
          </TablePanel>
        </div>
      )}

      {activeTab === "tenantVisibility" && (
        <div className="space-y-5">
          <TablePanel
            title="Tenant Setup Visibility"
            subtitle="Support visibility for tenant-owned operational records"
            headers={[
              "Private Tenant",
              "Branch Records Visible",
              "Warehouse Records Visible",
              "Terminal Records Visible",
              "Staff Access Records Visible",
              "POS Role Records Visible",
              "Readiness",
            ]}
          >
            {tenantRows.map((row) => (
              <tr key={row.vendor.id} className="text-xs hover:bg-stone-50">
                <td className="px-6 py-4 font-black uppercase">
                  {row.vendor.tradingName || row.vendor.name}
                </td>
                <td className="px-6 py-4">{row.branches.length}</td>
                <td className="px-6 py-4">{row.warehouses.length}</td>
                <td className="px-6 py-4">{row.terminals.length}</td>
                <td className="px-6 py-4">{row.staffAccess.length}</td>
                <td className="px-6 py-4">{row.roles.length}</td>
                <td className="px-6 py-4 font-black text-brand-orange">
                  {row.readiness}%
                </td>
              </tr>
            ))}
          </TablePanel>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <VisibilityPanel title="Branch records visible">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VendorSelect
                  label="Private Tenant"
                  value={branch.vendorId}
                  vendors={vendors}
                  onChange={(vendorId) => setBranch((c) => ({ ...c, vendorId }))}
                />
                <TextField
                  label="Branch Record Name"
                  value={branch.branchName}
                  onChange={(branchName) => setBranch((c) => ({ ...c, branchName }))}
                />
                <TextField
                  label="Branch Record Code"
                  value={branch.branchCode}
                  onChange={(branchCode) => setBranch((c) => ({ ...c, branchCode }))}
                />
                <FormField label="Record Type">
                  <select
                    className={inputClass}
                    value={branch.branchType || "shop"}
                    onChange={(e) =>
                      setBranch((c) => ({ ...c, branchType: e.target.value as any }))
                    }
                  >
                    <option value="shop">Shop</option>
                    <option value="warehouse">Warehouse</option>
                    <option value="agent">Agent</option>
                  </select>
                </FormField>
                <TextField
                  label="District"
                  value={branch.district}
                  onChange={(district) => setBranch((c) => ({ ...c, district }))}
                />
                <TextField
                  label="Suburb"
                  value={branch.suburb}
                  onChange={(suburb) => setBranch((c) => ({ ...c, suburb }))}
                />
                <div className="md:col-span-2 flex justify-end">
                  <PrimaryButton onClick={saveBranch} isLoading={working}>
                    Save Visibility Record
                  </PrimaryButton>
                </div>
              </div>
            </VisibilityPanel>

            <VisibilityPanel title="Warehouse records visible">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VendorSelect
                  label="Private Tenant"
                  value={warehouse.vendorId}
                  vendors={vendors}
                  onChange={(vendorId) =>
                    setWarehouse((c) => ({ ...c, vendorId }))
                  }
                />
                <TextField
                  label="Warehouse Record Name"
                  value={warehouse.warehouseName}
                  onChange={(warehouseName) =>
                    setWarehouse((c) => ({ ...c, warehouseName }))
                  }
                />
                <TextField
                  label="Warehouse Record Code"
                  value={warehouse.warehouseCode}
                  onChange={(warehouseCode) =>
                    setWarehouse((c) => ({ ...c, warehouseCode }))
                  }
                />
                <label className="flex items-center gap-3 border-2 border-stone-100 bg-stone-50 p-3">
                  <input
                    type="checkbox"
                    className="accent-brand-orange"
                    checked={!!warehouse.isDefault}
                    onChange={(e) =>
                      setWarehouse((c) => ({ ...c, isDefault: e.target.checked }))
                    }
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Default visible
                  </span>
                </label>
                <TextField
                  label="District"
                  value={warehouse.district}
                  onChange={(district) =>
                    setWarehouse((c) => ({ ...c, district }))
                  }
                />
                <TextField
                  label="Suburb"
                  value={warehouse.suburb}
                  onChange={(suburb) => setWarehouse((c) => ({ ...c, suburb }))}
                />
                <div className="md:col-span-2 flex justify-end">
                  <PrimaryButton onClick={saveWarehouse} isLoading={working}>
                    Save Visibility Record
                  </PrimaryButton>
                </div>
              </div>
            </VisibilityPanel>

            <VisibilityPanel title="Terminal records visible">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VendorSelect
                  label="Private Tenant"
                  value={terminal.vendorId}
                  vendors={vendors}
                  onChange={(vendorId) => setTerminal((c) => ({ ...c, vendorId }))}
                />
                <FormField label="Visible Branch Record">
                  <select
                    className={inputClass}
                    value={terminal.branchId || ""}
                    onChange={(e) =>
                      setTerminal((c) => ({ ...c, branchId: e.target.value }))
                    }
                  >
                    <option value="">Select branch...</option>
                    {data.branches
                      .filter((b) => !terminal.vendorId || b.vendorId === terminal.vendorId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branchName}
                        </option>
                      ))}
                  </select>
                </FormField>
                <TextField
                  label="Terminal Record Name"
                  value={terminal.terminalName}
                  onChange={(terminalName) =>
                    setTerminal((c) => ({ ...c, terminalName }))
                  }
                />
                <TextField
                  label="Terminal Record Code"
                  value={terminal.terminalCode}
                  onChange={(terminalCode) =>
                    setTerminal((c) => ({ ...c, terminalCode }))
                  }
                />
                <TextField
                  label="Access Code Visibility"
                  value={terminal.terminalAccessCode || ""}
                  onChange={(terminalAccessCode) =>
                    setTerminal((c) => ({ ...c, terminalAccessCode }))
                  }
                />
                <FormField label="Device Binding Visibility">
                  <select
                    className={inputClass}
                    value={terminal.deviceBindingStatus || "unbound"}
                    onChange={(e) =>
                      setTerminal((c) => ({
                        ...c,
                        deviceBindingStatus: e.target.value as any,
                      }))
                    }
                  >
                    <option value="unbound">Unbound</option>
                    <option value="pending">Pending</option>
                    <option value="bound">Bound</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </FormField>
                <div className="md:col-span-2 flex justify-end">
                  <PrimaryButton onClick={saveTerminal} isLoading={working}>
                    Save Visibility Record
                  </PrimaryButton>
                </div>
              </div>
            </VisibilityPanel>

            <VisibilityPanel title="Tenant Staff Access" subtitle="Backend Office setup for approved private tenant POS access">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VendorSelect
                  label="Private Tenant"
                  value={access.vendorId}
                  vendors={vendors}
                  onChange={(vendorId) =>
                    setAccess((c) => ({
                      ...c,
                      vendorId,
                      branchIds: [],
                      terminalIds: [],
                      branchId: "",
                      terminalId: "",
                      roleId: "",
                    }))
                  }
                />
                <TextField
                  label="Display Name"
                  value={access.displayName}
                  onChange={(displayName) =>
                    setAccess((c) => ({ ...c, displayName }))
                  }
                />
                <TextField
                  label="Email"
                  value={access.email}
                  onChange={(email) => setAccess((c) => ({ ...c, email }))}
                />
                <TextField
                  label="Phone"
                  value={access.phone}
                  onChange={(phone) => setAccess((c) => ({ ...c, phone }))}
                />
                <FormField label="Branch" required>
                  <select
                    className={inputClass}
                    value={access.branchId || ""}
                    onChange={(e) =>
                      setAccess((c) => ({
                        ...c,
                        branchId: e.target.value,
                        branchIds: e.target.value ? [e.target.value] : [],
                        terminalId: "",
                        terminalIds: [],
                      }))
                    }
                  >
                    <option value="">Select branch...</option>
                    {branchesForAccess.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.branchName}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Terminal" required>
                  <select
                    className={inputClass}
                    value={access.terminalId || ""}
                    onChange={(e) =>
                      setAccess((c) => ({
                        ...c,
                        terminalId: e.target.value,
                        terminalIds: e.target.value ? [e.target.value] : [],
                      }))
                    }
                  >
                    <option value="">Select terminal...</option>
                    {terminalsForAccess.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.terminalName}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Role">
                  <select
                    className={inputClass}
                    value={access.roleId || ""}
                    onChange={(e) =>
                      setAccess((c) => ({ ...c, roleId: e.target.value }))
                    }
                  >
                    <option value="">Default to SysAdmin...</option>
                    {rolesForAccess.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.roleName}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Temporary Access Code / PIN" required>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={access.temporaryAccessCode || ""}
                      onChange={(e) =>
                        setAccess((c) => ({
                          ...c,
                          temporaryAccessCode: e.target.value,
                        }))
                      }
                    />
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        setAccess((c) => ({
                          ...c,
                          temporaryAccessCode: generateTemporaryAccessCode(),
                          mustChangePin: true,
                        }))
                      }
                    >
                      Generate
                    </SecondaryButton>
                  </div>
                </FormField>
                <FormField label="Access Status">
                  <select
                    className={inputClass}
                    value={access.accessStatus || "pending_pin_reset"}
                    onChange={(e) =>
                      setAccess((c) => ({ ...c, accessStatus: e.target.value }))
                    }
                  >
                    <option value="pending_pin_reset">Pending PIN Reset</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </FormField>
                <FormField label="Record Status">
                  <select
                    className={inputClass}
                    value={access.status || "active"}
                    onChange={(e) =>
                      setAccess((c) => ({ ...c, status: e.target.value as any }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </FormField>
                <TextField
                  label="Notes"
                  value={access.notes}
                  onChange={(notes) => setAccess((c) => ({ ...c, notes }))}
                />
                <div className="md:col-span-2 border-l-4 border-brand-orange bg-stone-50 p-3 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                  Access code is used for current tenant provisioning. Review access status before sharing login details.
                </div>
                <div className="md:col-span-2 flex justify-end gap-3">
                  <PrimaryButton onClick={saveAccess} isLoading={working}>
                    {access.id ? "Update Staff Access" : "Create Staff Access"}
                  </PrimaryButton>
                </div>
              </div>
            </VisibilityPanel>

            <VisibilityPanel title="POS role records visible">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <VendorSelect
                    label="Private Tenant"
                    value={role.vendorId}
                    vendors={vendors}
                    onChange={(vendorId) => setRole((c) => ({ ...c, vendorId }))}
                  />
                  <TextField
                    label="Role Record Name"
                    value={role.roleName}
                    onChange={(roleName) => setRole((c) => ({ ...c, roleName }))}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {POS_PERMISSION_KEYS.map((permission) => (
                    <label
                      key={permission}
                      className="border border-stone-200 bg-stone-50 p-2 flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        className="accent-brand-orange"
                        checked={(role.permissions || []).includes(permission)}
                        onChange={(e) =>
                          setRole((c) => ({
                            ...c,
                            permissions: e.target.checked
                              ? [...(c.permissions || []), permission]
                              : (c.permissions || []).filter(
                                  (item) => item !== permission,
                                ),
                          }))
                        }
                      />
                      <span className="text-[9px] font-black uppercase">
                        {permission}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <PrimaryButton onClick={saveRole} isLoading={working}>
                    Save Visibility Record
                  </PrimaryButton>
                </div>
              </div>
            </VisibilityPanel>
          </div>

          <VisibilityTables
            vendors={vendors}
            data={data}
            updateAccessStatus={updateAccessStatus}
            resetAccessCode={resetAccessCode}
            editAccess={editAccess}
            copyLoginDetails={copyLoginDetails}
          />
        </div>
      )}

      {activeTab === "diagnostics" && canViewDiagnostics && (
        <TablePanel
          title="Support Diagnostics"
          subtitle="Support-side platform health and tenant setup signals"
          headers={[
            "Vendor ID",
            "Private Tenant",
            "Subscription Status",
            "Expiry",
            "Entitlement Snapshot",
            "Branches",
            "Terminals",
            "Staff Access",
            "Roles",
            "Last Sync / Check",
          ]}
        >
          {tenantRows.map((row) => {
            const latestSnapshot = row.snapshots
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.generatedAt).getTime() -
                  new Date(a.generatedAt).getTime(),
              )[0];
            return (
              <tr key={row.vendor.id} className="text-xs hover:bg-stone-50">
                <td className="px-6 py-4 font-mono">{row.vendor.id}</td>
                <td className="px-6 py-4 font-black uppercase">
                  {row.vendor.tradingName || row.vendor.name}
                </td>
                <td className="px-6 py-4">
                  {statusBadge(row.subscription?.subscriptionStatus)}
                </td>
                <td className="px-6 py-4">
                  {row.subscription?.expiresAt ||
                    row.subscription?.trialEndsAt ||
                    "-"}
                </td>
                <td className="px-6 py-4 font-mono">
                  {latestSnapshot?.generatedAt || "-"}
                </td>
                <td className="px-6 py-4">{row.branches.length}</td>
                <td className="px-6 py-4">{row.terminals.length}</td>
                <td className="px-6 py-4">{row.staffAccess.length}</td>
                <td className="px-6 py-4">{row.roles.length}</td>
                <td className="px-6 py-4 font-mono">{row.lastCheck}</td>
              </tr>
            );
          })}
        </TablePanel>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <MetricCard
              label="POS Access Status"
              value={`${data.subscriptions.filter((item) => item.subscriptionStatus === "active" || item.subscriptionStatus === "trial").length}/${vendors.length}`}
            />
            <MetricCard
              label="Avg Tenant Readiness Score"
              value={`${Math.round(
                tenantRows.reduce((sum, row) => sum + row.readiness, 0) /
                  Math.max(tenantRows.length, 1),
              )}%`}
            />
            <MetricCard
              label="Active Terminals"
              value={data.terminals.filter((item) => item.status === "active").length}
            />
            <MetricCard label="Staff Access Count" value={data.staffAccess.length} />
            <MetricCard
              label="Support Risk Flags"
              value={
                tenantRows.filter(
                  (row) =>
                    row.subscription?.subscriptionStatus === "expired" ||
                    row.subscription?.subscriptionStatus === "suspended" ||
                    row.readiness < 60,
                ).length
              }
            />
          </div>

          <TablePanel
            title="Vendor Analytics"
            subtitle="Platform access and tenant readiness only. Transaction analytics are not shown here."
            headers={[
              "Private Tenant",
              "POS Access Status",
              "Tenant Readiness Score",
              "Active Terminals",
              "Staff Access Count",
              "Support Risk Flags",
            ]}
          >
            {tenantRows.map((row) => {
              const flags = [
                !row.subscription && "not activated",
                row.subscription?.subscriptionStatus === "suspended" &&
                  "platform suspended",
                row.subscription?.subscriptionStatus === "expired" &&
                  "platform expired",
                row.readiness < 60 && "setup incomplete",
              ].filter(Boolean);

              return (
                <tr key={row.vendor.id} className="text-xs hover:bg-stone-50">
                  <td className="px-6 py-4 font-black uppercase">
                    {row.vendor.tradingName || row.vendor.name}
                  </td>
                  <td className="px-6 py-4">
                    {statusBadge(row.subscription?.subscriptionStatus)}
                  </td>
                  <td className="px-6 py-4 font-black text-brand-orange">
                    {row.readiness}%
                  </td>
                  <td className="px-6 py-4">
                    {row.terminals.filter((item) => item.status === "active").length}
                  </td>
                  <td className="px-6 py-4">{row.staffAccess.length}</td>
                  <td className="px-6 py-4 text-[10px] font-bold uppercase text-stone-500">
                    {flags.join(", ") || "none"}
                  </td>
                </tr>
              );
            })}
          </TablePanel>
        </div>
      )}

      {activeTab === "logs" && (
        <TablePanel
          title="Audit Logs"
          subtitle="Activation, renewal, suspension, entitlement snapshots and support-side changes"
          headers={["Timestamp", "Action", "Private Tenant", "Actor", "Before", "After"]}
        >
          {[...data.activationLogs]
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime(),
            )
            .map((row) => (
              <tr key={row.id} className="text-xs hover:bg-stone-50 align-top">
                <td className="px-6 py-4 font-mono">{row.timestamp}</td>
                <td className="px-6 py-4 font-black uppercase">{row.action}</td>
                <td className="px-6 py-4">{vendorName(vendors, row.vendorId)}</td>
                <td className="px-6 py-4">{row.actor}</td>
                <td className="px-6 py-4 max-w-xs truncate">
                  {row.before ? JSON.stringify(row.before) : "-"}
                </td>
                <td className="px-6 py-4 max-w-xs truncate">
                  {row.after ? JSON.stringify(row.after) : "-"}
                </td>
              </tr>
            ))}
        </TablePanel>
      )}

      <BrandedAlertModal
        isOpen={alert.isOpen}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert((current) => ({ ...current, isOpen: false }))}
      />
    </div>
  );
};

const VendorSelect: React.FC<{
  label?: string;
  value?: string;
  vendors: Vendor[];
  onChange: (value: string) => void;
}> = ({ label = "Private Tenant", value, vendors, onChange }) => (
  <FormField label={label} required>
    <select
      className={inputClass}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select private tenant...</option>
      {vendors.map((vendor) => (
        <option key={vendor.id} value={vendor.id}>
          {vendor.tradingName || vendor.name}
        </option>
      ))}
    </select>
  </FormField>
);

const TextField: React.FC<{
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <FormField label={label}>
    <input
      className={inputClass}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </FormField>
);

const VisibilityPanel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle = "Support visibility for tenant-owned records",
  children,
}) => (
  <section className="border-2 border-stone-200 bg-white p-5">
    <h3 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">
      {title}
    </h3>
    <p className="mb-4 mt-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">
      {subtitle}
    </p>
    {children}
  </section>
);

const MetricCard: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="border-2 border-stone-200 bg-white p-4">
    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">
      {label}
    </p>
    <p className="mt-2 text-2xl font-black text-brand-charcoal">{value}</p>
  </div>
);

const SnapshotPanel: React.FC<{
  snapshots: PosGovernanceData["entitlementSnapshots"];
  onClose: () => void;
}> = ({ snapshots, onClose }) => (
  <div className="border-2 border-stone-200 bg-stone-50 p-5">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-xs font-black uppercase tracking-widest">
        Entitlement Snapshot
      </h3>
      <button
        className="border border-stone-200 bg-white px-3 py-2 text-[10px] font-black uppercase"
        onClick={onClose}
      >
        Close
      </button>
    </div>
    <pre className="text-[10px] overflow-auto bg-white border border-stone-200 p-3">
      {JSON.stringify(
        snapshots
          .sort(
            (a, b) =>
              new Date(b.generatedAt).getTime() -
              new Date(a.generatedAt).getTime(),
          )[0] || null,
        null,
        2,
      )}
    </pre>
  </div>
);

const VisibilityTables: React.FC<{
  vendors: Vendor[];
  data: PosGovernanceData;
  updateAccessStatus: (row: PosStaffAccess, status: PosStaffAccess["status"]) => void;
  resetAccessCode: (row: PosStaffAccess) => void;
  editAccess: (row: PosStaffAccess) => void;
  copyLoginDetails: (row: PosStaffAccess) => void;
}> = ({ vendors, data, updateAccessStatus, resetAccessCode, editAccess, copyLoginDetails }) => (
  <div className="space-y-5">
    <TablePanel
      title="Branch Records Visible"
      headers={["Private Tenant", "Branch Record", "Type", "Location", "Status"]}
    >
      {data.branches.map((row) => (
        <tr key={row.id} className="text-xs hover:bg-stone-50">
          <td className="px-6 py-4">{vendorName(vendors, row.vendorId)}</td>
          <td className="px-6 py-4 font-bold">
            {row.branchName} / {row.branchCode}
          </td>
          <td className="px-6 py-4">{row.branchType}</td>
          <td className="px-6 py-4">
            {[row.district, row.suburb].filter(Boolean).join(", ")}
          </td>
          <td className="px-6 py-4">{statusBadge(row.status)}</td>
        </tr>
      ))}
    </TablePanel>

    <TablePanel
      title="Warehouse Records Visible"
      headers={["Private Tenant", "Warehouse Record", "Default", "Location", "Status"]}
    >
      {data.warehouses.map((row) => (
        <tr key={row.id} className="text-xs hover:bg-stone-50">
          <td className="px-6 py-4">{vendorName(vendors, row.vendorId)}</td>
          <td className="px-6 py-4 font-bold">
            {row.warehouseName} / {row.warehouseCode}
          </td>
          <td className="px-6 py-4">{row.isDefault ? "Yes" : "No"}</td>
          <td className="px-6 py-4">
            {[row.district, row.suburb].filter(Boolean).join(", ")}
          </td>
          <td className="px-6 py-4">{statusBadge(row.status)}</td>
        </tr>
      ))}
    </TablePanel>

    <TablePanel
      title="Terminal Records Visible"
      headers={[
        "Private Tenant",
        "Terminal Record",
        "Branch Record",
        "Device Binding",
        "Last Seen",
      ]}
    >
      {data.terminals.map((row) => (
        <tr key={row.id} className="text-xs hover:bg-stone-50">
          <td className="px-6 py-4">{vendorName(vendors, row.vendorId)}</td>
          <td className="px-6 py-4 font-bold">
            {row.terminalName} / {row.terminalCode}
          </td>
          <td className="px-6 py-4">
            {data.branches.find((b) => b.id === row.branchId)?.branchName ||
              row.branchId}
          </td>
          <td className="px-6 py-4">{row.deviceBindingStatus}</td>
          <td className="px-6 py-4">{row.lastSeenAt || "-"}</td>
        </tr>
      ))}
    </TablePanel>

    <TablePanel
      title="Tenant Staff Access"
      headers={[
        "Staff",
        "Vendor",
        "Branch",
        "Terminal",
        "Role",
        "Access Status",
        "PIN Status",
        "Status",
        "Created At",
        "Actions",
      ]}
    >
      {data.staffAccess.map((row) => (
        <tr key={row.id} className="text-xs hover:bg-stone-50">
          <td className="px-6 py-4">
            <p className="font-bold">{row.displayName}</p>
            <p className="text-[10px] text-stone-400">{row.email}</p>
          </td>
          <td className="px-6 py-4">{vendorName(vendors, row.vendorId)}</td>
          <td className="px-6 py-4">
            {row.branchName ||
              data.branches.find((item) => item.id === (row.branchId || row.branchIds?.[0]))?.branchName ||
              row.branchId ||
              "-"}
          </td>
          <td className="px-6 py-4">
            {row.terminalName ||
              data.terminals.find((item) => item.id === (row.terminalId || row.terminalIds?.[0]))?.terminalName ||
              row.terminalId ||
              "-"}
          </td>
          <td className="px-6 py-4">
            {row.roleName ||
              data.roles.find((item) => item.id === row.roleId)?.roleName ||
              row.roleId}
          </td>
          <td className="px-6 py-4">{statusBadge(row.accessStatus)}</td>
          <td className="px-6 py-4">
            {row.mustChangePin ? "Must change PIN" : "PIN set"}
          </td>
          <td className="px-6 py-4">{statusBadge(row.status)}</td>
          <td className="px-6 py-4 font-mono">{row.createdAt || "-"}</td>
          <td className="px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <SecondaryButton size="sm" onClick={() => editAccess(row)}>
                Edit
              </SecondaryButton>
              <SecondaryButton size="sm" onClick={() => resetAccessCode(row)}>
                Reset PIN
              </SecondaryButton>
              <SecondaryButton size="sm" onClick={() => updateAccessStatus(row, "disabled")}>
                Disable
              </SecondaryButton>
              <SecondaryButton size="sm" onClick={() => updateAccessStatus(row, "active")}>
                Enable
              </SecondaryButton>
              <SecondaryButton size="sm" onClick={() => copyLoginDetails(row)}>
                Copy Login Details
              </SecondaryButton>
            </div>
          </td>
        </tr>
      ))}
    </TablePanel>

    <TablePanel
      title="POS Role Records Visible"
      headers={["Private Tenant", "Role Record", "Permissions", "Status"]}
    >
      {data.roles.map((row) => (
        <tr key={row.id} className="text-xs hover:bg-stone-50">
          <td className="px-6 py-4">{vendorName(vendors, row.vendorId)}</td>
          <td className="px-6 py-4 font-black uppercase">{row.roleName}</td>
          <td className="px-6 py-4">{row.permissions.length} permissions</td>
          <td className="px-6 py-4">{statusBadge(row.status)}</td>
        </tr>
      ))}
    </TablePanel>
  </div>
);

export default POSGovernance;
