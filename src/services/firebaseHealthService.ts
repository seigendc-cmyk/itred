/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let nonEssentialWritesPausedUntil = 0;

const pauseNonEssentialWrites = () => {
  nonEssentialWritesPausedUntil = Date.now() + 60 * 1000;
};

export const firebaseHealthService = {
  isMissingFirestoreIndexError: (error: any): boolean =>
    String(error?.message || "").includes("requires an index") ||
    String(error?.code || "").includes("failed-precondition"),

  reportError: (error: any, context?: string) => {
    console.error(`Firebase Health Error [${context || "Global"}]:`, error);
    if (
      error?.message?.includes("Listen") ||
      error?.message?.includes("channel") ||
      error?.message?.includes("404")
    ) {
      console.warn(
        "Firestore listener failed. Falling back to one-time reads/cache.",
      );
    }
    if (
      error?.message?.includes("exhausted") ||
      error?.message?.includes("quota") ||
      error?.code === "resource-exhausted"
    ) {
      pauseNonEssentialWrites();
      console.warn(
        "Firestore resource/quota exhausted. Please slow down writes or wait.",
      );
    }
  },
  shouldSkipNonEssentialWrites: () =>
    Date.now() < nonEssentialWritesPausedUntil,
  isOnline: () => (typeof navigator !== "undefined" ? navigator.onLine : true),
};
