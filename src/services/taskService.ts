/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffTask, StaffTaskStatus } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { notificationService } from "./notificationService.ts";

const STORAGE_KEY = "itred_staff_tasks";

export const taskService = {
  getAll: async (): Promise<StaffTask[]> => {
    const data = await getStorageAdapter().getItem<StaffTask[]>(STORAGE_KEY);
    return data || [];
  },

  getById: async (id: string): Promise<StaffTask | undefined> => {
    const all = await taskService.getAll();
    return all.find((t) => t.id === id);
  },

  create: async (task: StaffTask): Promise<void> => {
    const all = await taskService.getAll();
    all.push(task);
    await getStorageAdapter().setItem(STORAGE_KEY, all);
  },

  updateStatus: async (id: string, status: StaffTaskStatus): Promise<void> => {
    const all = await taskService.getAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx >= 0) {
      all[idx].status = status;
      if (status === "completed")
        all[idx].completedAt = new Date().toISOString();
      await getStorageAdapter().setItem(STORAGE_KEY, all);
    }
  },

  delete: async (id: string): Promise<void> => {
    const all = await taskService.getAll();
    await getStorageAdapter().setItem(
      STORAGE_KEY,
      all.filter((t) => t.id !== id),
    );
  },

  createTask: async (
    taskData: Omit<StaffTask, "id" | "status" | "createdAt">,
  ): Promise<void> => {
    const newTask: StaffTask = {
      ...taskData,
      id: `TSK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    await taskService.create(newTask);

    await notificationService.createNotification({
      title: "New Task Assigned",
      message: `You have been assigned a new task: ${newTask.title}`,
      type: "task_due",
      priority: newTask.priority,
      recordType: "task",
      recordId: newTask.id,
      assignedToStaffId: newTask.assignedToStaffId,
    });
  },

  assignTask: async (id: string, staffId: string): Promise<void> => {
    const all = await taskService.getAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx >= 0) {
      all[idx].assignedToStaffId = staffId;
      await getStorageAdapter().setItem(STORAGE_KEY, all);
    }
  },

  updateTaskStatus: async (
    id: string,
    status: StaffTaskStatus,
  ): Promise<void> => {
    await taskService.updateStatus(id, status);
  },

  getTasksForStaff: async (staffId: string): Promise<StaffTask[]> => {
    const all = await taskService.getAll();
    return all.filter((t) => t.assignedToStaffId === staffId);
  },

  getOverdueTasks: async (): Promise<StaffTask[]> => {
    const all = await taskService.getAll();
    const now = new Date().toISOString();
    return all.filter(
      (t) =>
        t.dueAt &&
        t.dueAt < now &&
        t.status !== "completed" &&
        t.status !== "cancelled",
    );
  },
};
