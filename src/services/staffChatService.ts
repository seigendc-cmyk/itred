/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Staff,
  StaffChatGroup,
  StaffChatMonitorSummary,
  StaffMessage,
  StaffMessagePriority,
  StaffMessageType,
  StaffTask,
} from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { staffService } from "./staffService.ts";
import { notificationService } from "./notificationService.ts";
import { staffAuditService } from "./staffAuditService.ts";
import { taskService } from "./taskService.ts";

const MESSAGES_KEY = "itred_staff_messages";
const GROUPS_KEY = "itred_staff_chat_groups";

const DEFAULT_GROUPS: StaffChatGroup[] = [
  { id: "desk-sysadmin", groupName: "SysAdmin Desk", targetDesk: "SysAdmin Desk", isActive: true },
  { id: "desk-backoffice", groupName: "Backoffice Desk", targetDesk: "Backoffice Desk", isActive: true },
  { id: "desk-product-data", groupName: "Product Data Desk", targetDesk: "Product Data Desk", isActive: true },
  { id: "desk-catalogue", groupName: "Catalogue Deployment Desk", targetDesk: "Catalogue Deployment Desk", isActive: true },
  { id: "desk-rpn", groupName: "RPN Management Desk", targetDesk: "RPN Management Desk", isActive: true },
  { id: "desk-cah", groupName: "CAH Operations Desk", targetDesk: "CAH Operations Desk", isActive: true },
  { id: "desk-collections", groupName: "Collections Desk", targetDesk: "Collections Desk", isActive: true },
].map((group) => ({
  ...group,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const safeMessages = (messages: StaffMessage[] | null | undefined) =>
  Array.isArray(messages) ? messages : [];

const safeGroups = (groups: StaffChatGroup[] | null | undefined) =>
  Array.isArray(groups) ? groups : [];

const priorityToNotification = (
  priority: StaffMessagePriority,
): "low" | "medium" | "high" | "critical" => {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  return "medium";
};

const priorityToTask = (
  priority: StaffMessagePriority,
): StaffTask["priority"] => {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  return "medium";
};

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getStaffName = (staff: Staff) =>
  staff.fullName || staff.displayName || staff.staffCode || staff.id;

const threadForDirect = (a: string, b: string) =>
  `direct-${[a, b].sort().join("-")}`;

const threadForGroup = (groupId: string) => `group-${groupId}`;

const saveMessages = async (messages: StaffMessage[]) => {
  await getStorageAdapter().setItem(MESSAGES_KEY, messages);
  window.dispatchEvent(new Event("itred_staff_chat_updated"));
};

const notifyRecipients = async (
  message: StaffMessage,
  recipients: Staff[],
) => {
  await Promise.allSettled(
    recipients
      .filter((staff) => staff.id !== message.fromStaffId)
      .map((staff) =>
        notificationService.createNotification({
          title:
            message.messageType === "task"
              ? "Task Assigned via Staff Chat"
              : message.messageType === "alert"
                ? "Staff Alert"
                : "New Staff Message",
          message:
            message.messageType === "task"
              ? `${message.fromStaffName}: ${message.taskTitle || message.message}`
              : `${message.fromStaffName}: ${message.message}`,
          type: message.messageType === "task" ? "staff_task" : "system_alert",
          priority: priorityToNotification(message.priority),
          assignedToStaffId: staff.id,
          assignedToName: getStaffName(staff),
          createdByStaffId: message.fromStaffId,
          createdByName: message.fromStaffName,
          recordType: "staff_message",
          recordId: message.id,
          dedupeKey: `staff_message:${message.id}:${staff.id}`,
        }),
      ),
  );
};

export const staffChatService = {
  getGroups: async (): Promise<StaffChatGroup[]> => {
    const data = safeGroups(
      await getStorageAdapter().getItem<StaffChatGroup[]>(GROUPS_KEY),
    );
    if (data.length > 0) return data;
    await getStorageAdapter().setItem(GROUPS_KEY, DEFAULT_GROUPS);
    return DEFAULT_GROUPS;
  },

  getAllMessages: async (): Promise<StaffMessage[]> => {
    return safeMessages(
      await getStorageAdapter().getItem<StaffMessage[]>(MESSAGES_KEY),
    );
  },

  getVisibleMessages: async (staff: Staff, limit = 30): Promise<StaffMessage[]> => {
    const groups = await staffChatService.getGroups();
    const all = await staffChatService.getAllMessages();
    const groupIds = groups
      .filter((group) => {
        if (!group.isActive) return false;
        if (group.memberStaffIds?.includes(staff.id)) return true;
        if (group.targetDesk && group.targetDesk === staff.desk) return true;
        if (group.targetRole && group.targetRole === staff.role) return true;
        return false;
      })
      .map((group) => group.id);

    return all
      .filter((message) => {
        if (message.fromStaffId === staff.id) return true;
        if (message.toStaffId === staff.id) return true;
        if (message.groupId && groupIds.includes(message.groupId)) return true;
        if (message.targetDesk && message.targetDesk === staff.desk) return true;
        if (message.targetRole && message.targetRole === staff.role) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  },

  getUnreadCount: async (staff: Staff): Promise<number> => {
    const messages = await staffChatService.getVisibleMessages(staff, 200);
    return messages.filter(
      (message) =>
        message.fromStaffId !== staff.id &&
        !(message.readBy || []).includes(staff.id),
    ).length;
  },

  sendMessage: async (input: {
    messageType: StaffMessageType;
    fromStaff: Staff;
    toStaff?: Staff;
    group?: StaffChatGroup;
    message: string;
    priority: StaffMessagePriority;
    relatedModule?: string;
    relatedRecordId?: string;
    taskTitle?: string;
    taskDescription?: string;
    dueDate?: string;
  }): Promise<StaffMessage> => {
    const now = new Date().toISOString();
    let taskId: string | undefined;

    if (input.messageType === "task" && input.toStaff) {
      const task = await taskService.createTask({
        title: input.taskTitle || input.message.slice(0, 80),
        description: input.taskDescription || input.message,
        assignedToStaffId: input.toStaff.id,
        assignedToName: getStaffName(input.toStaff),
        assignedByStaffId: input.fromStaff.id,
        assignedByName: getStaffName(input.fromStaff),
        module: input.relatedModule || "Staff Chat",
        priority: priorityToTask(input.priority),
        dueDate: input.dueDate || new Date().toISOString().split("T")[0],
        relatedRecordType: input.relatedModule || "staff_chat",
        relatedRecordId: input.relatedRecordId,
        taskType: "customer_feedback_followup",
      });
      taskId = task.id;
    }

    const message: StaffMessage = {
      id: makeId("msg"),
      threadId: input.group
        ? threadForGroup(input.group.id)
        : threadForDirect(input.fromStaff.id, input.toStaff?.id || "unknown"),
      messageType: input.messageType,
      fromStaffId: input.fromStaff.id,
      fromStaffName: getStaffName(input.fromStaff),
      toStaffId: input.toStaff?.id,
      toStaffName: input.toStaff ? getStaffName(input.toStaff) : undefined,
      groupId: input.group?.id,
      groupName: input.group?.groupName,
      targetDesk: input.group?.targetDesk,
      targetRole: input.group?.targetRole,
      message: input.message.trim(),
      priority: input.priority,
      relatedModule: input.relatedModule,
      relatedRecordId: input.relatedRecordId,
      taskId,
      taskTitle: input.taskTitle,
      taskDescription: input.taskDescription,
      assignedToStaffId: input.toStaff?.id,
      dueDate: input.dueDate,
      taskStatus: input.messageType === "task" ? "pending" : undefined,
      readBy: [input.fromStaff.id],
      createdAt: now,
      updatedAt: now,
    };

    const all = await staffChatService.getAllMessages();
    await saveMessages([message, ...all].slice(0, 500));

    const allStaff = await staffService.getAllStaff();
    const recipients = input.group
      ? allStaff.filter((staff) => {
          if (input.group?.memberStaffIds?.includes(staff.id)) return true;
          if (input.group?.targetDesk && input.group.targetDesk === staff.desk) return true;
          if (input.group?.targetRole && input.group.targetRole === staff.role) return true;
          return false;
        })
      : input.toStaff
        ? [input.toStaff]
        : [];

    await notifyRecipients(message, recipients);

    void staffAuditService.logAction({
      eventType:
        input.messageType === "task"
          ? "TASK_CREATED"
          : input.messageType === "group"
            ? "RECORD_CREATED"
            : input.messageType === "alert"
              ? "NOTIFICATION_CREATED"
              : "RECORD_CREATED",
      module: "staff_chat",
      severity: input.priority === "critical" ? "critical" : input.priority === "high" ? "high" : "info",
      action:
        input.messageType === "task"
          ? "Task assigned through chat"
          : input.messageType === "group"
            ? "Group message sent"
            : input.messageType === "alert"
              ? "Critical alert sent"
              : "Direct message sent",
      recordType: "staff_message",
      recordId: message.id,
      recordName: message.threadId,
      afterSnapshot: message,
    });

    return message;
  },

  markVisibleRead: async (staff: Staff): Promise<void> => {
    const visible = await staffChatService.getVisibleMessages(staff, 200);
    const visibleIds = new Set(visible.map((message) => message.id));
    const all = await staffChatService.getAllMessages();
    const now = new Date().toISOString();
    const next = all.map((message) =>
      visibleIds.has(message.id) && message.fromStaffId !== staff.id
        ? {
            ...message,
            readBy: Array.from(new Set([...(message.readBy || []), staff.id])),
            readAt: message.readAt || now,
            updatedAt: now,
          }
        : message,
    );
    await saveMessages(next);
  },

  deleteMessage: async (id: string): Promise<void> => {
    const all = await staffChatService.getAllMessages();
    const deleted = all.find((message) => message.id === id);
    await saveMessages(all.filter((message) => message.id !== id));
    if (deleted) {
      void staffAuditService.logAction({
        eventType: "RECORD_DELETED",
        module: "staff_chat",
        severity: "high",
        action: "Deleted staff chat message",
        recordType: "staff_message",
        recordId: id,
        beforeSnapshot: deleted,
      });
    }
  },

  getMonitorSummary: async (): Promise<StaffChatMonitorSummary> => {
    const [messages, staff] = await Promise.all([
      staffChatService.getAllMessages(),
      staffService.getAllStaff(),
    ]);
    const unreadByStaff = staff.map((member) => {
      const unreadCount = messages.filter(
        (message) =>
          message.fromStaffId !== member.id &&
          (message.toStaffId === member.id ||
            message.targetDesk === member.desk ||
            message.targetRole === member.role) &&
          !(message.readBy || []).includes(member.id),
      ).length;
      return { staffId: member.id, staffName: getStaffName(member), unreadCount };
    }).filter((row) => row.unreadCount > 0);

    const now = Date.now();
    const responseDelays = unreadByStaff.map((row) => {
      const unread = messages
        .filter((message) => message.toStaffId === row.staffId && !(message.readBy || []).includes(row.staffId))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      return {
        staffId: row.staffId,
        staffName: row.staffName,
        oldestUnreadAt: unread?.createdAt || "",
        hoursWaiting: unread ? Math.round((now - new Date(unread.createdAt).getTime()) / 360_000) / 10 : 0,
      };
    });

    const activity = staff.map((member) => ({
      staffId: member.id,
      staffName: getStaffName(member),
      sentCount: messages.filter((message) => message.fromStaffId === member.id).length,
      receivedUnreadCount:
        unreadByStaff.find((row) => row.staffId === member.id)?.unreadCount || 0,
    }));

    return {
      unreadByStaff,
      overdueTaskMessages: messages.filter(
        (message) =>
          message.messageType === "task" &&
          !!message.dueDate &&
          message.dueDate < new Date().toISOString().split("T")[0] &&
          message.taskStatus !== "completed",
      ),
      unresolvedCriticalMessages: messages.filter(
        (message) =>
          message.priority === "critical" &&
          message.fromStaffId !== message.toStaffId &&
          (!message.toStaffId || !(message.readBy || []).includes(message.toStaffId)),
      ),
      responseDelays,
      activity,
    };
  },
};
