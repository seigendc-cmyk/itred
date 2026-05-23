export interface ActiveStaffSession {
  id?: string;
  staffId?: string;
  staffCode?: string;
  staffName?: string;
  displayName?: string;
  fullName?: string;
  role?: string;
  desk?: string;
}

const SESSION_KEY = "activeStaffSession";

export const getSession = (): ActiveStaffSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveStaffSession;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const getSessionStaffId = (session: ActiveStaffSession | null): string =>
  session?.staffCode || session?.staffId || session?.id || "";

export const getSessionStaffName = (
  session: ActiveStaffSession | null,
  fallback = "Unknown staff",
): string =>
  session?.staffName || session?.displayName || session?.fullName || fallback;

export const getSessionRole = (
  session: ActiveStaffSession | null,
): string => session?.role || "staff";

export const getSessionDesk = (
  session: ActiveStaffSession | null,
): string => session?.desk || "Unassigned desk";

export const hasValidSession = (
  session: ActiveStaffSession | null,
): boolean => Boolean(getSessionStaffId(session) && getSessionStaffName(session, ""));

