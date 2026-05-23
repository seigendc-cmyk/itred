/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  MessageSquare,
  Send,
  Shield,
  Users,
  X,
} from "lucide-react";
import {
  Staff,
  StaffChatGroup,
  StaffChatMonitorSummary,
  StaffMessage,
  StaffMessagePriority,
  StaffMessageType,
} from "../types.ts";
import { staffService } from "../services/staffService.ts";
import { staffChatService } from "../services/staffChatService.ts";
import { permissionService } from "../services/permissionService.ts";

type TabKey = "direct" | "groups" | "tasks" | "alerts";

const priorityClass = (priority: StaffMessagePriority) => {
  if (priority === "critical") return "bg-red-700 text-white";
  if (priority === "high") return "bg-brand-orange text-white";
  return "bg-stone-100 text-stone-600";
};

const getSessionStaffId = () => {
  try {
    const raw = localStorage.getItem("activeStaffSession");
    const session = raw ? JSON.parse(raw) : {};
    return session.staffId || session.id || "";
  } catch {
    return "";
  }
};

const messageMatchesTab = (message: StaffMessage, tab: TabKey) => {
  if (tab === "direct") return message.messageType === "direct";
  if (tab === "groups") return message.messageType === "group";
  if (tab === "tasks") return message.messageType === "task";
  return message.messageType === "alert" || message.priority === "critical";
};

export const StaffMessengerWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("direct");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [groups, setGroups] = useState<StaffChatGroup[]>([]);
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [monitor, setMonitor] = useState<StaffChatMonitorSummary | null>(null);
  const [toStaffId, setToStaffId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<StaffMessagePriority>("normal");
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [popup, setPopup] = useState<StaffMessage | null>(null);
  const [lastUnreadCount, setLastUnreadCount] = useState(0);

  const canView = permissionService.canViewStaffChat();
  const canSendDirect = permissionService.canSendDirectStaffChat();
  const canSendGroup = permissionService.canSendGroupStaffChat();
  const canAssignTask = permissionService.canAssignStaffChatTask();
  const canMonitor = permissionService.canMonitorStaffChat();
  const canDelete = permissionService.canDeleteStaffChatMessage();

  const loadData = async () => {
    if (!canView) return;
    const [allStaff, chatGroups] = await Promise.all([
      staffService.getAllStaff(),
      staffChatService.getGroups(),
    ]);
    const currentId = getSessionStaffId();
    const current =
      allStaff.find((member) => member.id === currentId) ||
      allStaff.find((member) => member.staffCode === currentId) ||
      null;
    setStaff(allStaff.filter((member) => member.status === "active"));
    setCurrentStaff(current);
    setGroups(chatGroups.filter((group) => group.isActive));
    if (current) {
      const visible = await staffChatService.getVisibleMessages(current, 60);
      const unread = visible.filter(
        (item) =>
          item.fromStaffId !== current.id &&
          !(item.readBy || []).includes(current.id),
      );
      setMessages(visible);
      if (!isOpen && unread.length > lastUnreadCount && unread[0]) {
        setPopup(unread[0]);
        window.setTimeout(() => setPopup(null), 6500);
      }
      setLastUnreadCount(unread.length);
    }
    if (canMonitor) {
      setMonitor(await staffChatService.getMonitorSummary());
    }
  };

  useEffect(() => {
    void loadData();
    const handleUpdate = () => void loadData();
    window.addEventListener("itred_staff_chat_updated", handleUpdate);
    window.addEventListener("itred_notifications_updated", handleUpdate);
    const interval = window.setInterval(handleUpdate, 30_000);
    return () => {
      window.removeEventListener("itred_staff_chat_updated", handleUpdate);
      window.removeEventListener("itred_notifications_updated", handleUpdate);
      window.clearInterval(interval);
    };
  }, [canView, isOpen, lastUnreadCount]);

  useEffect(() => {
    if (isOpen && currentStaff) {
      void staffChatService.markVisibleRead(currentStaff).then(loadData);
    }
  }, [isOpen, currentStaff?.id]);

  const unreadCount = useMemo(
    () =>
      messages.filter(
        (item) =>
          currentStaff &&
          item.fromStaffId !== currentStaff.id &&
          !(item.readBy || []).includes(currentStaff.id),
      ).length,
    [currentStaff, messages],
  );

  const tabMessages = messages.filter((item) => messageMatchesTab(item, activeTab));
  const selectedStaff = staff.find((member) => member.id === toStaffId);
  const selectedGroup = groups.find((group) => group.id === groupId);

  const handleSend = async () => {
    if (!currentStaff || !message.trim()) return;
    const messageType: StaffMessageType =
      activeTab === "tasks" ? "task" : activeTab === "alerts" ? "alert" : activeTab === "groups" ? "group" : "direct";
    if (messageType === "direct" && (!selectedStaff || !canSendDirect)) return;
    if (messageType === "group" && (!selectedGroup || !canSendGroup)) return;
    if (messageType === "task" && (!selectedStaff || !canAssignTask)) return;

    await staffChatService.sendMessage({
      messageType,
      fromStaff: currentStaff,
      toStaff: selectedStaff,
      group: messageType === "group" || messageType === "alert" ? selectedGroup : undefined,
      message,
      priority: messageType === "alert" && priority === "normal" ? "high" : priority,
      taskTitle: taskTitle || message.slice(0, 80),
      taskDescription: message,
      dueDate,
      relatedModule: "staff_chat",
    });
    setMessage("");
    setTaskTitle("");
    await loadData();
  };

  if (!canView || !currentStaff) return null;

  return (
    <>
      {popup && (
        <div className="fixed bottom-24 right-4 z-[70] w-[calc(100vw-2rem)] max-w-sm border border-brand-orange bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-stone-200 bg-brand-charcoal px-3 py-2 text-white">
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Staff Message
            </span>
            <button onClick={() => setPopup(null)} aria-label="Dismiss message">
              <X size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setPopup(null);
            }}
            className="block w-full p-3 text-left"
          >
            <p className="text-[10px] font-bold uppercase text-brand-orange">
              {popup.fromStaffName}
            </p>
            <p className="mt-1 text-xs text-brand-charcoal line-clamp-2">
              {popup.message}
            </p>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-[65] h-12 w-12 border border-brand-charcoal bg-brand-charcoal text-white shadow-2xl hover:bg-brand-orange hover:border-brand-orange flex items-center justify-center"
        title="Staff Messenger"
        aria-label="Staff Messenger"
      >
        <MessageSquare size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center bg-brand-orange px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-4 z-[65] flex h-[72vh] max-h-[640px] w-[calc(100vw-2rem)] max-w-md flex-col border border-stone-300 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-stone-200 bg-brand-charcoal px-4 py-3 text-white">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">
                Staff Messenger
              </p>
              <p className="text-[10px] text-white/60">
                {currentStaff.fullName} / {currentStaff.desk}
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Close messenger">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-4 border-b border-stone-200">
            {[
              ["direct", MessageSquare, "Direct"],
              ["groups", Users, "Groups"],
              ["tasks", CheckSquare, "Tasks"],
              ["alerts", AlertTriangle, "Alerts"],
            ].map(([key, Icon, label]) => (
              <button
                key={key as string}
                type="button"
                onClick={() => setActiveTab(key as TabKey)}
                className={`flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-bold uppercase ${
                  activeTab === key
                    ? "bg-orange-50 text-brand-orange"
                    : "text-stone-500 hover:bg-stone-50"
                }`}
              >
                {React.createElement(Icon as React.ElementType, { size: 13 })}
                <span className="hidden sm:inline">{label as string}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-stone-50">
            {tabMessages.length === 0 ? (
              <div className="border border-dashed border-stone-200 bg-white p-6 text-center text-xs font-bold uppercase text-stone-400">
                No messages in this tab.
              </div>
            ) : (
              tabMessages.map((item) => (
                <div key={item.id} className="border border-stone-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold uppercase text-brand-charcoal">
                        {item.fromStaffName}
                        {item.toStaffName ? ` -> ${item.toStaffName}` : ""}
                        {item.groupName ? ` -> ${item.groupName}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-stone-700">{item.message}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 text-[9px] font-bold uppercase ${priorityClass(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] uppercase text-stone-400">
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    {canDelete && (
                      <button
                        type="button"
                        className="font-bold text-red-500"
                        onClick={() => void staffChatService.deleteMessage(item.id).then(loadData)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {activeTab === "alerts" && canMonitor && monitor && (
              <div className="border border-stone-200 bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-brand-charcoal">
                  <Shield size={13} className="text-brand-orange" /> Monitoring
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] uppercase text-stone-600">
                  <div className="bg-stone-50 p-2">Unread staff: {monitor.unreadByStaff.length}</div>
                  <div className="bg-stone-50 p-2">Overdue tasks: {monitor.overdueTaskMessages.length}</div>
                  <div className="bg-stone-50 p-2">Critical: {monitor.unresolvedCriticalMessages.length}</div>
                  <div className="bg-stone-50 p-2">Activity rows: {monitor.activity.length}</div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-stone-200 bg-white p-3 space-y-2">
            {(activeTab === "direct" || activeTab === "tasks") && (
              <select
                value={toStaffId}
                onChange={(event) => setToStaffId(event.target.value)}
                className="w-full border border-stone-200 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange"
              >
                <option value="">Select staff member...</option>
                {staff
                  .filter((member) => member.id !== currentStaff.id)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} / {member.role} / {member.desk}
                    </option>
                  ))}
              </select>
            )}
            {(activeTab === "groups" || activeTab === "alerts") && (
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="w-full border border-stone-200 p-2 text-xs font-bold uppercase outline-none focus:border-brand-orange"
              >
                <option value="">Select group / desk...</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.groupName}
                  </option>
                ))}
              </select>
            )}
            {activeTab === "tasks" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Task title"
                  className="border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange"
                />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange"
                />
              </div>
            )}
            <div className="flex gap-2">
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as StaffMessagePriority)}
                className="w-28 border border-stone-200 p-2 text-[10px] font-bold uppercase outline-none focus:border-brand-orange"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write staff message..."
                className="min-h-10 flex-1 resize-none border border-stone-200 p-2 text-xs outline-none focus:border-brand-orange"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!message.trim()}
                className="w-10 border border-brand-orange bg-brand-orange text-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Send staff message"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
