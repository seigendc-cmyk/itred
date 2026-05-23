import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Shield,
  UserCheck,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "../components/CommonUI.tsx";
import { staffService } from "../services/staffService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { Staff } from "../types.ts";

interface WelcomePageProps {
  googleEmail?: string;
  onLoginSuccess: (session: any) => void;
  sessionMessage?: string | null;
}

const WelcomePage: React.FC<WelcomePageProps> = ({
  googleEmail = "seiGEN Commerce",
  onLoginSuccess,
  sessionMessage,
}) => {
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [passcode, setPasscode] = useState<string>("");
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSetupMode, setIsSetupMode] = useState<boolean>(false);

  const [setupFullName, setSetupFullName] = useState<string>("");
  const [setupDisplayName, setSetupDisplayName] = useState<string>("");
  const [setupEmail, setSetupEmail] = useState<string>("");
  const [setupPasscode, setSetupPasscode] = useState<string>("");
  const [setupConfirmPasscode, setSetupConfirmPasscode] = useState<string>("");
  const [setupShowPass, setSetupShowPass] = useState<boolean>(false);

  const refreshStaff = async () => {
    try {
      const firebaseStaff = await staffService.loadStaffFromFirebase();
      const safeStaff = Array.isArray(firebaseStaff) ? firebaseStaff : [];
      setAllStaff(safeStaff);
      setIsSetupMode(safeStaff.length === 0);
      return safeStaff;
    } catch (error) {
      console.error("Failed to load staff from Firebase", error);
      const localStaff = staffService.getAllStaff();
      const safeLocalStaff = Array.isArray(localStaff) ? localStaff : [];
      setAllStaff(safeLocalStaff);
      setIsSetupMode(safeLocalStaff.length === 0);
      return safeLocalStaff;
    }
  };

  useEffect(() => {
    void refreshStaff();
  }, []);

  const selectedStaff = allStaff.find((staff) => staff.id === selectedStaffId);

  const handleLogin = async () => {
    setLoginError(null);

    if (!selectedStaffId) {
      setLoginError("Please select your name.");
      return;
    }

    let staffToLogin = allStaff.find((staff) => staff.id === selectedStaffId);

    if (!staffToLogin) {
      const latestStaff = await refreshStaff();
      staffToLogin = latestStaff.find((staff) => staff.id === selectedStaffId);

      if (!staffToLogin) {
        setLoginError(
          "Selected staff profile was not found. Refresh and try again.",
        );
        return;
      }
    }

    if (staffToLogin.status !== "active") {
      setLoginError(
        "This staff account is not active. Contact SysAdmin.",
      );
      try {
        analyticsService.logEvent({
          eventType: "STAFF_LOGIN_BLOCKED_INACTIVE",
          actorType: "system",
          actorName: "Login System",
          result: "blocked",
          details: {
            staffId: staffToLogin.id,
            staffName: staffToLogin.fullName,
            reason: staffToLogin.status,
          },
        });
      } catch (err) {}
      return;
    }

    if (staffToLogin.isLocked) {
      setLoginError(
        "This account is locked due to too many failed attempts. Contact SysAdmin.",
      );
      try {
        analyticsService.logEvent({
          eventType: "STAFF_LOGIN_BLOCKED_LOCKED",
          actorType: "system",
          actorName: "Login System",
          result: "locked",
          details: {
            staffId: staffToLogin.id,
            staffName: staffToLogin.fullName,
            reason: "locked",
          },
        });
      } catch (err) {}
      return;
    }

    if (passcode.length !== 6) {
      setLoginError("Passcode must be exactly 6 digits.");
      return;
    }

    try {
      if (passcode === staffToLogin.passcode) {
        const session = {
          staffId: staffToLogin.id,
          staffCode: staffToLogin.staffCode,
          staffName: staffToLogin.fullName,
          displayName: staffToLogin.displayName,
          role: staffToLogin.role,
          desk: staffToLogin.desk,
          menuPermissions: staffToLogin.menuPermissions,
          actionPermissions: staffToLogin.actionPermissions,
          loginAt: new Date().toISOString(),
          googleEmailUsed: googleEmail,
        };

        localStorage.setItem("activeStaffSession", JSON.stringify(session));

        const updatedStaff: Staff = {
          ...staffToLogin,
          failedAttemptCount: 0,
          isLocked: false,
          updatedAt: new Date().toISOString(),
        };

        await staffService.saveStaff(updatedStaff);

        analyticsService.logEvent({
          eventType: "STAFF_LOGIN_SUCCESS",
          actorType:
            staffToLogin.role === "Admin" || staffToLogin.role === "SysAdmin"
              ? "admin"
              : "backend_staff",
          actorName: staffToLogin.fullName,
          actorId: staffToLogin.id,
          result: "success",
          details: {
            staffId: staffToLogin.id,
            staffName: staffToLogin.fullName,
            role: staffToLogin.role,
            desk: staffToLogin.desk,
            googleEmail,
          },
        });

        onLoginSuccess(session);
        return;
      }

      const failedAttemptCount = (staffToLogin.failedAttemptCount || 0) + 1;
      const isLocked = failedAttemptCount >= 5;

      const updatedStaff: Staff = {
        ...staffToLogin,
        failedAttemptCount,
        isLocked,
        updatedAt: new Date().toISOString(),
      };

      await staffService.saveStaff(updatedStaff);

      if (isLocked) {
        setLoginError(
          "Too many failed attempts. Your account has been locked. Contact SysAdmin.",
        );

        analyticsService.logEvent({
          eventType: "STAFF_LOCKED_AFTER_FAILED_ATTEMPTS",
          actorType: "system",
          actorName: "Login System",
          actorId: staffToLogin.id,
          result: "locked",
          details: {
            staffId: staffToLogin.id,
            staffName: staffToLogin.fullName,
            attempts: failedAttemptCount,
          },
        });
      } else {
        setLoginError(
          `Invalid passcode. ${5 - failedAttemptCount} attempts remaining.`,
        );

        analyticsService.logEvent({
          eventType: "STAFF_LOGIN_FAILED",
          actorType: "system",
          actorName: "Login System",
          actorId: staffToLogin.id,
          result: "failed",
          details: {
            staffId: staffToLogin.id,
            staffName: staffToLogin.fullName,
            attempts: failedAttemptCount,
          },
        });
      }

      await refreshStaff();
    } catch (error) {
      console.error("Login handling error", error);
      setLoginError("An error occurred during login. Please try again.");
    }
  };

  const handleCancel = () => {
    setSelectedStaffId("");
    setPasscode("");
    setShowPasscode(false);
    setLoginError(null);
  };

  const handleFinishSetup = async () => {
    setLoginError(null);

    if (!setupFullName.trim() || !setupDisplayName.trim()) {
      setLoginError("Full Name and Display Name are required.");
      return;
    }

    if (setupPasscode.length !== 6) {
      setLoginError("Passcode must be exactly 6 digits.");
      return;
    }

    if (setupPasscode !== setupConfirmPasscode) {
      setLoginError("Passcodes must match.");
      return;
    }

    try {
      const now = new Date().toISOString();
      let staffCode = "";
      try {
        staffCode = await staffService.generateUniqueStaffCodeFromFirebase();
      } catch (e) {
        staffCode = staffService.generateStaffCode();
      }

      const defaultSysAdmin: Staff = {
        id: `STAFF-${Date.now()}`,
        staffCode,
        fullName: setupFullName.trim(),
        displayName: setupDisplayName.trim(),
        role: "SysAdmin",
        desk: "SysAdmin Desk",
        email: setupEmail.trim() || googleEmail || "sysadmin@itred.com",
        phone: "",
        whatsapp: "",
        googleEmailAllowed: googleEmail,
        assignedBranchId: "BR-MAIN",
        status: "active",
        passcode: setupPasscode,
        mustChangePasscode: true,
        failedAttemptCount: 0,
        isLocked: false,
        menuPermissions:
          (staffService.ROLE_TEMPLATES["SysAdmin"] as any)?.menuPermissions ||
          staffService.ROLE_TEMPLATES["SysAdmin"] ||
          {},
        actionPermissions:
          (staffService.ROLE_TEMPLATES["SysAdmin"] as any)?.actionPermissions ||
          {},
        createdBy: "system",
        updatedBy: "system",
        createdAt: now,
        updatedAt: now,
      };

      await staffService.saveStaff(defaultSysAdmin);

      try {
        analyticsService.logEvent({
          eventType: "FIRST_SYSADMIN_CREATED" as any,
          actorType: "system",
          actorName: "Initial Setup",
          actorId: defaultSysAdmin.id,
          result: "success",
          details: {
            staffId: defaultSysAdmin.id,
            staffName: defaultSysAdmin.fullName,
            role: defaultSysAdmin.role,
            desk: defaultSysAdmin.desk,
          },
        });
      } catch (analyticsError) {
        console.error("Analytics log failed", analyticsError);
      }

      const latestStaff = await refreshStaff();

      const savedStaff =
        latestStaff.find((s) => s.id === defaultSysAdmin.id) ||
        latestStaff.find((s) => s.staffCode === defaultSysAdmin.staffCode) ||
        latestStaff.find((s) => s.email === defaultSysAdmin.email);

      if (!savedStaff) {
        setLoginError(
          "SysAdmin was saved but could not be reloaded. Refresh the page and check Staff Management.",
        );
      } else {
        setLoginError(
          "First SysAdmin profile created. Please enter your passcode to access the desk.",
        );
      }

      setIsSetupMode(false);
      setSelectedStaffId(savedStaff?.id || defaultSysAdmin.id);
      setSetupFullName("");
      setSetupDisplayName("");
      setSetupEmail("");
      setSetupPasscode("");
      setSetupConfirmPasscode("");
    } catch (error) {
      console.error("Setup failed", error);
      setLoginError(
        error instanceof Error
          ? error.message
          : "Failed to initialize system. Please check console.",
      );
    }
  };

  const isSelectedStaffBlocked =
    !!selectedStaff &&
    (selectedStaff.status !== "active" || selectedStaff.isLocked);

  const selectableStaff = useMemo(() => {
    const activeById = new Map<string, Staff>();

    allStaff.forEach((staff) => {
      if (staff.status !== "active" || staff.isLocked) return;
      const key = staff.id || staff.staffCode || staff.email || staff.fullName;
      if (!key || activeById.has(key)) return;
      activeById.set(key, staff);
    });

    return Array.from(activeById.values()).sort((a, b) =>
      (a.fullName || a.displayName || a.email || a.staffCode || "").localeCompare(
        b.fullName || b.displayName || b.email || b.staffCode || "",
      ),
    );
  }, [allStaff]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.appName}>iTred</h1>
          <p style={styles.subtitle}>
            Backend Catalogue & Storefront Operations Console
          </p>
        </div>

        <div style={styles.panel}>
          <div style={styles.googleEmailDisplay}>
            <UserCheck size={16} style={{ color: "#2E2E2E" }} />
            <span style={styles.googleEmailText}>{googleEmail}</span>
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="staff-select" style={styles.label}>
              Select Your Name
            </label>

            <select
              id="staff-select"
              style={styles.select}
              value={selectedStaffId}
              onChange={(event) => {
                setSelectedStaffId(event.target.value);
                setLoginError(null);
                setPasscode("");
                setShowPasscode(false);
              }}
              disabled={isSetupMode}
            >
              {selectableStaff.length > 0 ? (
                <>
                  <option value="">-- Select Staff --</option>
                  {selectableStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {`${staff.fullName || staff.displayName || staff.email || staff.staffCode || staff.id}${staff.role || staff.desk ? ` — ${[staff.role, staff.desk].filter(Boolean).join(" / ")}` : ""}`}
                    </option>
                  ))}
                </>
              ) : (
                <option value="" disabled>
                  No active staff profiles available.
                </option>
              )}
            </select>
            {!isSetupMode && selectableStaff.length === 0 && (
              <div style={styles.emptyStaffState}>
                No active staff profiles available.
              </div>
            )}
            <div
              style={{
                fontSize: "10px",
                color: "#888",
                marginTop: "4px",
                textAlign: "right",
              }}
            >
              Loaded staff profiles: {allStaff.length} | Selectable profiles:{" "}
              {selectableStaff.length}
            </div>
          </div>

          {isSetupMode && (
            <div style={styles.setupContainer}>
              <div style={styles.setupCard}>
                <Lock
                  size={24}
                  style={{ color: "#FF6B00", marginBottom: "15px" }}
                />

                <h3 style={styles.setupCardTitle}>System Initialisation</h3>

                <p style={styles.setupCardText}>
                  No staff profiles detected. Create the primary SysAdmin
                  profile to activate the operations console.
                </p>

                <div style={styles.setupForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Full Legal Name</label>
                    <input
                      style={styles.inputNormal}
                      value={setupFullName}
                      onChange={(event) => setSetupFullName(event.target.value)}
                      placeholder="E.G. JOHN DOE"
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Display Name</label>
                    <input
                      style={styles.inputNormal}
                      value={setupDisplayName}
                      onChange={(event) =>
                        setSetupDisplayName(event.target.value)
                      }
                      placeholder="E.G. ADMIN-J"
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email Address Optional</label>
                    <input
                      style={styles.inputNormal}
                      value={setupEmail}
                      onChange={(event) => setSetupEmail(event.target.value)}
                      placeholder="ADMIN@ITRED.COM"
                    />
                  </div>

                  <div style={styles.grid2}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>6-Digit Passcode</label>
                      <input
                        type={setupShowPass ? "text" : "password"}
                        style={styles.inputCenter}
                        maxLength={6}
                        value={setupPasscode}
                        onChange={(event) =>
                          setSetupPasscode(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Confirm Passcode</label>
                      <input
                        type={setupShowPass ? "text" : "password"}
                        style={styles.inputCenter}
                        maxLength={6}
                        value={setupConfirmPasscode}
                        onChange={(event) =>
                          setSetupConfirmPasscode(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div style={styles.showPasscodeRow}>
                    <button
                      type="button"
                      onClick={() => setSetupShowPass((current) => !current)}
                      style={styles.linkButton}
                    >
                      {setupShowPass ? "Hide Passcodes" : "Show Passcodes"}
                    </button>
                  </div>

                  {loginError && (
                    <div style={styles.errorBox}>
                      <AlertTriangle size={16} style={{ color: "#EF4444" }} />
                      <span style={styles.errorText}>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleFinishSetup}
                    style={
                      !setupFullName ||
                      !setupDisplayName ||
                      setupPasscode.length !== 6 ||
                      setupPasscode !== setupConfirmPasscode
                        ? styles.setupButtonDisabled
                        : styles.setupButton
                    }
                    disabled={
                      !setupFullName ||
                      !setupDisplayName ||
                      setupPasscode.length !== 6 ||
                      setupPasscode !== setupConfirmPasscode
                    }
                  >
                    <Shield size={16} style={{ marginRight: "8px" }} />
                    Initialise System
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedStaff && !isSetupMode && (
            <div style={styles.staffDetailsPreview}>
              <h4 style={styles.previewTitle}>Selected Profile Overview</h4>

              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Name:</span>
                <span style={styles.previewValue}>
                  {selectedStaff.displayName || selectedStaff.fullName}
                </span>
              </div>

              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Role:</span>
                <span style={styles.previewValue}>{selectedStaff.role}</span>
              </div>

              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Desk:</span>
                <span style={styles.previewValue}>{selectedStaff.desk}</span>
              </div>

              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Status:</span>
                <span style={styles.previewValue}>
                  <StatusBadge
                    status={
                      selectedStaff.isLocked ? "locked" : selectedStaff.status
                    }
                    variant={
                      selectedStaff.status === "active" &&
                      !selectedStaff.isLocked
                        ? "success"
                        : "warning"
                    }
                  />
                </span>
              </div>
            </div>
          )}

          {selectedStaff && !isSetupMode && (
            <div style={styles.loginForm}>
              {selectedStaff.status === "suspended" && (
                <div style={styles.warningBox}>
                  <Lock size={16} style={{ color: "#EF4444" }} />
                  <span style={styles.warningText}>
                    Account Suspended. Contact SysAdmin.
                  </span>
                </div>
              )}

              {selectedStaff.isLocked && (
                <div style={styles.warningBox}>
                  <Lock size={16} style={{ color: "#EF4444" }} />
                  <span style={styles.warningText}>
                    Account Locked. Contact SysAdmin.
                  </span>
                </div>
              )}

              <div style={styles.formGroup}>
                <label htmlFor="passcode" style={styles.label}>
                  6-Digit Passcode
                </label>

                <div style={styles.passcodeInputContainer}>
                  <input
                    id="passcode"
                    type={showPasscode ? "text" : "password"}
                    style={styles.input}
                    value={passcode}
                    onChange={(event) => {
                      const value = event.target.value
                        .replace(/[^0-9]/g, "")
                        .slice(0, 6);
                      setPasscode(value);
                      setLoginError(null);
                    }}
                    maxLength={6}
                    disabled={isSelectedStaffBlocked}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPasscode((current) => !current)}
                    style={styles.togglePasscodeButton}
                    disabled={isSelectedStaffBlocked}
                  >
                    {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div style={styles.errorBox}>
                  <AlertTriangle size={16} style={{ color: "#EF4444" }} />
                  <span style={styles.errorText}>{loginError}</span>
                </div>
              )}

              <div style={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={handleLogin}
                  style={
                    !passcode || passcode.length !== 6 || isSelectedStaffBlocked
                      ? styles.loginButtonDisabled
                      : styles.loginButton
                  }
                  disabled={
                    !passcode || passcode.length !== 6 || isSelectedStaffBlocked
                  }
                >
                  <LogIn size={16} style={{ marginRight: "8px" }} />
                  Enter Staff Desk
                </button>

                <button
                  type="button"
                  onClick={handleCancel}
                  style={styles.cancelButton}
                >
                  <XCircle size={16} style={{ marginRight: "8px" }} />
                  Cancel Selection
                </button>
              </div>
            </div>
          )}

          {!isSetupMode && !selectedStaff && sessionMessage && !loginError && (
            <div
              style={{
                ...styles.errorBox,
                backgroundColor: "#FFF7ED",
                borderColor: "#FF6B00",
              }}
            >
              <AlertTriangle size={16} style={{ color: "#FF6B00" }} />
              <span style={{ ...styles.errorText, color: "#FF6B00" }}>
                {sessionMessage}
              </span>
            </div>
          )}

          {!isSetupMode && !selectedStaff && loginError && (
            <div style={styles.errorBox}>
              <AlertTriangle size={16} style={{ color: "#EF4444" }} />
              <span style={styles.errorText}>{loginError}</span>
            </div>
          )}

          <div style={styles.securityNotice}>
            <AlertTriangle size={16} style={{ color: "#FF6B00" }} />
            <p style={styles.securityText}>
              Access is restricted to authorised staff only. All login attempts
              and system activity are logged.
            </p>
          </div>

          <div style={styles.deskExplanation}>
            <h4 style={styles.deskExplanationTitle}>Staff Desks Overview</h4>

            <ul style={styles.deskList}>
              <li>
                <strong>SysAdmin Desk:</strong> Full system control and staff
                management.
              </li>
              <li>
                <strong>Backoffice Desk:</strong> Vendor, product, catalogue and
                general operations.
              </li>
              <li>
                <strong>Product Data Desk:</strong> Product entry, image uploads
                and price updates.
              </li>
              <li>
                <strong>Catalogue Deployment Desk:</strong> Catalogue and
                storefront generation.
              </li>
              <li>
                <strong>Collections Desk:</strong> Due subscriptions,
                collections and follow-ups.
              </li>
              <li>
                <strong>RPN Management Desk:</strong> Field collection, assigned
                vendors and spot checks.
              </li>
              <li>
                <strong>CAH Operations Desk:</strong> Access Hub links, booths
                and follower updates.
              </li>
              <li>
                <strong>BI & Analytics Desk:</strong> Analytics, BI scores and
                performance metrics.
              </li>
              <li>
                <strong>Viewer Desk:</strong> Read-only system summary.
              </li>
            </ul>

            <p style={styles.supportText}>
              Contact SysAdmin if your passcode is locked or forgotten.
            </p>
          </div>
        </div>

        <div style={styles.footer}>Powered by seiGEN Commerce</div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#F8F8F8",
    fontFamily: "Arial, sans-serif",
    color: "#2E2E2E",
  },
  container: {
    width: "100%",
    maxWidth: "560px",
    padding: "20px",
    textAlign: "center",
  },
  header: {
    marginBottom: "30px",
  },
  appName: {
    fontSize: "48px",
    fontWeight: 900,
    color: "#FF6B00",
    margin: 0,
    letterSpacing: "-2px",
  },
  subtitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#2E2E2E",
    margin: "5px 0 0",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E0E0E0",
    boxShadow: "none",
    padding: "30px",
    marginBottom: "20px",
  },
  googleEmailDisplay: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    backgroundColor: "#F0F0F0",
    padding: "12px",
    marginBottom: "25px",
    fontSize: "13px",
    fontWeight: "bold",
    color: "#2E2E2E",
    textTransform: "uppercase",
  },
  googleEmailText: {
    opacity: 0.8,
    overflowWrap: "anywhere",
  },
  formGroup: {
    marginBottom: "20px",
    textAlign: "left",
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#666666",
    marginBottom: "8px",
    letterSpacing: "0.5px",
  },
  select: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    border: "1px solid #D0D0D0",
    backgroundColor: "#FFFFFF",
    fontSize: "14px",
    color: "#2E2E2E",
    appearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%232E2E2E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    cursor: "pointer",
  },
  emptyStaffState: {
    marginTop: "8px",
    padding: "10px",
    border: "1px solid #E0E0E0",
    backgroundColor: "#F8F8F8",
    color: "#666666",
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  loginForm: {
    marginTop: "25px",
    borderTop: "1px solid #E0E0E0",
    paddingTop: "25px",
  },
  passcodeInputContainer: {
    position: "relative",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    border: "1px solid #D0D0D0",
    fontSize: "18px",
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: "2px",
    color: "#2E2E2E",
    backgroundColor: "#FFFFFF",
  },
  inputNormal: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    border: "1px solid #D0D0D0",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#2E2E2E",
    backgroundColor: "#FFFFFF",
  },
  inputCenter: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    border: "1px solid #D0D0D0",
    textAlign: "center",
    fontSize: "16px",
    fontWeight: "bold",
    letterSpacing: "4px",
  },
  togglePasscodeButton: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#666666",
    padding: "5px",
  },
  buttonGroup: {
    marginTop: "30px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  loginButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#FF6B00",
    color: "#FFFFFF",
    border: "none",
    fontSize: "14px",
    fontWeight: "bold",
    textTransform: "uppercase",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonDisabled: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#CCCCCC",
    color: "#FFFFFF",
    border: "none",
    fontSize: "14px",
    fontWeight: "bold",
    textTransform: "uppercase",
    cursor: "not-allowed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#F0F0F0",
    color: "#666666",
    border: "1px solid #D0D0D0",
    fontSize: "14px",
    fontWeight: "bold",
    textTransform: "uppercase",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  warningBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#FEE2E2",
    border: "1px solid #EF4444",
    padding: "12px",
    marginBottom: "20px",
    textAlign: "left",
  },
  warningText: {
    fontSize: "12px",
    color: "#EF4444",
    fontWeight: "bold",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#FEE2E2",
    border: "1px solid #EF4444",
    padding: "12px",
    marginBottom: "20px",
    textAlign: "left",
  },
  errorText: {
    fontSize: "12px",
    color: "#EF4444",
    fontWeight: "bold",
  },
  supportText: {
    fontSize: "11px",
    color: "#666666",
    marginTop: "25px",
    lineHeight: "1.5",
  },
  footer: {
    marginTop: "30px",
    fontSize: "11px",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  securityNotice: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#F0F0F0",
    border: "1px solid #D0D0D0",
    padding: "12px",
    marginTop: "25px",
    textAlign: "left",
  },
  securityText: {
    fontSize: "11px",
    color: "#666666",
    fontWeight: "bold",
    margin: 0,
  },
  deskExplanation: {
    marginTop: "25px",
    borderTop: "1px solid #E0E0E0",
    paddingTop: "25px",
    textAlign: "left",
  },
  deskExplanationTitle: {
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#2E2E2E",
    marginBottom: "15px",
    letterSpacing: "0.5px",
  },
  deskList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    fontSize: "11px",
    lineHeight: "1.8",
    color: "#444444",
  },
  staffDetailsPreview: {
    marginTop: "25px",
    borderTop: "1px solid #E0E0E0",
    paddingTop: "25px",
    textAlign: "left",
    marginBottom: "25px",
  },
  previewTitle: {
    fontSize: "12px",
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#2E2E2E",
    marginBottom: "10px",
    letterSpacing: "0.5px",
  },
  previewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "5px 0",
    borderBottom: "1px dotted #F0F0F0",
    fontSize: "11px",
  },
  previewLabel: {
    fontWeight: "bold",
    color: "#666666",
  },
  previewValue: {
    color: "#2E2E2E",
    textAlign: "right",
  },
  setupContainer: {
    marginTop: "25px",
  },
  setupCard: {
    backgroundColor: "#FFFBEB",
    border: "1px solid #FCD34D",
    padding: "30px",
    textAlign: "center",
  },
  setupCardTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#2E2E2E",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "10px",
  },
  setupCardText: {
    fontSize: "12px",
    color: "#666666",
    marginBottom: "20px",
    lineHeight: "1.5",
  },
  setupForm: {
    textAlign: "left",
    marginTop: "25px",
    paddingTop: "25px",
    borderTop: "1px solid #E0E0E0",
  },
  setupButton: {
    width: "100%",
    padding: "12px 20px",
    backgroundColor: "#FF6B00",
    color: "#FFFFFF",
    border: "none",
    fontSize: "13px",
    fontWeight: "bold",
    textTransform: "uppercase",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  setupButtonDisabled: {
    width: "100%",
    padding: "12px 20px",
    backgroundColor: "#CCCCCC",
    color: "#FFFFFF",
    border: "none",
    fontSize: "13px",
    fontWeight: "bold",
    textTransform: "uppercase",
    cursor: "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  showPasscodeRow: {
    textAlign: "right",
    marginBottom: "15px",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#666666",
    fontSize: "10px",
    fontWeight: "bold",
    cursor: "pointer",
    textTransform: "uppercase",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "15px",
  },
};

export default WelcomePage;
