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
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  StatCard,
} from "../components/CommonUI.tsx";
import { approvalService } from "../services/approvalService.ts";
import { permissionService } from "../services/permissionService.ts";
import { ApprovalRequest, ApprovalRequestStatus } from "../types.ts";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  FileText,
  Layers,
  ArchiveX,
} from "lucide-react";

export const ApprovalQueue: React.FC = () => {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("All");
  const [activeModal, setActiveModal] = useState<{
    type: "view" | "approve" | "reject" | "return";
    request: ApprovalRequest;
  } | null>(null);
  const [managerComment, setManagerComment] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    const allReqs = await approvalService.getAll();
    setRequests(
      allReqs.sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      ),
    );
  };

  const sessionStr = localStorage.getItem("activeStaffSession");
  const staffId = sessionStr ? JSON.parse(sessionStr).staffId : "STAFF-ADM";
  const staffName = sessionStr
    ? JSON.parse(sessionStr).staffName
    : "Backend Manager";

  const filteredRequests = useMemo(() => {
    let filtered = requests;
    if (selectedTab !== "All") {
      filtered = filtered.filter(
        (r) => r.recordType.toLowerCase() === selectedTab.toLowerCase(),
      );
    }
    return filtered;
  }, [requests, selectedTab]);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const todayStr = new Date().toISOString().split("T")[0];

  const stats = {
    pending: pendingRequests.length,
    highRisk: pendingRequests.filter(
      (r) => r.riskLevel === "high" || r.riskLevel === "critical",
    ).length,
    returnedToday: requests.filter(
      (r) =>
        r.status === "returned_for_correction" &&
        r.reviewedAt?.startsWith(todayStr),
    ).length,
    approvedToday: requests.filter(
      (r) => r.status === "approved" && r.reviewedAt?.startsWith(todayStr),
    ).length,
    overdue: pendingRequests.filter(
      (r) =>
        new Date().getTime() - new Date(r.submittedAt).getTime() >
        48 * 3600 * 1000,
    ).length,
  };

  const handleAction = async () => {
    if (!activeModal) return;

    try {
      if (activeModal.type === "approve") {
        await approvalService.approveRequest(
          activeModal.request.id,
          staffId,
          staffName,
          managerComment,
        );
      } else if (activeModal.type === "reject") {
        await approvalService.rejectRequest(
          activeModal.request.id,
          staffId,
          staffName,
          managerComment,
        );
      } else if (activeModal.type === "return") {
        await approvalService.returnForCorrection(
          activeModal.request.id,
          staffId,
          staffName,
          managerComment,
        );
      }

      setActiveModal(null);
      setManagerComment("");
      loadRequests();
    } catch (err) {
      console.error(err);
      alert("Failed to process approval action.");
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <PageHeader
        title="Approval Queue"
        subtitle="Managerial governance layer for high-risk systemic actions."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Pending" value={stats.pending} icon={Layers} />
        <StatCard
          label="High/Critical Risk"
          value={stats.highRisk}
          icon={AlertTriangle}
          variant={stats.highRisk > 0 ? "error" : "neutral"}
        />
        <StatCard
          label="Overdue (>48h)"
          value={stats.overdue}
          icon={ArchiveX}
          variant={stats.overdue > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Approved Today"
          value={stats.approvedToday}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Returned Today"
          value={stats.returnedToday}
          icon={RotateCcw}
          variant="warning"
        />
      </div>

      <DataPanel
        title="Queue Manager"
        className="border-t-4 border-brand-charcoal"
      >
        <div className="p-4 border-b border-stone-100 flex gap-2 overflow-x-auto custom-scrollbar">
          {[
            "All",
            "Vendor",
            "Product",
            "Catalogue",
            "CAH_Link",
            "Pricing",
            "RPN",
          ].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${selectedTab === tab ? "bg-brand-charcoal text-white" : "bg-stone-50 text-stone-500 hover:bg-stone-200"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-[9px] uppercase tracking-widest text-stone-400">
                <th className="px-6 py-4">Request Trace</th>
                <th className="px-6 py-4">Submitted By</th>
                <th className="px-6 py-4">Risk Profile</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  className="hover:bg-stone-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-brand-charcoal uppercase">
                      {req.requestType.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] text-stone-500 font-medium mt-1">
                      Record: {req.recordName || req.recordId}
                    </p>
                    <p className="text-[8px] font-mono text-stone-400 mt-0.5">
                      {req.id} • {new Date(req.submittedAt).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold uppercase text-stone-600">
                    {req.submittedByName}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-1 ${req.riskLevel === "critical" ? "bg-red-100 text-red-700" : req.riskLevel === "high" ? "bg-orange-100 text-orange-700" : "bg-stone-100 text-stone-600"}`}
                    >
                      {req.riskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      status={req.status}
                      variant={
                        req.status === "approved"
                          ? "success"
                          : req.status === "pending"
                            ? "warning"
                            : req.status === "rejected"
                              ? "error"
                              : "neutral"
                      }
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          setActiveModal({ type: "view", request: req })
                        }
                        className="p-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-[10px] font-bold uppercase text-stone-600"
                      >
                        View
                      </button>
                      {req.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              setActiveModal({ type: "approve", request: req })
                            }
                            disabled={!permissionService.canApproveWork()}
                            className="p-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-[10px] font-bold uppercase text-emerald-700 disabled:opacity-50"
                            title={
                              !permissionService.canApproveWork()
                                ? "No permission to approve work"
                                : "Approve"
                            }
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              setActiveModal({ type: "return", request: req })
                            }
                            disabled={
                              !permissionService.canReturnWorkForCorrection()
                            }
                            className="p-1.5 px-3 bg-orange-50 hover:bg-orange-100 text-[10px] font-bold uppercase text-orange-700 disabled:opacity-50"
                            title={
                              !permissionService.canReturnWorkForCorrection()
                                ? "No permission to return work"
                                : "Return"
                            }
                          >
                            Return
                          </button>
                          <button
                            onClick={() =>
                              setActiveModal({ type: "reject", request: req })
                            }
                            disabled={!permissionService.canRejectWork()}
                            className="p-1.5 px-3 bg-red-50 hover:bg-red-100 text-[10px] font-bold uppercase text-red-700 disabled:opacity-50"
                            title={
                              !permissionService.canRejectWork()
                                ? "No permission to reject work"
                                : "Reject"
                            }
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20">
                    <EmptyState
                      title="Queue Empty"
                      description="No approval requests match the current filters."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataPanel>

      {/* Approval Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-brand-charcoal/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right overflow-hidden">
            <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase text-brand-charcoal tracking-tight">
                  {activeModal.type === "view"
                    ? "Approval Request Details"
                    : activeModal.type === "approve"
                      ? "Approve Request"
                      : activeModal.type === "reject"
                        ? "Reject Request"
                        : "Return For Correction"}
                </h3>
                <p className="text-[10px] font-bold uppercase text-stone-400 mt-1">
                  ID: {activeModal.request.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setManagerComment("");
                }}
                className="p-2 text-stone-400 hover:text-brand-charcoal"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-stone-50 border border-stone-100">
                  <p className="text-[9px] uppercase font-bold tracking-widest text-stone-400">
                    Request Type
                  </p>
                  <p className="text-xs font-bold text-brand-charcoal mt-1 uppercase">
                    {activeModal.request.requestType.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="p-4 bg-stone-50 border border-stone-100">
                  <p className="text-[9px] uppercase font-bold tracking-widest text-stone-400">
                    Submitter
                  </p>
                  <p className="text-xs font-bold text-brand-charcoal mt-1 uppercase">
                    {activeModal.request.submittedByName}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white border border-stone-200">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
                  <FileText size={12} /> Snapshot Data
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase text-stone-400 mb-2">
                      Before Change
                    </p>
                    <pre className="p-3 bg-stone-50 text-[10px] font-mono text-stone-600 overflow-x-auto custom-scrollbar h-48 border border-stone-100">
                      {activeModal.request.beforeSnapshot
                        ? JSON.stringify(
                            activeModal.request.beforeSnapshot,
                            null,
                            2,
                          )
                        : "No previous state or new creation."}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-brand-orange mb-2">
                      Requested State
                    </p>
                    <pre className="p-3 bg-orange-50/30 text-[10px] font-mono text-stone-700 overflow-x-auto custom-scrollbar h-48 border border-orange-100">
                      {activeModal.request.afterSnapshot
                        ? JSON.stringify(
                            activeModal.request.afterSnapshot,
                            null,
                            2,
                          )
                        : "Data payload omitted or deletion."}
                    </pre>
                  </div>
                </div>
              </div>

              {activeModal.type !== "view" && (
                <div className="p-4 bg-stone-50 border border-stone-200 space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-500">
                    {activeModal.type === "return"
                      ? "Correction Notes (Required) *"
                      : "Manager Comment / Rationale (Optional)"}
                  </label>
                  <textarea
                    className="w-full p-3 text-xs font-medium outline-none border border-stone-200 focus:border-brand-orange h-24 resize-none"
                    value={managerComment}
                    onChange={(e) => setManagerComment(e.target.value)}
                    placeholder={
                      activeModal.type === "return"
                        ? "Specify what the submitter needs to fix..."
                        : "Internal rationale..."
                    }
                  />
                </div>
              )}

              {activeModal.request.status !== "pending" && (
                <div className="p-4 bg-stone-100 border border-stone-200">
                  <p className="text-[10px] font-bold uppercase text-stone-500">
                    Review Outcome
                  </p>
                  <p className="text-xs font-medium text-stone-700 mt-2">
                    {activeModal.request.status.toUpperCase()} by{" "}
                    {activeModal.request.reviewedByName ||
                      activeModal.request.reviewedByStaffId}
                  </p>
                  {(activeModal.request.managerComment ||
                    activeModal.request.correctionNotes) && (
                    <p className="text-[10px] text-stone-500 italic mt-2">
                      "
                      {activeModal.request.managerComment ||
                        activeModal.request.correctionNotes}
                      "
                    </p>
                  )}
                </div>
              )}
            </div>

            {activeModal.type !== "view" && (
              <div className="p-6 border-t border-stone-100 bg-white flex gap-3 shrink-0">
                <SecondaryButton
                  onClick={() => {
                    setActiveModal(null);
                    setManagerComment("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onClick={handleAction}
                  disabled={
                    activeModal.type === "return" && !managerComment.trim()
                  }
                  className="flex-1"
                >
                  Confirm {activeModal.type.toUpperCase()}
                </PrimaryButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
