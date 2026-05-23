/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffTask, StaffTaskStatus } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { notificationService } from "./notificationService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { generateTaskId } from "../utils/idGenerator.ts";

const STORAGE_KEY = "itred_staff_tasks";

type CreateStaffTaskInput = Omit<
  StaffTask,
  "id" | "status" | "createdAt" | "updatedAt" | "completedAt" | "reviewedAt"
>;

const safeTasks = (tasks: StaffTask[] | null | undefined): StaffTask[] =>
  Array.isArray(tasks) ? tasks : [];

const priorityToSeverity = (
  priority: StaffTask["priority"],
): "info" | "warning" | "high" | "critical" => {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "medium") return "warning";
  return "info";
};

const taskId = () => generateTaskId();

const saveAll = async (tasks: StaffTask[]): Promise<void> => {
  await getStorageAdapter().setItem(STORAGE_KEY, safeTasks(tasks));
};

const notifyTask = async (
  task: StaffTask,
  title: string,
  message: string,
  assignedToStaffId: string,
  statusKey: string,
): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  await notificationService.createNotification({
    title,
    message,
    type: "staff_task",
    priority: task.priority,
    recordType: "staff_task",
    recordId: task.id,
    assignedToStaffId,
    assignedToName:
      assignedToStaffId === task.assignedToStaffId
        ? task.assignedToName
        : task.assignedByName,
    createdByStaffId: task.assignedByStaffId,
    createdByName: task.assignedByName,
    dedupeKey: `staff_task:staff_task:${task.id}:${statusKey}:${today}`,
  });
};

export const taskService = {
  getAll: async (): Promise<StaffTask[]> => {
    try {
      const data = await getStorageAdapter().getItem<StaffTask[]>(STORAGE_KEY);
      return safeTasks(data);
    } catch (error) {
      console.error("Failed to load staff tasks", error);
      return [];
    }
  },

  getById: async (id: string): Promise<StaffTask | undefined> => {
    const all = await taskService.getAll();
    return all.find((task) => task.id === id);
  },

  create: async (task: StaffTask): Promise<void> => {
    const all = await taskService.getAll();
    await saveAll([...all.filter((item) => item.id !== task.id), task]);
  },

  createTask: async (taskData: CreateStaffTaskInput): Promise<StaffTask> => {
    const now = new Date().toISOString();
    const newTask: StaffTask = {
      ...taskData,
      id: taskId(),
      status: "open",
      createdAt: now,
      updatedAt: now,
      notes: taskData.notes || "",
      reviewNotes: taskData.reviewNotes || "",
    };

    await taskService.create(newTask);

    await Promise.allSettled([
      notifyTask(
        newTask,
        "New Staff Task Assigned",
        `${newTask.assignedByName} assigned you: ${newTask.title}`,
        newTask.assignedToStaffId,
        "open",
      ),
      staffAuditService.logAction({
        eventType: "TASK_CREATED",
        module: "staff_tasks",
        severity: priorityToSeverity(newTask.priority),
        action: "Created staff task",
        recordType: "staff_task",
        recordId: newTask.id,
        recordName: newTask.title,
        afterSnapshot: newTask,
      }),
    ]);

    return newTask;
  },

  updateTaskStatus: async (
    id: string,
    status: StaffTaskStatus,
    options?: {
      notes?: string;
      reviewNotes?: string;
      actorStaffId?: string;
      actorName?: string;
    },
  ): Promise<StaffTask | undefined> => {
    const all = await taskService.getAll();
    const index = all.findIndex((task) => task.id === id);
    if (index < 0) return undefined;

    const before = all[index];
    const now = new Date().toISOString();
    const updated: StaffTask = {
      ...before,
      status,
      updatedAt: now,
      notes: options?.notes ?? before.notes ?? "",
      reviewNotes: options?.reviewNotes ?? before.reviewNotes ?? "",
      completedAt:
        status === "completed" ? before.completedAt || now : before.completedAt,
      reviewedAt:
        status === "reviewed" ? before.reviewedAt || now : before.reviewedAt,
    };

    all[index] = updated;
    await saveAll(all);

    const isReviewed = status === "reviewed";
    const isCancelled = status === "cancelled";

    await Promise.allSettled([
      staffAuditService.logAction({
        eventType: isReviewed
          ? "TASK_REVIEWED"
          : isCancelled
            ? "TASK_CANCELLED"
            : "TASK_STATUS_UPDATED",
        module: "staff_tasks",
        severity: priorityToSeverity(updated.priority),
        action: `Updated staff task status to ${status.replace(/_/g, " ")}`,
        recordType: "staff_task",
        recordId: updated.id,
        recordName: updated.title,
        beforeSnapshot: before,
        afterSnapshot: updated,
      }),
      status === "completed"
        ? notifyTask(
            updated,
            "Task Completed for Review",
            `${updated.assignedToName} completed: ${updated.title}`,
            updated.assignedByStaffId,
            "completed",
          )
        : Promise.resolve(),
      isReviewed || isCancelled
        ? notifyTask(
            updated,
            isReviewed ? "Staff Task Reviewed" : "Staff Task Cancelled",
            isReviewed
              ? `${updated.title} has been reviewed.`
              : `${updated.title} has been cancelled.`,
            updated.assignedToStaffId,
            status,
          )
        : Promise.resolve(),
    ]);

    return updated;
  },

  updateStatus: async (id: string, status: StaffTaskStatus): Promise<void> => {
    await taskService.updateTaskStatus(id, status);
  },

  assignTask: async (id: string, staffId: string): Promise<void> => {
    const all = await taskService.getAll();
    const index = all.findIndex((task) => task.id === id);
    if (index >= 0) {
      all[index] = {
        ...all[index],
        assignedToStaffId: staffId,
        updatedAt: new Date().toISOString(),
      };
      await saveAll(all);
    }
  },

  delete: async (id: string): Promise<void> => {
    const all = await taskService.getAll();
    await saveAll(all.filter((task) => task.id !== id));
  },

  getTasksForStaff: async (staffId: string): Promise<StaffTask[]> => {
    const all = await taskService.getAll();
    return all.filter((task) => task.assignedToStaffId === staffId);
  },

  getOverdueTasks: async (): Promise<StaffTask[]> => {
    const all = await taskService.getAll();
    const today = new Date().toISOString().split("T")[0];
    return all.filter(
      (task) =>
        task.dueDate < today &&
        !["completed", "reviewed", "cancelled"].includes(task.status),
    );
  },
};
