const SESSION_KEYS = [
  "activeStaffSession",
  "activeDeskSession",
  "activeDeskState",
  "itred_active_desk",
  "itred_session_token",
  "itred_auth_token",
];

export const sessionService = {
  logoutSession: () => {
    SESSION_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to clear local session key ${key}`, error);
      }

      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to clear browser session key ${key}`, error);
      }
    });
  },
};
