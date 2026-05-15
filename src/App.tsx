/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { AppShell } from "./components/AppShell.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { VendorManagement } from "./pages/VendorManagement.tsx";
import { RPNManagement } from "./pages/RPNManagement.tsx";
import { ProductManagement } from "./pages/ProductManagement.tsx";
import { CAHManagement } from "./pages/CAHManagement.tsx";
import { WhatsAppActivityLogs } from "./pages/WhatsAppActivityLogs.tsx";
import { WhatsAppCommunityBI } from "./pages/WhatsAppCommunityBI.tsx";
import { WhatsAppPerformanceReports } from "./pages/WhatsAppPerformanceReports.tsx";
import { PricingPlans } from "./pages/PricingPlans.tsx";
import { SubscriptionManagement } from "./pages/SubscriptionManagement.tsx";
import { SectorCatalogueGenerator } from "./pages/SectorCatalogueGenerator.tsx";
import { VendorStorefrontBuilder } from "./pages/VendorStorefrontBuilder.tsx";
import { Analytics } from "./pages/Analytics.tsx";
import { BIMarket } from "./pages/BIMarket.tsx";
import { ActivityLogs } from "./pages/ActivityLogs.tsx";
import { InventorySpotChecks } from "./pages/InventorySpotChecks.tsx";
import { StaffManagement } from "./pages/StaffManagement.tsx";
import { AdminDashboard } from "./pages/AdminDashboard.tsx";
import { RoleMenuPermissions } from "./pages/RoleMenuPermissions.tsx";
import { StaffAccessLogs } from "./pages/StaffAccessLogs.tsx";
import { SystemSettings } from "./pages/SystemSettings.tsx";
import { RPNPerformanceDashboard } from "./pages/RPNPerformanceDashboard.tsx";
import { ContactHubSettings } from "./pages/ContactHubSettings.tsx";
import WelcomePage from "./pages/WelcomePage.tsx";
import { HowToPage } from "./pages/HowToPage.tsx";
import { ApprovalQueue } from "./pages/ApprovalQueue.tsx";
import { AppRoute, MenuKey, DeskType } from "./types.ts";
import { ErrorBoundary, PrimaryButton } from "./components/CommonUI.tsx";
import { permissionService } from "./services/permissionService.ts";
import { AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { analyticsService } from "./services/analyticsService.ts";
import { settingsService } from "./services/settingsService.ts";
import { staffAuditService } from "./services/staffAuditService.ts";

function RestrictedAccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const sessionStr = localStorage.getItem("activeStaffSession");
    let session: any = {};
    if (sessionStr) {
      try {
        session = JSON.parse(sessionStr);
      } catch (error) {
        console.error("Failed to parse activeStaffSession", error);
      }
    }
    if (session.staffId) {
      analyticsService.logEvent({
        eventType: "ACCESS_DENIED" as any,
        actorType: session.role === "Admin" ? "admin" : "backend_staff",
        actorName: session.staffName || "Unknown",
        actorId: session.staffId,
        result: "failed",
        details: { path: window.location.pathname },
      });
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
        <AlertTriangle size={40} />
      </div>
      <h2 className="text-2xl font-bold uppercase tracking-tight text-brand-charcoal mb-4">
        Access Restricted
      </h2>
      <p className="text-stone-500 max-w-md mb-8">
        You do not have permission to access this desk. Contact SysAdmin if you
        require elevated privileges.
      </p>
      <PrimaryButton onClick={() => navigate("/dashboard")}>
        Return to Dashboard
      </PrimaryButton>
    </div>
  );
}

function AppContent({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Map path to AppRoute enum
  const getActiveRoute = (): AppRoute => {
    const path = location.pathname.split("/")[1] as AppRoute;
    return path || AppRoute.DASHBOARD;
  };

  const activeRoute = getActiveRoute();

  // Title mapping for the AppShell header
  const titles: Record<AppRoute, string> = {
    // These are page titles, not desk names
    [AppRoute.DASHBOARD]: "Dashboard",
    [AppRoute.VENDOR_MGMT]: "Vendor Management",
    [AppRoute.RPN_MGMT]: "RPN Management",
    [AppRoute.PRODUCT_MGMT]: "Product Management",
    [AppRoute.CAH]: "Access Hub",
    [AppRoute.WHATSAPP_ACTIVITY]: "WhatsApp Activity",
    [AppRoute.COMMUNITY_BI]: "Community BI",
    [AppRoute.WHATSAPP_REPORTS]: "WhatsApp Reports",
    [AppRoute.PRICING]: "Pricing",
    [AppRoute.SUBSCRIPTIONS]: "Subscriptions & Collections",
    [AppRoute.CATALOGUE_GEN]: "Create Catalogue",
    [AppRoute.VENDOR_STOREFRONT]: "Create Storefront",
    [AppRoute.ANALYTICS]: "Performance Metrics",
    [AppRoute.BI_MARKET]: "BI Market Analytics",
    [AppRoute.PERFORMANCE_METRICS]: "Performance Metrics",
    [AppRoute.ACTIVITY_LOGS]: "Activity Logs",
    [AppRoute.SPOT_CHECKS]: "Inventory Spot Checks",
    [AppRoute.STAFF_MGMT]: "Staff Management",
    [AppRoute.ADMIN_DASHBOARD]: "Admin Dashboard",
    [AppRoute.ROLE_MENU_PERMISSIONS]: "Role & Menu Permissions",
    [AppRoute.STAFF_ACCESS_LOGS]: "Staff Access Logs",
    [AppRoute.SYSTEM_SETTINGS]: "System Settings",
    [AppRoute.CONTACT_HUB_SETTINGS]: "Catalogue Contact Hub",
    [AppRoute.HOW_TO]: "How To",
    [AppRoute.RPN_PERFORMANCE]: "RPN Performance",
  };

  const checkAccess = (route: string) => {
    const menuKeyMap: Partial<Record<string, MenuKey>> = {
      "vendor-management": "vendorManagement",
      "add-new-vendor": "addNewVendor", // Assuming a separate route for add new vendor
      "rpn-management": "rpnManagement",
      "product-management": "productManagement",
      "commerce-access-hub": "accessHub",
      "whatsapp-activity": "whatsappActivity",
      "whatsapp-community-bi": "whatsappActivity",
      "whatsapp-performance-reports": "whatsappActivity",
      pricing: "pricing",
      subscriptions: "subscriptionsCollections",
      "catalogue-generator": "createCatalogue",
      "vendor-storefront-builder": "createStorefront",
      analytics: "analytics",
      "bi-market": "biMarketAnalytics",
      "activity-logs": "activityLogs",
      "inventory-spot-checks": "inventorySpotChecks",
      "staff-management": "staffManagement",
      "admin-dashboard": "adminDashboard",
      "role-menu-permissions": "roleMenuPermissions",
      "staff-access-logs": "staffAccessLogs",
      "system-settings": "systemSettings",
      "contact-hub-settings": "systemSettings", // Treated as a system setting globally
      "approval-queue": "approvalQueue",
      notifications: "notifications",
      "staff-tasks": "staffTasks",
      "rpn-performance": "rpnPerformance",
      "how-to": "howTo",
      dashboard: "dashboard",
      // Add other specific mappings if routes don't directly match MenuKey
    };
    const key = menuKeyMap[route] || (route as MenuKey);
    return permissionService.hasMenuAccess(key);
  };

  const handleNavigate = (route: AppRoute) => {
    navigate(`/${route}`);
  };

  const sessionStr = localStorage.getItem("activeStaffSession");
  let staffSession: any = {};
  if (sessionStr) {
    try {
      staffSession = JSON.parse(sessionStr);
    } catch (error) {
      console.error("Failed to parse activeStaffSession", error);
    }
  }
  const staffName = staffSession.staffName || "Guest";
  const staffRole = staffSession.role || "Viewer";
  const staffDesk = staffSession.desk || "Viewer Desk";

  return (
    <AppShell
      activeRoute={activeRoute}
      onNavigate={handleNavigate}
      title={titles[activeRoute] || "iTred Operating System"}
      staffName={staffName}
      staffRole={staffRole}
      staffDesk={staffDesk}
      onLogout={onLogout}
    >
      <Routes>
        <Route
          path="/"
          element={
            checkAccess("dashboard") ? <Dashboard /> : <RestrictedAccess />
          }
        />
        <Route
          path="/dashboard"
          element={
            checkAccess("dashboard") ? <Dashboard /> : <RestrictedAccess />
          }
        />
        <Route
          path="/vendor-management"
          element={
            checkAccess("vendor-management") ? (
              <VendorManagement />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/rpn-management"
          element={
            checkAccess("rpn-management") ? (
              <RPNManagement />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/product-management"
          element={
            checkAccess("product-management") ? (
              <ProductManagement />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/commerce-access-hub"
          element={
            checkAccess("commerce-access-hub") ? (
              <CAHManagement />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/whatsapp-activity"
          element={
            checkAccess("whatsapp-activity") ? (
              <WhatsAppActivityLogs />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/whatsapp-community-bi"
          element={
            checkAccess("whatsapp-community-bi") ? (
              <WhatsAppCommunityBI />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/whatsapp-performance-reports"
          element={
            checkAccess("whatsapp-performance-reports") ? (
              <WhatsAppPerformanceReports />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/pricing"
          element={
            checkAccess("pricing") ? <PricingPlans /> : <RestrictedAccess />
          }
        />
        <Route
          path="/subscriptions"
          element={
            checkAccess("itred_subscriptions") ? (
              <SubscriptionManagement />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/catalogue-generator"
          element={
            checkAccess("catalogue-generator") ? (
              <SectorCatalogueGenerator />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/vendor-storefront-builder"
          element={
            checkAccess("vendor-storefront-builder") ? (
              <VendorStorefrontBuilder />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/analytics"
          element={
            checkAccess("analytics") ? <Analytics /> : <RestrictedAccess />
          }
        />
        <Route
          path="/bi-market"
          element={
            checkAccess("bi-market") ? <BIMarket /> : <RestrictedAccess />
          }
        />
        <Route
          path="/activity-logs"
          element={
            checkAccess("activity-logs") ? (
              <ActivityLogs />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/inventory-spot-checks"
          element={
            checkAccess("inventory-spot-checks") ? (
              <InventorySpotChecks />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route path="/staff-management" element={<StaffManagement />} />
        <Route
          path="/admin-dashboard"
          element={
            checkAccess("admin-dashboard") ? (
              <AdminDashboard onNavigate={handleNavigate} />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/role-menu-permissions"
          element={
            checkAccess("role-menu-permissions") ? (
              <RoleMenuPermissions />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/staff-access-logs"
          element={
            checkAccess("staff-access-logs") ? (
              <StaffAccessLogs />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/system-settings"
          element={
            checkAccess("system-settings") ? (
              <SystemSettings />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/contact-hub-settings"
          element={
            checkAccess("contact-hub-settings") ? (
              <ContactHubSettings />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/approval-queue"
          element={
            checkAccess("approval-queue") ? (
              <ApprovalQueue />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/notifications"
          element={
            checkAccess("notifications") ? (
              <AdminDashboard onNavigate={handleNavigate} />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/staff-tasks"
          element={
            checkAccess("staff-tasks") ? (
              <AdminDashboard onNavigate={handleNavigate} />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/rpn-performance"
          element={
            checkAccess("rpn-performance") ? (
              <RPNPerformanceDashboard />
            ) : (
              <RestrictedAccess />
            )
          }
        />
        <Route
          path="/how-to"
          element={checkAccess("how-to") ? <HowToPage /> : <RestrictedAccess />}
        />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [timeoutSettings, setTimeoutSettings] = useState({
    enabled: true,
    minutes: 30,
  });
  const lastActivity = useRef<number>(Date.now());

  useEffect(() => {
    const storedSession = localStorage.getItem("activeStaffSession");
    if (storedSession) {
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    settingsService.getSettings().then((s) => {
      setTimeoutSettings({
        enabled: s.enableSessionTimeout ?? true,
        minutes: s.sessionTimeoutMinutes ?? 30,
      });
    });
  }, [isLoggedIn]);

  const handleLogout = useCallback((msg?: string) => {
    localStorage.removeItem("activeStaffSession");
    setIsLoggedIn(false);
    setShowWarning(false);
    if (typeof msg === "string") {
      setLogoutMessage(msg);
    } else {
      setLogoutMessage(null);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !timeoutSettings.enabled) return;

    const resetTimer = () => {
      lastActivity.current = Date.now();
      setShowWarning((prev) => (prev ? false : prev));
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) =>
      window.addEventListener(e, resetTimer, { passive: true }),
    );

    const interval = setInterval(() => {
      const idleTime = Date.now() - lastActivity.current;
      const timeoutMs = timeoutSettings.minutes * 60 * 1000;
      const warningTimeMs = Math.max(timeoutMs - 2 * 60 * 1000, 0);

      if (idleTime >= timeoutMs) {
        void staffAuditService.logAction({
          eventType: "LOGOUT",
          module: "auth",
          severity: "warning",
          action: "Session timed out due to inactivity",
        });
        handleLogout(
          "Your session expired due to inactivity. Please log in again.",
        );
      } else if (idleTime >= warningTimeMs) {
        setShowWarning((prev) => (!prev ? true : prev));
      }
    }, 10000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
    };
  }, [isLoggedIn, timeoutSettings, handleLogout]);

  const handleLoginSuccess = () => {
    lastActivity.current = Date.now();
    setIsLoggedIn(true);
    setLogoutMessage(null);
  };

  return (
    <BrowserRouter>
      <ErrorBoundary>
        {!isLoggedIn ? (
          <WelcomePage
            onLoginSuccess={handleLoginSuccess}
            sessionMessage={logoutMessage}
          />
        ) : (
          <>
            <AppContent onLogout={() => handleLogout()} />
            {showWarning && (
              <div className="fixed inset-0 z-[9999] bg-brand-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white p-8 max-w-md w-full border-t-4 border-brand-orange shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
                  <AlertTriangle size={48} className="text-brand-orange mb-4" />
                  <h2 className="text-xl font-bold uppercase text-brand-charcoal mb-2">
                    Session Expiring
                  </h2>
                  <p className="text-sm text-stone-600 mb-8 font-medium">
                    Your session will expire soon due to inactivity.
                  </p>
                  <div className="flex gap-4 w-full">
                    <button
                      onClick={() => {
                        lastActivity.current = Date.now();
                        setShowWarning(false);
                      }}
                      className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 text-xs font-bold uppercase transition-colors"
                    >
                      Stay Logged In
                    </button>
                    <button
                      onClick={() => handleLogout()}
                      className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white py-3 text-xs font-bold uppercase transition-colors"
                    >
                      Logout Now
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </ErrorBoundary>
    </BrowserRouter>
  );
}
