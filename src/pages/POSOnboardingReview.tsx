import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, Search, X } from "lucide-react";
import {
  BrandedAlertModal,
  FormField,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TablePanel,
} from "../components/CommonUI.tsx";
import {
  posOnboardingReviewService,
} from "../services/posOnboardingReviewService.ts";
import {
  PosOnboardingReviewData,
  PosTenantSetupRequest,
  VendorProfileCompletionRequest,
} from "../types/posOnboardingReview.ts";

type ActiveTab = "pending" | "approved" | "rejected" | "all";
type ReviewTarget =
  | { type: "profile"; row: VendorProfileCompletionRequest }
  | { type: "setup"; row: PosTenantSetupRequest }
  | null;

const inputClass =
  "w-full bg-stone-50 border-0 border-b-2 border-stone-300 focus:border-brand-orange focus:ring-0 outline-none rounded-none px-4 py-3 text-sm font-bold text-brand-charcoal";

const statusClass = (status: string) =>
  status === "approved"
    ? "bg-emerald-100 text-emerald-700"
    : status === "rejected"
      ? "bg-red-100 text-red-700"
      : "bg-orange-100 text-brand-orange";

const statusBadge = (status?: string) => (
  <span className={`px-2 py-1 text-[9px] font-black uppercase ${statusClass(status || "pending")}`}>
    {status || "pending"}
  </span>
);

const fieldValue = (source: Record<string, unknown> | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "-";
};

const requestDate = (value?: string) => (value ? value : "-");

export const POSOnboardingReview: React.FC = () => {
  const [data, setData] = useState<PosOnboardingReviewData>({
    profileRequests: [],
    setupRequests: [],
    allRequests: [],
    vendors: [],
    onboardingCodes: [],
    diagnostics: {
      collectionsChecked: [],
      entries: [],
      statusesFound: [],
      totalRecordsFound: 0,
      errors: [],
    },
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>("pending");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [lookup, setLookup] = useState({ vendorId: "", vendorCode: "", onboardingCode: "" });
  const [lookupRan, setLookupRan] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>(null);
  const [rejectTarget, setRejectTarget] = useState<ReviewTarget>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [working, setWorking] = useState(false);
  const [alert, setAlert] = useState({
    isOpen: false,
    message: "",
    type: "success" as "success" | "error" | "warning" | "info",
  });

  const load = async () => setData(await posOnboardingReviewService.getData());

  useEffect(() => {
    void load().catch((error: any) =>
      showAlert(error.message || "POS onboarding review data could not be loaded.", "error"),
    );
  }, []);

  const showAlert = (
    message: string,
    type: "success" | "error" | "warning" | "info" = "success",
  ) => setAlert({ isOpen: true, message, type });

  const filteredProfiles = useMemo(
    () =>
      activeTab === "all"
        ? data.profileRequests
        : data.profileRequests.filter(
            (row) => (row.normalized?.normalizedStatus || String(row.status || "pending")) === activeTab,
          ),
    [data.profileRequests, activeTab],
  );

  const filteredSetups = useMemo(
    () =>
      activeTab === "all"
        ? data.setupRequests
        : data.setupRequests.filter(
            (row) => (row.normalized?.normalizedStatus || String(row.status || "pending")) === activeTab,
          ),
    [data.setupRequests, activeTab],
  );

  const lookupResults = useMemo(() => {
    if (!lookupRan) return [];
    const vendorId = lookup.vendorId.trim().toLowerCase();
    const vendorCode = lookup.vendorCode.trim().toLowerCase();
    const onboardingCode = lookup.onboardingCode.trim().toLowerCase();
    const matches = (row: any) => {
      const normalized = row.normalized || {};
      return (
        (!!vendorId &&
          [row.vendorId, row.vendor_id, row.tenantId, normalized.vendorId]
            .map((value) => String(value || "").toLowerCase())
            .includes(vendorId)) ||
        (!!vendorCode &&
          [row.vendorCode, row.vendor_code, row.vendorCode, normalized.vendorCode]
            .map((value) => String(value || "").toLowerCase())
            .includes(vendorCode)) ||
        (!!onboardingCode &&
          [row.code, row.onboardingCode, normalized.vendorCode]
            .map((value) => String(value || "").toLowerCase())
            .includes(onboardingCode))
      );
    };
    return [...data.allRequests, ...data.onboardingCodes, ...data.vendors].filter(matches);
  }, [lookup, lookupRan, data]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const approvedToday =
    data.profileRequests.filter((row) => String(row.approvedAt || "").startsWith(todayKey)).length +
    data.setupRequests.filter((row) => String(row.approvedAt || "").startsWith(todayKey)).length;
  const rejectedToday =
    data.profileRequests.filter((row) => String(row.rejectedAt || "").startsWith(todayKey)).length +
    data.setupRequests.filter((row) => String(row.rejectedAt || "").startsWith(todayKey)).length;
  const readyForPos = data.onboardingCodes.filter(
    (row: any) => row.onboardingStatus === "READY_FOR_POS",
  ).length;
  const highPriority = data.onboardingCodes.filter((row: any) => {
    const expires = row.expiresAt ? new Date(row.expiresAt).getTime() : 0;
    return row.status === "expired" || (expires > 0 && expires < Date.now() + 2 * 86400000);
  }).length;

  const run = async (action: () => Promise<void>, message: string) => {
    setWorking(true);
    try {
      await action();
      await load();
      setReviewTarget(null);
      setRejectTarget(null);
      setRejectionReason("");
      showAlert(message);
    } catch (error: any) {
      showAlert(error.message || "Review action failed.", "error");
    } finally {
      setWorking(false);
    }
  };

  const copySummary = async () => {
    if (!reviewTarget) return;
    await navigator.clipboard.writeText(JSON.stringify(reviewTarget.row, null, 2));
    showAlert("Review summary copied.");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="POS Onboarding Review" />

      <div className="border-l-4 border-brand-orange bg-stone-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
          Backend Office approval queue
        </p>
        <p className="mt-1 text-xs font-bold text-brand-charcoal">
          Review POS onboarding submissions from the private tenant app. Approval
          writes final tenant setup records; rejection returns a support reason.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Metric label="Pending Profile Reviews" value={data.profileRequests.filter((row) => row.normalized?.normalizedStatus === "pending").length} />
        <Metric label="Pending Setup Reviews" value={data.setupRequests.filter((row) => row.normalized?.normalizedStatus === "pending").length} />
        <Metric label="Approved Today" value={approvedToday} />
        <Metric label="Rejected Today" value={rejectedToday} />
        <Metric label="Ready for POS" value={readyForPos} />
        <Metric label="High Priority / Expired Codes" value={highPriority} />
      </div>

      <section className="border-2 border-stone-200 bg-white">
        <button
          type="button"
          onClick={() => setDiagnosticsOpen((current) => !current)}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-xs font-black uppercase tracking-widest text-brand-charcoal">
            Review Diagnostics
          </span>
          <span className="text-[10px] font-black uppercase text-brand-orange">
            {diagnosticsOpen ? "Hide" : "Show"}
          </span>
        </button>
        {diagnosticsOpen && <DiagnosticsPanel data={data} />}
      </section>

      <section className="border-2 border-stone-200 bg-white p-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">
          Manual Request Lookup
        </h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField label="Vendor ID">
            <input className={inputClass} value={lookup.vendorId} onChange={(event) => setLookup((current) => ({ ...current, vendorId: event.target.value }))} />
          </FormField>
          <FormField label="Vendor Code">
            <input className={inputClass} value={lookup.vendorCode} onChange={(event) => setLookup((current) => ({ ...current, vendorCode: event.target.value }))} />
          </FormField>
          <FormField label="Onboarding Code">
            <input className={inputClass} value={lookup.onboardingCode} onChange={(event) => setLookup((current) => ({ ...current, onboardingCode: event.target.value }))} />
          </FormField>
          <div className="flex items-end">
            <PrimaryButton type="button" onClick={() => setLookupRan(true)}>
              <Search size={13} className="mr-2" />
              Search Requests
            </PrimaryButton>
          </div>
        </div>
        {lookupRan && (
          <div className="mt-4 border border-stone-200 bg-stone-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
              Results: {lookupResults.length}
            </p>
            <pre className="mt-2 max-h-64 overflow-auto text-[10px] whitespace-pre-wrap">
              {lookupResults.length
                ? JSON.stringify(lookupResults, null, 2)
                : "No matching request or onboarding lifecycle records found."}
            </pre>
          </div>
        )}
      </section>

      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer border-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
              activeTab === tab
                ? "border-brand-charcoal bg-brand-charcoal text-white"
                : "border-stone-200 bg-white text-stone-500 hover:border-brand-orange"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {data.diagnostics.totalRecordsFound === 0 && data.onboardingCodes.length > 0 && (
        <div className="border-l-4 border-brand-orange bg-orange-50 p-4 text-xs font-bold text-brand-charcoal">
          No onboarding request documents were found in the expected collections.
          POS onboarding lifecycle records exist, but request documents may not
          have been written or may use unexpected status values.
        </div>
      )}

      {activeTab === "all" && (
        <TablePanel
          title="All Requests"
          subtitle="Every request found across all checked collections"
          headers={["Type", "Collection", "Vendor", "Vendor ID", "Vendor Code", "Submitted By", "Submitted At", "Raw Status", "Normalized"]}
        >
          {data.allRequests.map((row: any) => (
            <tr key={`${row.sourceCollection}-${row.id}`} className="text-xs hover:bg-stone-50">
              <td className="px-6 py-4 font-black uppercase">{row.requestKind}</td>
              <td className="px-6 py-4 font-mono">{row.sourceCollection}</td>
              <td className="px-6 py-4 font-black uppercase">{row.normalized?.vendorName || row.vendorName || "-"}</td>
              <td className="px-6 py-4 font-mono">{row.normalized?.vendorId || row.vendorId || "-"}</td>
              <td className="px-6 py-4 font-mono">{row.normalized?.vendorCode || row.vendorCode || "-"}</td>
              <td className="px-6 py-4">{row.normalized?.submittedBy || row.submittedByEmail || "-"}</td>
              <td className="px-6 py-4 font-mono">{row.normalized?.submittedAt || "-"}</td>
              <td className="px-6 py-4">{row.normalized?.rawStatus || row.status || "-"}</td>
              <td className="px-6 py-4">{statusBadge(row.normalized?.normalizedStatus || row.status)}</td>
            </tr>
          ))}
          {data.allRequests.length === 0 && <NoRows colSpan={9} label="No onboarding request documents were found in the expected collections." />}
        </TablePanel>
      )}

      <TablePanel
        title="Profile Completion Reviews"
        headers={["Vendor", "Vendor ID", "Vendor Code", "Submitted By", "Submitted At", "Status", "Actions"]}
      >
        {filteredProfiles.map((row) => (
          <tr key={row.id} className="text-xs hover:bg-stone-50">
            <td className="px-6 py-4 font-black uppercase">{row.vendorName || row.vendorId}</td>
            <td className="px-6 py-4 font-mono">{row.vendorId}</td>
            <td className="px-6 py-4 font-mono">{row.vendorCode || row.vendorId}</td>
            <td className="px-6 py-4">{row.submittedByEmail || row.submittedBy || "-"}</td>
            <td className="px-6 py-4 font-mono">{requestDate(row.submittedAt)}</td>
            <td className="px-6 py-4">{statusBadge(String(row.status || "pending"))}</td>
            <td className="px-6 py-4">
              <ActionButtons
                onReview={() => setReviewTarget({ type: "profile", row })}
                onApprove={() => {
                  if (confirm("Approve this profile completion request?")) {
                    void run(() => posOnboardingReviewService.approveProfile(row), "Profile request approved.");
                  }
                }}
                onReject={() => setRejectTarget({ type: "profile", row })}
              />
            </td>
          </tr>
        ))}
        {filteredProfiles.length === 0 && <NoRows colSpan={7} label="No profile requests in this tab." />}
      </TablePanel>

      <TablePanel
        title="Tenant Setup Reviews"
        headers={["Vendor", "Vendor ID", "Vendor Code", "Submitted By", "Warehouse", "Branch", "Terminal", "Submitted At", "Status", "Actions"]}
      >
        {filteredSetups.map((row) => {
          const warehouse = row.warehouse || row.proposedSetup?.warehouse;
          const branch = row.branch || row.proposedSetup?.branch;
          const terminal = row.terminal || row.proposedSetup?.terminal;
          return (
            <tr key={row.id} className="text-xs hover:bg-stone-50">
              <td className="px-6 py-4 font-black uppercase">{row.vendorName || row.vendorId}</td>
              <td className="px-6 py-4 font-mono">{row.vendorId}</td>
              <td className="px-6 py-4 font-mono">{row.vendorCode || row.vendorId}</td>
              <td className="px-6 py-4">{row.submittedByEmail || row.submittedBy || "-"}</td>
              <td className="px-6 py-4">{fieldValue(warehouse, ["warehouseName", "name"])}</td>
              <td className="px-6 py-4">{fieldValue(branch, ["branchName", "name"])}</td>
              <td className="px-6 py-4">{fieldValue(terminal, ["terminalName", "name"])}</td>
              <td className="px-6 py-4 font-mono">{requestDate(row.submittedAt)}</td>
              <td className="px-6 py-4">{statusBadge(String(row.status || "pending"))}</td>
              <td className="px-6 py-4">
                <ActionButtons
                  onReview={() => setReviewTarget({ type: "setup", row })}
                  onApprove={() => {
                    if (confirm("Approve this tenant setup request and write final POS tenant records?")) {
                      void run(() => posOnboardingReviewService.approveSetup(row), "Tenant setup approved.");
                    }
                  }}
                  onReject={() => setRejectTarget({ type: "setup", row })}
                />
              </td>
            </tr>
          );
        })}
        {filteredSetups.length === 0 && <NoRows colSpan={10} label="No setup requests in this tab." />}
      </TablePanel>

      {reviewTarget && (
        <ReviewPanel
          target={reviewTarget}
          working={working}
          onClose={() => setReviewTarget(null)}
          onCopy={copySummary}
          onApprove={() =>
            run(
              () =>
                reviewTarget.type === "profile"
                  ? posOnboardingReviewService.approveProfile(reviewTarget.row)
                  : posOnboardingReviewService.approveSetup(reviewTarget.row),
              reviewTarget.type === "profile" ? "Profile request approved." : "Tenant setup approved.",
            )
          }
          onReject={() => setRejectTarget(reviewTarget)}
        />
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[120] bg-brand-charcoal/60 flex items-center justify-center p-4">
          <div className="bg-white border-t-4 border-brand-orange w-full max-w-lg p-6">
            <h3 className="text-sm font-black uppercase tracking-widest">Reject Request</h3>
            <p className="mt-2 text-xs font-bold text-stone-500">Rejection reason is required.</p>
            <FormField label="Reason" className="mt-4">
              <textarea
                className={inputClass}
                rows={4}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
              />
            </FormField>
            <div className="mt-5 flex justify-end gap-3">
              <SecondaryButton onClick={() => setRejectTarget(null)}>Cancel</SecondaryButton>
              <PrimaryButton
                isLoading={working}
                onClick={() =>
                  run(
                    () =>
                      rejectTarget.type === "profile"
                        ? posOnboardingReviewService.rejectProfile(rejectTarget.row, rejectionReason)
                        : posOnboardingReviewService.rejectSetup(rejectTarget.row, rejectionReason),
                    "Request rejected.",
                  )
                }
              >
                Reject
              </PrimaryButton>
            </div>
          </div>
        </div>
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

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="border-2 border-stone-200 bg-white p-4">
    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">{label}</p>
    <p className="mt-2 text-2xl font-black text-brand-charcoal">{value}</p>
  </div>
);

const ActionButtons: React.FC<{
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
}> = ({ onReview, onApprove, onReject }) => (
  <div className="flex flex-wrap gap-2">
    <IconButton title="Review" onClick={onReview}><Eye size={13} /></IconButton>
    <IconButton title="Approve" onClick={onApprove}><Check size={13} /></IconButton>
    <IconButton title="Reject" onClick={onReject}><X size={13} /></IconButton>
  </div>
);

const IconButton: React.FC<{ title: string; children: React.ReactNode; onClick: () => void }> = ({ title, children, onClick }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    className="h-8 w-8 cursor-pointer border border-stone-200 bg-white flex items-center justify-center hover:border-brand-orange hover:text-brand-orange"
  >
    {children}
  </button>
);

const NoRows: React.FC<{ colSpan: number; label: string }> = ({ colSpan, label }) => (
  <tr className="text-xs">
    <td className="px-6 py-8 text-stone-500 font-bold" colSpan={colSpan}>{label}</td>
  </tr>
);

const DiagnosticsPanel: React.FC<{ data: PosOnboardingReviewData }> = ({ data }) => (
  <div className="border-t border-stone-100 p-5 space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Metric label="Collections Checked" value={data.diagnostics.collectionsChecked.length} />
      <Metric label="Request Docs Found" value={data.diagnostics.totalRecordsFound} />
      <Metric label="Statuses Found" value={data.diagnostics.statusesFound.length} />
      <Metric label="Errors / Rules Failures" value={data.diagnostics.errors.length} />
    </div>

    <TablePanel
      title="Collections Checked"
      subtitle="Support-side discovery across expected onboarding request collections"
      headers={["Collection", "Records", "Statuses", "Last Request Timestamp", "Errors / Index / Rules"]}
    >
      {data.diagnostics.entries.map((entry) => (
        <tr key={entry.collectionName} className="text-xs hover:bg-stone-50">
          <td className="px-6 py-4 font-mono">{entry.collectionName}</td>
          <td className="px-6 py-4 font-black">{entry.recordsFound}</td>
          <td className="px-6 py-4">
            {entry.statusesFound.length ? entry.statusesFound.join(", ") : "-"}
          </td>
          <td className="px-6 py-4 font-mono">{entry.lastRequestTimestamp || "-"}</td>
          <td className="px-6 py-4 text-red-600">{entry.error || "-"}</td>
        </tr>
      ))}
      {data.diagnostics.entries.length === 0 && (
        <NoRows colSpan={5} label="No request diagnostics are available." />
      )}
    </TablePanel>

    {data.diagnostics.statusesFound.length > 0 && (
      <div className="border border-stone-200 bg-stone-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
          Statuses Found
        </p>
        <p className="mt-2 text-xs font-bold text-brand-charcoal">
          {data.diagnostics.statusesFound.join(", ")}
        </p>
      </div>
    )}
  </div>
);

const ReviewPanel: React.FC<{
  target: ReviewTarget;
  working: boolean;
  onClose: () => void;
  onCopy: () => void;
  onApprove: () => void;
  onReject: () => void;
}> = ({ target, working, onClose, onCopy, onApprove, onReject }) => {
  if (!target) return null;
  const row = target.row as any;
  const current = target.type === "profile" ? row.currentSnapshot || {} : {};
  const proposed =
    target.type === "profile"
      ? row.proposedProfile || row
      : row.proposedSetup || {
          warehouse: row.warehouse,
          branch: row.branch,
          terminal: row.terminal,
          staffAdmin: row.staffAdmin,
        };

  return (
    <div className="fixed inset-0 z-[110] bg-brand-charcoal/60 flex items-center justify-center p-4">
      <div className="bg-white border-t-4 border-brand-orange w-full max-w-6xl max-h-[90vh] overflow-auto">
        <div className="p-5 border-b border-stone-100 flex justify-between items-start gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">
              {target.type === "profile" ? "Profile Review" : "Tenant Setup Review"}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mt-1">
              {row.vendorName || row.vendorId} / {row.vendorId}
            </p>
          </div>
          <button className="cursor-pointer border border-stone-200 px-3 py-2" onClick={onClose}>Close</button>
        </div>

        {target.type === "profile" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
            <JsonBlock title="Current Vendor Skeleton" data={current} />
            <JsonBlock title="Proposed Profile" data={proposed} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 p-5">
            <JsonBlock title="Warehouse" data={proposed.warehouse || {}} />
            <JsonBlock title="Branch" data={proposed.branch || {}} />
            <JsonBlock title="Terminal" data={proposed.terminal || {}} />
            <JsonBlock title="Staff/Admin Preview" data={proposed.staffAdmin || { submittedByEmail: row.submittedByEmail }} />
          </div>
        )}

        <div className="p-5 border-t border-stone-100 flex justify-end gap-3">
          <SecondaryButton onClick={onCopy}><Copy size={13} className="mr-2" />Copy Summary</SecondaryButton>
          <SecondaryButton onClick={onReject}>Reject</SecondaryButton>
          <PrimaryButton isLoading={working} onClick={onApprove}>
            {target.type === "profile" ? "Approve Profile" : "Approve Setup"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};

const JsonBlock: React.FC<{ title: string; data: unknown }> = ({ title, data }) => (
  <section className="border-2 border-stone-200 bg-stone-50 p-4">
    <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-charcoal mb-3">{title}</h4>
    <pre className="text-[10px] whitespace-pre-wrap break-words">{JSON.stringify(data || {}, null, 2)}</pre>
  </section>
);

export default POSOnboardingReview;
