/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  PageHeader,
  DataPanel,
  PrimaryButton,
} from "../components/CommonUI.tsx";
import {
  Users,
  Shield,
  History,
  Settings,
  Key,
  UserCheck,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { AppRoute } from "../types.ts";

interface AdminDashboardProps {
  onNavigate: (route: AppRoute) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigate,
}) => {
  const adminCards = [
    {
      title: "Staff Management",
      description: "Manage staff accounts, roles, and permissions",
      icon: Users,
      route: AppRoute.STAFF_MGMT,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Role & Menu Permissions",
      description: "Configure role-based access and menu permissions",
      icon: Shield,
      route: AppRoute.ROLE_MENU_PERMISSIONS,
      color: "bg-purple-50 text-purple-600",
    },
    {
      title: "Staff Access Logs",
      description: "View and monitor staff login activities",
      icon: History,
      route: AppRoute.STAFF_ACCESS_LOGS,
      color: "bg-green-50 text-green-600",
    },
    {
      title: "System Settings",
      description: "Configure system-wide settings and preferences",
      icon: Settings,
      route: AppRoute.SYSTEM_SETTINGS,
      color: "bg-orange-50 text-orange-600",
    },
    {
      title: "Passcode Overrides",
      description: "Manage emergency passcode reset capabilities",
      icon: Key,
      route: null,
      color: "bg-red-50 text-red-600",
    },
    {
      title: "Active Staff Sessions",
      description: "Monitor currently logged-in staff members",
      icon: UserCheck,
      route: null,
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "Locked Staff Accounts",
      description: "Review and unlock suspended staff accounts",
      icon: Lock,
      route: null,
      color: "bg-yellow-50 text-yellow-600",
    },
    {
      title: "Recent Security Events",
      description: "View recent security incidents and alerts",
      icon: AlertTriangle,
      route: null,
      color: "bg-pink-50 text-pink-600",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="System administration and security management"
      />

      <DataPanel title="Administration Tools">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {adminCards.map((card, index) => (
            <div
              key={index}
              className="bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-stone-800 mb-1">
                    {card.title}
                  </h3>
                  <p className="text-sm text-stone-600 mb-3">
                    {card.description}
                  </p>
                  {card.route && (
                    <PrimaryButton
                      onClick={() => onNavigate(card.route!)}
                      className="text-xs px-3 py-1"
                    >
                      Access
                    </PrimaryButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
};
