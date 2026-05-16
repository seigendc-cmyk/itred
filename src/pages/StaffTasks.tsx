/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react";
import { PageHeader, PrimaryButton, SecondaryButton } from "../components/CommonUI.tsx";
import { permissionService } from "../services/permissionService.ts";
import { staffService } from "../services/staffService.ts";
import { taskService } from "../services/taskService.ts";
import { notificationService } from "../services/notificationService.ts";
import { Staff, StaffTask, StaffTaskPriority, StaffTaskStatus } from "../types.ts";

type TaskFormState = {
  assignedToStaffId: string;
  title: string;
  description: string;
  module: string;
  priority: StaffTaskPriority;
  dueDate: string;
};

const emptyForm: TaskFormState = {
  assignedToStaffId: "",
  title: "",
  description: "",
  module: "Vendor Operations",
  priority: "medium",
  dueDate: new Date().toISOString().split("T")[0],
};

const safeArray = <T,>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];

const getSession = () => {
  try {
    const session = localStorage.getItem("activeStaffSession");
    return session ? JSON.parse(session) : {};
  } catch (error) {
    console.error("Failed to parse staff session", error);
    return {};
  }
};

const isOverdue = (task: StaffTask): boolean => {
  const today = new Date().toISOString().split("T")[0];
  return (
    !!task.dueDate &&
    task.dueDate < today &&
    !["completed", "reviewed", "cancelled"].includes(task.status)
  );
};

const statusLabel = (status: StaffTaskStatus) => status.replace(/_/g, " ");

const badgeClass = (task: StaffTask) => {
  if (isOverdue(task)) return "bg-red-50 text-red-700 border-red-200";
  if (task.status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (task.status === "reviewed") return "bg-blue-50 text-blue-700 border-blue-200";
  if (task.status === "in_progress") return "bg-orange-50 text-brand-orange border-orange-200";
  if (task.status === "cancelled") return "bg-stone-100 text-stone-500 border-stone-200";
  return "bg-white text-brand-charcoal border-stone-300";
};

const priorityClass = (priority: StaffTaskPriority) => {
  if (priority === "critical") return "bg-red-700 text-white";
  if (priority === "high") return "bg-orange-600 text-white";
  if (priority === "medium") return "bg-brand-orange text-white";
  return "bg-stone-200 text-stone-700";
};

const modules = [
  "Vendor Operations",
  "Product Operations",
  "Catalogue",
  "Commerce Access Hub",
  "WhatsApp",
  "RPN",
  "Finance",
  "Staff & Security",
  "BI & Analytics",
];

const TaskCard: React.FC<{
  task: StaffTask;
  actions: React.ReactNode;
}> = ({ task, actions }) => (
  <div className="border border-stone-200 bg-white p-4">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`px-2 py-1 border text-[9px] font-black uppercase tracking-widest ${badgeClass(task)}`}>
            {isOverdue(task) ? "overdue" : statusLabel(task.status)}
          </span>
          <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest ${priorityClass(task.priority)}`}>
            {task.priority}
          </span>
          <span className="px-2 py-1 bg-stone-100 text-stone-500 text-[9px] font-bold uppercase tracking-widest">
            {task.module}
          </span>
        </div>
        <h3 className="text-sm font-black uppercase text-brand-charcoal leading-tight">
          {task.title}
        </h3>
        <p className="text-xs text-stone-600 mt-2 leading-relaxed">
          {task.description || "No description supplied."}
        </p>
      </div>
      <div className="md:text-right shrink-0">
        <p className="text-[10px] font-bold uppercase text-stone-400">Due</p>
        <p className="text-xs font-black text-brand-charcoal">{task.dueDate || "No date"}</p>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] uppercase font-bold text-stone-500">
      <p>Assigned To: <span className="text-brand-charcoal">{task.assignedToName || task.assignedToStaffId}</span></p>
      <p>Assigned By: <span className="text-brand-charcoal">{task.assignedByName || task.assignedByStaffId}</span></p>
      <p>Updated: <span className="text-brand-charcoal">{new Date(task.updatedAt || task.createdAt).toLocaleString()}</span></p>
    </div>
    {(task.notes || task.reviewNotes) && (
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {task.notes && <p className="bg-stone-50 border border-stone-100 p-3 text-stone-600">{task.notes}</p>}
        {task.reviewNotes && <p className="bg-orange-50 border border-orange-100 p-3 text-stone-700">{task.reviewNotes}</p>}
      </div>
    )}
    {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const StaffTasks: React.FC = () => {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesByTaskId, setNotesByTaskId] = useState<Record<string, string>>({});
  const [reviewNotesByTaskId, setReviewNotesByTaskId] = useState<Record<string, string>>({});

  const session = getSession();
  const currentStaffId = session.staffId || session.id || "";
  const currentStaffName = session.staffName || session.displayName || session.fullName || "Current Staff";
  const canCreate = permissionService.canCreateStaffTask() || permissionService.canAssignTask();
  const canUpdate = permissionService.canUpdateStaffTaskStatus();
  const canReview = permissionService.canReviewStaffTask();
  const canCancel = permissionService.canCancelStaffTask();
  const isManager = canCreate || canReview || canCancel || permissionService.isSysAdmin();

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [taskRows, remoteStaff] = await Promise.all([
        taskService.getAll(),
        staffService.loadStaffFromFirebase().catch(() => staffService.getAllStaff()),
      ]);
      const fallbackStaff = safeArray(staffService.getAllStaff());
      setTasks(
        safeArray(taskRows).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
      void Promise.allSettled(
        safeArray(taskRows)
          .filter(isOverdue)
          .map((task) =>
            notificationService.createNotification({
              title: "Staff Task Overdue",
              message: `${task.title} is overdue and needs attention.`,
              type: "task_due",
              priority: task.priority === "low" ? "medium" : task.priority,
              recordType: "staff_task",
              recordId: task.id,
              assignedToStaffId: task.assignedToStaffId,
              assignedToName: task.assignedToName,
              createdByStaffId: task.assignedByStaffId,
              createdByName: task.assignedByName,
              dedupeKey: `staff_task:${task.id}:overdue:${new Date().toISOString().split("T")[0]}`,
            }),
          ),
      );
      setStaff(safeArray(remoteStaff).length > 0 ? safeArray(remoteStaff) : fallbackStaff);
    } catch (loadError) {
      console.error("Failed to load staff tasks", loadError);
      setError("Staff tasks could not be loaded. Local fallback data may be unavailable.");
      setTasks([]);
      setStaff(safeArray(staffService.getAllStaff()));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!form.assignedToStaffId && staff.length > 0) {
      setForm((prev) => ({ ...prev, assignedToStaffId: staff[0].id }));
    }
  }, [staff, form.assignedToStaffId]);

  const activeStaff = useMemo(
    () => safeArray(staff).filter((member) => member.status === "active"),
    [staff],
  );

  const visibleTasks = useMemo(() => {
    const rows = safeArray(tasks);
    if (isManager) return rows;
    return rows.filter((task) => task.assignedToStaffId === currentStaffId);
  }, [tasks, isManager, currentStaffId]);

  const myTasks = visibleTasks.filter(
    (task) =>
      task.assignedToStaffId === currentStaffId &&
      !["completed", "reviewed", "cancelled"].includes(task.status),
  );

  const teamQueue = visibleTasks.filter((task) =>
    ["open", "in_progress"].includes(task.status),
  );

  const reviewQueue = visibleTasks.filter((task) =>
    ["completed", "reviewed"].includes(task.status),
  );

  const stats = {
    open: visibleTasks.filter((task) => task.status === "open").length,
    inProgress: visibleTasks.filter((task) => task.status === "in_progress").length,
    completed: visibleTasks.filter((task) => task.status === "completed").length,
    overdue: visibleTasks.filter(isOverdue).length,
  };

  const selectedAssignee = activeStaff.find(
    (member) => member.id === form.assignedToStaffId,
  );

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) {
      setError("You do not have permission to create staff tasks.");
      return;
    }
    if (!selectedAssignee || !form.title.trim() || !form.description.trim()) {
      setError("Select a staff member and enter a task title and description.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await taskService.createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        assignedToStaffId: selectedAssignee.id,
        assignedToName:
          selectedAssignee.displayName || selectedAssignee.fullName || selectedAssignee.staffCode,
        assignedByStaffId: currentStaffId || "unknown",
        assignedByName: currentStaffName,
        module: form.module,
        priority: form.priority,
        dueDate: form.dueDate,
        notes: "",
        reviewNotes: "",
      });
      setForm({ ...emptyForm, assignedToStaffId: selectedAssignee.id });
      notificationService.toast("Staff task created");
      await loadData();
    } catch (saveError) {
      console.error("Failed to create staff task", saveError);
      setError(saveError instanceof Error ? saveError.message : "Task could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatus = async (task: StaffTask, status: StaffTaskStatus) => {
    setIsSaving(true);
    setError(null);
    try {
      await taskService.updateTaskStatus(task.id, status, {
        notes: notesByTaskId[task.id] || task.notes || "",
        reviewNotes: reviewNotesByTaskId[task.id] || task.reviewNotes || "",
        actorStaffId: currentStaffId,
        actorName: currentStaffName,
      });
      notificationService.toast("Task updated");
      await loadData();
    } catch (saveError) {
      console.error("Failed to update staff task", saveError);
      setError(saveError instanceof Error ? saveError.message : "Task status could not be updated.");
    } finally {
      setIsSaving(false);
    }
  };

  const staffActions = (task: StaffTask) => {
    const isOwn = task.assignedToStaffId === currentStaffId;
    const ownUpdateAllowed =
      isOwn && (canUpdate || permissionService.canView("staffTasks"));

    return (
      <>
        {ownUpdateAllowed && task.status === "open" && (
          <button
            onClick={() => void handleStatus(task, "in_progress")}
            disabled={isSaving}
            className="px-3 py-2 bg-brand-charcoal text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Start
          </button>
        )}
        {ownUpdateAllowed && task.status === "in_progress" && (
          <>
            <input
              value={notesByTaskId[task.id] || ""}
              onChange={(event) =>
                setNotesByTaskId((prev) => ({ ...prev, [task.id]: event.target.value }))
              }
              placeholder="Completion notes"
              className="min-w-[220px] flex-1 border border-stone-200 px-3 py-2 text-xs outline-none focus:border-brand-orange"
            />
            <button
              onClick={() => void handleStatus(task, "completed")}
              disabled={isSaving}
              className="px-3 py-2 bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Complete
            </button>
          </>
        )}
        {canReview && task.status === "completed" && (
          <>
            <input
              value={reviewNotesByTaskId[task.id] || ""}
              onChange={(event) =>
                setReviewNotesByTaskId((prev) => ({ ...prev, [task.id]: event.target.value }))
              }
              placeholder="Review notes"
              className="min-w-[220px] flex-1 border border-stone-200 px-3 py-2 text-xs outline-none focus:border-brand-orange"
            />
            <button
              onClick={() => void handleStatus(task, "reviewed")}
              disabled={isSaving}
              className="px-3 py-2 bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Review
            </button>
          </>
        )}
        {canCancel && ["open", "in_progress"].includes(task.status) && (
          <button
            onClick={() => void handleStatus(task, "cancelled")}
            disabled={isSaving}
            className="px-3 py-2 bg-red-700 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </>
    );
  };

  const renderTaskList = (rows: StaffTask[], emptyText: string) =>
    rows.length === 0 ? (
      <div className="border border-dashed border-stone-300 bg-white p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{emptyText}</p>
      </div>
    ) : (
      <div className="space-y-3">{rows.map((task) => <TaskCard key={task.id} task={task} actions={staffActions(task)} />)}</div>
    );

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Staff Tasks"
        subtitle="Operational task assignment, completion, review, and audit logging."
      />

      {error && (
        <div className="border-l-4 border-red-600 bg-red-50 p-4 text-sm font-bold text-red-700 flex items-center gap-3">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Open", stats.open, ClipboardCheck, "border-brand-charcoal"],
          ["In Progress", stats.inProgress, Clock, "border-brand-orange"],
          ["Completed", stats.completed, CheckCircle2, "border-emerald-600"],
          ["Overdue", stats.overdue, AlertTriangle, "border-red-600"],
        ].map(([label, value, Icon, border]) => (
          <div key={String(label)} className={`bg-white border-2 ${border} p-4`}>
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-black tracking-widest text-stone-400">
                {String(label)}
              </span>
              {React.createElement(Icon as typeof ClipboardCheck, { size: 18, className: "text-brand-orange" })}
            </div>
            <p className="mt-2 text-3xl font-black font-mono text-brand-charcoal">{String(value)}</p>
          </div>
        ))}
      </div>

      {canCreate && (
        <section className="bg-white border-2 border-brand-charcoal">
          <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-2">
            <Plus size={16} className="text-brand-orange" />
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-charcoal">Create Task</h2>
          </div>
          <form onSubmit={handleCreateTask} className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <label className="space-y-1 xl:col-span-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">Staff Member</span>
              <select
                value={form.assignedToStaffId}
                onChange={(event) => setForm((prev) => ({ ...prev, assignedToStaffId: event.target.value }))}
                className="w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
              >
                {activeStaff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName || member.fullName || member.staffCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 xl:col-span-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full border border-stone-200 px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-stone-400">Priority</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, priority: event.target.value as StaffTaskPriority }))
                }
                className="w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
              >
                {["low", "medium", "high", "critical"].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-stone-400">Due Date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                className="w-full border border-stone-200 px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
              />
            </label>
            <label className="space-y-1 md:col-span-2 xl:col-span-2">
              <span className="text-[10px] font-bold uppercase text-stone-400">Module</span>
              <select
                value={form.module}
                onChange={(event) => setForm((prev) => ({ ...prev, module: event.target.value }))}
                className="w-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-brand-orange"
              >
                {modules.map((moduleName) => (
                  <option key={moduleName} value={moduleName}>{moduleName}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2 xl:col-span-4">
              <span className="text-[10px] font-bold uppercase text-stone-400">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full min-h-[82px] border border-stone-200 px-3 py-2 text-xs font-medium outline-none resize-none focus:border-brand-orange"
              />
            </label>
            <div className="md:col-span-2 xl:col-span-6 flex flex-wrap gap-3 justify-end border-t border-stone-100 pt-4">
              <SecondaryButton type="button" onClick={() => setForm(emptyForm)}>
                Clear
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={isSaving || activeStaff.length === 0}>
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : "Save Task"}
              </PrimaryButton>
            </div>
          </form>
        </section>
      )}

      {isLoading ? (
        <div className="p-10 bg-white border border-stone-200 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-stone-400">
          <Loader2 size={18} className="animate-spin text-brand-orange" /> Loading tasks
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-charcoal border-b-2 border-brand-orange pb-2">
              My Assigned Tasks
            </h2>
            {renderTaskList(myTasks, "No assigned active tasks.")}
          </section>
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-charcoal border-b-2 border-brand-charcoal pb-2">
              Team Task Queue
            </h2>
            {renderTaskList(teamQueue, "No open team tasks.")}
          </section>
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-brand-charcoal border-b-2 border-emerald-600 pb-2 flex items-center gap-2">
              <XCircle size={14} className="text-brand-orange" /> Completed / Review Queue
            </h2>
            {renderTaskList(reviewQueue, "No completed tasks for review.")}
          </section>
        </div>
      )}
    </div>
  );
};
