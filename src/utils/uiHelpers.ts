export const focusMainContent = (): void => {
  try {
    const selectors = [
      "[data-main-content]",
      "#main-content",
      "main",
      ".main-content",
      ".page-content",
    ];

    let target: HTMLElement | null = null;

    for (const selector of selectors) {
      const found = document.querySelector(selector);
      if (found instanceof HTMLElement) {
        target = found;
        break;
      }
    }

    if (!target) {
      target = document.body;
    }

    const headerOffset = 90;
    const top =
      target.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });

    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }

    target.focus({ preventScroll: true });
  } catch (error) {
    console.warn("focusMainContent failed:", error);
  }
};

export default focusMainContent;
