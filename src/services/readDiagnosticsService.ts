/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type ReadDiagnostic = {
  service: string;
  collection: string;
  readType: string;
  timestamp: string;
  estimatedRecordCount?: number;
};

const diagnostics: ReadDiagnostic[] = [];

const isDev = () => {
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
};

export const readDiagnosticsService = {
  track(
    service: string,
    collection: string,
    readType: string,
    estimatedRecordCount?: number,
  ) {
    if (!isDev()) return;
    diagnostics.push({
      service,
      collection,
      readType,
      estimatedRecordCount,
      timestamp: new Date().toISOString(),
    });
    if (diagnostics.length > 200) diagnostics.shift();
    window.clearTimeout((window as any).__itredReadDiagnosticsTimer);
    (window as any).__itredReadDiagnosticsTimer = window.setTimeout(() => {
      console.groupCollapsed("Firebase read diagnostics");
      console.table(diagnostics.slice(-50));
      console.groupEnd();
    }, 800);
  },

  getRecent(limit = 50): ReadDiagnostic[] {
    return diagnostics.slice(-limit);
  },

  clear() {
    diagnostics.splice(0, diagnostics.length);
  },
};
