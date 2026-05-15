/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Vendor,
  Product,
  Branch,
  Staff,
  DeliveryStaff,
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
    catalogueId?: string;
    syncEndpointUrl?: string;
  },
): string => {
  const activeProducts = products.filter(
    (p) => p.publishToCatalogue && p.status === "active",
  );

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

  const jsonData = {
    metadata: metadata,
    products: activeProducts,
    vendors: scoredVendors,
    cahLinks: cahLinks.filter(
      (l) => l.status === "active" && l.showInCatalogue !== false,
    ),
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
            --brand-charcoal: #2E2E2E;
            --brand-silver: #F9F9F9;
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
            padding-bottom: 60px; /* nav space */
        }
        *, *:before, *:after { box-sizing: border-box; border-radius: 0; }
        
        img, video, iframe, table {
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
            max-width: 480px;
            margin: 0 auto;
            background: #fff;
            min-height: 100vh;
            position: relative;
            box-shadow: 0 0 20px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
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
            min-height: 138px;
            padding: 18px 88px 16px 18px;
            color: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            background: linear-gradient(135deg, rgba(255, 107, 0, 0.92), rgba(255, 132, 32, 0.78));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom-left-radius: 28px;
            border-bottom-right-radius: 28px;
            box-shadow: 0 14px 34px rgba(255, 107, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.32), inset 0 -1px 0 rgba(46, 46, 46, 0.12);
            overflow: hidden;
        }
        .sector-header::after {
            content: "";
            position: absolute;
            left: 14px;
            right: 14px;
            top: 10px;
            height: 1px;
            background: rgba(255, 255, 255, 0.45);
            z-index: 1;
        }
        .header-overlay {
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.35), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.02));
            pointer-events: none;
        }
        .header-content {
            position: relative;
            z-index: 2;
        }
        .itred-wordmark {
            font-size: 40px;
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            line-height: 1;
        }
        .itred-i { color: #ffffff; }
        .itred-tred { color: var(--brand-charcoal); }
        .seigen-logo-badge {
            position: absolute;
            bottom: 18px;
            right: 16px;
            width: 54px;
            height: 54px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.96);
            border: 2px solid rgba(255, 255, 255, 0.85);
            overflow: hidden;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 18px rgba(46, 46, 46, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .seigen-logo-badge img {
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
        .catalogue-subtitle {
            font-size: 9px; font-weight: 700; color: #ddd; line-height: 1.2;
        }
        .powered-by, .powered-by-text {
            color: var(--brand-charcoal);
            font-weight: 900;
        }

        /* Search */
        .search-area {
            position: sticky;
            top: 0;
            z-index: 902;
            padding: 10px 14px;
            margin-top: 8px;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .search-input {
            width: 100%;
            padding: 13px 14px;
            background: #ffffff;
            border: 1px solid #e0e0e0;
            font-size: 14px;
            font-weight: 800;
            outline: none;
        }
        .search-input:focus {
            background: #fff; border-color: var(--brand-orange);
        }

        /* Tabs */
        .tab-content { display: none; padding: 20px; flex: 1; }
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
            background: #eee; border: none; width: 32px; height: 32px;
            font-size: 16px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        
        .m-section { margin-top: 24px; padding-top: 16px; border-top: 2px solid #f0f0f0; }
        .m-title { font-size: 12px; font-weight: 900; color: var(--brand-orange); text-transform: uppercase; margin-bottom: 12px; }
        .m-row { display: flex; flex-direction: column; margin-bottom: 8px; font-size: 12px; }
        .m-lbl { font-size: 9px; font-weight: 900; color: #999; text-transform: uppercase; }
        .m-val { font-weight: 700; color: var(--brand-charcoal); }
        .m-image { width: 100%; height: 300px; object-fit: cover; background: #f9f9f9; margin-bottom: 16px; }

        /* Nav */
        .bottom-nav {
            position: fixed; bottom: 0; left: 0; right: 0; height: 60px;
            background: #fff; display: flex; border-top: 1px solid #eee; z-index: 1000;
            max-width: 480px; margin: 0 auto;
            overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none;
        }
        .bottom-nav::-webkit-scrollbar { display: none; }
        .nav-item {
            flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-size: 9px; font-weight: 900; color: #888; text-transform: uppercase; background: none; border: none;
            cursor: pointer; transition: 0.2s; padding: 0 16px;
        }
        .nav-item.active { color: var(--brand-orange); border-top: 2px solid var(--brand-orange); background: #fffaf5; }

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
        }
        .svy-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; display:none; align-items:center; justify-content:center; padding:16px; font-family:system-ui, sans-serif; }
        .svy-box { background:var(--brand-silver, #fff); width:100%; max-width:400px; padding:24px; position:relative; color:var(--brand-charcoal, #333); max-height:90vh; overflow-y:auto; }
        .svy-close { position:absolute; right:12px; top:12px; background:none; border:none; font-size:24px; cursor:pointer; color:#888; }
        .svy-btn { display:block; width:100%; padding:14px; margin-bottom:8px; border:1px solid #ddd; background:#f9f9f9; text-align:left; font-size:14px; font-weight:bold; cursor:pointer; color:var(--brand-charcoal, #333); }
        .svy-btn:hover { border-color:var(--brand-orange, #FF6B00); color:var(--brand-orange, #FF6B00); background:#fff3ed; }
        .svy-input { width:100%; padding:12px; border:1px solid #ddd; margin-bottom:12px; font-size:14px; font-family:inherit; }
        .svy-wa { display:block; width:100%; padding:14px; background:#16a34a; color:#fff; text-align:center; font-weight:bold; text-decoration:none; margin-top:16px; border:none; cursor:pointer; }
        .svy-h3 { margin-top:0; font-size:18px; margin-bottom:12px; color:var(--brand-charcoal, #111); line-height:1.2; }
        .svy-p { font-size:13px; color:#555; margin-top:0; margin-bottom:16px; line-height:1.4; }
        .svy-link { display:block; background:none; border:none; color:#888; font-size:12px; cursor:pointer; text-decoration:underline; width:100%; text-align:center; padding:12px; margin-top:8px; }
    </style>
</head>
<body>
    <div class="app-shell word-wrap">
        
        <div class="fixed-catalogue-header-wrapper">
            <header class="sector-header">
                <div class="header-overlay"></div>
                <div class="header-content">
                    <div class="itred-wordmark">
                        <span class="itred-i">i</span><span class="itred-tred">Tred</span>
                    </div>
                    <div class="catalogue-subtitle" style="margin-bottom: 8px;">Vendor Product Discovery</div>
                    <div class="catalogue-subtitle">${escapeHtml(metadata.serialNumber)} // ${jsonData.products.length} Products</div>
                    <div class="catalogue-subtitle powered-by">Powered by seiGEN Commerce</div>
                </div>
                <div class="seigen-logo-badge">
                    ${logoUrl ? `<img src="${logoUrl}" alt="seiGEN Commerce" onerror="this.outerHTML='<span class=\\'seigen-logo-fallback\\'>SCI</span>'"/>` : `<span class="seigen-logo-fallback">SCI</span>`}
                </div>
            </header>

            <div class="search-area" id="searchArea">
                <input type="text" id="searchInput" class="search-input" placeholder="Search products, brands, locations...">
                <div id="searchStats" style="font-size: 9px; font-weight: 900; color: #888; margin-top: 8px; text-transform: uppercase; display: none;"></div>
            </div>
        </div>

        <main>
            <!-- PRODUCTS TAB -->
            <div id="tab-products" class="tab-content active">
                <div id="productGrid" class="product-grid"></div>
            </div>

            <!-- VENDORS TAB -->
            <div id="tab-vendors" class="tab-content">
                <h2 style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 16px;">Registered Vendors</h2>
                <div id="vendorGrid"></div>
            </div>

            <!-- COMMUNITY HUB TAB -->
            <div id="tab-hub" class="tab-content">
                <h2 style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">Commerce Access Hub</h2>
                <p style="font-size: 12px; margin-bottom: 24px; color: #666;">Sector WhatsApp Groups</p>
                <div id="hubGrid"></div>
            </div>

            <!-- BRANCHES TAB -->
            <div id="tab-branches" class="tab-content">
                <h2 style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 16px;">Branch Directory</h2>
                <div id="branchGrid"></div>
            </div>

            <!-- STAFF TAB -->
            <div id="tab-staff" class="tab-content">
                <h2 style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 16px;">Staff Directory</h2>
                <div id="staffGrid"></div>
            </div>

            <!-- TRADE TERMS TAB -->
            <div id="tab-terms" class="tab-content" style="font-size: 12px; line-height: 1.6;">
                <h2 style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 16px;">Trade Terms</h2>
                <p style="font-weight: 700; margin-bottom: 16px; padding: 12px; background: #fff3ed; border-left: 3px solid var(--brand-orange);">
                    Products are supplied by independent vendors. SCI / iTred provides discovery, catalogue, and contact infrastructure. Product quality, warranty, availability, pricing, and final sale terms remain the responsibility of the listed vendor unless otherwise stated.
                </p>
                
                <h3 class="mt-4 mb-2">Privacy Policy</h3>
                <p>We respect your privacy. Contact details provided to vendors are subject to their own privacy policies.</p>
                
                <h3 class="mt-4 mb-2">Product Warranties</h3>
                <p>All warranties are provided directly by the supplying vendor. SCI / iTred disclaims all liability for defective goods.</p>
                
                <h3 class="mt-4 mb-2">Returns & Exchanges</h3>
                <p>Subject to the individual vendor's return policy. Please confirm before purchasing.</p>

                <h3 class="mt-4 mb-2">Stock Availability</h3>
                <p>Catalogue stock levels are indicative. Vendors may sell out before the catalogue updates. Always confirm availability.</p>
            </div>
        </main>

        <footer style="padding: 40px 20px; text-align: center; border-top: 1px solid #eee; margin-top: auto;">
            <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #aaa;">Powered by seiGEN Commerce</div>
        </footer>

        <nav class="bottom-nav">
            <button class="nav-item active" data-target="tab-products">Products</button>
            <button class="nav-item" data-target="tab-vendors">Vendors</button>
            <button class="nav-item" data-target="tab-hub">Hub</button>
            <button class="nav-item" data-target="tab-branches">Branches</button>
            <button class="nav-item" data-target="tab-staff">Staff</button>
            <button class="nav-item" data-target="tab-terms">Terms</button>
        </nav>
    </div>

    <!-- PRODUCT MODAL -->
    <div id="productModal" class="modal-overlay">
        <div class="modal-content word-wrap">
            <button class="modal-close" onclick="closeModal()">✕</button>
            
            <div id="modalImageContainer"></div>
            
            <div class="c-vendor" id="m-vendor"></div>
            <h2 style="font-size: 20px; font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-bottom: 8px;" id="m-title"></h2>
            <div style="font-size: 24px; font-weight: 900; font-family: monospace; margin-bottom: 16px;" id="m-price"></div>
            
            <p style="font-size: 14px; margin-bottom: 24px;" id="m-desc"></p>
            
            <div class="product-actions" id="m-actions"></div>

            <div class="m-section">
                <div class="m-title">Product Details</div>
                <div class="m-row"><span class="m-lbl">SKU / Code</span><span class="m-val" id="m-sku"></span></div>
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
                <div class="m-title">Staff Contact</div>
                <div class="m-row"><span class="m-lbl">Sales Contact</span><span class="m-val" id="m-staff">Sales contact not supplied</span></div>
            </div>
            
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
        const SYNC_ENDPOINT = ${JSON.stringify(metadata.syncEndpointUrl || "").replace(/</g, "\\u003c")};

        function getFeedbackUrl(encodedText) {
            if (FEEDBACK_WA) {
                return "https://wa.me/" + FEEDBACK_WA.replace(/[^0-9]/g, '') + "?text=" + encodedText;
            }
            return "https://wa.me/?text=" + encodedText;
        }

        function safeLocalStorageGet(key) {
          try {
            return localStorage.getItem(key);
          } catch (e) {
            console.warn('localStorage not available.', e);
            return null;
          }
        }

        function safeLocalStorageSet(key, value) {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            console.warn('localStorage not available.', e);
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

        function logOfflineEvent(event) {
          try {
            const events = JSON.parse(safeLocalStorageGet(ITRED_EVENTS_KEY) || '[]');
            const newEvent = Object.assign({}, event, {
                eventId: 'EVT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                synced: false,
                deviceSessionId: getDeviceSessionId()
            });
            events.push(newEvent);
            safeLocalStorageSet(ITRED_EVENTS_KEY, JSON.stringify(events));
          } catch(e) { console.warn('Failed to log event', e); }
        }

        function syncOfflineEvents() {
            if (!navigator.onLine || !SYNC_ENDPOINT) return;
            try {
                const events = JSON.parse(safeLocalStorageGet(ITRED_EVENTS_KEY) || '[]');
                const unsynced = events.filter(function(e) { return !e.synced; });
                if (unsynced.length === 0) return;
                
                const payload = {
                    source: "itred_offline_catalogue",
                    catalogueId: CATALOGUE_ID,
                    deviceSessionId: getDeviceSessionId(),
                    events: unsynced
                };

                fetch(SYNC_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(function(response) {
                    if (response.ok) {
                        const syncedIds = unsynced.map(function(e) { return e.eventId; });
                        const updatedEvents = events.map(function(e) {
                            if (syncedIds.includes(e.eventId)) e.synced = true;
                            return e;
                        });
                        safeLocalStorageSet(ITRED_EVENTS_KEY, JSON.stringify(updatedEvents));
                    }
                }).catch(function(err) {
                    console.warn('Sync failed, will retry later', err);
                });
            } catch (err) {}
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
            showSurveyHtml(\`<h3 class="svy-h3">We could not find that product.</h3><p class="svy-p" style="margin-bottom:20px;">Do you want seiGEN Commerce to help source it?</p><input type="text" id="nrProduct" placeholder="Product needed" class="svy-input" /><input type="text" id="nrLocation" placeholder="Location" class="svy-input" /><input type="text" id="nrBudget" placeholder="Budget (optional)" class="svy-input" /><input type="text" id="nrContact" placeholder="Contact (optional)" class="svy-input" /><button class="svy-btn nr-submit-btn" style="background:#111; color:#fff; text-align:center; margin-top:8px;">Submit Sourcing Request</button><button class="svy-link" onclick="closeSurvey()">Not Now</button>\`);
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
          const e = db.metadata.expiryDate; if (e) { const hoursLeft = (new Date(e).getTime() - Date.now()) / 3600000; if (hoursLeft <= 48) { triggerExpirySurvey(); return true; } } return false;
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
        const CATALOGUE_ID = db.metadata.serialNumber;
        const SECTOR = db.metadata.sector;
        const CATEGORY = db.metadata.category;

        const products = Array.isArray(db.products) ? db.products : [];
        const vendors = Array.isArray(db.vendors) ? db.vendors : [];
        const cahLinks = Array.isArray(db.cahLinks) ? db.cahLinks : [];

        // Tab Navigation
        document.querySelectorAll('.nav-item').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
                document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
                e.currentTarget.classList.add('active');
                document.getElementById(e.currentTarget.dataset.target).classList.add('active');
                
                if(e.currentTarget.dataset.target === 'tab-products') {
                    document.getElementById('searchArea').style.display = 'block';
                } else {
                    document.getElementById('searchArea').style.display = 'none';
                }
                window.scrollTo(0,0);
            });
        });

        // Modals
        const productModal = document.getElementById('productModal');
        function closeModal() {
            productModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        productModal.addEventListener('click', function(e) {
            if(e.target === productModal) closeModal();
        });

        function getVendor(id) { return vendors.find(function(v) { return v.id === id; }); }
        function getBranch(vendor, id) { 
            const branches = vendor && Array.isArray(vendor.branches) ? vendor.branches : [];
            return branches.find(function(b) { return b.id === id; }); 
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

        function renderHub() {
            const grid = document.getElementById('hubGrid');
            if(cahLinks.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO SECTOR WHATSAPP GROUPS WERE INCLUDED IN THIS CATALOGUE</div>';
                return;
            }

            const sortedLinks = [...cahLinks].sort(function(a,b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });

            let htmlString = sortedLinks.map(function(l) {
                const rawUrl = getHubUrl(l);
                const href = normalizeWhatsappHref(rawUrl);
                
                if(!href) return '';
                
                let typeLabel = escapeHtml(l.type);
                if (typeLabel.toLowerCase().includes('community')) typeLabel = 'Community';
                else if (typeLabel.toLowerCase().includes('group')) typeLabel = 'Group';
                else if (typeLabel.toLowerCase().includes('channel')) typeLabel = 'Channel';
                else if (typeLabel.toLowerCase().includes('support')) typeLabel = 'Support';
                
                const metaText = escapeHtml(l.sector || l.category || 'General');

                const followerCount = l.currentFollowerCount || l.whatsappCommunityCount || l.whatsappChannelCount || l.whatsappGroupCount;
                const countHtml = followerCount ? '<div style="font-size:10px; font-weight:800; color:var(--brand-orange); margin-bottom:8px;">' + followerCount.toLocaleString() + ' Members</div>' : '';

                const hasAdditional = Array.isArray(l.additionalWhatsappGroups) && l.additionalWhatsappGroups.length > 0;
                
                let cardHtml = '<div>';
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

        function renderVendors() {
            const grid = document.getElementById('vendorGrid');
            grid.innerHTML = vendors.map(function(v) { 
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
            let hasBranches = false;
            let html = '';
            
            vendors.forEach(function(v) {
                if (v.branches && v.branches.length > 0) {
                    hasBranches = true;
                    v.branches.forEach(function(b) {
                        html += "<div class=\\"vendor-card\\">" +
                            "<div style=\\"font-size: 10px; font-weight: 900; color: var(--brand-orange); text-transform: uppercase; margin-bottom: 4px;\\">" + escapeHtml(v.name) + "</div>" +
                            "<div style=\\"font-size: 14px; font-weight: 800; margin-bottom: 6px;\\">" + escapeHtml(b.name) + "</div>" +
                            "<div style=\\"font-size: 12px; color: #666; margin-bottom: 4px;\\">" + escapeHtml(b.address) + (b.cityTown ? ", " + escapeHtml(b.cityTown) : "") + "</div>" +
                            "<div style=\\"font-size: 12px; font-weight: 700; margin-bottom: 12px;\\">" + (b.phone ? "Phone: " + escapeHtml(b.phone) : "") + "</div>" +
                            "<div style=\\"display: flex; gap: 8px;\\">" +
                            (b.phone ? "<a href=\\"tel:" + b.phone.replace(/[^0-9+]/g, '') + "\\" class=\\"c-btn\\" style=\\"margin-top:0;\\">Call</a>" : "") +
                            (b.whatsapp ? "<a href=\\"https://wa.me/" + b.whatsapp.replace(/[^0-9]/g, '') + "\\" class=\\"c-btn wa\\" target=\\"_blank\\" style=\\"margin-top:0;\\">WhatsApp</a>" : "") +
                            "</div>" +
                        "</div>";
                    });
                }
            });

            if (!hasBranches) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO BRANCH DIRECTORY WAS INCLUDED IN THIS CATALOGUE</div>';
            } else {
                grid.innerHTML = html;
            }
        }

        function renderStaffDirectory() {
            const grid = document.getElementById('staffGrid');
            let hasStaff = false;
            let html = '';
            
            vendors.forEach(function(v) {
                if (v.staff && v.staff.length > 0) {
                    hasStaff = true;
                    html += '<h3 style="font-size: 12px; font-weight: 900; color: var(--brand-charcoal); text-transform: uppercase; margin: 16px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">' + escapeHtml(v.name) + '</h3>';
                    v.staff.forEach(function(s) {
                        html += "<div class=\\"vendor-card\\" style=\\"margin-bottom: 8px; padding: 12px;\\">" +
                            "<div style=\\"font-size: 14px; font-weight: 800; margin-bottom: 4px;\\">" + escapeHtml(s.fullName) + "</div>" +
                            "<div style=\\"font-size: 10px; font-weight: 900; color: #888; text-transform: uppercase; margin-bottom: 12px;\\">" + escapeHtml(s.role) + "</div>" +
                            "<div style=\\"display: flex; gap: 8px;\\">" +
                            (s.phone ? "<a href=\\"tel:" + s.phone.replace(/[^0-9+]/g, '') + "\\" class=\\"c-btn\\" style=\\"margin-top:0;\\">Call</a>" : "") +
                            (s.whatsapp ? "<a href=\\"https://wa.me/" + s.whatsapp.replace(/[^0-9]/g, '') + "\\" class=\\"c-btn wa\\" target=\\"_blank\\" style=\\"margin-top:0;\\">WhatsApp</a>" : "") +
                            "</div>" +
                        "</div>";
                    });
                }
            });

            if (!hasStaff) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO STAFF DIRECTORY WAS INCLUDED IN THIS CATALOGUE</div>';
            } else {
                grid.innerHTML = html;
            }
        }

        function rankProduct(p, tokens) {
            let score = 0;
            const vendor = getVendor(p.vendorId);
            const branch = getBranch(vendor, p.branchId);

            const searchBlob = [
                p.name, p.sku, p.category, p.description,
                vendor ? vendor.name : '', vendor ? vendor.tradingName : '', vendor ? vendor.sector : '', vendor ? vendor.cityTown : '', vendor ? vendor.province : '',
                branch ? branch.name : '', branch ? branch.cityTown : '', branch ? branch.address : '',
                p.tags ? p.tags.join(' ') : ''
            ].join(' ').toLowerCase();

            if (tokens.some(function(t) { return searchBlob === t; })) score += 100; // Exact match somewhere
            if (tokens.some(function(t) { return (p.name || '').toLowerCase().includes(t); })) score += 50;
            if (tokens.some(function(t) { return (p.category || '').toLowerCase().includes(t); })) score += 30;
            if (tokens.some(function(t) { return ((branch ? branch.cityTown : '') || (vendor ? vendor.cityTown : '') || '').toLowerCase().includes(t); })) score += 20;
            
            if (vendor) score += (vendor.trustScore / 10);
            if (p.stockQuantity > 0) score += 10;
            if (p.imageUrl) score += 15;

            return score;
        }

        let searchTimeout;
        let lastQuery = '';
        function debouncedSearchLog() {
            const searchInput = document.getElementById('searchInput');
            if(!searchInput) return;
            const rawQuery = searchInput.value.toLowerCase().trim();
            if (rawQuery.length < 2 || rawQuery === lastQuery) return;
            lastQuery = rawQuery;

            const grid = document.getElementById('productGrid');
            const matchCount = grid.querySelectorAll('.card').length;

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

        window.addEventListener("online", syncOfflineEvents);

        function bindProductEvents() {
            document.querySelectorAll(".product-card").forEach(function(card) {
                card.addEventListener("click", function() {
                    openProduct(card.getAttribute("data-product-id"));
                });
            });
        }

        function renderProducts() {
            const grid = document.getElementById('productGrid');
            const stats = document.getElementById('searchStats');
            const searchInput = document.getElementById('searchInput');
            const rawQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const tokens = rawQuery ? rawQuery.split(/\\s+/) : [];

            if (products.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc; font-size:12px; text-transform:uppercase;">NO PRODUCTS WERE INCLUDED IN THIS CATALOGUE</div>';
                if (stats) stats.style.display = 'none';
                return;
            }

            let filtered = products;

            if (tokens.length > 0) {
                // Free-order rules-based match
                filtered = products.map(function(p) {
                    const vendor = getVendor(p.vendorId);
                    const branch = getBranch(vendor, p.branchId);
                    const searchBlob = [
                        p.name, p.sku, p.category, p.description,
                        vendor ? vendor.name : '', vendor ? vendor.tradingName : '', vendor ? vendor.sector : '', vendor ? vendor.cityTown : '',
                        branch ? branch.name : '', branch ? branch.cityTown : '', branch ? branch.address : '',
                        p.tags ? p.tags.join(' ') : ''
                    ].join(' ').toLowerCase();

                    const matches = tokens.every(function(token) { return searchBlob.includes(token); });
                    if(matches) {
                        return { p: p, score: rankProduct(p, tokens) };
                    }
                    return null;
                }).filter(function(x) { return x; }).sort(function(a,b) { return b.score - a.score; }).map(function(x) { return x.p; });
                
                if (stats) {
                    stats.style.display = 'block';
                    stats.textContent = filtered.length + " Results Ranked";
                }
            } else {
                if (stats) stats.style.display = 'none';
            }

            if(filtered.length === 0) {
                grid.innerHTML = '<div style="padding:40px 20px; text-align:center; font-weight:900; color:#ccc;">NO PRODUCTS FOUND FOR THIS SEARCH</div>';
                return;
            }

            grid.innerHTML = filtered.map(function(p) {
                const vendor = getVendor(p.vendorId);
                const branch = getBranch(vendor, p.branchId);
                const location = (branch ? branch.cityTown : null) || (vendor ? vendor.cityTown : null) || p.branchName || 'Various';
                const vendorName = (vendor ? vendor.name : null) || p.vendorName || 'Vendor';
                
                return "<div class=\\"card product-card\\" data-product-id=\\"" + escapeHtml(p.id) + "\\">" +
                        "<div class=\\"card-img-wrap\\">" +
                            (p.imageUrl ? "<img src=\\"" + p.imageUrl + "\\" class=\\"card-img\\" loading=\\"lazy\\" onerror=\\"this.style.display='none'\\">" : "<span style=\\"font-size:8px; font-weight:900; color:#ccc;\\">NO IMG</span>") +
                        "</div>" +
                        "<div class=\\"card-info\\">" +
                            "<div class=\\"c-vendor\\">" + escapeHtml(vendorName) + "</div>" +
                            "<div class=\\"c-title\\">" + escapeHtml(p.name) + "</div>" +
                            "<div class=\\"c-price\\">$" + (p.sellingPrice || 0).toFixed(2) + "</div>" +
                            "<div class=\\"c-meta\\">" +
                                "<span>" + (p.stockQuantity > 0 ? 'IN STOCK' : 'OUT OF STOCK') + "</span>" +
                                "<span>" + escapeHtml(location) + "</span>" +
                            "</div>" +
                        "</div>" +
                    "</div>";
            }).join('');
            bindProductEvents();
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
        }

        window.openProduct = function(id) {
            const p = products.find(function(x) { return x.id === id; });
            if(!p) return;
            const vendor = getVendor(p.vendorId);
            const branch = getBranch(vendor, p.branchId);

            document.getElementById('modalImageContainer').innerHTML = p.imageUrl 
                ? "<img src=\\"" + p.imageUrl + "\\" class=\\"m-image\\" onerror=\\"this.style.display='none'\\">"
                : "<div class=\\"m-image\\" style=\\"display:flex;align-items:center;justify-content:center;color:#ccc;font-weight:900;\\">NO IMAGE</div>";

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

            document.getElementById('m-vendor').textContent = vendorName;
            document.getElementById('m-title').textContent = p.name;
            document.getElementById('m-price').textContent = '$' + (p.sellingPrice || 0).toFixed(2);
            document.getElementById('m-desc').textContent = p.description || 'No description provided.';
            
            document.getElementById('m-sku').textContent = p.sku || 'N/A';
            document.getElementById('m-cat').textContent = p.category || 'N/A';
            document.getElementById('m-sec').textContent = p.sector || 'N/A';
            document.getElementById('m-stock').textContent = p.stockQuantity > 0 ? p.stockQuantity + ' In Stock' : 'Out of Stock';

            document.getElementById('mv-name').textContent = vendorName;
            document.getElementById('mv-score').textContent = (vendor && vendor.trustTier) ? vendor.trustTier + ' (' + vendor.trustScore + ')' : 'New Vendor';
            document.getElementById('mv-loc').textContent = vendor ? (vendor.streetAddress || '') + ' ' + (vendor.cityTown || '') + ' ' + (vendor.province || '') : 'N/A';
            document.getElementById('mv-hours').textContent = (vendor && vendor.openingHours) ? vendor.openingHours : 'Not provided';

            if(branch) {
                document.getElementById('m-branch').innerHTML = 
                    "<div class=\\"m-row\\"><span class=\\"m-lbl\\">Branch Name</span><span class=\\"m-val\\">" + escapeHtml(branch.name) + "</span></div>" +
                    "<div class=\\"m-row\\"><span class=\\"m-lbl\\">Address</span><span class=\\"m-val\\">" + escapeHtml(branch.address) + ", " + escapeHtml(branch.cityTown) + "</span></div>" +
                    "<div class=\\"m-row\\"><span class=\\"m-lbl\\">Contact</span><span class=\\"m-val\\">" + escapeHtml(branch.phone || branch.whatsapp || 'N/A') + "</span></div>";
            } else {
                document.getElementById('m-branch').innerHTML = '<div class="m-val">Branch details not supplied</div>';
            }

            // Actions
            let actions = '';
            const phone = (branch ? branch.phone : null) || (vendor ? vendor.mainPhone : null);
            const wa = (branch ? branch.whatsapp : null) || (vendor ? vendor.whatsappNumber : null);
            const leadRef = 'ITRED-' + CATALOGUE_ID + '-' + p.vendorId + '-' + p.id;
            const msg = encodeURIComponent("Hi " + vendorName + ", I saw this product on iTred.\\n\\nProduct: " + p.name + "\\nPrice: USD " + (p.sellingPrice||0).toFixed(2) + "\\nRef: " + leadRef + "\\n\\nPlease confirm availability.");
            
            if(wa) {
                actions += "<a href=\\"https://wa.me/" + wa.replace(/[^0-9]/g, '') + "?text=" + msg + "\\" class=\\"c-btn wa product-wa-link\\" target=\\"_blank\\" data-product-id=\\"" + escapeHtml(p.id) + "\\">Order on WhatsApp</a>";
            }
            if(phone) {
                actions += "<a href=\\"tel:" + phone + "\\" class=\\"c-btn product-call-link\\" target=\\"_blank\\" data-product-id=\\"" + escapeHtml(p.id) + "\\">Call Procurement</a>";
            }
            document.getElementById('m-actions').innerHTML = actions;

            document.querySelectorAll(".product-wa-link").forEach(function(btn) {
                btn.addEventListener("click", function() {
                    logWaClick(btn.getAttribute("data-product-id"));
                });
            });

            document.querySelectorAll(".product-call-link").forEach(function(btn) {
                btn.addEventListener("click", function() {
                    logCallClick(btn.getAttribute("data-product-id"));
                });
            });

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
        if(searchInputEl) {
            searchInputEl.addEventListener('input', function() {
                renderProducts();
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(debouncedSearchLog, 900);
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
                renderProducts();
                renderVendors();
                renderHub();
                renderStaffDirectory();
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
                console.error("Catalogue render failed", error);
                var grid = document.getElementById("productGrid");
                if (grid) {
                    grid.innerHTML = '<div style="padding:40px 20px;text-align:center;font-weight:900;color:#ff6b00;">CATALOGUE RENDER ERROR. CHECK BROWSER CONSOLE.</div>';
                }
            }
        });
    </script>
</body>
</html>
  `;
};
