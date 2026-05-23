/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Vendor,
  Product,
  Branch,
  CAHLink,
  PricingPlan,
} from "../types.ts";

const escapeHtml = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const generateCatalogueHtml = (
  vendors: Vendor[],
  products: Product[],
  cahLinks: CAHLink[] = [],
  plans: PricingPlan[] = [],
  metadata: {
    serialNumber: string;
    sector: string;
    category: string;
    expiryDate: string;
    seigenLogoDataUri?: string;
    seigenLogoUrl?: string;
    companyLogoUrl?: string;
    systemLogoUrl?: string;
    hostedUrl?: string;
    recommendedOpenMode?: "hosted" | "offline";
    feedbackWhatsAppNumber?: string;
    supportTitle?: string;
    supportMessage?: string;
    supportWhatsAppNumber?: string;
    catalogueId?: string;
    syncEndpointUrl?: string;
  },
): string => {
  const activeProducts = products.filter((p) => {
    const status = String(p.status || "active").toLowerCase();
    return (
      p.publishToCatalogue !== false &&
      status !== "hidden" &&
      status !== "discontinued" &&
      status !== "pending_review"
    );
  });

  const displaySector = metadata.sector
    ? metadata.sector.trim()
    : "All Sectors";
  const displayCategory = metadata.category
    ? metadata.category.trim()
    : "All Categories";
  const displayDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Calculate synthetic scores for UI
  const scoredVendors = vendors.map((v) => {
    let score = 50;
    if (v.logoAssetUrl || v.logoUrl || v.businessLogoUrl) score += 10;
    if (v.branches && v.branches.length > 0) score += 5;
    if (v.whatsappNumber) score += 10;
    if (v.businessDescription && v.businessDescription.length > 50) score += 5;

    // Determine fallback score name
    let scoreTier = "New Vendor";
    if (score >= 80) scoreTier = "Trusted Provider";
    else if (score >= 60) scoreTier = "Verified";

    return {
      ...v,
      trustScore: score,
      trustTier: scoreTier,
    };
  });

  const exportedCahLinks = cahLinks.filter((l) => {
    const status = String(l.status || "active").toLowerCase();
    return status === "active" && l.showInCatalogue !== false;
  });

  const jsonData = {
    metadata: metadata,
    products: activeProducts,
    vendors: scoredVendors,
    cahLinks: exportedCahLinks,
  };

  const logoUrl =
    metadata.seigenLogoUrl || metadata.companyLogoUrl || metadata.systemLogoUrl;

  // Determine Sector Background
  // Simple CSS data URIs for texture
  let bgImage = "linear-gradient(135deg, #FF6B00 0%, #2E2E2E 100%)";
  const s = displaySector.toLowerCase();
  if (s.includes("motor")) {
    bgImage = `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z' fill='%23333' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E"), linear-gradient(135deg, #4b5563, #1f2937)`;
  } else if (s.includes("agri") || s.includes("farm")) {
    bgImage = `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='2' fill='%2322c55e' fill-opacity='0.4'/%3E%3C/svg%3E"), linear-gradient(135deg, #166534, #14532d)`;
  } else if (s.includes("hardware") || s.includes("build")) {
    bgImage = `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0l10 10m0-10L0 10' stroke='%23f59e0b' stroke-width='1' stroke-opacity='0.2'/%3E%3C/svg%3E"), linear-gradient(135deg, #78350f, #451a03)`;
  } else if (s.includes("cloth") || s.includes("fashion")) {
    bgImage = `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10Q5 5 10 10t10 0v10Q15 15 10 10T0 10z' fill='%23db2777' fill-opacity='0.2'/%3E%3C/svg%3E"), linear-gradient(135deg, #831843, #4c0519)`;
  } else if (s.includes("prop") || s.includes("real estate")) {
    bgImage = `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='20' height='20' fill='%232563eb' fill-opacity='0.2'/%3E%3C/svg%3E"), linear-gradient(135deg, #1e3a8a, #172554)`;
  } else if (s.includes("edu")) {
    bgImage = `url("data:image/svg+xml,%3Csvg width='30' height='30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15 0l15 15-15 15L0 15z' fill='%236b7280' fill-opacity='0.2'/%3E%3C/svg%3E"), linear-gradient(135deg, #374151, #111827)`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SCI | ${escapeHtml(displaySector)} | ${escapeHtml(displayCategory)} | ${displayDate}</title>
    <style>
        :root {
            --brand-orange: #FF6B00;
            --brand-dark-orange: #C84A00;
            --brand-charcoal: #2E2E2E;
            --brand-silver: #F9F9F9;
            --surface-soft: #FAFAFA;
            --border-soft: #E9E5E1;
        }
        /* CRITICAL MOBILE-FIRST RULES */
        html, body {
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background: var(--brand-silver);
            color: var(--brand-charcoal);
            font-size: 13px;
            font-weight: 400;
            line-height: 1.45;
            padding-bottom: 176px; /* floating controls space */
        }
        *, *:before, *:after { box-sizing: border-box; border-radius: 0; }
        
        img, video, iframe, canvas, table {
            max-width: 100%;
            height: auto;
        }
        iframe { width: 100%; max-width: 100%; border: 0; display: block; }
        
        .word-wrap {
            overflow-wrap: break-word;
            word-break: break-word;
        }

        /* App Shell */
        .app-shell {
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
            margin: 0 auto;
            background: #fff;
            min-height: 100vh;
            position: relative;
            box-shadow: 0 0 20px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
        }

        /* Window Controls */
        .window-controls {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1001;
            display: flex;
            gap: 8px;
        }
        .window-control-btn {
            background: transparent;
            border: none;
            color: #52525b;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: none;
        }
        .window-control-btn:hover {
            background: transparent;
            color: var(--brand-dark-orange);
        }
        .window-control-btn:focus-visible {
            outline: 2px solid rgba(200, 74, 0, 0.42);
            outline-offset: 2px;
        }
        .window-control-btn.close-btn:hover {
            background: transparent;
            color: var(--brand-dark-orange);
        }

        /* Minimized State */
        .minimized-catalogue-bar {
            display: none;
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--brand-orange);
            color: white;
            padding: 12px 24px;
            font-weight: 800;
            font-size: 14px;
            text-transform: uppercase;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 2000;
            cursor: pointer;
            border: 2px solid white;
            white-space: nowrap;
        }
        .catalogue-minimized .app-shell main,
        .catalogue-minimized .menu-button,
        .catalogue-minimized .menu-sheet,
        .catalogue-minimized .menu-backdrop,
        .catalogue-minimized .search-area,
        .catalogue-minimized footer {
            display: none !important;
        }
        .catalogue-minimized .minimized-catalogue-bar {
            display: block;
        }
        /* Responsive Constraint for Desktop */
        @media (min-width: 1024px) {
            .app-shell { max-width: 480px; }
            .search-area { max-width: 480px; }
        }

        /* Header */
        .fixed-catalogue-header-wrapper {
            position: sticky;
            top: 0;
            z-index: 900;
            background: #ffffff;
            box-shadow: 0 6px 18px rgba(0,0,0,0.08);
        }
        .sector-header {
            position: relative;
            min-height: 82px;
            padding: 12px 112px 10px 16px;
            color: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            background: linear-gradient(135deg, #FF6B00 0%, #FF8A2A 100%);
            box-shadow: 0 10px 28px rgba(255, 107, 0, 0.20);
            overflow: hidden;
        }
        .sector-header::after { /* Removed */
            display: none;
        }
        .header-overlay {
            display: none;
        }
        .header-content {
            position: relative;
            z-index: 2;
        }
        .itred-wordmark {
            font-size: 30px;
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
            line-height: 1;
        }
        .itred-i { color: #ffffff; }
        .itred-tred { color: var(--brand-charcoal); }
        .seigen-logo-badge {
            position: absolute;
            bottom: 16px;
            right: 16px;
            width: 42px;
            height: 42px;
            background: #ffffff;
            border: 2px solid #ffffff;
            overflow: hidden;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 18px rgba(46, 46, 46, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .seigen-logo-badge img { /* No change needed, just ensuring it's present */
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            padding: 4px;
        }
        .seigen-logo-fallback {
            color: var(--brand-orange);
            font-weight: 900;
            font-size: 16px;
            letter-spacing: 0px;
        }
        .header-cart-button {
            position: absolute;
            bottom: 16px;
            right: 66px;
            z-index: 12;
            width: 42px;
            height: 42px;
            border: 1px solid rgba(255,255,255,0.58);
            background: rgba(255,255,255,0.16);
            color: #ffffff;
            box-shadow: 0 8px 18px rgba(46,46,46,0.12);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        .header-cart-button svg {
            width: 19px;
            height: 19px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        .header-cart-count {
            position: absolute;
            top: -7px;
            right: -7px;
            min-width: 19px;
            height: 19px;
            padding: 0 5px;
            border: 1px solid rgba(255,255,255,0.9);
            background: var(--brand-orange);
            color: #fff;
            font-size: 10px;
            font-weight: 900;
            line-height: 18px;
            text-align: center;
        }
        .catalogue-subtitle {
            font-size: 9px; font-weight: 700; color: #ddd; line-height: 1.2;
        }
        .powered-by, .powered-by-text {
            color: var(--brand-charcoal);
            font-weight: 900;
        }

        /* Search */
        .search-area {
            position: fixed;
            left: 50%;
            right: auto;
            bottom: 76px;
            transform: translateX(-50%);
            z-index: 890;
            width: 100%;
            max-width: 480px;
            padding: 8px 12px 10px;
            background: #fff7f2;
            border: 1px solid rgba(255, 107, 0, 0.22);
            border-left: none;
            border-right: none;
            box-shadow: 0 -8px 18px rgba(46,46,46,0.10);
        }
        .search-box {
            position: relative;
            display: flex;
            align-items: center;
        }
        .search-input {
            width: 100%;
            padding: 12px 40px 12px 12px;
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(46, 46, 46, 0.14);
            font-size: 14px;
            font-weight: 800;
            outline: none;
        }
        .search-input:focus {
            background: #fff; border-color: var(--brand-orange); box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.14);
        }
        .search-clear {
            display: none;
            position: absolute;
            right: 6px;
            top: 50%;
            transform: translateY(-50%);
            width: 30px;
            height: 30px;
            border: none;
            background: transparent;
            color: var(--brand-charcoal);
            font-size: 18px;
            font-weight: 900;
            cursor: pointer;
        }
        .search-clear.visible { display: flex; align-items: center; justify-content: center; }
        #searchStats {
            font-size: 9px;
            font-weight: 900;
            color: #666;
            margin-top: 6px;
            text-transform: uppercase;
            display: none;
        }
        .search-suggestions {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding: 10px 0 0;
            scrollbar-width: none;
        }
        .search-suggestions::-webkit-scrollbar { display: none; }
        .search-suggestion {
            flex: 0 0 auto;
            border: 1px solid var(--border-soft);
            background: #fff;
            color: var(--brand-charcoal);
            padding: 8px 10px;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
        }

        /* Tabs */
        .tab-content { display: none; padding: 12px; flex: 1; }
        .tab-content.active { display: block; }

        /* Grid */
        .product-grid {
            display: flex; flex-direction: column; gap: 16px;
        }
        .card {
            border: 1px solid #eee; padding: 16px;
            display: flex; gap: 16px; align-items: flex-start;
            background: #fff; cursor: pointer; transition: 0.2s;
        }
        .card:active { background: #fafafa; }
        .card-img-wrap {
            width: 90px; height: 90px; flex-shrink: 0;
            background: #f9f9f9; display: flex; align-items: center; justify-content: center;
        }
        .card-img { width: 100%; height: 100%; object-fit: cover; }
        .card-info { flex: 1; min-width: 0; }
        .c-vendor { font-size: 9px; color: var(--brand-orange); font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
        .c-title { font-size: 14px; font-weight: 800; line-height: 1.2; margin-bottom: 6px; }
        .c-price { font-size: 16px; font-weight: 900; margin-bottom: 8px; font-family: monospace; }
        .c-meta { font-size: 10px; color: #666; font-weight: 700; display: flex; justify-content: space-between; }
        .c-btn {
            background: var(--brand-charcoal); color: #fff; border: none;
            padding: 8px 12px; font-size: 10px; font-weight: 900; text-transform: uppercase;
            margin-top: 12px; width: 100%; display: block; text-align: center; text-decoration: none;
        }
        .c-btn.wa { background: #25D366; }

        /* Vendor Card */
        .vendor-card {
            border: 1px solid #eee; padding: 16px; margin-bottom: 16px;
        }
        .vendor-score {
            display: inline-block; padding: 4px 8px; font-size: 9px; font-weight: 900;
            background: #eef2ff; color: #1e40af; margin-bottom: 8px; text-transform: uppercase;
        }

        /* Modal */
        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 2000;
            display: none; align-items: flex-end; justify-content: center;
        }
        .modal-content {
            background: #fff; width: 100%; max-width: 480px; max-height: 90vh;
            overflow-y: auto; position: relative; padding: 24px;
            animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .modal-close {
            position: absolute; top: 16px; right: 16px;
            background: #fff; border: 1px solid #bbb; color: var(--brand-charcoal); width: 34px; height: 34px;
            font-size: 16px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .modal-close svg {
            width: 16px;
            height: 16px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
        }
        
        .m-section { margin-top: 24px; padding-top: 16px; border-top: 2px solid #f0f0f0; }
        .m-title { font-size: 12px; font-weight: 900; color: var(--brand-orange); text-transform: uppercase; margin-bottom: 12px; }
        .m-row { display: flex; flex-direction: column; margin-bottom: 8px; font-size: 12px; }
        .m-lbl { font-size: 9px; font-weight: 900; color: #999; text-transform: uppercase; }
        .m-val { font-weight: 700; color: var(--brand-charcoal); }
        .m-image { width: 100%; height: 300px; object-fit: cover; background: #f9f9f9; margin-bottom: 16px; }

        /* Floating Menu */
        .menu-button {
            position: fixed;
            right: max(12px, calc((100vw - 480px) / 2 + 12px));
            bottom: 12px;
            z-index: 1002;
            width: 52px;
            height: 52px;
            border: none;
            background: transparent;
            color: var(--brand-charcoal);
            box-shadow: none;
            font-size: 32px;
            font-weight: 900;
            cursor: pointer;
            line-height: 1;
        }
        .menu-button.active {
            background: transparent;
            color: var(--brand-orange);
        }
        .menu-backdrop {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 1000;
            background: rgba(0,0,0,0.18);
        }
        .menu-backdrop.open { display: block; }
        .menu-sheet {
            position: fixed;
            left: 50%;
            bottom: 76px;
            transform: translate(-50%, 16px);
            z-index: 1002;
            width: calc(100vw - 24px);
            max-width: 480px;
            background: rgba(255,255,255,0.96);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(0,0,0,0.08);
            box-shadow: 0 18px 48px rgba(0,0,0,0.24);
            padding: 10px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.18s ease, transform 0.18s ease;
        }
        .menu-sheet.open {
            opacity: 1;
            pointer-events: auto;
            transform: translate(-50%, 0);
        }
        .menu-item {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: none;
            background: transparent;
            padding: 14px 12px;
            color: var(--brand-charcoal);
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            cursor: pointer;
            text-align: left;
        }
        .menu-item.active { color: var(--brand-orange); background: #fff3ed; }
        .menu-item.active::after { content: "ACTIVE"; font-size: 8px; color: var(--brand-orange); }
        .menu-item.cart { background:#191919; color:#fff; margin: 6px 0; }
        .menu-divider { height:1px; background:#eee; margin:8px 0; }

        /* Typography Utilities */
        .text-center { text-align: center; }
        .mt-4 { margin-top: 16px; }
        .mb-2 { margin-bottom: 8px; }
        
        .hub-link {
            display: block; padding: 16px; background: #f9f9f9; border: 1px solid #eee;
            margin-bottom: 12px; text-decoration: none; color: inherit;
        }
        .hub-link:hover { border-color: var(--brand-orange); }
        .hub-type { font-size: 9px; font-weight: 900; color: var(--brand-orange); text-transform: uppercase; }
        .hub-name { font-size: 14px; font-weight: 800; margin-top: 4px; }
        .support-card {
            border: 1px solid var(--border-soft);
            background: #fff;
            padding: 16px;
            margin-bottom: 12px;
            max-width: 100%;
            min-width: 0;
        }
        .support-title {
            margin: 0 0 8px;
            color: var(--brand-dark-orange);
            font-size: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        .support-copy {
            margin: 0 0 14px;
            color: #555;
            font-size: 13px;
            line-height: 1.5;
        }
        .support-list {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            margin: 12px 0 0;
        }
        .support-tip {
            border: 1px solid var(--border-soft);
            background: var(--surface-soft);
            padding: 11px;
            font-size: 12px;
            color: #555;
            line-height: 1.45;
        }

        /* Marketplace V2 */
        .market-hero {
            background: #191919;
            color: #fff;
            padding: 22px 18px;
            border-bottom: 4px solid var(--brand-orange);
        }
        .market-eyebrow {
            font-size: 9px;
            font-weight: 900;
            color: var(--brand-orange);
            text-transform: uppercase;
            letter-spacing: 0;
            margin-bottom: 8px;
        }
        .market-title {
            font-size: 24px;
            font-weight: 950;
            line-height: 1.05;
            margin: 0 0 10px;
        }
        .market-copy {
            font-size: 12px;
            line-height: 1.45;
            color: #e7e7e7;
            margin: 0 0 16px;
        }
        .hero-search-button {
            width: 100%;
            border: 1px solid rgba(255,255,255,0.22);
            background: #fff;
            color: var(--brand-charcoal);
            padding: 13px 14px;
            font-size: 13px;
            font-weight: 900;
            text-align: left;
            cursor: pointer;
        }
        .quick-chip-row, .filter-chip-row {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding: 14px 0 4px;
            scrollbar-width: none;
        }
        .quick-chip-row::-webkit-scrollbar, .filter-chip-row::-webkit-scrollbar { display: none; }
        .quick-chip, .filter-chip {
            flex: 0 0 auto;
            border: 1px solid #ddd;
            background: #fff;
            padding: 9px 11px;
            font-size: 10px;
            font-weight: 900;
            color: var(--brand-charcoal);
            text-transform: uppercase;
            cursor: pointer;
        }
        .quick-chip.active, .filter-chip.active {
            border-color: var(--brand-orange);
            background: #fff3ed;
            color: var(--brand-orange);
        }
        .market-section {
            padding: 18px 0 4px;
        }
        .market-section-head {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
        }
        .market-section-title {
            font-size: 14px;
            font-weight: 950;
            text-transform: uppercase;
            color: var(--brand-charcoal);
            margin: 0;
        }
        .market-section-note {
            font-size: 10px;
            font-weight: 800;
            color: #777;
        }
        .market-rail {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 6px;
            scrollbar-width: none;
        }
        .market-rail::-webkit-scrollbar { display: none; }
        .market-lite-placeholder {
            border: 1px solid #eeeeee;
            background: #fafafa;
            padding: 12px;
            font-size: 11px;
            line-height: 1.45;
            color: #666;
        }
        .market-lite-placeholder button {
            border: none;
            background: transparent;
            color: var(--brand-orange);
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            padding: 0;
            margin-top: 8px;
            cursor: pointer;
        }
        .rail-card {
            flex: 0 0 74%;
            border: 1px solid #e8e8e8;
            background: #fff;
            cursor: pointer;
        }
        .rail-card .product-image-box { height: 150px; }
        .product-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
        }
        .filter-panel {
            position: sticky;
            top: 62px;
            z-index: 10;
            background: #fff;
            border-bottom: 1px solid #eee;
            padding: 0 0 12px;
            margin-bottom: 14px;
        }
        .filter-fields {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 10px;
        }
        .filter-fields select, .filter-fields input {
            width: 100%;
            border: 1px solid #ddd;
            background: #fff;
            padding: 9px;
            font-size: 11px;
            font-weight: 800;
            min-width: 0;
        }
        .market-product-card {
            border: 1px solid #e5e5e5;
            background: #fff;
            overflow: hidden;
            cursor: pointer;
            display: grid;
            grid-template-columns: 104px 1fr;
            min-height: 138px;
        }
        .product-image-box {
            width: 100%;
            height: 100%;
            min-height: 138px;
            aspect-ratio: auto;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }
        .product-image-box img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #ffffff;
            display: block;
        }
        .product-card-body { padding: 12px; }
        .product-card-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 8px;
        }
        .trust-badge, .stock-badge {
            display: inline-flex;
            align-items: center;
            padding: 5px 7px;
            font-size: 8px;
            font-weight: 950;
            text-transform: uppercase;
            white-space: nowrap;
        }
        .trust-badge.trusted { background: #e8f7ef; color: #087443; }
        .trust-badge.verified { background: #fff3ed; color: var(--brand-orange); }
        .trust-badge.new { background: #eee; color: #555; }
        .stock-badge { background: #f4f4f4; color: #555; }
        .stock-badge.in { background: #e8f7ef; color: #087443; }
        .product-name {
            font-size: 14px;
            font-weight: 950;
            line-height: 1.2;
            color: var(--brand-charcoal);
            margin: 0 0 8px;
        }
        .product-price {
            font-size: 19px;
            font-weight: 950;
            color: #111;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            margin-bottom: 8px;
        }
        .vendor-line, .location-line {
            font-size: 10px;
            font-weight: 800;
            color: #666;
            margin-bottom: 4px;
        }
        .card-actions,
        .product-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-top: 10px;
        }
        .product-action-btn,
        .product-action-btn:link,
        .product-action-btn:visited,
        .mini-action,
        .mini-action:link,
        .mini-action:visited {
            width: 36px;
            height: 36px;
            min-width: 36px;
            min-height: 36px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
            outline: none;
            padding: 0;
            text-decoration: none;
            cursor: pointer;
            color: var(--brand-charcoal);
            transform: translateZ(0);
            transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .product-action-btn svg,
        .product-action-btn i,
        .mini-action svg,
        .mini-action i {
            width: 22px;
            height: 22px;
            stroke-width: 2;
            stroke: currentColor;
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        .product-action-btn.whatsapp,
        .product-action-btn.wa,
        .mini-action.whatsapp,
        .mini-action.wa {
            color: #16a34a;
        }
        .product-action-btn.call,
        .mini-action.call {
            color: #111827;
        }
        .product-action-btn.view,
        .mini-action.view {
            color: #f97316;
        }
        .product-action-btn:hover,
        .mini-action:hover {
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
            opacity: 0.78;
            transform: scale(1.04);
        }
        .product-action-btn:focus-visible,
        .mini-action:focus-visible {
            outline: 2px solid rgba(249, 115, 22, 0.45);
            outline-offset: 3px;
        }
        .product-action-btn[disabled],
        .mini-action[disabled],
        .product-action-btn.disabled,
        .mini-action.disabled {
            opacity: 0.35;
            cursor: not-allowed;
            transform: none;
        }
        .product-group-card {
            border: 1px solid var(--border-soft);
            background: #fff;
            overflow: hidden;
            cursor: pointer;
            display: grid;
            grid-template-columns: 104px 1fr;
        }
        .product-group-body {
            padding: 12px;
        }
        .group-meta-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 8px 0;
        }
        .group-chip {
            border: 1px solid var(--border-soft);
            background: var(--surface-soft);
            color: #555;
            padding: 4px 6px;
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
        }
        .vendor-option-row {
            border: 1px solid var(--border-soft);
            background: #fff;
            padding: 10px;
            margin-bottom: 8px;
        }
        .vendor-option-main {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: flex-start;
            cursor: pointer;
        }
        .vendor-option-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            margin-top: 9px;
        }
        .vendor-option-search-wrap {
            position: sticky;
            top: 0;
            z-index: 20;
            padding: 8px 0 10px;
            margin: -2px 0 10px;
            background: rgba(255, 243, 237, 0.78);
            border: 1px solid rgba(255, 107, 0, 0.22);
            box-shadow: 0 8px 18px rgba(46,46,46,0.08);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }
        .vendor-option-search-wrap input {
            width: calc(100% - 16px);
            margin: 0 8px;
            padding: 10px 11px;
            border: 1px solid rgba(46,46,46,0.14);
            background: rgba(255,255,255,0.94);
            color: var(--brand-charcoal);
            font-size: 13px;
            font-weight: 800;
            outline: none;
        }
        .vendor-option-search-wrap input:focus {
            border-color: var(--brand-orange);
            box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.12);
        }
        .vendor-option-search-meta {
            padding: 6px 10px 0;
            color: #71717a;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
        }
        .cart-modal-content {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 88vh;
        }
        .cart-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding-right: 42px;
            padding: 12px 42px 12px 12px;
            margin: -6px -6px 2px;
            border: 1px solid rgba(255,107,0,0.22);
            background: rgba(255, 243, 237, 0.76);
            box-shadow: 0 8px 18px rgba(46,46,46,0.08);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
        }
        .cart-title {
            margin: 0;
            color: var(--brand-charcoal);
            font-size: 20px;
            font-weight: 900;
            text-transform: uppercase;
        }
        .cart-subtitle {
            color: #71717a;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
        }
        .cart-confirmation {
            display: none;
            border: 1px solid rgba(255,107,0,0.26);
            background: rgba(255,243,237,0.78);
            color: #7c2d12;
            padding: 9px 10px;
            font-size: 11px;
            font-weight: 800;
        }
        .cart-vendor-group {
            border: 1px solid var(--border-soft);
            background: #fff;
            padding: 12px;
        }
        .cart-vendor-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 10px;
        }
        .cart-vendor-name {
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
            color: var(--brand-charcoal);
        }
        .cart-vendor-meta {
            color: #71717a;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            margin-top: 3px;
        }
        .cart-item-row {
            border-top: 1px solid #f1f1f1;
            padding: 9px 0;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: start;
        }
        .cart-item-name {
            font-size: 12px;
            font-weight: 900;
            color: var(--brand-charcoal);
        }
        .cart-item-meta {
            color: #666;
            font-size: 10px;
            font-weight: 800;
            margin-top: 3px;
        }
        .cart-vendor-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            margin-top: 8px;
        }
        .cart-empty-state {
            border: 1px dashed rgba(46,46,46,0.18);
            padding: 20px 12px;
            text-align: center;
            color: #71717a;
            font-size: 12px;
            font-weight: 800;
            background: rgba(250,250,250,0.82);
        }
        .rail-card.compact-discovery .product-card-body {
            padding: 10px;
        }
        .rail-card.compact-discovery .product-card-top {
            margin-bottom: 7px;
        }
        .rail-card.compact-discovery .product-name {
            font-size: 13px;
            margin-bottom: 6px;
        }
        .rail-card.compact-discovery .product-price {
            font-size: 16px;
            margin-bottom: 6px;
        }
        .rail-card.compact-discovery .card-actions {
            display: none !important;
        }
        .modal-outline-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-top: 12px;
        }
        .modal-outline-action {
            border: 1px solid var(--border-soft);
            background: #fff;
            color: var(--brand-charcoal);
            min-height: 48px;
            padding: 8px 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            text-decoration: none;
            cursor: pointer;
        }
        .modal-outline-action.primary {
            border-color: var(--brand-orange);
            color: var(--brand-orange);
        }
        .modal-outline-action svg {
            width: 15px;
            height: 15px;
            flex: 0 0 auto;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }
        .shops-directory-search {
            width: 100%;
            border: 1px solid rgba(255, 107, 0, 0.24);
            background: rgba(255, 243, 237, 0.58);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 12px;
            font-size: 13px;
            font-weight: 600;
            outline: none;
            margin: 10px 0 14px;
        }
        .shops-directory-search:focus {
            border-color: var(--brand-orange);
            box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.12);
            background: rgba(255,255,255,0.88);
        }
        .branch-card-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 12px;
        }
        @media (max-width: 360px) {
            .modal-outline-actions {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
        }
        .vendor-rail-card {
            flex: 0 0 68%;
            border: 1px solid #e5e5e5;
            background: #fff;
            padding: 14px;
            cursor: pointer;
        }
        .vendor-logo-box {
            width: 54px;
            height: 54px;
            background: #f2f2f2;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            margin-bottom: 10px;
            font-size: 18px;
            font-weight: 950;
            color: var(--brand-orange);
        }
        .vendor-logo-box img { width: 100%; height: 100%; object-fit: cover; }
        .vendor-modal-hero {
            border: 1px solid var(--border-soft);
            background: var(--surface-soft);
            min-height: 170px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            overflow: hidden;
            color: var(--brand-orange);
            font-size: 42px;
            font-weight: 900;
        }
        .vendor-modal-hero img {
            width: 100%;
            height: 100%;
            min-height: 170px;
            object-fit: cover;
            display: block;
        }
        .market-cta {
            background: #fff3ed;
            border: 1px solid #ffd9c2;
            padding: 16px;
            margin-top: 16px;
        }
        .modal-gallery {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            margin: 8px 0 16px;
        }
        .modal-thumb {
            width: 62px;
            height: 62px;
            flex: 0 0 auto;
            border: 2px solid #eee;
            background: #f5f5f5;
            cursor: pointer;
            object-fit: cover;
        }
        .modal-thumb.active { border-color: var(--brand-orange); }
        .modal-vendor-card {
            border: 1px solid #eee;
            background: #fafafa;
            padding: 12px;
            margin-top: 12px;
        }
        .related-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .related-card {
            border: 1px solid #eee;
            padding: 8px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
        }

        /* Browser Gate */
        .browser-gate {
            position: fixed;
            inset: 0;
            z-index: 5000;
            background: rgba(46,46,46,0.78);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .browser-gate-card {
            width: 100%;
            max-width: 360px;
            background: #ffffff;
            border: 2px solid var(--brand-orange);
            padding: 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.28);
            text-align: center;
        }
        .browser-gate-badge {
            display: inline-block;
            background: var(--brand-orange);
            color: #ffffff;
            font-weight: 900;
            padding: 8px 12px;
            margin-bottom: 16px;
        }
        .browser-gate-card h2 {
            margin: 0 0 10px;
            font-size: 18px;
            font-weight: 900;
            color: var(--brand-charcoal);
            text-transform: uppercase;
        }
        .browser-gate-card p {
            font-size: 13px;
            line-height: 1.5;
            color: #555;
            margin-bottom: 20px;
        }
        .browser-gate-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
        }
        .browser-gate-actions button,
        .browser-gate-actions a {
            display: block;
            text-decoration: none;
            border: none;
            padding: 13px 14px;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            cursor: pointer;
        }
        #iosContinueBtn,
        #continueCatalogueBtn {
            background: #f3f3f3;
            color: var(--brand-charcoal);
        }
        #iosOpenHostedBtn,
        #downloadChromeBtn {
            background: var(--brand-orange);
            color: #ffffff;
        }

        main {
            position: relative;
            z-index: 1;
            background: #fff;
            padding-bottom: 100px;
        }

        /* Premium lightweight visual pass */
        .content,
        .product-grid,
        .tab-content,
        .tab-panel,
        .app-shell,
        .filter-panel,
        .market-section,
        .market-rail,
        .modal-content,
        .menu-sheet {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            overflow-x: hidden;
        }
        .product-card,
        .market-product-card,
        .vendor-card,
        .modal,
        .modal-content,
        .sheet,
        .card,
        .panel,
        .hub-link,
        .vendor-rail-card,
        .market-cta,
        .browser-gate-card,
        .svy-box {
            max-width: 100%;
            min-width: 0;
            border-color: var(--border-soft);
            box-shadow: none;
        }
        h1, h2, h3, h4, h5, h6,
        .market-title,
        .market-section-title,
        .product-name,
        .hub-name,
        .support-title,
        .c-title,
        .m-title,
        .vendor-line,
        .menu-item,
        .filter-chip,
        .quick-chip,
        .mini-action,
        .c-btn,
        .trust-badge,
        .stock-badge {
            font-weight: 600 !important;
            letter-spacing: 0 !important;
        }
        [style*="font-weight: 950"],
        [style*="font-weight:950"],
        [style*="font-weight: 900"],
        [style*="font-weight:900"],
        [style*="font-weight: 800"],
        [style*="font-weight:800"],
        [style*="font-weight: 700"],
        [style*="font-weight:700"],
        [style*="font-weight:bold"],
        [style*="font-weight: bold"] {
            font-weight: 600 !important;
        }
        .market-title {
            font-size: 18px !important;
            line-height: 1.18 !important;
        }
        .market-section-title,
        .hub-name,
        .c-title {
            font-size: 14px !important;
        }
        .product-name {
            font-size: 14px !important;
            line-height: 1.3 !important;
            color: #222 !important;
        }
        .product-price,
        .c-price,
        #m-price {
            font-size: 17px !important;
            font-weight: 600 !important;
            color: var(--brand-dark-orange) !important;
        }
        .market-eyebrow,
        .catalogue-subtitle,
        .c-vendor,
        .hub-type,
        .market-section-note,
        .vendor-line,
        .location-line,
        .m-title,
        .menu-item.active,
        .quick-chip.active,
        .filter-chip.active {
            color: var(--brand-dark-orange) !important;
        }
        .market-hero {
            background: #24211f !important;
            border-bottom: 2px solid var(--brand-dark-orange) !important;
            padding: 20px 18px !important;
        }
        .tab-content {
            padding: 16px !important;
        }
        .search-input,
        .hero-search-button,
        .filter-fields select,
        .filter-fields input {
            font-size: 13px !important;
            font-weight: 500 !important;
            border-color: var(--border-soft) !important;
        }
        .search-input:focus,
        .filter-fields select:focus,
        .filter-fields input:focus {
            border-color: var(--brand-dark-orange) !important;
            box-shadow: 0 0 0 2px rgba(200, 74, 0, 0.12) !important;
        }
        .quick-chip,
        .filter-chip,
        .search-suggestion,
        .trust-badge,
        .stock-badge,
        .mini-action,
        .c-btn {
            font-size: 9px !important;
        }
        .market-product-card,
        .vendor-card,
        .hub-link,
        .support-card,
        .support-tip,
        .modal-vendor-card,
        .related-card {
            background: #fff !important;
            border-color: var(--border-soft) !important;
        }
        .market-product-card {
            border-radius: 0 !important;
        }
        .product-image-box {
            aspect-ratio: 1 / 0.68 !important;
            background: var(--surface-soft) !important;
        }
        .product-image-box img,
        .m-image,
        #modalMainImage {
            max-width: 100% !important;
            object-fit: cover !important;
        }
        .m-image,
        #modalMainImage {
            max-height: 260px !important;
        }
        .modal-content {
            width: 100% !important;
            max-width: 480px !important;
            max-height: 92vh !important;
            padding: 18px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
        }
        .modal-gallery {
            max-width: 100%;
            overflow-x: auto;
        }
        .card-actions,
        .modal-outline-actions,
        .related-grid,
        .filter-fields {
            min-width: 0;
        }
        @media (max-width: 360px) {
            .filter-fields,
            .card-actions,
            .related-grid {
                grid-template-columns: 1fr !important;
            }
            .search-area {
                width: calc(100vw - 84px) !important;
            }
            .market-title {
                font-size: 17px !important;
            }
        }
        .svy-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.58); z-index:9999; display:none; align-items:center; justify-content:center; padding:16px; font-family:system-ui, sans-serif; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
        .svy-box { background:rgba(255, 243, 237, 0.78); width:100%; max-width:400px; padding:24px; position:relative; color:#27272a; max-height:90vh; overflow-y:auto; border:1px solid rgba(255, 107, 0, 0.26); box-shadow:0 18px 48px rgba(46,46,46,0.18); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border-radius:10px !important; }
        .svy-close { position:absolute; right:12px; top:12px; background:none; border:none; font-size:24px; cursor:pointer; color:#888; }
        .svy-btn { display:block; width:100%; padding:14px; margin-bottom:8px; border:1px solid #ddd; background:#f9f9f9; text-align:left; font-size:14px; font-weight:bold; cursor:pointer; color:var(--brand-charcoal, #333); }
        .svy-btn:hover { border-color:var(--brand-orange, #FF6B00); color:var(--brand-orange, #FF6B00); background:#fff3ed; }
        .svy-input { width:100%; padding:12px; border:1px solid #ddd; margin-bottom:12px; font-size:14px; font-family:inherit; }
        .svy-wa { display:block; width:100%; padding:14px; background:#16a34a; color:#fff; text-align:center; font-weight:bold; text-decoration:none; margin-top:16px; border:none; cursor:pointer; }
        .svy-h3 { margin-top:0; font-size:18px; margin-bottom:12px; color:var(--brand-charcoal, #111); line-height:1.2; }
        .svy-p { font-size:13px; color:#555; margin-top:0; margin-bottom:16px; line-height:1.4; }
        .svy-link { display:block; background:none; border:none; color:#888; font-size:12px; cursor:pointer; text-decoration:underline; width:100%; text-align:center; padding:12px; margin-top:8px; }
        .bi-popup-badge { display:inline-block; color:var(--brand-orange); border:1px solid rgba(255,107,0,0.32); background:rgba(255,255,255,0.62); padding:5px 8px; font-size:9px; font-weight:900; text-transform:uppercase; margin-bottom:10px; border-radius:6px !important; }
        .bi-popup-note { font-size:12px; line-height:1.45; color:#3f3f46; background:rgba(255,255,255,0.55); border:1px solid rgba(255,107,0,0.18); padding:10px; margin-bottom:14px; border-radius:8px !important; }

        .vendor-filter-btn { width: 100%; border: 1px solid var(--border-soft); background: #fff; padding: 9px; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--brand-charcoal); }
        .vendor-filter-btn:focus { border-color: var(--brand-dark-orange); box-shadow: 0 0 0 2px rgba(200, 74, 0, 0.12); }
        .vendor-picker-overlay { position: fixed; inset: 0; z-index: 3000; background: rgba(0,0,0,0.4); display: none; align-items: center; justify-content: center; padding: 20px; }
        .vendor-picker-overlay.active { display: flex; }
        .vendor-picker-popup { width: 100%; max-width: 420px; max-height: 80vh; background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255, 255, 255, 0.45); box-shadow: 0 20px 60px rgba(0,0,0,0.25); display: flex; flex-direction: column; border-radius: 16px !important; overflow: hidden; }
        .vendor-picker-header { padding: 16px; display: flex; gap: 8px; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); position: sticky; top: 0; background: transparent; z-index: 10; }
        .bubble-search { flex: 1; display: flex; align-items: center; background: rgba(255, 255, 255, 0.9); border-radius: 20px !important; padding: 8px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .bubble-search svg { width: 16px; height: 16px; stroke: #888; margin-right: 8px; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .bubble-search input { flex: 1; border: none; background: transparent; outline: none; font-size: 13px; font-weight: 600; width: 100%; color: var(--brand-charcoal); }
        .vendor-picker-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; -webkit-overflow-scrolling: touch; }
        .vp-card { background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.8); padding: 12px; border-radius: 8px !important; cursor: pointer; transition: all 0.2s; }
        .vp-card:hover { background: rgba(255, 255, 255, 0.9); border-color: var(--brand-orange); }
        .vp-card.selected { border-color: var(--brand-orange); background: #fff3ed; }
        .vp-name { font-size: 14px; font-weight: 600; color: var(--brand-charcoal); }
        .vp-meta { font-size: 10px; font-weight: 500; color: #666; margin-top: 4px; }
        .vp-badges { display: flex; gap: 4px; margin-top: 6px; }
        .vp-badge { padding: 3px 6px; font-size: 8px; font-weight: 600; text-transform: uppercase; border-radius: 4px !important; }
        .vp-badge.wa { background: #dcfce7; color: #166534; }
        .vp-badge.score { background: #e0e7ff; color: #1e40af; }
        .vp-badge.products { background: #f3f4f6; color: #4b5563; }
    </style>
</head>
<body>
    <div class="app-shell word-wrap">
        
        <div class="fixed-catalogue-header-wrapper">
            <header class="sector-header">
                <div class="window-controls">
                    <button class="window-control-btn" onclick="minimizeCatalogue()" title="Minimize">−</button>
                    <button class="window-control-btn close-btn" onclick="closeCatalogue()" title="Close">×</button>
                </div>
                <div class="header-overlay"></div>
                <div class="header-content">
                    <div class="itred-wordmark">
                        <span class="itred-i">i</span><span class="itred-tred">Tred</span>
                    </div>
                    <div class="catalogue-subtitle" style="margin-bottom: 8px;">iTred Marketplace</div>
                    <div class="catalogue-subtitle">${escapeHtml(metadata.serialNumber)} // ${jsonData.products.length} Products</div>
                    <div class="catalogue-subtitle powered-by">Powered by seiGEN Commerce</div>
                </div>
                <div class="seigen-logo-badge">
                    ${logoUrl ? `<img src="${logoUrl}" alt="seiGEN Commerce" onerror="this.outerHTML='<span class=\\'seigen-logo-fallback\\'>SCI</span>'"/>` : `<span class="seigen-logo-fallback">SCI</span>`}
                </div>
                <button type="button" id="headerCartButton" class="header-cart-button" aria-label="Open vendor cart" title="Open cart">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2 2h3l3.6 12.6a2 2 0 0 0 2 1.4h7.7a2 2 0 0 0 1.9-1.4L22 7H6"></path></svg>
                    <span id="headerCartCount" class="header-cart-count">0</span>
                </button>
            </header>
        </div>

        <div class="search-area" id="searchArea">
            <div class="search-box">
                <input type="text" id="searchInput" class="search-input" placeholder="Search products, vendors, locations...">
                <button type="button" id="searchClear" class="search-clear" aria-label="Clear search">Clear</button>
            </div>
            <div id="searchStats"></div>
        </div>

        <main>
            <!-- PRODUCTS TAB -->
            <div id="tab-products" class="tab-content active">
                <div class="filter-panel">
                    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:10px;">
                        <div>
                            <div class="market-eyebrow">Search products</div>
                            <h1 class="market-section-title">Find products near you</h1>
                        </div>
                        <button type="button" class="filter-chip" data-filter="all">Filter</button>
                    </div>
                    <div class="filter-chip-row" id="filterChips">
                        <button class="filter-chip active" data-filter="all">All</button>
                        <button class="filter-chip" data-filter="in-stock">In Stock</button>
                        <button class="filter-chip" data-filter="trusted">Trusted</button>
                        <button class="filter-chip" data-filter="near">Near Me / Location</button>
                        <button class="filter-chip" data-filter="best-value">Best Value</button>
                        <button class="filter-chip" data-filter="new">New</button>
                    </div>
                    <div class="filter-fields">
                        <select id="categoryFilter"><option value="">All categories</option></select>
                        <button type="button" id="vendorFilterBtn" class="vendor-filter-btn">All Vendors</button>
                        <input id="locationFilter" type="text" placeholder="City / suburb">
                        <select id="availabilityFilter">
                            <option value="">Any availability</option>
                            <option value="in-stock">In stock</option>
                            <option value="out-of-stock">Out of stock</option>
                        </select>
                        <input id="minPriceFilter" type="number" min="0" placeholder="Min price">
                        <input id="maxPriceFilter" type="number" min="0" placeholder="Max price">
                    </div>
                    <div class="search-suggestions" id="searchSuggestions"></div>
                </div>
                <div id="productGrid" class="product-grid"></div>
            </div>

            <!-- VENDORS TAB -->
            <div id="tab-vendors" class="tab-content">
                <h2 style="font-size: 16px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; color: var(--brand-dark-orange);">Registered Vendors</h2>
                <div id="vendorGrid"></div>
            </div>

            <!-- COMMUNITY HUB TAB -->
            <div id="tab-hub" class="tab-content">
                <h2 style="font-size: 16px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; color: var(--brand-dark-orange);">Commerce Access Hub</h2>
                <p style="font-size: 12px; margin-bottom: 24px; color: #666;">Sector WhatsApp Groups</p>
                <div id="hubGrid"></div>
            </div>

            <!-- SUPPORT TAB -->
            <div id="tab-support" class="tab-content">
                <div id="supportPage"></div>
            </div>

            <!-- BRANCHES TAB -->
            <div id="tab-branches" class="tab-content">
                <h2 style="font-size: 16px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; color: var(--brand-dark-orange);">Shops Directory</h2>
                <p style="font-size:12px; color:#666; margin:0 0 10px;">Find vendor shops, branches, delivery points and contact routes.</p>
                <input id="branchDirectorySearch" class="shops-directory-search" type="text" placeholder="Search shops by vendor, suburb, sector, delivery...">
                <div id="branchGrid"></div>
            </div>

            <!-- TRADE TERMS TAB -->
            <div id="tab-terms" class="tab-content" style="font-size: 12px; line-height: 1.6;">
                <h2 style="font-size: 16px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; color: var(--brand-dark-orange);">Trade Terms</h2>
                <p style="font-weight: 500; margin-bottom: 16px; padding: 12px; background: #fff3ed; border-left: 3px solid var(--brand-dark-orange);">
                    Products are supplied by independent vendors. SCI / iTred provides discovery, catalogue, and contact infrastructure. Product quality, warranty, availability, pricing, and final sale terms remain the responsibility of the listed vendor unless otherwise stated.
                </p>

                <h3 class="mt-4 mb-2">Business Terms</h3>
                <p>iTred uses Business Intelligence (BI), not artificial intelligence decision-making, to help communicate structured market signals to vendors. BI prompts may ask vendors to confirm product availability, update prices, respond to customer enquiries, or clarify delivery options. These BI prompts are designed to improve market visibility and catalogue accuracy. Final business decisions remain the responsibility of the vendor.</p>
                <p>BI communication may collect structured market signals such as product interest, customer enquiries, price sensitivity, location demand, delivery demand, stock availability feedback, and vendor response behaviour. BI chats and prompts help vendors understand what customers are looking for. The system does not replace human decision-making, and vendors remain responsible for pricing, stock accuracy, fulfilment, warranties, and customer responses.</p>

                <h3 class="mt-4 mb-2">Terms of Reference</h3>
                <p>Users and vendors are encouraged to respond to BI chats and prompts accurately and timeously because these responses help us build real market analytics. These analytics help improve product discovery, vendor visibility, delivery planning, pricing insight, stock accuracy, and the overall commerce experience. Accurate responses strengthen the catalogue and help customers find reliable suppliers faster.</p>
                <p>Market analytics may support local supplier visibility, price comparison, delivery planning, vendor ranking signals, customer experience, and catalogue relevance. Failure to respond to BI prompts may affect visibility, trust score, or catalogue quality indicators later. BI analytics are used to improve the commerce experience, not to unfairly manipulate customers or vendors.</p>
                
                <h3 class="mt-4 mb-2">Privacy Policy</h3>
                <p>We respect your privacy. Contact details provided to vendors are subject to their own privacy policies and should be handled carefully for commerce support, enquiry fulfilment, vendor communication, support, and analytics.</p>
                <p>Where iTred uses Google, Firebase, authentication, analytics, maps, hosting, or related platform services, we intend to align with applicable Google policy requirements. We also recognize that regional internet, data protection, consumer protection, and electronic communications policies may apply in different markets. iTred intends to enforce reasonable platform, privacy, and content requirements to protect customers, vendors, and the wider commerce network.</p>
                <p>Users and vendors must not upload illegal, harmful, misleading, counterfeit, or privacy-infringing content. Regional internet, data protection, consumer protection, and electronic communications rules may apply depending on the country or region where the catalogue is used.</p>
                <p>BI signals may include search behaviour, product views, enquiry patterns, vendor responses, location demand, delivery interest, and catalogue activity. These signals help improve catalogue relevance, supplier discovery, and market analytics. We do not design BI features to replace vendor judgement or to make unfair automated decisions, and we do not design these BI features to sell personal data.</p>
                
                <h3 class="mt-4 mb-2">Product Warranties</h3>
                <p>All warranties are provided directly by the supplying vendor. SCI / iTred disclaims all liability for defective goods.</p>

                <h3 class="mt-4 mb-2">Indemnity</h3>
                <p>Customers and vendors use this catalogue as a discovery and communication tool. Vendors remain responsible for their listings, responses, fulfilment, warranties, and lawful conduct. Customers should verify product details, price, availability, and delivery terms before purchasing.</p>

                <h3 class="mt-4 mb-2">About iTred</h3>
                <p>iTred is a commerce discovery catalogue powered by seiGEN Commerce. It helps customers find products, vendors, shops, and commerce access routes while helping vendors understand real demand through Business Intelligence signals.</p>
                
                <h3 class="mt-4 mb-2">Returns & Exchanges</h3>
                <p>Subject to the individual vendor's return policy. Please confirm before purchasing.</p>

                <h3 class="mt-4 mb-2">Stock Availability</h3>
                <p>Catalogue stock levels are indicative. Vendors may sell out before the catalogue updates. Always confirm availability.</p>
            </div>
        </main>

        <footer style="padding: 40px 20px; text-align: center; border-top: 1px solid #eee; margin-top: auto;">
            <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #aaa;">Powered by seiGEN Commerce</div>
        </footer>

        <button type="button" id="menuButton" class="menu-button" aria-label="Open catalogue menu" title="Open catalogue menu" aria-expanded="false">⋮</button>
        <div id="menuBackdrop" class="menu-backdrop"></div>
        <nav id="menuSheet" class="menu-sheet" aria-label="Catalogue sections">
            <button class="menu-item active" data-action="search" data-target="tab-products">Search</button>
            <button class="menu-item" data-target="tab-products">Products</button>
            <button class="menu-item" data-target="tab-vendors">Vendors</button>
            <button class="menu-item cart" data-action="cart">Cart / Enquiry</button>
            <div class="menu-divider"></div>
            <button class="menu-item" data-target="tab-support">Support / Contact</button>
            <button class="menu-item" data-target="tab-terms">About</button>
            <button class="menu-item" data-target="tab-terms">Privacy Policy</button>
            <button class="menu-item" data-target="tab-terms">Business Terms</button>
            <button class="menu-item" data-target="tab-hub">Join Commerce Access Hub</button>
        </nav>

        <div id="minimizedBar" class="minimized-catalogue-bar" onclick="restoreCatalogue()">
            iTred Catalogue — Tap to reopen
        </div>
    </div>

    <!-- PRODUCT MODAL -->
    <div id="productModal" class="modal-overlay">
        <div class="modal-content word-wrap">
            <button class="modal-close" onclick="closeModal()" aria-label="Close product details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
            
            <div id="modalImageContainer"></div>
            <div id="modalGallery" class="modal-gallery"></div>
            
            <div class="c-vendor" id="m-vendor"></div>
            <h2 style="font-size: 20px; font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-bottom: 8px;" id="m-title"></h2>
            <div style="font-size: 24px; font-weight: 900; font-family: monospace; margin-bottom: 16px;" id="m-price"></div>
            
            <p style="font-size: 14px; margin-bottom: 24px;" id="m-desc"></p>
            
            <div class="product-actions" id="m-actions"></div>

            <div class="m-section">
                <div class="m-title">Product Details</div>
                <div class="m-row"><span class="m-lbl">SKU / Code</span><span class="m-val" id="m-sku"></span></div>
                <div class="m-row"><span class="m-lbl">Brand</span><span class="m-val" id="m-brand"></span></div>
                <div class="m-row"><span class="m-lbl">Category</span><span class="m-val" id="m-cat"></span></div>
                <div class="m-row"><span class="m-lbl">Sector</span><span class="m-val" id="m-sec"></span></div>
                <div class="m-row"><span class="m-lbl">Stock Status</span><span class="m-val" id="m-stock"></span></div>
            </div>

            <div class="m-section">
                <div class="m-title">Vendor Details</div>
                <div class="m-row"><span class="m-lbl">Name</span><span class="m-val" id="mv-name"></span></div>
                <div class="m-row"><span class="m-lbl">Trust Score</span><span class="m-val" id="mv-score"></span></div>
                <div class="m-row"><span class="m-lbl">Location</span><span class="m-val" id="mv-loc"></span></div>
                <div class="m-row"><span class="m-lbl">Business Hours</span><span class="m-val" id="mv-hours"></span></div>
            </div>

            <div class="m-section">
                <div class="m-title">Branch Details</div>
                <div id="m-branch"></div>
            </div>

            <div class="m-section">
                <div class="m-title">Delivery</div>
                <div class="m-row"><span class="m-lbl">Status</span><span class="m-val" id="m-delivery">Delivery details not supplied</span></div>
            </div>

            <div class="m-section">
                <div class="m-title">Contact Person</div>
                <div class="m-row"><span class="m-lbl">Seller Contact</span><span class="m-val" id="m-staff">Contact person not supplied</span></div>
            </div>

            <div class="m-section">
                <div class="m-title">Save / Share</div>
                <div class="product-actions" id="m-save-share"></div>
            </div>

            <div class="m-section">
                <div class="m-title">Related Products</div>
                <div id="m-related" class="related-grid"></div>
            </div>

            <div class="m-section">
                <div class="m-title">Similar Vendors</div>
                <div id="m-similar-vendors"></div>
            </div>
            
        </div>
    </div>

    <!-- TRUSTED VENDOR MODAL -->
    <div id="trustedVendorModal" class="modal-overlay">
        <div class="modal-content word-wrap">
            <button class="modal-close" onclick="closeTrustedVendorModal()" aria-label="Close vendor details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
            <div id="vendorModalHero" class="vendor-modal-hero"></div>
            <div class="c-vendor" id="vm-sector"></div>
            <h2 style="font-size: 20px; font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-bottom: 8px;" id="vm-name"></h2>
            <div id="vm-trust" style="margin-bottom:12px;"></div>
            <div class="m-section">
                <div class="m-title">Vendor Details</div>
                <div class="m-row"><span class="m-lbl">Sector / Category</span><span class="m-val" id="vm-category"></span></div>
                <div class="m-row"><span class="m-lbl">Location</span><span class="m-val" id="vm-location"></span></div>
                <div class="m-row"><span class="m-lbl">WhatsApp</span><span class="m-val" id="vm-whatsapp"></span></div>
                <div class="m-row"><span class="m-lbl">Phone</span><span class="m-val" id="vm-phone"></span></div>
                <div class="m-row"><span class="m-lbl">Storefront</span><span class="m-val" id="vm-storefront"></span></div>
                <div class="m-row"><span class="m-lbl">Delivery / iDeliver</span><span class="m-val" id="vm-delivery"></span></div>
            </div>
            <div class="m-section">
                <div class="m-title">Actions</div>
                <div id="vm-actions"></div>
            </div>
        </div>
    </div>

    <!-- PRODUCT GROUP MODAL -->
    <div id="productGroupModal" class="modal-overlay">
        <div class="modal-content word-wrap">
            <button class="modal-close" onclick="closeProductGroupModal()" aria-label="Close product group"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
            <div id="pgImage"></div>
            <div class="c-vendor" id="pgCategory"></div>
            <h2 style="font-size:20px;font-weight:900;text-transform:uppercase;line-height:1.1;margin-bottom:8px;" id="pgTitle"></h2>
            <div style="font-size:18px;font-weight:900;font-family:monospace;margin-bottom:10px;color:var(--brand-dark-orange);" id="pgPrice"></div>
            <div class="group-meta-row" id="pgMeta"></div>
            <p style="font-size:12px;color:#555;line-height:1.45;" id="pgDescription"></p>
            <div class="m-section">
                <div class="m-title">Available From</div>
                <div class="vendor-option-search-wrap">
                    <input type="text" id="pgVendorSearch" placeholder="Search vendor, price, location..." autocomplete="off">
                    <div id="pgVendorSearchMeta" class="vendor-option-search-meta"></div>
                </div>
                <div id="pgVendorOptions"></div>
            </div>
        </div>
    </div>

    <!-- CART MODAL -->
    <div id="cartModal" class="modal-overlay">
        <div class="modal-content cart-modal-content word-wrap">
            <button class="modal-close" onclick="closeCartModal()" aria-label="Close cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
            <div class="cart-header-row">
                <div>
                    <h2 class="cart-title">Cart / Enquiry</h2>
                    <div class="cart-subtitle">Send product enquiries to sellers on WhatsApp</div>
                </div>
            </div>
            <div id="cartConfirmation" class="cart-confirmation"></div>
            <div id="cartContent"></div>
        </div>
    </div>

    <!-- IOS GATE -->
    <div id="iosGate" class="browser-gate" style="display:none;">
        <div class="browser-gate-card">
            <div class="browser-gate-badge">iTred</div>
            <h2>iPhone Notice</h2>
            <p>Downloaded HTML catalogues may not open correctly on iPhone. For best results, use the online catalogue link.</p>
            <div class="browser-gate-actions">
                <a id="iosOpenHostedBtn" href="#" target="_blank" rel="noopener" style="display:none;">Open Online Catalogue</a>
                <button id="iosContinueBtn">Continue Offline</button>
            </div>
        </div>
    </div>

    <!-- BROWSER GATE -->
    <div id="browserGate" class="browser-gate" style="display:none;">
        <div class="browser-gate-card">
            <div class="browser-gate-badge">iTred</div>
            <h2>Open in Google Chrome</h2>
            <p>
                For the best catalogue experience, use Google Chrome. Some features may not work correctly in your current browser.
            </p>
            <div class="browser-gate-actions">
                <button id="continueCatalogueBtn">Continue Anyway</button>
                <a id="downloadChromeBtn" href="#" target="_blank" rel="noopener">Download Chrome</a>
            </div>
        </div>
    </div>

    <div id="vendorPickerOverlay" class="vendor-picker-overlay">
        <div class="vendor-picker-popup">
            <div class="vendor-picker-header">
                <div class="bubble-search">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
                    <input type="text" id="vendorPickerSearch" placeholder="Search vendors, sectors, locations..." />
                    <button type="button" id="vendorPickerClear" class="search-clear" style="position:static; transform:none; display:none;">×</button>
                </div>
                <button type="button" id="vendorPickerClose" class="search-clear visible" style="position:static; transform:none; font-size:24px;">×</button>
            </div>
            <div id="vendorPickerList" class="vendor-picker-list"></div>
        </div>
    </div>

    <div id="svyOverlay" class="svy-overlay">
      <div class="svy-box">
        <button class="svy-close" onclick="closeSurvey()">×</button>
        <div id="svyContent"></div>
      </div>
    </div>

    <!-- CAH LINKS EXPORTED: ${jsonData.cahLinks.length} -->
    <script>
        // --- Commerce Intelligence Core ---
        const ITRED_EVENTS_KEY = 'itred_offline_commerce_events';
        const ITRED_LEADS_KEY = 'itred_pending_leads';
        const ITRED_SESSION_KEY = 'itred_device_session_id';
        const FEEDBACK_WA = ${JSON.stringify(metadata.feedbackWhatsAppNumber || "").replace(/</g, "\\u003c")};
        const SUPPORT_TITLE = ${JSON.stringify(metadata.supportTitle || "Need help with this catalogue?").replace(/</g, "\\u003c")};
        const SUPPORT_MESSAGE = ${JSON.stringify(metadata.supportMessage || "Use vendor WhatsApp or call buttons for product questions. Contact seiGEN Commerce support if you cannot find a product, vendor, or working contact route.").replace(/</g, "\\u003c")};
        const SUPPORT_WA = ${JSON.stringify(metadata.supportWhatsAppNumber || metadata.feedbackWhatsAppNumber || "").replace(/</g, "\\u003c")};
        const SYNC_ENDPOINT = ${JSON.stringify(metadata.syncEndpointUrl || "/api/catalogue-events").replace(/</g, "\\u003c")};
        const SYNC_BATCH_SIZE = 50;
        const OFFLINE_EVENT_QUEUE_LIMIT = 500;
        const OFFLINE_EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
        let syncTimerId = null;
        let syncInFlight = false;

        function isSyncDebugEnabled() {
            try {
                if (new URLSearchParams(window.location.search).get('debugSync') === '1') return true;
                return localStorage.getItem('SCI_DEBUG_SYNC') === 'true';
            } catch (e) {
                return false;
            }
        }

        function debugSyncLog() {
            if (!isSyncDebugEnabled() || !window.console || !console.warn) return;
            console.warn.apply(console, arguments);
        }

        function minimizeCatalogue() {
            document.body.classList.add('catalogue-minimized');
            logOfflineEvent({ eventType: 'CATALOGUE_MINIMIZED', sourceType: 'catalogue', catalogueId: CATALOGUE_ID });
        }

        function restoreCatalogue() {
            document.body.classList.remove('catalogue-minimized');
            logOfflineEvent({ eventType: 'CATALOGUE_RESTORED', sourceType: 'catalogue', catalogueId: CATALOGUE_ID });
        }

        function closeCatalogue() {
            logOfflineEvent({ eventType: 'CATALOGUE_CLOSE_ATTEMPTED', sourceType: 'catalogue', catalogueId: CATALOGUE_ID });
            // Attempt native tab close
            window.close();
            // Show branded fallback message if browser blocks window.close()
            setTimeout(function() {
                showSurveyHtml('<h3 class="svy-h3">Exit Catalogue</h3><p class="svy-p">Catalogue cannot close this browser tab automatically. Please use your phone back button or close the browser tab manually.</p><button class="svy-btn" onclick="closeSurvey()">Return to Catalogue</button>');
            }, 300);
        }

        function getFeedbackUrl(encodedText) {
            if (FEEDBACK_WA) {
                return "https://wa.me/" + FEEDBACK_WA.replace(/[^0-9]/g, '') + "?text=" + encodedText;
            }
            return "https://wa.me/?text=" + encodedText;
        }

        function getSupportUrl(encodedText) {
            const number = SUPPORT_WA || FEEDBACK_WA;
            if (number) {
                return "https://wa.me/" + number.replace(/[^0-9]/g, '') + "?text=" + encodedText;
            }
            return "https://wa.me/?text=" + encodedText;
        }

        function safeLocalStorageGet(key) {
          try {
            return localStorage.getItem(key);
          } catch (e) {
            debugSyncLog('localStorage not available.', e);
            return null;
          }
        }

        function safeLocalStorageSet(key, value) {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            debugSyncLog('localStorage not available.', e);
          }
        }

        function getDeviceSessionId() {
          let sessionId = safeLocalStorageGet(ITRED_SESSION_KEY);
          if (!sessionId) {
            sessionId = 'SESS-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            safeLocalStorageSet(ITRED_SESSION_KEY, sessionId);
          }
          return sessionId;
        }

        const OFFLINE_EVENT_TYPE_MAP = {
            CATALOGUE_OPENED: 'catalogue_open',
            RETURN_VISIT: 'catalogue_open',
            PRODUCT_VIEWED: 'product_view',
            PRODUCT_CLICKED: 'product_click',
            SEARCH_PERFORMED: 'product_search',
            NO_RESULTS_SEARCH: 'product_search',
            product_group_searched: 'product_search',
            vendor_option_searched: 'product_search',
            TRUSTED_VENDOR_OPENED: 'vendor_click',
            vendor_clicked: 'vendor_click',
            WHATSAPP_VENDOR_CLICKED: 'whatsapp_click',
            vendor_whatsapp_clicked: 'whatsapp_click',
            SUPPORT_CONTACT_CLICKED: 'whatsapp_click',
            CALL_VENDOR_CLICKED: 'call_click',
            vendor_call_clicked: 'call_click',
            cart_item_added: 'cart_add',
            cart_add: 'cart_add',
            cart_vendor_group_removed: 'cart_remove',
            cart_remove: 'cart_remove',
            cart_vendor_lead_sent: 'order_created',
            order_created: 'order_created',
            SHARE_PRODUCT: 'share_click',
            share_click: 'share_click',
            CATALOGUE_EXPIRED_VIEW: 'catalogue_expired_view',
            EXPIRY_SURVEY_OPENED: 'catalogue_expired_view'
        };

        function sanitizeEventValue(value) {
            if (value === undefined) return null;
            if (value === null) return null;
            if (Array.isArray(value)) {
                return value.map(sanitizeEventValue);
            }
            if (typeof value === 'object') {
                const clean = {};
                Object.keys(value).forEach(function(key) {
                    clean[key] = sanitizeEventValue(value[key]);
                });
                return clean;
            }
            return value;
        }

        function normalizeOfflineEventType(eventType) {
            const raw = String(eventType || 'catalogue_open');
            if (OFFLINE_EVENT_TYPE_MAP[raw]) return OFFLINE_EVENT_TYPE_MAP[raw];
            return raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
        }

        function findOfflineEventProduct(event) {
            const productId = event.productId || (event.payload && event.payload.productId);
            if (!productId || typeof products === 'undefined') return null;
            return products.find(function(item) { return item.id === productId; }) || null;
        }

        function findOfflineEventVendor(event, product) {
            const vendorId = event.vendorId || (event.payload && event.payload.vendorId) || (product && product.vendorId);
            if (!vendorId || typeof vendors === 'undefined') return null;
            return vendors.find(function(item) { return item.id === vendorId; }) || null;
        }

        function normalizeOfflineEvent(event) {
            const rawEvent = event || {};
            const product = findOfflineEventProduct(rawEvent);
            const vendor = findOfflineEventVendor(rawEvent, product);
            const payload = rawEvent.payload || rawEvent.metadata || {};
            const eventType = normalizeOfflineEventType(rawEvent.eventType);
            const productId = rawEvent.productId || payload.productId || (product ? product.id : null);
            const vendorId = rawEvent.vendorId || payload.vendorId || (product ? product.vendorId : null) || (vendor ? vendor.id : null);
            const metadata = sanitizeEventValue(Object.assign({}, payload, {
                originalEventType: rawEvent.eventType || null,
                sourceType: rawEvent.sourceType || null,
                sector: rawEvent.sector || payload.sector || (product ? product.sector : null) || (vendor ? vendor.sector : null) || null,
                category: rawEvent.category || payload.category || (product ? product.category : null) || (vendor ? vendor.category : null) || null,
                leadRef: rawEvent.leadRef || payload.leadRef || null
            }));

            return sanitizeEventValue({
                eventId: rawEvent.eventId || 'EVT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                catalogueId: rawEvent.catalogueId || CATALOGUE_ID || null,
                catalogueSerial: rawEvent.catalogueSerial || CATALOGUE_SERIAL || null,
                vendorId: vendorId || null,
                vendorName: rawEvent.vendorName || payload.vendorName || (vendor ? (vendor.name || vendor.tradingName) : null) || (product ? product.vendorName : null) || null,
                productId: productId || null,
                productName: rawEvent.productName || payload.productName || (product ? (product.name || product.productName) : null) || null,
                eventType: eventType,
                searchTerm: rawEvent.searchTerm || rawEvent.query || payload.query || payload.searchTerm || null,
                city: rawEvent.city || payload.city || (product ? (product.city || product.cityTown) : null) || (vendor ? vendor.cityTown : null) || null,
                suburb: rawEvent.suburb || payload.suburb || (product ? product.suburb : null) || (vendor ? vendor.suburb : null) || null,
                source: 'offline_catalogue',
                createdAt: rawEvent.createdAt || rawEvent.timestamp || new Date().toISOString(),
                synced: false,
                userAgent: rawEvent.userAgent || (navigator.userAgent || null),
                sessionId: rawEvent.sessionId || rawEvent.deviceSessionId || getDeviceSessionId(),
                metadata: metadata
            });
        }

        function readOfflineEventsQueue() {
            try {
                const parsed = JSON.parse(safeLocalStorageGet(ITRED_EVENTS_KEY) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }

        function pruneOfflineEventsQueue(events) {
            const seen = {};
            const minCreatedAt = Date.now() - OFFLINE_EVENT_MAX_AGE_MS;
            const cleanEvents = [];
            (Array.isArray(events) ? events : []).forEach(function(event) {
                if (!event || !event.eventId || seen[event.eventId]) return;
                const createdAtMs = new Date(event.createdAt || event.timestamp || 0).getTime();
                if (createdAtMs && createdAtMs < minCreatedAt) return;
                seen[event.eventId] = true;
                cleanEvents.push(sanitizeEventValue(event));
            });
            if (cleanEvents.length <= OFFLINE_EVENT_QUEUE_LIMIT) return cleanEvents;
            return cleanEvents.slice(cleanEvents.length - OFFLINE_EVENT_QUEUE_LIMIT);
        }

        function writeOfflineEventsQueue(events) {
            safeLocalStorageSet(ITRED_EVENTS_KEY, JSON.stringify(pruneOfflineEventsQueue(events)));
        }

        function syncCatalogueEvents(events) {
            return fetch(SYNC_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: events }),
                keepalive: true
            });
        }

        function scheduleOfflineEventSync(delayMs) {
            if (!navigator.onLine || !SYNC_ENDPOINT) return;
            if (syncTimerId) window.clearTimeout(syncTimerId);
            syncTimerId = window.setTimeout(function() {
                syncTimerId = null;
                syncOfflineEvents();
            }, typeof delayMs === 'number' ? delayMs : 250);
        }

        function logOfflineEvent(event) {
          try {
            const events = readOfflineEventsQueue();
            const nextEvent = normalizeOfflineEvent(event);
            if (!events.some(function(item) { return item && item.eventId === nextEvent.eventId; })) {
                events.push(nextEvent);
            }
            writeOfflineEventsQueue(events);
            scheduleOfflineEventSync(50);
          } catch(e) { debugSyncLog('Failed to log event', e); }
        }

        function syncOfflineEvents() {
            if (!navigator.onLine || !SYNC_ENDPOINT || syncInFlight) return;
            try {
                const events = readOfflineEventsQueue();
                const unsynced = events.filter(function(e) { return !e.synced; });
                if (unsynced.length === 0) return;
                const batch = unsynced.slice(0, SYNC_BATCH_SIZE).map(normalizeOfflineEvent);
                syncInFlight = true;

                syncCatalogueEvents(batch).then(function(response) {
                    if (response.ok) {
                        const syncedIds = batch.map(function(e) { return e.eventId; });
                        const latestEvents = readOfflineEventsQueue();
                        const updatedEvents = latestEvents.map(function(e) {
                            if (syncedIds.indexOf(e.eventId) >= 0) {
                                e.synced = true;
                                e.syncedAt = new Date().toISOString();
                            }
                            return sanitizeEventValue(e);
                        });
                        writeOfflineEventsQueue(updatedEvents);
                        if (unsynced.length > batch.length) {
                            scheduleOfflineEventSync(500);
                        }
                    }
                }).catch(function(err) {
                    debugSyncLog('Sync failed, will retry later', err);
                }).finally(function() {
                    syncInFlight = false;
                });
            } catch (err) {
                syncInFlight = false;
                debugSyncLog('Offline event sync failed', err);
            }
        }

        function storePendingLead(lead) {
          try {
            const leads = JSON.parse(safeLocalStorageGet(ITRED_LEADS_KEY) || '[]');
            leads.push(lead);
            safeLocalStorageSet(ITRED_LEADS_KEY, JSON.stringify(leads));
          } catch(e) {}
        }

        function getPendingLeads() {
          try {
            return JSON.parse(safeLocalStorageGet(ITRED_LEADS_KEY) || '[]');
          } catch(e) { return []; }
        }

        function markLeadAnswered(leadRef) {
          try {
            const leads = getPendingLeads();
            const updated = leads.map(function(l) { return l.leadRef === leadRef ? Object.assign({}, l, { answered: true }) : l; });
            safeLocalStorageSet(ITRED_LEADS_KEY, JSON.stringify(updated));
          } catch(e) {}
        }
        
        // --- Survey Engine ---
        const ITRED_LAST_WELCOME = 'itred_last_welcome_back';
        const ITRED_LAST_HELP = 'itred_last_helpfulness';
        const ITRED_EXPIRY_SHOWN = 'itred_expiry_shown';
        
        let popupsShownThisSession = 0;
        let sessionProductViews = 0;
        let sessionSearches = 0;
        let sessionEmptySearches = 0;

        function canShowPopup(key, hours) {
          if (popupsShownThisSession > 0) return false;
          if (!key) return true;
          const last = safeLocalStorageGet(key);
          if (!last) return true;
          if (Date.now() - parseInt(last) > hours * 3600000) return true;
          return false;
        }

        function showSurveyHtml(html) {
          const el = document.getElementById('svyContent');
          if(el) {
            el.innerHTML = html;
            document.getElementById('svyOverlay').style.display = 'flex';
            popupsShownThisSession++;
          }
        }

        function closeSurvey() {
          const el = document.getElementById('svyOverlay');
          if(el) el.style.display = 'none';
        }

        function triggerWelcomeBack() {
          if (canShowPopup(ITRED_LAST_WELCOME, 24)) {
            safeLocalStorageSet(ITRED_LAST_WELCOME, Date.now());
            const html = \`
              <div class="bi-popup-badge">BI Notice</div>
              <div class="bi-popup-note">This catalogue uses Business Intelligence signals, not AI decision-making, to improve vendor communication, product discovery, and market analytics. Please respond to BI prompts accurately so customers can find reliable products and suppliers faster.</div>
              <h3 class="svy-h3">Welcome back to iTred.</h3>
              <p class="svy-p">Search products, contact vendors, and tell us if this catalogue helped you.</p>
              <h3 class="svy-h3" style="font-size:15px; margin-bottom:8px;">Mauya zvakare pa iTred.</h3>
              <p class="svy-p" style="font-size:12px;">Tsvagai zvigadzirwa, taurai nevatengesi, mutibatsirewo kutizivisa kana catalogue iri kubatsira.</p>
              <h3 class="svy-h3" style="font-size:15px; margin-bottom:8px;">Siyalamukela futhi ku iTred.</h3>
              <p class="svy-p" style="font-size:12px; margin-bottom:24px;">Dingani impahla, xhumanani labathengisi, lisitshele ukuthi ikhathalogu iyalinceda yini.</p>
              <button class="svy-btn" onclick="closeSurvey()">Continue</button>
              <button class="svy-btn welcome-feedback-btn">Give Feedback</button>
            \`;
            showSurveyHtml(html);
            document.querySelectorAll(".welcome-feedback-btn").forEach(function(btn) {
              btn.addEventListener("click", function() {
                triggerHelpfulnessSurvey(true);
              });
            });
          }
        }

        function triggerHelpfulnessSurvey(force = false) {
          if (force || canShowPopup(ITRED_LAST_HELP, 24)) {
            safeLocalStorageSet(ITRED_LAST_HELP, Date.now());
            const html = \`
              <div class="bi-popup-badge">Business Intelligence</div>
              <div class="bi-popup-note">Your response helps iTred build market analytics for product discovery, vendor visibility, stock accuracy, delivery planning, and catalogue relevance. This is BI, not AI decision-making.</div>
              <h3 class="svy-h3" style="margin-bottom:20px;">Is this catalogue helping you find what you need?</h3>
              <button class="svy-btn helpfulness-btn" data-answer="Yes, it helped">Yes, it helped</button>
              <button class="svy-btn helpfulness-btn" data-answer="Partly helped">Partly helped</button>
              <button class="svy-btn helpfulness-btn" data-answer="No, I did not find what I wanted">No, I did not find what I wanted</button>
              <button class="svy-btn helpfulness-btn" data-answer="I need assistance">I need assistance</button>
              <div style="margin-top:20px;">
                <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:6px;">Optional comment:</label>
                <input type="text" id="helpComment" placeholder="What product/vendor are you looking for?" class="svy-input" />
              </div>
              <button class="svy-link" onclick="closeSurvey()">Not Now</button>
            \`;
            showSurveyHtml(html);
            document.querySelectorAll('.helpfulness-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                submitHelpfulness(btn.getAttribute('data-answer') || '');
              });
            });
          }
        }

        function submitHelpfulness(answer) {
          const commentEl = document.getElementById('helpComment');
          const comment = commentEl ? commentEl.value : '';
          logOfflineEvent({ eventType: 'SURVEY_ANSWERED', sourceType: 'catalogue', payload: { survey: 'helpfulness', answer: answer, comment: comment } });
          const text = encodeURIComponent("Feedback: " + answer + "\\nComment: " + comment);
          document.getElementById('svyContent').innerHTML = \`
            <h3 class="svy-h3">Thank you for your feedback!</h3>
            <button class="svy-wa survey-wa-btn" data-text="\${text}">Send Feedback to seiGEN Commerce on WhatsApp</button>
            <button class="svy-link" onclick="closeSurvey()">Close</button>\`;
          document.querySelectorAll('.survey-wa-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                  window.open(getFeedbackUrl(btn.getAttribute('data-text') || ''));
              });
          });
        }

        function triggerExpirySurvey() {
          if (canShowPopup(ITRED_EXPIRY_SHOWN, 999999)) {
            safeLocalStorageSet(ITRED_EXPIRY_SHOWN, "true");
            showSurveyHtml(\`
              <div class="bi-popup-badge">BI Notice</div>
              <div class="bi-popup-note">This BI prompt helps vendors and catalogue teams understand product interest, vendor response behaviour, location demand, and delivery needs.</div>
              <h3 class="svy-h3" style="margin-bottom:20px;">This catalogue is about to expire. Did it help you connect with vendors or products?</h3>
              <button class="svy-btn expiry-btn" data-answer="Yes">Yes</button>
              <button class="svy-btn expiry-btn" data-answer="Partly">Partly</button>
              <button class="svy-btn expiry-btn" data-answer="No">No</button>
              <button class="svy-btn expiry-btn" data-answer="I need updated catalogue">I need updated catalogue</button>
              <button class="svy-link" onclick="closeSurvey()">Not Now</button>\`);
            logOfflineEvent({ eventType: 'EXPIRY_SURVEY_OPENED', sourceType: 'catalogue', payload: { status: 'opened' } });
            document.querySelectorAll('.expiry-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                submitExpiry(btn.getAttribute('data-answer') || '');
              });
            });
          }
        }

        function submitExpiry(answer) {
          logOfflineEvent({ eventType: 'SURVEY_ANSWERED', sourceType: 'catalogue', payload: { survey: 'expiry', answer: answer } });
          const text = encodeURIComponent("Expiry Feedback: " + answer);
          document.getElementById('svyContent').innerHTML = \`<h3 class="svy-h3">Thank you for your feedback!</h3><button class="svy-wa survey-wa-btn" data-text="\${text}">Send Feedback to seiGEN Commerce on WhatsApp</button><button class="svy-link" onclick="closeSurvey()">Close</button>\`;
          document.querySelectorAll('.survey-wa-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                  window.open(getFeedbackUrl(btn.getAttribute('data-text') || ''));
              });
          });
        }

        function triggerNoResultsSurvey() {
          if (canShowPopup('', 0)) {
            showSurveyHtml(\`<div class="bi-popup-badge">BI Sourcing Signal</div><div class="bi-popup-note">This BI prompt records structured product demand so iTred can improve supplier discovery and help vendors understand what customers are looking for.</div><h3 class="svy-h3">We could not find that product.</h3><p class="svy-p" style="margin-bottom:20px;">Do you want seiGEN Commerce to help source it?</p><input type="text" id="nrProduct" placeholder="Product needed" class="svy-input" /><input type="text" id="nrLocation" placeholder="Location" class="svy-input" /><input type="text" id="nrBudget" placeholder="Budget (optional)" class="svy-input" /><input type="text" id="nrContact" placeholder="Contact (optional)" class="svy-input" /><button class="svy-btn nr-submit-btn" style="background:#111; color:#fff; text-align:center; margin-top:8px;">Submit Sourcing Request</button><button class="svy-link" onclick="closeSurvey()">Not Now</button>\`);
            document.querySelectorAll('.nr-submit-btn').forEach(function(btn) {
              btn.addEventListener('click', submitNoResults);
            });
          }
        }

        function submitNoResults() {
          const product = document.getElementById('nrProduct') ? document.getElementById('nrProduct').value : '';
          const location = document.getElementById('nrLocation') ? document.getElementById('nrLocation').value : '';
          if (!product || !location) { alert('Please provide product and location'); return; }
          logOfflineEvent({ eventType: 'LEAD_FOLLOWUP_ANSWERED', sourceType: 'catalogue', payload: { survey: 'sourcing_request', product: product, location: location, budget: document.getElementById('nrBudget') ? document.getElementById('nrBudget').value : '', contact: document.getElementById('nrContact') ? document.getElementById('nrContact').value : '' } });
          const text = encodeURIComponent("Sourcing Request\\nProduct: " + product + "\\nLocation: " + location + "\\nBudget: " + (document.getElementById('nrBudget') ? document.getElementById('nrBudget').value : '') + "\\nContact: " + (document.getElementById('nrContact') ? document.getElementById('nrContact').value : ''));
          document.getElementById('svyContent').innerHTML = \`<h3 class="svy-h3">Request Prepared!</h3><button class="svy-wa survey-wa-btn" data-text="\${text}">Send Request to seiGEN Commerce on WhatsApp</button><button class="svy-link" onclick="closeSurvey()">Close</button>\`;
          document.querySelectorAll('.survey-wa-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                  window.open(getFeedbackUrl(btn.getAttribute('data-text') || ''));
              });
          });
        }

        function checkExpiry() {
          const e = db.metadata.expiryDate;
          if (e) {
            const expiresAt = new Date(e).getTime();
            const hoursLeft = (expiresAt - Date.now()) / 3600000;
            if (expiresAt && expiresAt < Date.now()) {
              logOfflineEvent({ eventType: 'CATALOGUE_EXPIRED_VIEW', sourceType: 'catalogue', catalogueId: CATALOGUE_ID });
            }
            if (hoursLeft <= 48) { triggerExpirySurvey(); return true; }
          }
          return false;
        }

        function checkPendingLeads() {
          if (popupsShownThisSession > 0) return false;
          const leads = getPendingLeads();
          const now = Date.now();
          const dueLead = leads.find(function(l) { return !l.answered && l.followUpDueAt <= now; });
          
          if (dueLead) {
            triggerLeadFollowUpSurvey(dueLead);
            return true;
          } else {
            const nextLead = leads.find(function(l) { return !l.answered && l.followUpDueAt > now; });
            if (nextLead) {
              setTimeout(checkPendingLeads, nextLead.followUpDueAt - now);
            }
          }
          return false;
        }

        function triggerLeadFollowUpSurvey(lead) {
          if (popupsShownThisSession > 0) return;
          const html = 
            '<div class="bi-popup-badge">BI Follow-up</div>' +
            '<div class="bi-popup-note">This BI prompt helps improve vendor response analytics, stock accuracy, and customer experience. It does not make automated business decisions.</div>' +
            '<h3 class="svy-h3" style="margin-bottom:20px;">Were you helped by the vendor?</h3>' +
            '<p class="svy-p" style="margin-bottom:12px;">Regarding: <strong>' + escapeHtml(lead.productName) + '</strong> from <strong>' + escapeHtml(lead.vendorName) + '</strong></p>' +
            '<button class="svy-btn lead-followup-btn" data-lead-ref="' + escapeHtml(lead.leadRef) + '" data-answer="Yes, I was helped">Yes, I was helped</button>' +
            '<button class="svy-btn lead-followup-btn" data-lead-ref="' + escapeHtml(lead.leadRef) + '" data-answer="Vendor did not respond">Vendor did not respond</button>' +
            '<button class="svy-btn lead-followup-btn" data-lead-ref="' + escapeHtml(lead.leadRef) + '" data-answer="Product was unavailable">Product was unavailable</button>' +
            '<button class="svy-btn lead-followup-btn" data-lead-ref="' + escapeHtml(lead.leadRef) + '" data-answer="Price was different">Price was different</button>' +
            '<button class="svy-btn lead-followup-btn" data-lead-ref="' + escapeHtml(lead.leadRef) + '" data-answer="I still need help">I still need help</button>' +
            '<div style="margin-top:20px;">' +
              '<label style="font-size:12px; font-weight:bold; display:block; margin-bottom:6px;">Optional comment:</label>' +
              '<input type="text" id="leadComment" placeholder="Any additional details?" class="svy-input" />' +
            '</div>' +
            '<button class="svy-link" onclick="closeSurvey()">Not Now</button>';
          showSurveyHtml(html);
          document.querySelectorAll(".lead-followup-btn").forEach(function(btn) {
            btn.addEventListener("click", function() {
              submitLeadFollowUp(
                btn.getAttribute("data-lead-ref") || "",
                btn.getAttribute("data-answer") || ""
              );
            });
          });
        }

        function submitLeadFollowUp(leadRef, answer) {
          const commentEl = document.getElementById('leadComment');
          const comment = commentEl ? commentEl.value : '';
          
          const leads = getPendingLeads();
          const lead = leads.find(function(l) { return l.leadRef === leadRef; });
          if (!lead) { closeSurvey(); return; }

          markLeadAnswered(leadRef);

          logOfflineEvent({
            eventType: 'LEAD_FOLLOWUP_ANSWERED',
            sourceType: 'catalogue',
            catalogueId: lead.catalogueId,
            vendorId: lead.vendorId,
            vendorName: lead.vendorName,
            productId: lead.productId,
            productName: lead.productName,
            leadRef: leadRef,
            payload: { survey: 'lead_followup', answer: answer, comment: comment }
          });

          const text = "SCI CUSTOMER FEEDBACK\\n\\nLead Ref: " + leadRef + "\\nCatalogue/Storefront: " + lead.catalogueId + "\\nVendor: " + lead.vendorName + "\\nProduct: " + lead.productName + "\\nCustomer answer: " + answer + "\\nComment: " + comment + "\\nTime: " + new Date().toISOString() + "\\n\\nPlease follow up.";
          const encodedText = encodeURIComponent(text);

          document.getElementById('svyContent').innerHTML = 
            '<h3 class="svy-h3">Thank you for your feedback!</h3>' +
            '<button class="svy-wa survey-wa-btn" data-text="' + encodedText + '">Send Feedback to seiGEN Commerce</button>' +
            '<button class="svy-link" onclick="closeSurvey()">Close</button>';
          document.querySelectorAll('.survey-wa-btn').forEach(function(btn) {
              btn.addEventListener('click', function() {
                  window.open(getFeedbackUrl(btn.getAttribute('data-text') || ''));
              });
          });
        }
        // --- End Commerce Intelligence Core ---

        const db = ${JSON.stringify(jsonData).replace(/</g, "\\u003c")};
        const CATALOGUE_ID = db.metadata.catalogueId || db.metadata.serialNumber;
        const CATALOGUE_SERIAL = db.metadata.serialNumber || CATALOGUE_ID;
        const SECTOR = db.metadata.sector;
        const CATEGORY = db.metadata.category;

        const products = Array.isArray(db.products) ? db.products : [];
        const vendors = Array.isArray(db.vendors) ? db.vendors : [];
        const cahLinks = Array.isArray(db.cahLinks) ? db.cahLinks : [];
        const RECENT_PRODUCTS_KEY = 'itred_recently_viewed_products';
        const SAVED_PRODUCTS_KEY = 'itred_saved_products';
        const SAVED_VENDORS_KEY = 'itred_saved_vendors';
        const CART_PRODUCTS_KEY = 'itred_cart_products';
        let activeFilterChip = 'all';
        let selectedVendorFilterId = "";
        let activeProductGroupId = "";
        let productGroupVendorQuery = "";

        function readJsonArray(key) {
            try {
                const value = JSON.parse(safeLocalStorageGet(key) || '[]');
                return Array.isArray(value) ? value : [];
            } catch (e) {
                return [];
            }
        }

        function writeJsonArray(key, value) {
            safeLocalStorageSet(key, JSON.stringify(Array.isArray(value) ? value.slice(0, 40) : []));
        }

        function uniqueValues(items) {
            const seen = {};
            return items.filter(function(value) {
                const clean = String(value || '').trim();
                if (!clean || seen[clean.toLowerCase()]) return false;
                seen[clean.toLowerCase()] = true;
                return true;
            }).sort();
        }

        function formatMoney(value) {
            const amount = Number(value || 0);
            return 'USD ' + (Number.isFinite(amount) ? amount.toFixed(2) : '0.00');
        }

        function productPrice(p) {
            return Number(p.sellingPrice || p.price || p.unitPrice || 0);
        }

        function productImage(p) {
            return p.imageUrl || p.primaryImageUrl || p.image || '';
        }

        function productImages(p) {
            const list = [productImage(p)];
            ['imageUrls', 'images', 'galleryImages', 'additionalImages'].forEach(function(key) {
                if (Array.isArray(p[key])) {
                    p[key].forEach(function(item) {
                        if (typeof item === 'string') list.push(item);
                        else if (item && (item.url || item.imageUrl)) list.push(item.url || item.imageUrl);
                    });
                }
            });
            const unique = uniqueValues(list);
            if (unique.length > 6) {
                console.warn('Listing exceeded image limit, truncating to first 6 images.');
            }
            return unique.slice(0, 6);
        }

        function normalizeProductIdentity(value, preserveCodes) {
            const text = String(value || '').toLowerCase().trim().replace(/[_|/]+/g, ' ');
            if (preserveCodes) {
                return text.replace(/[^a-z0-9 -]+/g, '').replace(/\s+/g, ' ').trim();
            }
            return text.replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
        }

        function productSku(p) {
            return p.sku || p.productCode || p.barcode || p.standardSku || p.vendorSku || '';
        }

        function buildProductGroupKey(p) {
            const sku = normalizeProductIdentity(productSku(p), true);
            if (sku && sku.length >= 4) return 'sku:' + sku;
            const name = normalizeProductIdentity(p.name || p.productName, false);
            const category = normalizeProductIdentity(p.category, false);
            const sector = normalizeProductIdentity(p.sector, false);
            if (name && (category || sector)) return ['name', name, category, sector].filter(Boolean).join(':');
            const attr = normalizeProductIdentity([p.brand, p.model, p.unitOfMeasure, p.quantityUnit, p.packagingSize].filter(Boolean).join(' '), false);
            if (name && attr) return 'attr:' + name + ':' + attr;
            return 'id:' + (p.id || Math.random().toString(36).slice(2));
        }

        function getVendorOptionLocation(option) {
            return [option.suburb, option.city, option.location].filter(Boolean).slice(0, 3).join(' · ') || 'Location not supplied';
        }

        function productGroupSearchBlob(group) {
            return textBlob([
                group.productName, group.representativeSku, group.sector, group.category,
                group.representativeDescription, group.minPrice, group.maxPrice,
                group.deliveryAvailable ? 'delivery ideliver' : '',
                group.vendors.map(function(v) {
                    return [
                        v.vendorName, v.branchName, v.location, v.suburb, v.city,
                        v.price, v.sku, v.condition, v.warranty,
                        v.deliveryAvailable ? 'delivery ideliver' : '',
                        v.iDeliverLabel,
                        v.productAttributes
                    ].join(' ');
                }).join(' ')
            ]);
        }

        function buildProductGroups(sourceProducts) {
            const groupsByKey = {};
            sourceProducts.forEach(function(p) {
                const vendor = getVendor(p.vendorId);
                const branch = getBranch(vendor, p.branchId);
                const key = buildProductGroupKey(p);
                const price = productPrice(p);
                const qty = Number(p.stockQuantity || p.quantityAvailable || p.availableQuantity || 0);
                const delivery = !!(p.deliveryAvailable || hasDelivery(vendor));
                const image = productImage(p);
                if (!groupsByKey[key]) {
                    groupsByKey[key] = {
                        groupId: 'grp-' + Object.keys(groupsByKey).length + '-' + key.replace(/[^a-z0-9]+/g, '-').slice(0, 48),
                        productKey: key,
                        productName: p.name || p.productName || 'Product',
                        sector: p.sector || (vendor ? vendor.sector : '') || '',
                        category: p.category || '',
                        thumbnailUrl: image || '',
                        imageAlt: p.name || p.productName || 'Product image',
                        representativeSku: productSku(p),
                        representativeDescription: p.description || '',
                        minPrice: price || 0,
                        maxPrice: price || 0,
                        totalAvailableQty: qty,
                        vendorCount: 0,
                        deliveryAvailable: delivery,
                        updatedAt: p.updatedAt || p.createdAt || '',
                        vendors: []
                    };
                }
                const group = groupsByKey[key];
                if (!group.thumbnailUrl && image) group.thumbnailUrl = image;
                if (!group.representativeSku && productSku(p)) group.representativeSku = productSku(p);
                if (!group.representativeDescription && p.description) group.representativeDescription = p.description;
                if (price > 0) {
                    group.minPrice = group.minPrice > 0 ? Math.min(group.minPrice, price) : price;
                    group.maxPrice = Math.max(group.maxPrice, price);
                }
                group.totalAvailableQty += qty;
                group.deliveryAvailable = group.deliveryAvailable || delivery;
                if ((p.updatedAt || '') > (group.updatedAt || '')) group.updatedAt = p.updatedAt;
                group.vendors.push({
                    vendorId: p.vendorId,
                    vendorName: (vendor ? vendor.name : null) || p.vendorName || 'Vendor',
                    vendorScore: vendor ? (vendor.trustScore || 0) : 0,
                    branchId: p.branchId || (branch ? (branch.id || branch.branchId) : ''),
                    branchName: (branch ? branch.name : null) || p.branchName || 'Main Shop',
                    location: getVendorLocation(vendor, branch),
                    suburb: (branch ? branch.suburb : '') || (vendor ? vendor.suburb : '') || p.suburb || '',
                    city: (branch ? branch.cityTown : '') || (vendor ? vendor.cityTown : '') || p.cityTown || '',
                    price: price,
                    currency: p.currency || 'USD',
                    qty: qty,
                    sku: productSku(p),
                    condition: p.condition || p.storageCondition || '',
                    warranty: p.warranty || '',
                    deliveryAvailable: delivery,
                    iDeliverLabel: delivery ? 'Delivery / iDeliver available' : 'Delivery not supplied',
                    phone: (branch ? branch.phone : '') || (vendor ? vendor.mainPhone : '') || '',
                    whatsapp: (branch ? branch.whatsapp : '') || (vendor ? vendor.whatsappNumber : '') || '',
                    storefrontUrl: vendorStorefrontUrl(vendor),
                    productId: p.id,
                    productDescription: p.description || '',
                    productAttributes: [p.brand, p.model, p.unitOfMeasure, p.quantityUnit, p.packagingSize].filter(Boolean).join(' / ')
                });
            });
            return Object.keys(groupsByKey).map(function(key) {
                const group = groupsByKey[key];
                group.vendorCount = group.vendors.length;
                group.vendors.sort(function(a, b) {
                    return (b.vendorScore || 0) - (a.vendorScore || 0) || (a.price || 0) - (b.price || 0);
                });
                return group;
            });
        }

        const productGroups = buildProductGroups(products);

        function vendorLogo(v) {
            return v ? (v.logoAssetUrl || v.logoUrl || v.businessLogoUrl || '') : '';
        }

        function vendorHeroImage(v) {
            return v ? (v.bannerUrl || v.coverImageUrl || v.storefrontBannerUrl || vendorLogo(v)) : '';
        }

        function vendorPhone(v) {
            return v ? (v.mainPhone || v.phone || v.businessPhone || '') : '';
        }

        function vendorWhatsapp(v) {
            return v ? (v.whatsappNumber || v.whatsapp || v.businessWhatsapp || '') : '';
        }

        function vendorStorefrontUrl(v) {
            return v ? (v.storefrontUrl || v.storefrontLink || v.publicStorefrontUrl || v.website || '') : '';
        }

        function vendorFullLocation(v) {
            return v ? [v.streetAddress, v.businessAddress, v.suburb, v.district, v.cityTown, v.province, v.country].filter(Boolean).join(', ') : '';
        }

        function vendorDirectionsUrl(v) {
            const location = vendorFullLocation(v);
            return location ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location) : '';
        }

        function cleanPhoneNumber(value, keepPlus) {
            return String(value || '').replace(keepPlus ? /[^0-9+]/g : /[^0-9]/g, '');
        }

        function branchName(branch) {
            return branch.branchName || branch.name || branch.shopName || branch.title || 'Main Shop';
        }

        function branchPhone(vendor, branch) {
            return branch.phone || branch.mainPhone || branch.businessPhone || vendorPhone(vendor);
        }

        function branchWhatsapp(vendor, branch) {
            return branch.whatsapp || branch.whatsappNumber || branch.businessWhatsapp || vendorWhatsapp(vendor);
        }

        function branchDeliveryAvailable(vendor, branch) {
            const blob = textBlob([
                branch.deliveryDetails, branch.deliveryNotes, branch.deliveryAreas,
                branch.iDeliverLabel, branch.deliveryAvailable ? 'delivery ideliver' : '',
                branch.hasDelivery ? 'delivery ideliver' : '',
                branch.offersDelivery ? 'delivery ideliver' : ''
            ]);
            return blob.includes('delivery') || branch.deliveryAvailable === true || branch.hasDelivery === true || branch.offersDelivery === true || hasDelivery(vendor);
        }

        function branchDeliveryLabel(vendor, branch) {
            if (branch.iDeliverLabel) return branch.iDeliverLabel;
            if (branch.deliveryLabel) return branch.deliveryLabel;
            return branchDeliveryAvailable(vendor, branch) ? 'Delivery / iDeliver available' : 'Delivery not supplied';
        }

        function branchAddress(branch) {
            return [branch.address || branch.streetAddress, branch.suburb, branch.district, branch.city || branch.cityTown, branch.province, branch.country].filter(Boolean).join(', ');
        }

        function ensureVendorBranches() {
            vendors.forEach(function(v, vendorIndex) {
                if (Array.isArray(v.branches) && v.branches.length > 0) return;
                const vendorProducts = products.filter(function(p) { return p.vendorId === v.id; });
                const inferredCategory = v.category || v.sector || (vendorProducts[0] ? (vendorProducts[0].category || vendorProducts[0].sector) : '');
                v.branches = [{
                    id: v.id + '-main-shop',
                    branchId: v.id + '-main-shop',
                    vendorId: v.id,
                    vendorName: v.name || v.tradingName || 'Vendor',
                    branchName: (v.suburb || v.cityTown) ? 'Main Shop' : 'Catalogue Shop ' + (vendorIndex + 1),
                    sector: v.sector || inferredCategory,
                    category: v.category || inferredCategory,
                    address: v.streetAddress || v.businessAddress || v.address || '',
                    suburb: v.suburb || '',
                    cityTown: v.cityTown || v.city || '',
                    country: v.country || '',
                    phone: vendorPhone(v),
                    whatsapp: vendorWhatsapp(v),
                    deliveryAvailable: hasDelivery(v),
                    iDeliverLabel: hasDelivery(v) ? 'Delivery / iDeliver available' : 'Delivery not supplied',
                    openingHours: v.openingHours || v.businessHours || ''
                }];
            });
        }

        function getVendorLocation(v, b) {
            return [
                b ? b.suburb : '',
                b ? b.cityTown : '',
                v ? v.suburb : '',
                v ? v.cityTown : '',
                v ? v.district : '',
                v ? v.province : ''
            ].filter(Boolean).slice(0, 2).join(', ') || 'Location not supplied';
        }

        function isInStock(p) {
            const stock = Number(p.stockQuantity || p.quantityAvailable || p.availableQuantity || 0);
            if (String(p.availability || '').toLowerCase().includes('stock')) return true;
            return stock > 0;
        }

        function isTrustedVendor(v) {
            return !!v && ((v.trustScore || 0) >= 60 || String(v.trustTier || '').toLowerCase().includes('trusted') || String(v.trustTier || '').toLowerCase().includes('verified'));
        }

        function getTrustClass(v) {
            if (!v) return 'new';
            const tier = String(v.trustTier || '').toLowerCase();
            if (tier.includes('trusted')) return 'trusted';
            if (tier.includes('verified')) return 'verified';
            return 'new';
        }

        function hasDelivery(v) {
            if (!v) return false;
            const blob = textBlob([v.deliveryDetails, v.deliveryNotes, v.deliveryAreas, v.deliveryPolicy, v.hasDelivery ? 'delivery' : '']);
            return blob.includes('delivery') || v.hasDelivery === true || v.offersDelivery === true;
        }

        ensureVendorBranches();

        function setSearchQuery(query) {
            const input = document.getElementById('searchInput');
            if (input) {
                input.value = query || '';
                updateSearchClear();
            }
        }

        function setMenuOpen(isOpen) {
            const menuButton = document.getElementById('menuButton');
            const menuSheet = document.getElementById('menuSheet');
            const menuBackdrop = document.getElementById('menuBackdrop');
            if (!menuButton || !menuSheet || !menuBackdrop) return;
            menuButton.classList.toggle('active', isOpen);
            menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            menuSheet.classList.toggle('open', isOpen);
            menuBackdrop.classList.toggle('open', isOpen);
        }

        let activeTabId = "tab-products";
        const searchPlaceholders = {
            "tab-products": "Search products, vendors, locations...",
            "tab-vendors": "Search vendors, sectors, locations...",
            "tab-hub": "Search Hub links, sectors, groups...",
            "tab-branches": "Search shops, vendors, suburbs, delivery..."
        };

        function updateSearchPlaceholder() {
            const input = document.getElementById('searchInput');
            const searchArea = document.getElementById('searchArea');
            const stats = document.getElementById('searchStats');
            const searchable = activeTabId !== 'tab-terms';
            if (searchArea) searchArea.style.display = activeTabId === 'tab-terms' ? 'none' : 'block';
            if (input) {
                input.placeholder = searchPlaceholders[activeTabId] || 'Search products, vendors, locations...';
                input.disabled = !searchable;
                input.readOnly = !searchable;
            }
            if (activeTabId === 'tab-terms' && stats) stats.style.display = 'none';
            updateSearchClear();
        }

        function getCurrentSearchQuery() {
            const input = document.getElementById("searchInput");
            return input ? input.value : "";
        }

        function renderActiveTab() {
            if (activeTabId === "tab-products") renderProducts();
            if (activeTabId === "tab-vendors") renderVendors();
            if (activeTabId === "tab-hub") renderHub();
            if (activeTabId === "tab-branches") renderBranchesDirectory();
        }

        function switchTab(targetId) {
            activeTabId = targetId || "tab-products";
            document.querySelectorAll('.menu-item').forEach(function(b) {
                b.classList.toggle('active', b.getAttribute('data-target') === targetId);
            });
            document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
            updateSearchPlaceholder();
            renderActiveTab();
            setMenuOpen(false);
            window.scrollTo(0,0);
        }

        const menuButton = document.getElementById('menuButton');
        if (menuButton) {
            menuButton.addEventListener('click', function() {
                const menuSheet = document.getElementById('menuSheet');
                setMenuOpen(!(menuSheet && menuSheet.classList.contains('open')));
            });
        }
        const menuBackdrop = document.getElementById('menuBackdrop');
        if (menuBackdrop) menuBackdrop.addEventListener('click', function() { setMenuOpen(false); });
        const headerCartButton = document.getElementById('headerCartButton');
        if (headerCartButton) headerCartButton.addEventListener('click', openCartModal);
        document.querySelectorAll('.menu-item').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'cart') {
                    openCartModal();
                    setMenuOpen(false);
                    return;
                }
                if (action === 'search') {
                    switchTab('tab-products');
                    const input = document.getElementById('searchInput');
                    if (input) setTimeout(function() { input.focus(); }, 50);
                    return;
                }
                switchTab(e.currentTarget.getAttribute('data-target'));
            });
        });

        // Modals
        const productModal = document.getElementById('productModal');
        const trustedVendorModal = document.getElementById('trustedVendorModal');
        const productGroupModal = document.getElementById('productGroupModal');
        const cartModal = document.getElementById('cartModal');
        function closeModal() {
            productModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        function closeTrustedVendorModal() {
            if (trustedVendorModal) trustedVendorModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        function closeProductGroupModal() {
            if (productGroupModal) productGroupModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        function closeCartModal() {
            if (cartModal) cartModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        productModal.addEventListener('click', function(e) {
            if(e.target === productModal) closeModal();
        });
        if (trustedVendorModal) {
            trustedVendorModal.addEventListener('click', function(e) {
                if(e.target === trustedVendorModal) closeTrustedVendorModal();
            });
        }
        if (productGroupModal) {
            productGroupModal.addEventListener('click', function(e) {
                if(e.target === productGroupModal) closeProductGroupModal();
            });
        }
        if (cartModal) {
            cartModal.addEventListener('click', function(e) {
                if(e.target === cartModal) closeCartModal();
            });
        }
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && productModal && productModal.style.display === 'flex') closeModal();
            if (e.key === 'Escape' && trustedVendorModal && trustedVendorModal.style.display === 'flex') closeTrustedVendorModal();
            if (e.key === 'Escape' && productGroupModal && productGroupModal.style.display === 'flex') closeProductGroupModal();
            if (e.key === 'Escape' && cartModal && cartModal.style.display === 'flex') closeCartModal();
        });

        function getVendor(id) { return vendors.find(function(v) { return v.id === id; }); }
        function getBranch(vendor, id) { 
            const branches = vendor && Array.isArray(vendor.branches) ? vendor.branches : [];
            return branches.find(function(b) { return b.id === id; }); 
        }

        function textBlob(parts) {
            return parts.filter(function(value) {
                return value !== undefined && value !== null && value !== '';
            }).join(' ').toLowerCase();
        }

        function normalizeSearchText(value) {
          return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9\\s]/g, " ")
            .replace(/\\s+/g, " ")
            .trim();
        }

        function matchesFreeOrderSearch(text, query) {
          const normalizedText = normalizeSearchText(text);
          const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
          if (tokens.length === 0) return true;
          return tokens.every(function(token) {
            return normalizedText.includes(token);
          });
        }

        function setSearchStats(label, count) {
            const stats = document.getElementById('searchStats');
            if (!stats) return;
            if (!normalizeSearchText(getCurrentSearchQuery())) {
                stats.style.display = 'none';
                stats.textContent = '';
                return;
            }
            stats.style.display = 'block';
            stats.textContent = count + ' ' + label + ' Found';
        }

        function getProductSearchBlob(p, vendor, branch) {
            return textBlob([
                p.name, p.productName, p.sku, p.productCode, p.standardSku, p.barcode,
                p.category, p.sector, p.brand, p.description, p.searchableText,
                Array.isArray(p.tags) ? p.tags.join(' ') : '',
                Array.isArray(p.keywords) ? p.keywords.join(' ') : '',
                p.country, p.province, p.cityTown, p.district, p.suburb, p.streetAddress, p.branchName,
                vendor ? vendor.name : '', vendor ? vendor.tradingName : '', vendor ? vendor.sector : '',
                vendor ? vendor.country : '', vendor ? vendor.province : '', vendor ? vendor.cityTown : '',
                vendor ? vendor.district : '', vendor ? vendor.suburb : '', vendor ? vendor.streetAddress : '',
                vendor ? vendor.businessAddress : '',
                branch ? branch.name : '', branch ? branch.country : '', branch ? branch.province : '',
                branch ? branch.cityTown : '', branch ? branch.district : '', branch ? branch.suburb : '',
                branch ? branch.streetAddress : '', branch ? branch.address : '', branch ? branch.landmark : ''
            ]);
        }

        function getVendorSearchBlob(v) {
            let branchBlob = '';
            if (Array.isArray(v.branches)) {
                branchBlob = v.branches.map(function(b) {
                    return [b.name, b.address, b.cityTown, b.suburb, b.province].join(' ');
                }).join(' ');
            }
            return textBlob([
                v.name, v.tradingName, v.sector, v.businessType, v.category,
                v.country, v.province, v.cityTown, v.district, v.suburb,
                v.streetAddress, v.businessAddress, v.phone, v.mainPhone,
                v.whatsapp, v.whatsappNumber, v.businessDescription, v.description,
                branchBlob
            ]);
        }

        function getHubSearchBlob(l) {
            const followerCount = l.currentFollowerCount || l.whatsappCommunityCount || l.whatsappChannelCount || l.whatsappGroupCount;
            return textBlob([
                l.name, l.type, l.sector, l.category, l.description,
                l.province, l.city, l.cityTown, l.district, l.suburb,
                l.linkType, l.groupType, l.hubType, followerCount
            ]);
        }

        function getBranchSearchBlob(v, b) {
            return textBlob([
                v ? v.name : '', v ? v.tradingName : '', v ? v.sector : '',
                b.name, b.country, b.province, b.cityTown, b.district, b.suburb,
                b.branchName, b.shopName, b.category, b.sector,
                b.streetAddress, b.address, b.landmark, b.phone, b.mainPhone,
                b.whatsapp, b.whatsappNumber, branchDeliveryLabel(v, b)
            ]);
        }

        function matchesBranchQuery(record, query) {
            const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
            if (tokens.length === 0) return true;
            const branch = record.branch;
            const vendor = record.vendor;
            const searchableText = normalizeSearchText(textBlob([
                vendor.name, vendor.tradingName, vendor.sector, vendor.category,
                branchName(branch), branch.sector, branch.category,
                branchAddress(branch), branch.city, branch.cityTown, branch.suburb,
                branch.phone, branch.mainPhone, branch.whatsapp, branch.whatsappNumber,
                branchDeliveryLabel(vendor, branch), branch.openingHours
            ]));
            return tokens.every(function(token) { return searchableText.includes(token); });
        }

        function getHubUrl(l) {
            return (
                l.whatsappCommunityLink ||
                l.whatsappChannelLink ||
                l.whatsappGroupLink ||
                l.whatsappUrl ||
                l.url ||
                l.link ||
                l.supportLink ||
                l.catalogueDistributionGroupLink ||
                l.vendorSupportGroupLink ||
                l.customerDiscoveryGroupLink ||
                l.rpnSupportGroupLink ||
                l.supportNumber ||
                ""
            );
        }

        function normalizeWhatsappHref(raw) {
            if (!raw) return "";
            var value = String(raw).trim();
            if (value.startsWith("http://") || value.startsWith("https://")) {
                return value;
            }
            var digits = value.replace(/[^0-9]/g, "");
            if (digits) {
                return "https://wa.me/" + digits;
            }
            return "";
        }

        function logHubClick(linkId) {
            const link = cahLinks.find(function(l) { return l.id === linkId; });
            if (!link) return;
            logOfflineEvent({
                eventType: 'HUB_LINK_CLICKED',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                sector: SECTOR,
                category: CATEGORY,
                payload: { linkId: link.id, linkName: link.name, linkUrl: getHubUrl(link) }
            });
            // The default <a> tag action will handle opening the link
            return true;
        }

        function bindHubEvents() {
            document.querySelectorAll(".hub-link").forEach(function(link) {
                link.addEventListener("click", function() {
                    logHubClick(link.getAttribute("data-link-id"));
                });
            });
        }

        function renderSupportPage() {
            const el = document.getElementById('supportPage');
            if (!el) return;
            const supportText = encodeURIComponent(
                "Catalogue Support Request\\nCatalogue: " + CATALOGUE_ID +
                "\\nSector: " + SECTOR +
                "\\nCategory: " + CATEGORY +
                "\\n\\nPlease help me with this catalogue."
            );
            const supportHref = getSupportUrl(supportText);
            const hubCount = cahLinks.length;
            el.innerHTML =
                '<section class="support-card">' +
                    '<div class="market-eyebrow">Catalogue Support</div>' +
                    '<h2 class="support-title">' + escapeHtml(SUPPORT_TITLE) + '</h2>' +
                    '<p class="support-copy">' + escapeHtml(SUPPORT_MESSAGE) + '</p>' +
                    '<a class="c-btn wa support-contact-link" href="' + supportHref + '" target="_blank" rel="noopener">WhatsApp Support</a>' +
                '</section>' +
                '<section class="support-card">' +
                    '<h3 class="support-title">Search Tips</h3>' +
                    '<div class="support-list">' +
                        '<div class="support-tip">Search product names, brands, categories, vendors, suburb, city, district, SKU or barcode.</div>' +
                        '<div class="support-tip">Use filters for availability, vendor, category, location and price range when the catalogue has many products.</div>' +
                        '<div class="support-tip">If a product is out of stock, open the product and contact the vendor to confirm alternatives.</div>' +
                    '</div>' +
                '</section>' +
                '<section class="support-card">' +
                    '<h3 class="support-title">Contact Routes</h3>' +
                    '<p class="support-copy">Product cards and product detail pages use vendor WhatsApp and call routes where available. Hub links included in this export: ' + hubCount + '.</p>' +
                    '<button type="button" class="c-btn" data-support-target="tab-hub">Open Hub Links</button>' +
                    '<button type="button" class="c-btn" data-support-target="tab-terms">View Trade Terms</button>' +
                '</section>';
            document.querySelectorAll('[data-support-target]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    switchTab(btn.getAttribute('data-support-target'));
                });
            });
            document.querySelectorAll('.support-contact-link').forEach(function(link) {
                link.addEventListener('click', function() {
                    logOfflineEvent({
                        eventType: 'SUPPORT_CONTACT_CLICKED',
                        sourceType: 'catalogue',
                        catalogueId: CATALOGUE_ID,
                        sector: SECTOR,
                        category: CATEGORY
                    });
                });
            });
        }

        function renderVendorPickerList() {
            const listEl = document.getElementById('vendorPickerList');
            if (!listEl) return;
            
            const input = document.getElementById('vendorPickerSearch');
            const query = input ? input.value : "";
            const terms = normalizeSearchText(query).split(" ").filter(Boolean);
            
            let html = '';
            
            const matchesAll = terms.length === 0 || terms.every(function(t) { return 'all vendors'.includes(t); });
            if (matchesAll) {
                html += '<div class="vp-card ' + (!selectedVendorFilterId ? 'selected' : '') + '" data-vendor-id="">' +
                    '<div class="vp-name">All Vendors</div>' +
                    '<div class="vp-meta">Show products from all vendors</div>' +
                '</div>';
            }

            vendors.forEach(function(v) {
                const searchBlob = getVendorSearchBlob(v);
                const matches = matchesFreeOrderSearch(searchBlob, query);
                if (!matches) return;
                
                const isSelected = v.id === selectedVendorFilterId;
                let pCount = 0;
                for(let i=0; i<products.length; i++) { if(products[i].vendorId === v.id) pCount++; }
                
                const waBadge = v.whatsappNumber ? '<span class="vp-badge wa">WhatsApp</span>' : '';
                const scoreBadge = v.trustScore ? '<span class="vp-badge score">Score: ' + v.trustScore + '</span>' : '';
                const pCountBadge = '<span class="vp-badge products">' + pCount + ' Products</span>';
                const location = [v.suburb, v.cityTown].filter(Boolean).join(', ');
                
                html += '<div class="vp-card ' + (isSelected ? 'selected' : '') + '" data-vendor-id="' + escapeHtml(v.id) + '">' +
                    '<div class="vp-name">' + escapeHtml(v.name) + '</div>' +
                    '<div class="vp-meta">' + escapeHtml(v.sector) + (location ? ' • ' + escapeHtml(location) : '') + '</div>' +
                    '<div class="vp-badges">' + waBadge + scoreBadge + pCountBadge + '</div>' +
                '</div>';
            });
            
            listEl.innerHTML = html || '<div style="padding: 20px; text-align: center; color: #888; font-size: 12px; font-weight: 800;">No vendors found</div>';
            
            listEl.querySelectorAll('.vp-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    const vid = card.getAttribute('data-vendor-id');
                    selectVendorFilter(vid);
                });
            });
        }

        function selectVendorFilter(vendorId) {
            selectedVendorFilterId = vendorId || "";
            const btn = document.getElementById('vendorFilterBtn');
            if (btn) {
                if (vendorId) {
                    const v = getVendor(vendorId);
                    btn.textContent = v ? v.name : "All Vendors";
                } else {
                    btn.textContent = "All Vendors";
                }
            }
            closeVendorPicker();
            
            if (activeTabId === 'tab-products') {
                renderProducts();
            } else if (activeTabId === 'tab-vendors') {
                renderVendors();
            }
        }

        function openVendorPicker() {
            const overlay = document.getElementById('vendorPickerOverlay');
            if (overlay) overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            renderVendorPickerList();
            const input = document.getElementById('vendorPickerSearch');
            if (input) input.focus();
        }

        function closeVendorPicker() {
            const overlay = document.getElementById('vendorPickerOverlay');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        function initVendorPicker() {
            const vFilterBtn = document.getElementById('vendorFilterBtn');
            if (vFilterBtn) vFilterBtn.addEventListener('click', openVendorPicker);

            const vpOverlay = document.getElementById('vendorPickerOverlay');
            if (vpOverlay) {
                vpOverlay.addEventListener('click', function(e) {
                    if (e.target === vpOverlay) closeVendorPicker();
                });
            }

            const vpClose = document.getElementById('vendorPickerClose');
            if (vpClose) vpClose.addEventListener('click', closeVendorPicker);

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeVendorPicker();
            });

            const vpSearch = document.getElementById('vendorPickerSearch');
            const vpClear = document.getElementById('vendorPickerClear');

            if (vpSearch && vpClear) {
                vpSearch.addEventListener('input', function() {
                    vpClear.style.display = vpSearch.value ? 'block' : 'none';
                    renderVendorPickerList();
                });
                vpClear.addEventListener('click', function() {
                    vpSearch.value = '';
                    vpClear.style.display = 'none';
                    renderVendorPickerList();
                    vpSearch.focus();
                });
            }
        }

        function renderHub() {
            const grid = document.getElementById('hubGrid');
            if(cahLinks.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO SECTOR WHATSAPP GROUPS WERE INCLUDED IN THIS CATALOGUE</div>';
                setSearchStats('Hub Links', 0);
                return;
            }

            const query = getCurrentSearchQuery();
            const sortedLinks = [...cahLinks]
                .filter(function(l) { return matchesFreeOrderSearch(getHubSearchBlob(l), query); })
                .sort(function(a,b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
            setSearchStats('Hub Links', sortedLinks.length);

            if(sortedLinks.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO HUB LINKS FOUND FOR THIS SEARCH</div>';
                return;
            }

            let currentGroup = '';
            let htmlString = sortedLinks.map(function(l) {
                const rawUrl = getHubUrl(l);
                const href = normalizeWhatsappHref(rawUrl);
                
                if(!href) return '';
                const groupName = escapeHtml(l.sector || l.category || l.type || 'General');
                let groupHeading = '';
                if (groupName !== currentGroup) {
                    currentGroup = groupName;
                    groupHeading = '<h3 style="font-size:11px;font-weight:950;text-transform:uppercase;color:var(--brand-charcoal);margin:18px 0 8px;">' + groupName + '</h3>';
                }
                
                let typeLabel = escapeHtml(l.type);
                if (typeLabel.toLowerCase().includes('community')) typeLabel = 'Community';
                else if (typeLabel.toLowerCase().includes('group')) typeLabel = 'Group';
                else if (typeLabel.toLowerCase().includes('channel')) typeLabel = 'Channel';
                else if (typeLabel.toLowerCase().includes('support')) typeLabel = 'Support';
                
                const metaText = escapeHtml(l.sector || l.category || 'General');

                const followerCount = l.currentFollowerCount || l.whatsappCommunityCount || l.whatsappChannelCount || l.whatsappGroupCount;
                const countHtml = followerCount ? '<div style="font-size:10px; font-weight:800; color:var(--brand-orange); margin-bottom:8px;">' + followerCount.toLocaleString() + ' Members</div>' : '';

                const hasAdditional = Array.isArray(l.additionalWhatsappGroups) && l.additionalWhatsappGroups.length > 0;
                
                let cardHtml = groupHeading + '<div>';
                cardHtml += '<a href="' + href + '" class="hub-link" target="_blank" data-link-id="' + escapeHtml(l.id) + '" style="' + (hasAdditional ? 'margin-bottom:0; border-bottom:none;' : 'margin-bottom:12px;') + '">' +
                       '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">' +
                           '<div class="hub-type">' + typeLabel + '</div>' +
                           '<div style="font-size:8px; font-weight:900; color:#888; text-transform:uppercase;">' + metaText + '</div>' +
                       '</div>' +
                       '<div class="hub-name">' + escapeHtml(l.name) + '</div>' +
                       '<div style="font-size:11px; margin-top:4px; color:#666; margin-bottom:12px;">' + escapeHtml(l.description || '') + '</div>' +
                       countHtml +
                       '<div class="c-btn wa" style="margin-top:0;">Join / Open WhatsApp Hub</div>' +
                       '</a>';

                if (hasAdditional) {
                    cardHtml += '<div style="background: #f9f9f9; border: 1px solid #eee; border-top: none; padding: 0 16px 16px 16px; margin-bottom: 12px;">';
                    l.additionalWhatsappGroups.forEach(function(addGrp, idx) {
                        const addHref = normalizeWhatsappHref(addGrp);
                        if (addHref) {
                            cardHtml += '<a href="' + addHref + '" class="c-btn wa" target="_blank" style="margin-top:8px; opacity:0.85;">Open Sub-Group ' + (idx + 1) + '</a>';
                        }
                    });
                    cardHtml += '</div>';
                }
                cardHtml += '</div>';
                
                return cardHtml;
            }).join('');

            if (!htmlString) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px;">WhatsApp Hub links were selected, but no valid WhatsApp URL was found. Check the link fields in Access Hub setup.</div>';
                return;
            }

            grid.innerHTML = htmlString;
            bindHubEvents();
        }

        function renderProductRail(elementId, list, options) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const items = list.slice(0, 8);
            const compact = !!(options && options.compact);
            const grouped = !!(options && options.grouped);
            el.innerHTML = items.length
                ? items.map(function(item) { return grouped ? productGroupCardHtml(item, true, compact) : productCardHtml(item, true, compact); }).join('')
                : '<div style="padding:16px;font-size:11px;font-weight:900;color:#aaa;text-transform:uppercase;">No products available</div>';
            bindProductEvents();
            bindCommerceActionEvents(el);
        }

        function renderLandingSummary(elementId, list, fallbackText, filter) {
            const el = document.getElementById(elementId);
            if (!el) return;
            const count = Array.isArray(list) ? list.length : 0;
            const label = count === 1 ? '1 product available' : count + ' products available';
            el.innerHTML = '<div>' + (count ? label : fallbackText) + '</div>' +
                '<button type="button" data-home-filter="' + escapeHtml(filter || 'all') + '">Browse products</button>';
        }

        function bindHomeFilterButtons() {
            document.querySelectorAll('[data-home-filter]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const filter = btn.getAttribute('data-home-filter') || 'all';
                    const chip = document.querySelector('#filterChips .filter-chip[data-filter="' + filter + '"]');
                    document.querySelectorAll('#filterChips .filter-chip').forEach(function(item) {
                        item.classList.toggle('active', item === chip);
                    });
                    activeFilterChip = filter;
                    switchTab('tab-products');
                    renderProducts();
                });
            });
        }

        function renderTrustedVendors() {
            const el = document.getElementById('trustedVendorRail');
            if (!el) return;
            const trusted = vendors
                .slice()
                .sort(function(a, b) { return (b.trustScore || 0) - (a.trustScore || 0); })
                .slice(0, 10);
            el.innerHTML = trusted.map(function(v) {
                const logo = vendorLogo(v);
                const productCount = products.filter(function(p) { return p.vendorId === v.id; }).length;
                return '<div class="vendor-rail-card trusted-vendor-card" data-vendor-id="' + escapeHtml(v.id) + '">' +
                    '<div class="vendor-logo-box">' + (logo ? '<img src="' + escapeHtml(logo) + '" loading="lazy" onerror="this.style.display=\\'none\\'">' : escapeHtml((v.name || 'V').slice(0, 1))) + '</div>' +
                    '<div class="trust-badge ' + getTrustClass(v) + '">' + escapeHtml(v.trustTier || 'New Vendor') + '</div>' +
                    '<div style="font-size:14px;font-weight:950;margin-top:8px;">' + escapeHtml(v.name) + '</div>' +
                    '<div style="font-size:10px;font-weight:800;color:#666;margin-top:4px;">' + escapeHtml([v.sector || v.category, v.suburb || v.cityTown].filter(Boolean).join(' - ')) + '</div>' +
                    '<div style="font-size:10px;font-weight:900;color:var(--brand-orange);margin-top:8px;">' + escapeHtml(v.trustScore ? String(v.trustScore) + '/100' : productCount + ' products') + '</div>' +
                '</div>';
            }).join('');
            document.querySelectorAll('.trusted-vendor-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    openTrustedVendor(card.getAttribute('data-vendor-id'));
                });
            });
        }

        function renderContinueBrowsing() {
            const section = document.getElementById('continueBrowsingSection');
            const summary = document.getElementById('continueBrowsingSummary');
            if (!section || !summary) return;
            const recentIds = readJsonArray(RECENT_PRODUCTS_KEY);
            const savedIds = readJsonArray(SAVED_PRODUCTS_KEY);
            const ids = uniqueValues(recentIds.concat(savedIds));
            const items = ids.map(function(id) { return products.find(function(p) { return p.id === id; }); }).filter(Boolean);
            section.style.display = items.length ? 'block' : 'none';
            summary.innerHTML = '<div>' + items.length + ' saved or recently viewed products are ready in your catalogue.</div>' +
                '<button type="button" data-home-filter="all">Open product list</button>';
        }

        function renderVendors() {
            const grid = document.getElementById('vendorGrid');
            const query = getCurrentSearchQuery();
            const filteredVendors = vendors.filter(function(v) {
                const matchesSearch = matchesFreeOrderSearch(getVendorSearchBlob(v), query);
                const matchesPicker = !selectedVendorFilterId || v.id === selectedVendorFilterId;
                return matchesSearch && matchesPicker;
            });
            setSearchStats('Vendors', filteredVendors.length);

            if (filteredVendors.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO VENDORS FOUND FOR THIS SEARCH</div>';
                return;
            }

            grid.innerHTML = filteredVendors.map(function(v) { 
                return "<div class=\\"vendor-card\\">" +
                    "<div class=\\"vendor-score\\">" + escapeHtml(v.trustTier) + " (" + v.trustScore + "/100)</div>" +
                    "<div style=\\"font-size: 16px; font-weight: 900; margin-bottom: 4px;\\">" + escapeHtml(v.name) + "</div>" +
                    "<div style=\\"font-size: 12px; color: #666; margin-bottom: 8px;\\">" + escapeHtml(v.cityTown) + " • " + escapeHtml(v.sector) + "</div>" +
                    (v.businessDescription ? "<p style=\\"font-size:12px; margin-bottom:12px;\\">" + escapeHtml(v.businessDescription) + "</p>" : "") +
                    (v.whatsappNumber ? "<a href=\\"https://wa.me/" + v.whatsappNumber + "\\" class=\\"c-btn wa\\" target=\\"_blank\\">WhatsApp Vendor</a>" : "") +
                "</div>";
            }).join('');
        }

        function renderBranchesDirectory() {
            const grid = document.getElementById('branchGrid');
            const localSearch = document.getElementById('branchDirectorySearch');
            const query = localSearch && localSearch.value.trim() ? localSearch.value : getCurrentSearchQuery();
            const records = [];

            vendors.forEach(function(v) {
                if (v.branches && v.branches.length > 0) {
                    v.branches.forEach(function(b) {
                        records.push({ vendor: v, branch: b });
                    });
                }
            });

            if (records.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO SHOPS DIRECTORY WAS INCLUDED IN THIS CATALOGUE</div>';
                setSearchStats('Shops', 0);
                return;
            }

            const filtered = records.filter(function(record) {
                return matchesBranchQuery(record, query);
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO SHOPS FOUND FOR THIS SEARCH</div>';
                setSearchStats('Shops', 0);
                return;
            }

            grid.innerHTML = filtered.map(function(record) {
                const v = record.vendor;
                const b = record.branch;
                const phone = branchPhone(v, b);
                const whatsapp = branchWhatsapp(v, b);
                const sector = b.sector || b.category || v.sector || v.category || 'General';
                const citySuburb = [b.suburb, b.city || b.cityTown].filter(Boolean).join(', ');
                const address = branchAddress(b) || vendorFullLocation(v) || 'Location not supplied';
                const delivery = branchDeliveryLabel(v, b);
                const waMessage = encodeURIComponent('Hello, I found your shop on iTred powered by seiGEN Commerce. I would like to enquire about your products.');
                const callAction = phone
                    ? '<a href="tel:' + cleanPhoneNumber(phone, true) + '" class="modal-outline-action vendor-call-link" data-vendor-id="' + escapeHtml(v.id || '') + '" style="min-height:44px;" aria-label="Call ' + escapeHtml(branchName(b)) + '">' + iconSvg('call') + '<span>Call</span></a>'
                    : '<button type="button" class="modal-outline-action" disabled style="min-height:44px;opacity:.4;">' + iconSvg('call') + '<span>Call</span></button>';
                const waAction = whatsapp
                    ? '<a href="https://wa.me/' + cleanPhoneNumber(whatsapp, false) + '?text=' + waMessage + '" class="modal-outline-action primary vendor-wa-link" data-vendor-id="' + escapeHtml(v.id || '') + '" target="_blank" rel="noopener" style="min-height:44px;" aria-label="WhatsApp ' + escapeHtml(branchName(b)) + '">' + iconSvg('whatsapp') + '<span>WhatsApp</span></a>'
                    : '<button type="button" class="modal-outline-action primary" disabled style="min-height:44px;opacity:.4;">' + iconSvg('whatsapp') + '<span>WhatsApp</span></button>';

                return '<div class="vendor-card">' +
                    '<div style="font-size:10px;font-weight:900;color:var(--brand-orange);text-transform:uppercase;margin-bottom:4px;">' + escapeHtml(v.name || v.tradingName || 'Vendor') + '</div>' +
                    '<div style="font-size:15px;font-weight:800;margin-bottom:6px;">' + escapeHtml(branchName(b)) + '</div>' +
                    '<div class="trust-badge ' + getTrustClass(v) + '" style="margin-bottom:10px;">' + escapeHtml(sector) + '</div>' +
                    '<div class="m-row"><span class="m-lbl">Address / Location</span><span class="m-val">' + escapeHtml(address) + '</span></div>' +
                    '<div class="m-row"><span class="m-lbl">City / Suburb</span><span class="m-val">' + escapeHtml(citySuburb || 'Not supplied') + '</span></div>' +
                    '<div class="m-row"><span class="m-lbl">Opening Hours</span><span class="m-val">' + escapeHtml(b.openingHours || b.businessHours || v.openingHours || 'Not supplied') + '</span></div>' +
                    '<div class="m-row"><span class="m-lbl">Delivery / iDeliver</span><span class="m-val">' + escapeHtml(delivery) + '</span></div>' +
                    '<div class="m-row"><span class="m-lbl">Phone</span><span class="m-val">' + escapeHtml(phone || 'Not supplied') + '</span></div>' +
                    '<div class="m-row"><span class="m-lbl">WhatsApp</span><span class="m-val">' + escapeHtml(whatsapp || 'Not supplied') + '</span></div>' +
                    '<div class="branch-card-actions">' + callAction + waAction + '</div>' +
                '</div>';
            }).join('');
            setSearchStats('Shops', filtered.length);
            bindCommerceActionEvents(grid);
        }

        function rankProduct(p, tokens) {
            let score = 0;
            const vendor = getVendor(p.vendorId);
            const branch = getBranch(vendor, p.branchId);

            const searchBlob = normalizeSearchText(getProductSearchBlob(p, vendor, branch));

            if (tokens.some(function(t) { return searchBlob === t; })) score += 100; // Exact match somewhere
            if (tokens.some(function(t) { return normalizeSearchText(p.name || '').includes(t); })) score += 50;
            if (tokens.some(function(t) { return normalizeSearchText((vendor ? vendor.name : '') || '').includes(t); })) score += 42;
            if (tokens.some(function(t) { return normalizeSearchText(p.category || '').includes(t) || normalizeSearchText(p.sector || '').includes(t); })) score += 30;
            if (tokens.some(function(t) {
                return normalizeSearchText(textBlob([
                    vendor ? vendor.suburb : '', vendor ? vendor.cityTown : '',
                    branch ? branch.suburb : '', branch ? branch.cityTown : ''
                ])).includes(t);
            })) score += 34;
            
            if (vendor && String(vendor.status || '').toLowerCase() === 'active') score += 16;
            if (vendor) score += ((vendor.trustScore || 0) / 10);
            if (p.stockQuantity > 0) score += 10;
            if (p.imageUrl) score += 15;

            return score;
        }

        let searchTimeout;
        let lastQuery = '';
        function debouncedSearchLog() {
            const searchInput = document.getElementById('searchInput');
            if(!searchInput) return;
            const rawQuery = normalizeSearchText(searchInput.value);
            if (rawQuery.length < 2 || rawQuery === lastQuery) return;
            lastQuery = rawQuery;

            let grid = document.getElementById('productGrid');
            let selector = '.product-card, .product-group-card';
            if (activeTabId === 'tab-vendors') {
                grid = document.getElementById('vendorGrid');
                selector = '.vendor-card';
            } else if (activeTabId === 'tab-hub') {
                grid = document.getElementById('hubGrid');
                selector = '.hub-link';
            } else if (activeTabId === 'tab-branches') {
                grid = document.getElementById('branchGrid');
                selector = '.vendor-card';
            }
            const matchCount = grid ? grid.querySelectorAll(selector).length : 0;

            sessionSearches++;
            if (matchCount === 0) {
              sessionEmptySearches++;
              if (sessionEmptySearches >= 2) { setTimeout(triggerNoResultsSurvey, 1500); }
            } else if (sessionSearches >= 2) {
              setTimeout(triggerHelpfulnessSurvey, 2000);
            }

            logOfflineEvent({
                eventType: matchCount > 0 ? 'SEARCH_PERFORMED' : 'NO_RESULTS_SEARCH',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                payload: { query: rawQuery, results: matchCount }
            });
        }

        window.addEventListener("online", function() {
            scheduleOfflineEventSync(0);
        });

        function bindProductEvents() {
            document.querySelectorAll(".product-group-card").forEach(function(card) {
                card.addEventListener("click", function() {
                    openProductGroup(card.getAttribute("data-group-id"));
                });
            });
            document.querySelectorAll(".product-card").forEach(function(card) {
                card.addEventListener("click", function() {
                    const productId = card.getAttribute("data-product-id");
                    logOfflineEvent({
                        eventType: 'product_click',
                        sourceType: 'catalogue',
                        catalogueId: CATALOGUE_ID,
                        productId: productId
                    });
                    openProduct(productId);
                });
            });
            document.querySelectorAll(".card-action").forEach(function(btn) {
                btn.addEventListener("click", function(event) {
                    event.stopPropagation();
                    const id = btn.getAttribute("data-product-id");
                    const action = btn.getAttribute("data-action");
                    if (action === "view") {
                        logOfflineEvent({
                            eventType: 'product_click',
                            sourceType: 'catalogue',
                            catalogueId: CATALOGUE_ID,
                            productId: id
                        });
                        openProduct(id);
                    }
                    if (action === "save") toggleSavedProduct(id);
                });
            });
            document.querySelectorAll(".product-group-action").forEach(function(btn) {
                btn.addEventListener("click", function(event) {
                    event.stopPropagation();
                    openProductGroup(btn.getAttribute("data-group-id"));
                });
            });
            document.querySelectorAll(".product-group-card .mini-action").forEach(function(action) {
                action.addEventListener("click", function(event) {
                    event.stopPropagation();
                });
            });
        }

        function priceRangeText(group) {
            if (!group.minPrice && !group.maxPrice) return 'Confirm price';
            if (group.minPrice === group.maxPrice) return formatMoney(group.minPrice);
            return formatMoney(group.minPrice) + ' - ' + formatMoney(group.maxPrice);
        }

        function productGroupCardHtml(group, rail, compact) {
            const locationSummary = uniqueValues(group.vendors.map(function(v) { return v.suburb || v.city || v.location; }).filter(Boolean)).slice(0, 3).join(' / ');
            const primaryOption = group.vendors[0] || {};
            const leadRef = 'ITRED-' + CATALOGUE_ID + '-' + (primaryOption.vendorId || 'vendor') + '-' + group.groupId;
            const msg = encodeURIComponent("Hi " + (primaryOption.vendorName || 'Vendor') + ", I saw this product on iTred.\\n\\nProduct: " + group.productName + "\\nPrice: " + priceRangeText(group) + "\\nRef: " + leadRef + "\\n\\nPlease confirm availability.");
            const waHref = primaryOption.whatsapp ? 'https://wa.me/' + String(primaryOption.whatsapp).replace(/[^0-9]/g, '') + '?text=' + msg : '';
            const callHref = primaryOption.phone ? 'tel:' + String(primaryOption.phone).replace(/[^0-9+]/g, '') : '';
            const actionsHtml = compact ? '' :
                '<div class="card-actions">' +
                    (waHref ? '<a class="product-action-btn whatsapp mini-action wa product-wa-link" href="' + waHref + '" target="_blank" rel="noopener" data-product-id="' + escapeHtml(primaryOption.productId || '') + '" aria-label="Contact vendor on WhatsApp">' + iconSvg('whatsapp') + '</a>' : '<span class="product-action-btn whatsapp mini-action wa disabled" aria-label="WhatsApp contact not available">' + iconSvg('whatsapp') + '</span>') +
                    (callHref ? '<a class="product-action-btn call mini-action call product-call-link" href="' + callHref + '" data-product-id="' + escapeHtml(primaryOption.productId || '') + '" aria-label="Call vendor directly">' + iconSvg('call') + '</a>' : '<span class="product-action-btn call mini-action call disabled" aria-label="Direct call not available">' + iconSvg('call') + '</span>') +
                    '<button type="button" class="mini-action product-group-action" data-group-id="' + escapeHtml(group.groupId) + '">View details</button>' +
                '</div>';
            return '<div class="' + (rail ? 'rail-card ' : '') + (compact ? 'compact-discovery ' : '') + 'product-group-card" data-group-id="' + escapeHtml(group.groupId) + '">' +
                '<div class="product-image-box">' +
                    (group.thumbnailUrl ? '<img src="' + escapeHtml(group.thumbnailUrl) + '" width="160" height="160" loading="lazy" alt="' + escapeHtml(group.imageAlt) + '" onerror="this.style.display=\\'none\\'">' : '<span style="font-size:10px;font-weight:500;color:#bbb;">NO IMAGE</span>') +
                '</div>' +
                '<div class="product-group-body">' +
                    '<div class="product-card-top">' +
                        '<span class="trust-badge verified">' + escapeHtml(group.vendorCount + ' vendors') + '</span>' +
                        '<span class="stock-badge ' + (group.totalAvailableQty > 0 ? 'in' : '') + '">' + (group.totalAvailableQty > 0 ? group.totalAvailableQty + ' qty' : 'Confirm qty') + '</span>' +
                    '</div>' +
                    '<h3 class="product-name">' + escapeHtml(group.productName) + '</h3>' +
                    '<div class="product-price">' + priceRangeText(group) + '</div>' +
                    '<div class="vendor-line">' + escapeHtml([group.sector, group.category].filter(Boolean).join(' / ') || 'General') + '</div>' +
                    '<div class="location-line">' + escapeHtml(locationSummary || 'Multiple locations') + '</div>' +
                    '<div class="group-meta-row">' +
                        (group.deliveryAvailable ? '<span class="group-chip">Delivery / iDeliver</span>' : '') +
                        '<span class="group-chip">' + escapeHtml(primaryOption.vendorName || group.vendorCount + ' sellers') + '</span>' +
                    '</div>' +
                    actionsHtml +
                '</div>' +
            '</div>';
        }

        function productCardHtml(p, rail, compact) {
            const vendor = getVendor(p.vendorId);
            const branch = getBranch(vendor, p.branchId);
            const location = getVendorLocation(vendor, branch);
            const vendorName = (vendor ? vendor.name : null) || p.vendorName || 'Vendor';
            const image = productImage(p);
            const trustClass = getTrustClass(vendor);
            const trustText = vendor && vendor.trustTier ? vendor.trustTier : 'New Vendor';
            const stockText = isInStock(p) ? 'In Stock' : 'Confirm Stock';
            const phone = (branch ? branch.phone : null) || (vendor ? vendor.mainPhone : null);
            const wa = (branch ? branch.whatsapp : null) || (vendor ? vendor.whatsappNumber : null);
            const leadRef = 'ITRED-' + CATALOGUE_ID + '-' + p.vendorId + '-' + p.id;
            const msg = encodeURIComponent("Hi " + vendorName + ", I saw this product on iTred.\\n\\nProduct: " + (p.name || p.productName || '') + "\\nPrice: " + formatMoney(productPrice(p)) + "\\nRef: " + leadRef + "\\n\\nPlease confirm availability.");
            const waHref = wa ? 'https://wa.me/' + String(wa).replace(/[^0-9]/g, '') + '?text=' + msg : '';
            const callHref = phone ? 'tel:' + String(phone).replace(/[^0-9+]/g, '') : '';
            const supportHref = getSupportUrl(encodeURIComponent("Catalogue Support Request\\nProduct: " + (p.name || p.productName || '') + "\\nVendor: " + vendorName + "\\nCatalogue: " + CATALOGUE_ID));
            const actionsHtml = compact ? '' :
                '<div class="card-actions">' +
                    (waHref ? '<a class="product-action-btn whatsapp mini-action wa product-wa-link" href="' + waHref + '" target="_blank" rel="noopener" data-product-id="' + escapeHtml(p.id) + '" aria-label="Contact vendor on WhatsApp">' + iconSvg('whatsapp') + '</a>' : '<a class="product-action-btn whatsapp mini-action wa support-contact-link" href="' + supportHref + '" target="_blank" rel="noopener" aria-label="Contact catalogue support on WhatsApp">' + iconSvg('whatsapp') + '</a>') +
                    (callHref ? '<a class="product-action-btn call mini-action call product-call-link" href="' + callHref + '" data-product-id="' + escapeHtml(p.id) + '" aria-label="Call vendor directly">' + iconSvg('call') + '</a>' : '<span class="product-action-btn call mini-action call disabled" aria-label="Direct call not available">' + iconSvg('call') + '</span>') +
                    '<button type="button" class="product-action-btn view mini-action card-action" data-action="view" data-product-id="' + escapeHtml(p.id) + '" aria-label="View product details">' + iconSvg('search') + '</button>' +
                '</div>';
            const brandedBadge = p.productMode === 'branded_product'
                ? '<span class="trust-badge in" style="border-color:#16a34a;color:#16a34a;">BRANDED</span>'
                : '<span class="trust-badge">LINKED</span>';
            const displayVendorName = p.productMode === 'branded_product' && p.brandDisplayName
                ? p.brandDisplayName
                : vendorName;
            return '<div class="' + (rail ? 'rail-card ' : '') + (compact ? 'compact-discovery ' : '') + 'market-product-card product-card" data-product-id="' + escapeHtml(p.id) + '">' +
                '<div class="product-image-box">' +
                    (image ? '<img src="' + escapeHtml(image) + '" width="160" height="160" loading="lazy" onerror="this.style.display=\\'none\\'">' : '<span style="font-size:10px;font-weight:500;color:#bbb;">NO IMAGE</span>') +
                '</div>' +
                '<div class="product-card-body">' +
                    '<div class="product-card-top">' +
                        '<span class="trust-badge ' + trustClass + '">' + escapeHtml(trustText) + '</span>' +
                        '<span class="stock-badge ' + (isInStock(p) ? 'in' : '') + '">' + stockText + '</span>' +
                    '</div>' +
                    '<div style="margin-bottom:6px;">' + brandedBadge + '</div>' +
                    '<h3 class="product-name">' + escapeHtml(p.name || p.productName || 'Product') + '</h3>' +
                    '<div class="product-price">' + formatMoney(productPrice(p)) + '</div>' +
                    '<div class="vendor-line">' + escapeHtml(displayVendorName) + '</div>' +
                    '<div class="location-line">' + escapeHtml(location) + '</div>' +
                    actionsHtml +
                '</div>' +
            '</div>';
        }

        function bindCommerceActionEvents(root) {
            const scope = root || document;
            scope.querySelectorAll(".product-wa-link").forEach(function(btn) {
                btn.addEventListener("click", function(event) {
                    event.stopPropagation();
                    logWaClick(btn.getAttribute("data-product-id"));
                });
            });
            scope.querySelectorAll(".product-call-link").forEach(function(btn) {
                btn.addEventListener("click", function(event) {
                    event.stopPropagation();
                    logCallClick(btn.getAttribute("data-product-id"));
                });
            });
            scope.querySelectorAll(".support-contact-link").forEach(function(btn) {
                btn.addEventListener("click", function(event) {
                    event.stopPropagation();
                    logOfflineEvent({
                        eventType: 'SUPPORT_CONTACT_CLICKED',
                        sourceType: 'catalogue',
                        catalogueId: CATALOGUE_ID,
                        sector: SECTOR,
                        category: CATEGORY
                    });
                });
            });
            scope.querySelectorAll(".vendor-wa-link").forEach(function(btn) {
                btn.addEventListener("click", function(event) {
                    event.stopPropagation();
                    logOfflineEvent({
                        eventType: 'whatsapp_click',
                        sourceType: 'catalogue',
                        catalogueId: CATALOGUE_ID,
                        vendorId: btn.getAttribute("data-vendor-id") || null
                    });
                });
            });
            scope.querySelectorAll(".vendor-call-link").forEach(function(btn) {
                btn.addEventListener("click", function(event) {
                    event.stopPropagation();
                    logOfflineEvent({
                        eventType: 'call_click',
                        sourceType: 'catalogue',
                        catalogueId: CATALOGUE_ID,
                        vendorId: btn.getAttribute("data-vendor-id") || null
                    });
                });
            });
        }

        function populateFilters() {
            const categoryFilter = document.getElementById('categoryFilter');
            if (categoryFilter && categoryFilter.options.length <= 1) {
                uniqueValues(products.map(function(p) { return p.category || p.sector; })).forEach(function(value) {
                    categoryFilter.innerHTML += '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>';
                });
            }
            ['categoryFilter','locationFilter','availabilityFilter','minPriceFilter','maxPriceFilter'].forEach(function(id) {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', renderProducts);
                if (el) el.addEventListener('change', renderProducts);
            });
            document.querySelectorAll('#filterChips .filter-chip').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    activeFilterChip = btn.getAttribute('data-filter') || 'all';
                    document.querySelectorAll('#filterChips .filter-chip').forEach(function(item) {
                        item.classList.toggle('active', item === btn);
                    });
                    renderProducts();
                });
            });
            renderSearchSuggestions();
        }

        function renderSearchSuggestions() {
            const el = document.getElementById('searchSuggestions');
            if (!el) return;
            const values = uniqueValues([
                ...products.map(function(p) { return p.category || p.sector; }),
                ...products.map(function(p) { return p.brand; }),
                ...vendors.map(function(v) { return v.name || v.tradingName; }),
                ...vendors.map(function(v) { return v.cityTown || v.suburb || v.district; })
            ]).filter(Boolean).slice(0, 12);
            el.innerHTML = values.map(function(value) {
                return '<button type="button" class="search-suggestion" data-search-suggestion="' + escapeHtml(value) + '">' + escapeHtml(value) + '</button>';
            }).join('');
            document.querySelectorAll('[data-search-suggestion]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const input = document.getElementById('searchInput');
                    if (input) {
                        input.value = btn.getAttribute('data-search-suggestion') || '';
                        updateSearchClear();
                    }
                    switchTab('tab-products');
                    renderProducts();
                });
            });
        }

        function applyDiscoveryFilters(list) {
            const category = (document.getElementById('categoryFilter') || {}).value || '';
            const vendorId = selectedVendorFilterId;
            const location = ((document.getElementById('locationFilter') || {}).value || '').toLowerCase().trim();
            const availability = (document.getElementById('availabilityFilter') || {}).value || '';
            const minPrice = Number((document.getElementById('minPriceFilter') || {}).value || 0);
            const maxPriceRaw = (document.getElementById('maxPriceFilter') || {}).value || '';
            const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : null;

            let filtered = list.filter(function(p) {
                const vendor = getVendor(p.vendorId);
                const branch = getBranch(vendor, p.branchId);
                const price = productPrice(p);
                const locBlob = textBlob([
                    vendor ? vendor.country : '', vendor ? vendor.province : '', vendor ? vendor.cityTown : '',
                    vendor ? vendor.district : '', vendor ? vendor.suburb : '', vendor ? vendor.streetAddress : '',
                    branch ? branch.name : '', branch ? branch.address : '', branch ? branch.streetAddress : '',
                    branch ? branch.landmark : '', branch ? branch.suburb : '', branch ? branch.cityTown : ''
                ]);
                return (
                    (!category || String(p.category || p.sector || '') === category) &&
                    (!vendorId || p.vendorId === vendorId) &&
                    (!location || locBlob.includes(location)) &&
                    (!availability || (availability === 'in-stock' ? isInStock(p) : !isInStock(p))) &&
                    (!minPrice || price >= minPrice) &&
                    (maxPrice === null || price <= maxPrice)
                );
            });

            if (activeFilterChip === 'in-stock') filtered = filtered.filter(isInStock);
            if (activeFilterChip === 'trusted') filtered = filtered.filter(function(p) { return isTrustedVendor(getVendor(p.vendorId)); });
            if (activeFilterChip === 'near') {
                filtered = filtered.sort(function(a, b) {
                    return rankProduct(b, []) - rankProduct(a, []);
                });
            }
            if (activeFilterChip === 'best-value') filtered = filtered.sort(function(a, b) { return productPrice(a) - productPrice(b); });
            if (activeFilterChip === 'new') filtered = filtered.sort(function(a, b) {
                return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
            });
            return filtered;
        }

        function applyGroupDiscoveryFilters(list) {
            const category = (document.getElementById('categoryFilter') || {}).value || '';
            const vendorId = selectedVendorFilterId;
            const location = ((document.getElementById('locationFilter') || {}).value || '').toLowerCase().trim();
            const availability = (document.getElementById('availabilityFilter') || {}).value || '';
            const minPrice = Number((document.getElementById('minPriceFilter') || {}).value || 0);
            const maxPriceRaw = (document.getElementById('maxPriceFilter') || {}).value || '';
            const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : null;

            let filtered = list.filter(function(group) {
                const locBlob = textBlob(group.vendors.map(function(v) { return [v.location, v.suburb, v.city].join(' '); }));
                return (
                    (!category || String(group.category || group.sector || '') === category) &&
                    (!vendorId || group.vendors.some(function(v) { return v.vendorId === vendorId; })) &&
                    (!location || locBlob.includes(location)) &&
                    (!availability || (availability === 'in-stock' ? group.totalAvailableQty > 0 : group.totalAvailableQty <= 0)) &&
                    (!minPrice || group.maxPrice >= minPrice) &&
                    (maxPrice === null || group.minPrice <= maxPrice)
                );
            });

            if (activeFilterChip === 'in-stock') filtered = filtered.filter(function(group) { return group.totalAvailableQty > 0; });
            if (activeFilterChip === 'trusted') filtered = filtered.filter(function(group) {
                return group.vendors.some(function(option) { return isTrustedVendor(getVendor(option.vendorId)); });
            });
            if (activeFilterChip === 'near') {
                filtered = filtered.sort(function(a, b) { return b.vendorCount - a.vendorCount; });
            }
            if (activeFilterChip === 'best-value') filtered = filtered.sort(function(a, b) { return (a.minPrice || 999999999) - (b.minPrice || 999999999); });
            if (activeFilterChip === 'new') filtered = filtered.sort(function(a, b) {
                return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
            });
            return filtered;
        }

        function renderProducts() {
            const grid = document.getElementById('productGrid');
            const rawQuery = getCurrentSearchQuery();
            const tokens = normalizeSearchText(rawQuery).split(" ").filter(Boolean);

            if (productGroups.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO PRODUCTS WERE INCLUDED IN THIS CATALOGUE</div>';
                setSearchStats('Products', 0);
                return;
            }

            let filtered = productGroups;

            if (tokens.length > 0) {
                filtered = productGroups.filter(function(group) {
                    return matchesFreeOrderSearch(productGroupSearchBlob(group), rawQuery);
                });
                logOfflineEvent({
                    eventType: 'product_group_searched',
                    sourceType: 'catalogue',
                    catalogueId: CATALOGUE_ID,
                    payload: { query: rawQuery, groups: filtered.length }
                });
            }

            filtered = applyGroupDiscoveryFilters(filtered);
            setSearchStats('Products', filtered.length);

            if(filtered.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc;">NO PRODUCTS FOUND FOR THIS SEARCH</div>';
                return;
            }

            grid.innerHTML = filtered.map(function(group) { return productGroupCardHtml(group, false); }).join('');
            bindProductEvents();
            bindCommerceActionEvents(grid);
        }

        function logWaClick(productId) {
            const p = products.find(function(x) { return x.id === productId; });
            if (!p) return;

            const vendor = getVendor(p.vendorId);
            const leadRef = 'ITRED-' + CATALOGUE_ID + '-' + p.vendorId + '-' + p.id;

            storePendingLead({
              leadRef: leadRef,
              timestamp: new Date().toISOString(),
              vendorId: p.vendorId,
              vendorName: (vendor ? vendor.name : null) || p.vendorName,
              productId: p.id,
              productName: p.name,
              catalogueId: CATALOGUE_ID,
              sector: SECTOR,
              category: CATEGORY,
              actionType: 'WHATSAPP',
              followUpDueAt: Date.now() + 30 * 60000,
              answered: false
            });

            logOfflineEvent({
                eventType: 'WHATSAPP_VENDOR_CLICKED',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: p.vendorId,
                vendorName: (vendor ? vendor.name : null) || p.vendorName,
                productId: p.id,
                productName: p.name,
                leadRef: leadRef,
                payload: { price: p.sellingPrice }
            });
            logOfflineEvent({
                eventType: 'vendor_whatsapp_clicked',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: p.vendorId,
                vendorName: (vendor ? vendor.name : null) || p.vendorName,
                productId: p.id,
                productName: p.name,
                payload: { price: p.sellingPrice }
            });
        }

        function logCallClick(productId) {
            const p = products.find(function(x) { return x.id === productId; });
            if (!p) return;

            const vendor = getVendor(p.vendorId);
            const leadRef = 'ITRED-' + CATALOGUE_ID + '-' + p.vendorId + '-' + p.id;

            storePendingLead({
              leadRef: leadRef,
              timestamp: new Date().toISOString(),
              vendorId: p.vendorId,
              vendorName: (vendor ? vendor.name : null) || p.vendorName,
              productId: p.id,
              productName: p.name,
              catalogueId: CATALOGUE_ID,
              sector: SECTOR,
              category: CATEGORY,
              actionType: 'CALL',
              followUpDueAt: Date.now() + 30 * 60000,
              answered: false
            });

            logOfflineEvent({
                eventType: 'CALL_VENDOR_CLICKED',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: p.vendorId,
                vendorName: (vendor ? vendor.name : null) || p.vendorName,
                productId: p.id,
                productName: p.name,
                leadRef: leadRef,
                payload: { price: p.sellingPrice }
            });
            logOfflineEvent({
                eventType: 'vendor_call_clicked',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: p.vendorId,
                vendorName: (vendor ? vendor.name : null) || p.vendorName,
                productId: p.id,
                productName: p.name,
                payload: { price: p.sellingPrice }
            });
        }

        function rememberRecentProduct(productId) {
            if (!productId) return;
            const recent = readJsonArray(RECENT_PRODUCTS_KEY).filter(function(id) { return id !== productId; });
            recent.unshift(productId);
            writeJsonArray(RECENT_PRODUCTS_KEY, recent.slice(0, 16));
            renderContinueBrowsing();
        }

        function toggleSavedProduct(productId) {
            if (!productId) return;
            let saved = readJsonArray(SAVED_PRODUCTS_KEY);
            if (saved.indexOf(productId) >= 0) {
                saved = saved.filter(function(id) { return id !== productId; });
                alert('Product removed from saved list.');
            } else {
                saved.unshift(productId);
                alert('Product saved on this device.');
            }
            writeJsonArray(SAVED_PRODUCTS_KEY, saved);
            renderContinueBrowsing();
        }

        function toggleSavedVendor(vendorId) {
            if (!vendorId) return;
            let saved = readJsonArray(SAVED_VENDORS_KEY);
            if (saved.indexOf(vendorId) >= 0) {
                saved = saved.filter(function(id) { return id !== vendorId; });
                alert('Vendor removed from saved list.');
            } else {
                saved.unshift(vendorId);
                alert('Vendor saved on this device.');
            }
            writeJsonArray(SAVED_VENDORS_KEY, saved);
        }

        function addProductToCart(productId) {
            if (!productId) return;
            const p = products.find(function(x) { return x.id === productId; });
            const vendor = p ? getVendor(p.vendorId) : null;
            const cart = readJsonArray(CART_PRODUCTS_KEY).filter(function(id) { return id !== productId; });
            cart.unshift(productId);
            writeJsonArray(CART_PRODUCTS_KEY, cart.slice(0, 50));
            logOfflineEvent({
                eventType: 'cart_add',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: p ? p.vendorId : null,
                vendorName: (vendor ? vendor.name : null) || (p ? p.vendorName : null),
                productId: productId,
                productName: p ? (p.name || p.productName) : null,
                payload: { source: 'product_modal' }
            });
            alert('Product added to cart on this device.');
        }

        function addVendorOptionToCart(groupId, productId) {
            const group = productGroups.find(function(item) { return item.groupId === groupId; });
            if (!group) return;
            const option = group.vendors.find(function(item) { return item.productId === productId; });
            if (!option || !option.vendorId || !option.productId) return;
            const cart = readJsonArray(CART_PRODUCTS_KEY);
            const existing = cart.find(function(item) {
                return item && typeof item !== 'string' && item.productId === productId && item.vendorId === option.vendorId;
            });
            if (existing) {
                existing.qtyRequested = Number(existing.qtyRequested || existing.qty || 1) + 1;
                existing.qty = existing.qtyRequested;
            } else {
                cart.unshift({
                groupId: groupId,
                productId: productId,
                productName: group.productName,
                vendorId: option.vendorId,
                vendorName: option.vendorName,
                branchId: option.branchId || '',
                branchName: option.branchName || '',
                price: option.price,
                currency: option.currency || 'USD',
                qtyRequested: 1,
                qty: 1,
                availableQty: option.qty || 0,
                location: option.location || '',
                suburb: option.suburb || '',
                city: option.city || '',
                phone: option.phone || '',
                whatsapp: option.whatsapp || '',
                storefrontUrl: option.storefrontUrl || '',
                deliveryAvailable: !!option.deliveryAvailable,
                iDeliverLabel: option.iDeliverLabel || ''
                });
            }
            writeJsonArray(CART_PRODUCTS_KEY, cart.slice(0, 50));
            updateHeaderCartCount();
            logOfflineEvent({
                eventType: 'cart_item_added',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: option.vendorId,
                vendorName: option.vendorName,
                productId: productId,
                productName: group.productName,
                payload: { price: option.price, groupId: groupId }
            });
            // TODO BI: cart_item_added should sync when catalogue BI capture is online.
            alert('Vendor-specific enquiry added to cart.');
        }

        function getCartItems() {
            return readJsonArray(CART_PRODUCTS_KEY).filter(function(item) {
                return item && typeof item !== 'string' && item.vendorId && item.productId;
            });
        }

        function saveCartItems(items) {
            writeJsonArray(CART_PRODUCTS_KEY, items);
            updateHeaderCartCount();
        }

        function getCartCount() {
            return getCartItems().reduce(function(total, item) {
                return total + Math.max(1, Number(item.qtyRequested || item.qty || 1));
            }, 0);
        }

        function updateHeaderCartCount() {
            const countEl = document.getElementById('headerCartCount');
            if (!countEl) return;
            const count = getCartCount();
            countEl.textContent = String(count);
            countEl.style.display = count > 0 ? 'block' : 'none';
        }

        function cartVendorKey(item) {
            return [item.vendorId, item.branchId || item.branchName || item.location || 'main'].join('::');
        }

        function groupCartItemsByVendor(items) {
            const groups = {};
            items.forEach(function(item) {
                const key = cartVendorKey(item);
                if (!groups[key]) {
                    groups[key] = {
                        key: key,
                        vendorId: item.vendorId,
                        vendorName: item.vendorName || 'Vendor',
                        branchName: item.branchName || '',
                        location: [item.suburb, item.city, item.location].filter(Boolean).join(' / '),
                        phone: item.phone || '',
                        whatsapp: item.whatsapp || '',
                        items: []
                    };
                }
                groups[key].items.push(item);
                if (!groups[key].phone && item.phone) groups[key].phone = item.phone;
                if (!groups[key].whatsapp && item.whatsapp) groups[key].whatsapp = item.whatsapp;
            });
            return Object.keys(groups).map(function(key) { return groups[key]; });
        }

        function cartLineTotal(item) {
            return Number(item.price || 0) * Math.max(1, Number(item.qtyRequested || item.qty || 1));
        }

        function cartGroupSubtotal(group) {
            return group.items.reduce(function(total, item) { return total + cartLineTotal(item); }, 0);
        }

        function removeCartItem(productId, vendorId) {
            const removed = getCartItems().find(function(item) {
                return item.productId === productId && item.vendorId === vendorId;
            });
            const remaining = getCartItems().filter(function(item) {
                return !(item.productId === productId && item.vendorId === vendorId);
            });
            saveCartItems(remaining);
            logOfflineEvent({
                eventType: 'cart_remove',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: vendorId,
                vendorName: removed ? removed.vendorName : null,
                productId: productId,
                productName: removed ? removed.productName : null
            });
            renderCartContent();
        }

        function removeCartVendorGroup(groupKey) {
            const remaining = getCartItems().filter(function(item) {
                return cartVendorKey(item) !== groupKey;
            });
            saveCartItems(remaining);
            logOfflineEvent({
                eventType: 'cart_vendor_group_removed',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                payload: { vendorGroup: groupKey }
            });
            // TODO BI: cart_vendor_group_removed can be uploaded when BI sync is available.
            renderCartContent();
        }

        function buildVendorCartMessage(group) {
            const currency = (group.items[0] && group.items[0].currency) || 'USD';
            const lines = group.items.map(function(item, index) {
                const qty = Math.max(1, Number(item.qtyRequested || item.qty || 1));
                return (index + 1) + '. ' + (item.productName || 'Product') + ' - Qty: ' + qty + ' - Price: ' + ((item.currency || currency) + ' ' + Number(item.price || 0).toFixed(2));
            }).join('\\n');
            return "Hello, I found these products on iTred powered by seiGEN Commerce.\\n\\n" +
                "Vendor: " + group.vendorName + "\\n" +
                "Branch: " + ([group.branchName, group.location].filter(Boolean).join(' / ') || 'Main shop') + "\\n\\n" +
                "Items:\\n" + lines + "\\n\\n" +
                "Estimated Total: " + currency + " " + cartGroupSubtotal(group).toFixed(2) + "\\n\\n" +
                "Please confirm availability, final price, and delivery options.";
        }

        function sendCartVendorLead(groupKey) {
            const group = groupCartItemsByVendor(getCartItems()).find(function(item) { return item.key === groupKey; });
            if (!group) return;
            const contact = cleanPhoneNumber(group.whatsapp || group.phone, false);
            if (!contact) {
                alert('This vendor has no WhatsApp or phone number configured.');
                return;
            }
            const href = 'https://wa.me/' + contact + '?text=' + encodeURIComponent(buildVendorCartMessage(group));
            logOfflineEvent({
                eventType: 'cart_vendor_lead_sent',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: group.vendorId,
                vendorName: group.vendorName,
                payload: { itemCount: group.items.length, subtotal: cartGroupSubtotal(group) }
            });
            logOfflineEvent({
                eventType: 'whatsapp_click',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: group.vendorId,
                vendorName: group.vendorName,
                payload: { source: 'cart', itemCount: group.items.length }
            });
            window.open(href, '_blank', 'noopener');
            const remaining = getCartItems().filter(function(item) {
                return cartVendorKey(item) !== groupKey;
            });
            saveCartItems(remaining);
            const confirmation = document.getElementById('cartConfirmation');
            if (confirmation) {
                confirmation.textContent = 'Lead sent to ' + group.vendorName + '. Vendor items cleared from cart.';
                confirmation.style.display = 'block';
            }
            // TODO BI: cart_vendor_lead_sent should sync with offline BI event capture.
            renderCartContent();
        }

        function renderCartContent() {
            const container = document.getElementById('cartContent');
            if (!container) return;
            const items = getCartItems();
            if (!items.length) {
                container.innerHTML = '<div class="cart-empty-state">Cart is empty. Add vendor-specific product options from a product group.</div>';
                updateHeaderCartCount();
                return;
            }
            const groups = groupCartItemsByVendor(items);
            container.innerHTML = groups.map(function(group) {
                const callHref = group.phone ? 'tel:' + cleanPhoneNumber(group.phone, true) : '';
                return '<div class="cart-vendor-group">' +
                    '<div class="cart-vendor-head">' +
                        '<div>' +
                            '<div class="cart-vendor-name">' + escapeHtml(group.vendorName) + '</div>' +
                            '<div class="cart-vendor-meta">' + escapeHtml([group.branchName, group.location].filter(Boolean).join(' / ') || 'Branch not supplied') + '</div>' +
                            '<div class="cart-vendor-meta">' + escapeHtml([group.whatsapp ? 'WhatsApp available' : '', group.phone ? 'Phone available' : ''].filter(Boolean).join(' / ') || 'No contact supplied') + '</div>' +
                        '</div>' +
                        '<div style="font-size:12px;font-weight:900;color:var(--brand-dark-orange);font-family:monospace;">' + formatMoney(cartGroupSubtotal(group)) + '</div>' +
                    '</div>' +
                    group.items.map(function(item) {
                        const qty = Math.max(1, Number(item.qtyRequested || item.qty || 1));
                        return '<div class="cart-item-row">' +
                            '<div>' +
                                '<div class="cart-item-name">' + escapeHtml(item.productName || 'Product') + '</div>' +
                                '<div class="cart-item-meta">Qty ' + qty + ' / ' + escapeHtml(item.currency || 'USD') + ' ' + Number(item.price || 0).toFixed(2) + ' / ' + escapeHtml([item.iDeliverLabel, item.location].filter(Boolean).join(' / ')) + '</div>' +
                            '</div>' +
                            '<button type="button" class="modal-outline-action remove-cart-item-btn" data-product-id="' + escapeHtml(item.productId) + '" data-vendor-id="' + escapeHtml(item.vendorId) + '" style="width:42px;height:34px;padding:0;">' + iconSvg('trash') + '</button>' +
                        '</div>';
                    }).join('') +
                    '<div class="cart-vendor-actions">' +
                        '<button type="button" class="modal-outline-action primary send-cart-vendor-btn" data-group-key="' + escapeHtml(group.key) + '">' + iconSvg('whatsapp') + '<span>Send</span></button>' +
                        (callHref ? '<a class="modal-outline-action vendor-call-link" data-vendor-id="' + escapeHtml(group.vendorId || '') + '" href="' + callHref + '">' + iconSvg('call') + '<span>Call</span></a>' : disabledOutlineAction('call', 'Call')) +
                        '<button type="button" class="modal-outline-action remove-cart-vendor-btn" data-group-key="' + escapeHtml(group.key) + '">' + iconSvg('trash') + '<span>Remove</span></button>' +
                    '</div>' +
                '</div>';
            }).join('');
            document.querySelectorAll('.send-cart-vendor-btn').forEach(function(btn) {
                btn.addEventListener('click', function() { sendCartVendorLead(btn.getAttribute('data-group-key')); });
            });
            document.querySelectorAll('.remove-cart-vendor-btn').forEach(function(btn) {
                btn.addEventListener('click', function() { removeCartVendorGroup(btn.getAttribute('data-group-key')); });
            });
            document.querySelectorAll('.remove-cart-item-btn').forEach(function(btn) {
                btn.addEventListener('click', function() { removeCartItem(btn.getAttribute('data-product-id'), btn.getAttribute('data-vendor-id')); });
            });
            updateHeaderCartCount();
        }

        function openCartModal() {
            if (!cartModal) return;
            const confirmation = document.getElementById('cartConfirmation');
            if (confirmation) {
                confirmation.textContent = '';
                confirmation.style.display = 'none';
            }
            renderCartContent();
            cartModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            logOfflineEvent({
                eventType: 'cart_opened',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                payload: { itemCount: getCartCount() }
            });
            // TODO BI: cart_opened should be synced when static catalogue events are uploaded.
        }

        function shareProduct(productId) {
            const p = products.find(function(x) { return x.id === productId; });
            if (!p) return;
            const vendor = getVendor(p.vendorId);
            logOfflineEvent({
                eventType: 'share_click',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: p.vendorId,
                vendorName: (vendor ? vendor.name : null) || p.vendorName,
                productId: p.id,
                productName: p.name || p.productName
            });
            const text = (p.name || p.productName || 'Product') + "\\n" +
                formatMoney(productPrice(p)) + "\\n" +
                "Vendor: " + (((vendor ? vendor.name : null) || p.vendorName || 'Vendor')) + "\\n" +
                "Catalogue: " + CATALOGUE_ID;
            if (navigator.share) {
                navigator.share({ title: p.name || 'iTred Product', text: text }).catch(function() {});
                return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function() {
                    alert('Product details copied.');
                }).catch(function() {
                    alert(text);
                });
            } else {
                alert(text);
            }
        }

        function iconSvg(name) {
            const icons = {
                cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2 2h3l3.6 12.6a2 2 0 0 0 2 1.4h7.7a2 2 0 0 0 1.9-1.4L22 7H6"></path></svg>',
                whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"></path><path d="M9 8.8c.3 2 2.1 4 4.2 4.8l1.3-1.1 2 .6"></path></svg>',
                call: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.4a2 2 0 0 1-.5 1.8L8 9a16 16 0 0 0 7 7l1.1-1.1a2 2 0 0 1 1.8-.5l2.4.5a2 2 0 0 1 1.7 2Z"></path></svg>',
                offer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"></path><path d="M7 7h.01"></path></svg>',
                vendor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18l-1-5H4L3 9Z"></path><path d="M5 9v11h14V9"></path><path d="M9 20v-6h6v6"></path></svg>',
                location: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 10.6 6.8-4.2"></path><path d="m8.6 13.4 6.8 4.2"></path></svg>',
                search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>',
                trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>'
            };
            return icons[name] || '';
        }

        function outlineButtonHtml(id, iconName, label, primary) {
            return '<button type="button" class="modal-outline-action ' + (primary ? 'primary' : '') + '" id="' + id + '">' + iconSvg(iconName) + '<span>' + label + '</span></button>';
        }

        function outlineLinkHtml(href, className, iconName, label, primary, productId) {
            const dataAttribute = productId
                ? (String(className || '').indexOf('vendor-') >= 0 ? 'data-vendor-id="' + escapeHtml(productId) + '"' : 'data-product-id="' + escapeHtml(productId) + '"')
                : '';
            return '<a href="' + href + '" class="modal-outline-action ' + (primary ? 'primary ' : '') + className + '" target="_blank" rel="noopener" ' + dataAttribute + '>' + iconSvg(iconName) + '<span>' + label + '</span></a>';
        }

        function disabledOutlineAction(iconName, label) {
            return '<button type="button" class="modal-outline-action" disabled style="opacity:.4;">' + iconSvg(iconName) + '<span>' + label + '</span></button>';
        }

        function matchesVendorOptionQuery(vendorOption, query) {
            const words = String(query || '').toLowerCase().trim().split(/\\s+/).filter(Boolean);
            if (!words.length) return true;
            const searchableText = [
                vendorOption.vendorName,
                vendorOption.branchName,
                vendorOption.price,
                vendorOption.currency,
                vendorOption.location,
                vendorOption.suburb,
                vendorOption.city,
                vendorOption.deliveryAvailable ? 'delivery available ideliver' : '',
                vendorOption.iDeliverLabel,
                vendorOption.qty,
                vendorOption.condition,
                vendorOption.warranty
            ].filter(Boolean).join(' ').toLowerCase();
            return words.every(function(word) { return searchableText.includes(word); });
        }

        function vendorOptionActionsHtml(group, option) {
            const waMessage = encodeURIComponent("Hello, I found this product on iTred powered by seiGEN Commerce.\\nProduct: " + group.productName + "\\nVendor: " + option.vendorName + "\\nListed Price: " + formatMoney(option.price) + "\\nPlease confirm availability.");
            const offerMessage = encodeURIComponent("Hello, I found this product on iTred powered by seiGEN Commerce.\\nProduct: " + group.productName + "\\nVendor: " + option.vendorName + "\\nListed Price: " + formatMoney(option.price) + "\\nMy Offer: [enter offer]\\nLocation: [enter location]\\nIs this acceptable?");
            const waHref = option.whatsapp ? 'https://wa.me/' + String(option.whatsapp).replace(/[^0-9]/g, '') + '?text=' + waMessage : '';
            const offerHref = option.whatsapp ? 'https://wa.me/' + String(option.whatsapp).replace(/[^0-9]/g, '') + '?text=' + offerMessage : '';
            const callHref = option.phone ? 'tel:' + String(option.phone).replace(/[^0-9+]/g, '') : '';
            return '<div class="vendor-option-actions">' +
                '<button type="button" class="modal-outline-action vendor-detail-btn" data-product-id="' + escapeHtml(option.productId) + '">' + iconSvg('vendor') + '<span>Details</span></button>' +
                (callHref ? '<a href="' + callHref + '" class="modal-outline-action product-call-link" data-product-id="' + escapeHtml(option.productId) + '">' + iconSvg('call') + '<span>Call</span></a>' : disabledOutlineAction('call', 'Call')) +
                (waHref ? '<a href="' + waHref + '" class="modal-outline-action primary product-wa-link" target="_blank" rel="noopener" data-product-id="' + escapeHtml(option.productId) + '">' + iconSvg('whatsapp') + '<span>WhatsApp</span></a>' : disabledOutlineAction('whatsapp', 'WhatsApp')) +
                (option.storefrontUrl ? '<a href="' + escapeHtml(option.storefrontUrl) + '" class="modal-outline-action" target="_blank" rel="noopener">' + iconSvg('vendor') + '<span>Store</span></a>' : disabledOutlineAction('vendor', 'Store')) +
                '<button type="button" class="modal-outline-action add-option-cart-btn" data-group-id="' + escapeHtml(group.groupId) + '" data-product-id="' + escapeHtml(option.productId) + '">' + iconSvg('cart') + '<span>Cart</span></button>' +
                (offerHref ? '<a href="' + offerHref + '" class="modal-outline-action price-offer-link" target="_blank" rel="noopener" data-product-id="' + escapeHtml(option.productId) + '" data-group-id="' + escapeHtml(group.groupId) + '">' + iconSvg('offer') + '<span>Offer</span></a>' : disabledOutlineAction('offer', 'Offer')) +
            '</div>';
        }

        function vendorOptionRowHtml(group, option) {
            const vendor = getVendor(option.vendorId);
            return '<div class="vendor-option-row">' +
                '<div class="vendor-option-main vendor-detail-btn" data-product-id="' + escapeHtml(option.productId) + '">' +
                    '<div>' +
                        '<div style="font-size:12px;font-weight:900;text-transform:uppercase;color:var(--brand-charcoal);">' + escapeHtml(option.vendorName) + '</div>' +
                        '<div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#777;">' + escapeHtml([option.branchName, getVendorOptionLocation(option)].filter(Boolean).join(' / ')) + '</div>' +
                        '<div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#777;">' + escapeHtml([option.condition, option.warranty, option.iDeliverLabel].filter(Boolean).join(' / ')) + '</div>' +
                    '</div>' +
                    '<div style="text-align:right;">' +
                        '<div style="font-size:13px;font-weight:900;color:var(--brand-dark-orange);font-family:monospace;">' + formatMoney(option.price) + '</div>' +
                        '<div class="trust-badge ' + getTrustClass(vendor) + '" style="margin-top:4px;">' + escapeHtml((vendor && vendor.trustTier) || 'Vendor') + '</div>' +
                        '<div style="font-size:9px;font-weight:900;color:#777;margin-top:4px;">Qty ' + escapeHtml(option.qty || 'Confirm') + '</div>' +
                    '</div>' +
                '</div>' +
                vendorOptionActionsHtml(group, option) +
            '</div>';
        }

        function bindProductGroupVendorActions(group) {
            if (!productGroupModal) return;
            productGroupModal.querySelectorAll('.vendor-detail-btn').forEach(function(btn) {
                btn.addEventListener('click', function(event) {
                    event.stopPropagation();
                    logOfflineEvent({
                        eventType: 'vendor_option_opened',
                        sourceType: 'catalogue',
                        catalogueId: CATALOGUE_ID,
                        productId: btn.getAttribute('data-product-id'),
                        productName: group.productName,
                        payload: { groupId: group.groupId }
                    });
                    openProduct(btn.getAttribute('data-product-id'));
                });
            });
            productGroupModal.querySelectorAll('.add-option-cart-btn').forEach(function(btn) {
                btn.addEventListener('click', function(event) {
                    event.stopPropagation();
                    addVendorOptionToCart(btn.getAttribute('data-group-id'), btn.getAttribute('data-product-id'));
                });
            });
            productGroupModal.querySelectorAll('.price-offer-link').forEach(function(btn) {
                btn.addEventListener('click', function(event) {
                    event.stopPropagation();
                    logOfflineEvent({
                        eventType: 'price_offer_started',
                        sourceType: 'catalogue',
                        catalogueId: CATALOGUE_ID,
                        productId: btn.getAttribute('data-product-id'),
                        productName: group.productName,
                        payload: { groupId: btn.getAttribute('data-group-id') }
                    });
                });
            });
            bindCommerceActionEvents(productGroupModal);
        }

        function renderProductGroupVendors() {
            const group = productGroups.find(function(item) { return item.groupId === activeProductGroupId; });
            const list = document.getElementById('pgVendorOptions');
            const meta = document.getElementById('pgVendorSearchMeta');
            if (!group || !list) return;
            const filtered = group.vendors.filter(function(option) {
                return matchesVendorOptionQuery(option, productGroupVendorQuery);
            });
            if (meta) meta.textContent = 'Showing ' + filtered.length + ' of ' + group.vendors.length + ' vendors';
            list.innerHTML = filtered.length
                ? filtered.map(function(option) { return vendorOptionRowHtml(group, option); }).join('')
                : '<div class="cart-empty-state">No vendor options match this search.</div>';
            bindProductGroupVendorActions(group);
            if (productGroupVendorQuery) {
                logOfflineEvent({
                    eventType: 'vendor_option_searched',
                    sourceType: 'catalogue',
                    catalogueId: CATALOGUE_ID,
                    productName: group.productName,
                    payload: { groupId: group.groupId, query: productGroupVendorQuery, results: filtered.length }
                });
                // TODO BI: vendor_option_searched should sync when BI event upload is enabled.
            }
        }

        function openProductGroup(groupId) {
            const group = productGroups.find(function(item) { return item.groupId === groupId; });
            if (!group || !productGroupModal) return;
            activeProductGroupId = groupId;
            productGroupVendorQuery = "";
            document.getElementById('pgImage').innerHTML = group.thumbnailUrl
                ? '<img src="' + escapeHtml(group.thumbnailUrl) + '" class="m-image" width="160" height="160" alt="' + escapeHtml(group.imageAlt) + '" loading="lazy" onerror="this.style.display=\\'none\\'">'
                : '<div class="m-image" style="display:flex;align-items:center;justify-content:center;color:#ccc;font-weight:900;">NO IMAGE</div>';
            document.getElementById('pgCategory').textContent = [group.sector, group.category].filter(Boolean).join(' / ') || 'Product Group';
            document.getElementById('pgTitle').textContent = group.productName;
            document.getElementById('pgPrice').textContent = priceRangeText(group);
            document.getElementById('pgMeta').innerHTML =
                '<span class="group-chip">' + group.vendorCount + ' vendors</span>' +
                '<span class="group-chip">' + group.totalAvailableQty + ' qty</span>' +
                (group.deliveryAvailable ? '<span class="group-chip">Delivery / iDeliver</span>' : '');
            document.getElementById('pgDescription').textContent = group.representativeDescription || 'Select a vendor below to view vendor-specific product details.';
            const vendorSearch = document.getElementById('pgVendorSearch');
            if (vendorSearch) {
                vendorSearch.value = "";
                vendorSearch.oninput = function() {
                    productGroupVendorQuery = vendorSearch.value || "";
                    renderProductGroupVendors();
                };
            }
            renderProductGroupVendors();
            logOfflineEvent({
                eventType: 'product_group_viewed',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                productName: group.productName,
                payload: { groupId: group.groupId, vendorCount: group.vendorCount }
            });
            productGroupModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        function openTrustedVendor(vendorId) {
            const vendor = getVendor(vendorId);
            if (!vendor || !trustedVendorModal) return;
            const logo = vendorHeroImage(vendor);
            const vendorName = vendor.name || vendor.tradingName || 'Trusted Vendor';
            const sector = vendor.sector || vendor.category || vendor.businessType || 'Vendor';
            const location = vendorFullLocation(vendor) || getVendorLocation(vendor, null);
            const wa = vendorWhatsapp(vendor);
            const phone = vendorPhone(vendor);
            const storefront = vendorStorefrontUrl(vendor);
            const directions = vendorDirectionsUrl(vendor);
            const productCount = products.filter(function(p) { return p.vendorId === vendor.id; }).length;
            const message = encodeURIComponent("Hi " + vendorName + ", I found your vendor profile on iTred. Please assist me.");
            logOfflineEvent({
                eventType: 'vendor_click',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: vendor.id,
                vendorName: vendorName
            });

            document.getElementById('vendorModalHero').innerHTML = logo
                ? '<img src="' + escapeHtml(logo) + '" loading="lazy" onerror="this.style.display=\\'none\\'">'
                : escapeHtml((vendorName || 'V').slice(0, 1));
            document.getElementById('vm-sector').textContent = sector;
            document.getElementById('vm-name').textContent = vendorName;
            document.getElementById('vm-trust').innerHTML = '<span class="trust-badge ' + getTrustClass(vendor) + '">' + escapeHtml(vendor.trustTier || 'New Vendor') + (vendor.trustScore ? ' - ' + escapeHtml(String(vendor.trustScore)) + '/100' : '') + '</span>';
            document.getElementById('vm-category').textContent = sector;
            document.getElementById('vm-location').textContent = location || 'Location not supplied';
            document.getElementById('vm-whatsapp').textContent = wa ? 'Available' : 'Not supplied';
            document.getElementById('vm-phone').textContent = phone ? 'Available' : 'Not supplied';
            document.getElementById('vm-storefront').textContent = storefront ? 'Available' : (productCount ? productCount + ' catalogue products' : 'Not supplied');
            document.getElementById('vm-delivery').textContent = hasDelivery(vendor) ? 'Delivery / iDeliver available. Confirm area with vendor.' : 'Delivery details not supplied';

            let actions = '<div class="modal-outline-actions">';
            actions += phone ? outlineLinkHtml('tel:' + String(phone).replace(/[^0-9+]/g, ''), 'vendor-call-link', 'call', 'Call', false, vendor.id) : disabledOutlineAction('call', 'Call');
            actions += wa ? outlineLinkHtml('https://wa.me/' + String(wa).replace(/[^0-9]/g, '') + '?text=' + message, 'vendor-wa-link', 'whatsapp', 'WhatsApp', true, vendor.id) : disabledOutlineAction('whatsapp', 'WhatsApp');
            actions += storefront ? outlineLinkHtml(storefront, 'vendor-storefront-link', 'vendor', 'Storefront', false, '') : disabledOutlineAction('vendor', 'Storefront');
            actions += outlineButtonHtml('vendorProductsBtn', 'cart', 'Products', false);
            actions += directions ? outlineLinkHtml(directions, 'vendor-directions-link', 'location', 'Location', false, '') : disabledOutlineAction('location', 'Location');
            actions += '</div>';
            document.getElementById('vm-actions').innerHTML = actions;

            const productsBtn = document.getElementById('vendorProductsBtn');
            if (productsBtn) productsBtn.addEventListener('click', function() {
                selectVendorFilter(vendor.id);
                closeTrustedVendorModal();
                switchTab('tab-products');
                renderProducts();
            });

            bindCommerceActionEvents(trustedVendorModal);
            trustedVendorModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        window.openProduct = function(id) {
            const p = products.find(function(x) { return x.id === id; });
            if(!p) return;
            const vendor = getVendor(p.vendorId);
            const branch = getBranch(vendor, p.branchId);
            const images = productImages(p);
            const firstImage = images[0] || '';

            document.getElementById('modalImageContainer').innerHTML = firstImage 
                ? "<img id=\\"modalMainImage\\" src=\\"" + escapeHtml(firstImage) + "\\" class=\\"m-image\\" onerror=\\"this.style.display='none'\\">"
                : "<div class=\\"m-image\\" style=\\"display:flex;align-items:center;justify-content:center;color:#ccc;font-weight:900;\\">NO IMAGE</div>";
            document.getElementById('modalGallery').innerHTML = images.length > 1
                ? images.map(function(src, index) {
                    return '<img src="' + escapeHtml(src) + '" class="modal-thumb ' + (index === 0 ? 'active' : '') + '" data-src="' + escapeHtml(src) + '" loading="lazy">';
                }).join('')
                : '';
            document.querySelectorAll('.modal-thumb').forEach(function(img) {
                img.addEventListener('click', function() {
                    const main = document.getElementById('modalMainImage');
                    if (main) main.src = img.getAttribute('data-src') || '';
                    document.querySelectorAll('.modal-thumb').forEach(function(item) { item.classList.remove('active'); });
                    img.classList.add('active');
                });
            });

            logOfflineEvent({
                eventType: 'PRODUCT_VIEWED',
                sourceType: 'catalogue',
                catalogueId: CATALOGUE_ID,
                vendorId: p.vendorId,
                vendorName: (vendor ? vendor.name : null) || p.vendorName,
                productId: p.id,
                productName: p.name,
                sector: p.sector,
                category: p.category,
                payload: { price: p.sellingPrice }
            });

            sessionProductViews++;
            if (sessionProductViews >= 2) {
              setTimeout(triggerHelpfulnessSurvey, 2000);
            }

            const vendorName = (vendor ? vendor.name : null) || p.vendorName || 'Vendor';
            rememberRecentProduct(p.id);

            document.getElementById('m-vendor').textContent = vendorName;
            document.getElementById('m-title').textContent = p.name || p.productName || 'Product';
            document.getElementById('m-price').textContent = formatMoney(productPrice(p));
            document.getElementById('m-desc').textContent = p.description || 'No description provided.';
            
            document.getElementById('m-sku').textContent = p.sku || 'N/A';
            document.getElementById('m-brand').textContent = p.brand || 'N/A';
            document.getElementById('m-cat').textContent = p.category || 'N/A';
            document.getElementById('m-sec').textContent = p.sector || 'N/A';
            document.getElementById('m-stock').textContent = isInStock(p) ? ((p.stockQuantity || p.quantityAvailable || '') + ' In Stock').trim() : 'Confirm stock with vendor';

            document.getElementById('mv-name').textContent = vendorName;
            document.getElementById('mv-score').textContent = (vendor && vendor.trustTier) ? vendor.trustTier + ' (' + vendor.trustScore + ')' : 'New Vendor';
            document.getElementById('mv-loc').textContent = vendor ? [vendor.streetAddress, vendor.suburb, vendor.district, vendor.cityTown, vendor.province, vendor.country].filter(Boolean).join(', ') : 'N/A';
            document.getElementById('mv-hours').textContent = (vendor && vendor.openingHours) ? vendor.openingHours : 'Not provided';
            document.getElementById('m-delivery').textContent = hasDelivery(vendor) ? 'Delivery/contact options available. Confirm area and cost with vendor.' : 'Delivery details not supplied. Confirm with vendor.';

            if(branch) {
                document.getElementById('m-branch').innerHTML = 
                    "<div class=\\"m-row\\"><span class=\\"m-lbl\\">Branch Name</span><span class=\\"m-val\\">" + escapeHtml(branch.name) + "</span></div>" +
                    "<div class=\\"m-row\\"><span class=\\"m-lbl\\">Address</span><span class=\\"m-val\\">" + escapeHtml([branch.address || branch.streetAddress, branch.suburb, branch.district, branch.cityTown, branch.province, branch.country, branch.landmark].filter(Boolean).join(', ')) + "</span></div>" +
                    "<div class=\\"m-row\\"><span class=\\"m-lbl\\">Contact</span><span class=\\"m-val\\">" + escapeHtml(branch.phone || branch.whatsapp || 'N/A') + "</span></div>";
            } else {
                document.getElementById('m-branch').innerHTML = '<div class="m-val">Branch details not supplied</div>';
            }

            // Actions
            const phone = (branch ? branch.phone : null) || (vendor ? vendor.mainPhone : null);
            const wa = (branch ? branch.whatsapp : null) || (vendor ? vendor.whatsappNumber : null);
            const leadRef = 'ITRED-' + CATALOGUE_ID + '-' + p.vendorId + '-' + p.id;
            const msg = encodeURIComponent("Hi " + vendorName + ", I saw this product on iTred.\\n\\nProduct: " + (p.name || p.productName || '') + "\\nPrice: " + formatMoney(productPrice(p)) + "\\nRef: " + leadRef + "\\n\\nPlease confirm availability.");
            const offerMsg = encodeURIComponent("Hi " + vendorName + ", I would like to make an offer on this product from iTred.\\n\\nProduct: " + (p.name || p.productName || '') + "\\nListed price: " + formatMoney(productPrice(p)) + "\\nRef: " + leadRef);
            const waHref = wa ? 'https://wa.me/' + String(wa).replace(/[^0-9]/g, '') + '?text=' + msg : '';
            const offerHref = wa ? 'https://wa.me/' + String(wa).replace(/[^0-9]/g, '') + '?text=' + offerMsg : getSupportUrl(offerMsg);
            const callHref = phone ? 'tel:' + String(phone).replace(/[^0-9+]/g, '') : '';
            const supportHref = getSupportUrl(encodeURIComponent("Catalogue Support Request\\nProduct: " + (p.name || p.productName || '') + "\\nVendor: " + vendorName + "\\nCatalogue: " + CATALOGUE_ID));
            let actions = '<div class="modal-outline-actions">';
            actions += waHref
                ? outlineLinkHtml(waHref, 'product-wa-link', 'whatsapp', 'WhatsApp', true, p.id)
                : outlineLinkHtml(supportHref, 'support-contact-link', 'whatsapp', 'Support', true, '');
            actions += callHref
                ? outlineLinkHtml(callHref, 'product-call-link', 'call', 'Call', false, p.id)
                : '<button type="button" class="modal-outline-action" disabled style="opacity:.4;">' + iconSvg('call') + '<span>Call</span></button>';
            actions += outlineLinkHtml(offerHref, wa ? 'product-wa-link' : 'support-contact-link', 'offer', 'Offer', false, p.id);
            actions += outlineButtonHtml('browseVendorBtn', 'vendor', 'Vendor', false);
            actions += '</div>';
            document.getElementById('m-actions').innerHTML = actions;

            document.getElementById('m-save-share').innerHTML =
                '<div class="modal-outline-actions">' +
                    outlineButtonHtml('saveProductBtn', 'cart', 'Add', true) +
                    outlineButtonHtml('saveVendorBtn', 'vendor', 'Storefront', false) +
                    outlineButtonHtml('shareProductBtn', 'share', 'Share', false) +
                '</div>';

            const saveProductBtn = document.getElementById('saveProductBtn');
            const saveVendorBtn = document.getElementById('saveVendorBtn');
            const shareProductBtn = document.getElementById('shareProductBtn');
            const browseVendorBtn = document.getElementById('browseVendorBtn');
            if (saveProductBtn) saveProductBtn.addEventListener('click', function() { addProductToCart(p.id); });
            if (saveVendorBtn && vendor) saveVendorBtn.addEventListener('click', function() { toggleSavedVendor(vendor.id); });
            if (shareProductBtn) shareProductBtn.addEventListener('click', function() { shareProduct(p.id); });
            if (browseVendorBtn && vendor) browseVendorBtn.addEventListener('click', function() {
                selectVendorFilter(vendor.id);
                closeModal();
                switchTab('tab-vendors');
                renderVendors();
            });

            const related = products.filter(function(item) {
                return item.id !== p.id && (item.category === p.category || item.sector === p.sector || item.vendorId === p.vendorId);
            }).slice(0, 4);
            document.getElementById('m-related').innerHTML = related.length
                ? related.map(function(item) {
                    return '<div class="related-card" data-related-product-id="' + escapeHtml(item.id) + '">' +
                        '<div>' + escapeHtml(item.name || item.productName || 'Product') + '</div>' +
                        '<div style="color:var(--brand-orange);margin-top:4px;">' + formatMoney(productPrice(item)) + '</div>' +
                    '</div>';
                }).join('')
                : '<div style="font-size:11px;color:#777;">No related products in this offline catalogue.</div>';
            document.querySelectorAll('.related-card').forEach(function(card) {
                card.addEventListener('click', function() {
                    openProduct(card.getAttribute('data-related-product-id'));
                });
            });

            const similarVendors = vendors.filter(function(item) {
                return vendor && item.id !== vendor.id && (item.sector === vendor.sector || item.category === vendor.category || item.cityTown === vendor.cityTown);
            }).slice(0, 3);
            document.getElementById('m-similar-vendors').innerHTML = similarVendors.length
                ? similarVendors.map(function(item) {
                    return '<div class="modal-vendor-card">' +
                        '<div class="trust-badge ' + getTrustClass(item) + '">' + escapeHtml(item.trustTier || 'New Vendor') + '</div>' +
                        '<div style="font-size:13px;font-weight:950;margin-top:8px;">' + escapeHtml(item.name) + '</div>' +
                        '<div style="font-size:10px;color:#666;font-weight:800;">' + escapeHtml([item.suburb, item.cityTown].filter(Boolean).join(', ')) + '</div>' +
                    '</div>';
                }).join('')
                : '<div style="font-size:11px;color:#777;">No similar vendors listed.</div>';

            bindCommerceActionEvents(document.getElementById('productModal'));

            productModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        };

        // Esc html helper
        function escapeHtml(str) {
            if(!str) return '';
            return String(str).replace(/[&<>'"]/g, function(tag) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag];
            });
        }

        function isChromeLikeBrowser() {
            var ua = navigator.userAgent || "";
            var isChromium = ua.indexOf("Chrome") > -1 || ua.indexOf("CriOS") > -1 || ua.indexOf("Chromium") > -1;
            var isEdge = ua.indexOf("Edg") > -1;
            var isOpera = ua.indexOf("OPR") > -1 || ua.indexOf("Opera") > -1;
            var isBrave = ua.indexOf("Brave") > -1;
            return isChromium || isEdge || isOpera || isBrave;
        }

        function getChromeDownloadUrl() {
            var ua = navigator.userAgent || "";
            if (/android/i.test(ua)) {
                return "https://play.google.com/store/apps/details?id=com.android.chrome";
            }
            if (/iphone|ipad|ipod/i.test(ua)) {
                return "https://apps.apple.com/app/google-chrome/id535886823";
            }
            return "https://www.google.com/chrome/";
        }

        function initBrowserGate() {
            var gate = document.getElementById("browserGate");
            var continueBtn = document.getElementById("continueCatalogueBtn");
            var downloadBtn = document.getElementById("downloadChromeBtn");
            if (!gate || !continueBtn || !downloadBtn) return;
            downloadBtn.href = getChromeDownloadUrl();
            var dismissed = false;
            try { dismissed = localStorage.getItem("itred_chrome_gate_dismissed") === "true"; } catch (e) {}
            if (!isChromeLikeBrowser() && !dismissed) { gate.style.display = "flex"; }
            continueBtn.addEventListener("click", function () {
                gate.style.display = "none";
                try { localStorage.setItem("itred_chrome_gate_dismissed", "true"); } catch (e) {}
            });
        }

        const searchInputEl = document.getElementById('searchInput');
        const searchClearEl = document.getElementById('searchClear');
        function updateSearchClear() {
            if (!searchInputEl || !searchClearEl) return;
            searchClearEl.classList.toggle('visible', searchInputEl.value.trim().length > 0);
        }
        if(searchInputEl) {
            searchInputEl.addEventListener('input', function() {
                updateSearchClear();
                if (!searchPlaceholders[activeTabId]) {
                    switchTab('tab-products');
                } else {
                    renderActiveTab();
                }
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(debouncedSearchLog, 900);
            });
        }
        if(searchClearEl && searchInputEl) {
            searchClearEl.addEventListener('click', function() {
                searchInputEl.value = '';
                updateSearchClear();
                renderActiveTab();
                searchInputEl.focus();
            });
        }
        const branchDirectorySearchEl = document.getElementById('branchDirectorySearch');
        if (branchDirectorySearchEl) {
            branchDirectorySearchEl.addEventListener('input', function() {
                if (activeTabId === 'tab-branches') renderBranchesDirectory();
            });
        }
        
        document.addEventListener("DOMContentLoaded", function () {
            try {
                const isReturn = !!safeLocalStorageGet(ITRED_SESSION_KEY);
                logOfflineEvent({
                    eventType: isReturn ? 'RETURN_VISIT' : 'CATALOGUE_OPENED',
                    sourceType: 'catalogue',
                    catalogueId: CATALOGUE_ID,
                    sector: SECTOR,
                    category: CATEGORY,
                    payload: { userAgent: navigator.userAgent }
                });
                populateFilters();
                updateSearchPlaceholder();
                initVendorPicker();
                updateHeaderCartCount();
                renderSupportPage();
                renderProducts();
                renderVendors();
                renderHub();
                renderBranchesDirectory();
                
                if (typeof initIosGate === "function") initIosGate();
                if (typeof initBrowserGate === "function") initBrowserGate();

                setTimeout(syncOfflineEvents, 2000);

                setTimeout(() => {
                  let shown = checkExpiry();
                  if (!shown) shown = checkPendingLeads();
                  if (!shown && isReturn) {
                    triggerWelcomeBack();
                  }
                }, 2500);
            } catch (error) {
                debugSyncLog("Catalogue render failed", error);
                var grid = document.getElementById("productGrid");
                if (grid) {
                    grid.innerHTML = '<div style="padding:40px 20px;text-align:center;font-weight:900;color:#ff6b00;">CATALOGUE COULD NOT LOAD. PLEASE REOPEN THE FILE OR CONTACT SUPPORT.</div>';
                }
            }
        });
    </script>
</body>
</html>
  `;
};
