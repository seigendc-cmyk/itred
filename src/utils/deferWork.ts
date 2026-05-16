/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const deferWork = (callback: () => void, timeout = 250) => {
  if (typeof window === "undefined") {
    callback();
    return;
  }

  const requestIdle = (window as any).requestIdleCallback as
    | ((cb: () => void, options?: { timeout: number }) => number)
    | undefined;

  if (requestIdle) {
    requestIdle(callback, { timeout });
    return;
  }

  window.setTimeout(callback, timeout);
};
