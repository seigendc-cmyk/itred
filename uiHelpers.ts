/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const focusMainContent = () => {
  const container = document.getElementById("main-scroll-container");
  if (container) {
    container.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
