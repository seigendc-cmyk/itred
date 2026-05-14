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
} from "../types.ts";

const SIZE_LABELS = ["B", "KB", "MB"];

const escapeHtml = (value: string | number | undefined) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const normalizeImageUrl = (imageUrl?: string) => {
  if (!imageUrl) {
    return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22240%22 viewBox=%220 0 320 240%22%3E%3Crect width=%22320%22 height=%22240%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%22160%22 y=%22120%22 fill=%22%239ca3af%22 font-family=%22Arial%22 font-size=%2216%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3ENo Image%3C/text%3E%3C/svg%3E";
  }

  if (imageUrl.startsWith("data:")) return imageUrl;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))
    return imageUrl;
  if (/^\/\//.test(imageUrl)) return `https:${imageUrl}`;
  return `data:image/webp;base64,${imageUrl}`;
};

const smallerText = (text: string) => escapeHtml(text || "");

export const generateVendorStorefrontHtml = (
  vendor: Vendor,
  products: Product[],
  branches: Branch[],
  staff: Staff[],
  deliveryStaff: DeliveryStaff[],
  cahLinks: CAHLink[],
  title: string,
  slogan: string,
  generatedAt: string,
  storefrontId: string,
  expiryDate?: string,
  allowWhatsApp: boolean = false,
  allowCall: boolean = false,
  selectedVendorId?: string,
  feedbackWhatsAppNumber?: string,
  syncEndpointUrl?: string,
) => {
  const vendorProducts = selectedVendorId
    ? products.filter((p) => p.vendorId === selectedVendorId)
    : products;

  const mainWhatsapp = vendor.whatsappNumber
    ? `https://wa.me/${vendor.whatsappNumber.replace(/[^0-9]/g, "")}`
    : "";
  const mainCall = vendor.mainPhone
    ? `tel:${vendor.mainPhone.replace(/[^0-9+]/g, "")}`
    : "";
  const farmProduceProducts = vendorProducts.filter((p) => p.isFarmProduce);
  const hasFarmProduce = farmProduceProducts.length > 0;

  if (vendorProducts.length === 0) {
    // We will handle the empty state rendering later in the function,
    // but the filtering is done here.
  }

  const productItems =
    vendorProducts.length === 0
      ? '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--muted); background: #f9f9f9; border: 1px dashed var(--border); border-radius: 8px;">No products available for this vendor.</div>'
      : vendorProducts
          .map((p) => {
            const imageSrc = normalizeImageUrl(product.imageUrl);
            const searchString = escapeHtml(
              [
                p.name,
                p.brand,
                p.category,
                p.sector,
                p.tags?.join(" ") || "",
                p.description || "",
                vendor.name,
                p.branchName || "",
                vendor.cityTown || "",
                vendor.suburb || "",
                vendor.district || "",
                p.sellingPrice.toString(),
              ]
                .join(" ")
                .toLowerCase(),
            );
            const stockClass = p.stockQuantity > 0 ? "stock-in" : "stock-out";
            const stockText = p.stockQuantity > 0 ? "In Stock" : "Out of Stock";

            return `
      <article class="product-card" data-id="${p.id}" data-search="${searchString}">
        <div class="product-img-wrapper" onclick="openProductModal('${p.id}')">
          <img src="${imageSrc}" loading="lazy" alt="${escapeHtml(p.name)}" />
        </div>
        <div class="product-info">
          <div class="product-brand">${escapeHtml(p.brand || p.category || vendor.sector || "General")}</div>
          <h3 class="product-name" onclick="openProductModal('${p.id}')">${escapeHtml(p.name)}</h3>
          <div class="product-price">USD ${p.sellingPrice.toFixed(2)}</div>
          <div class="product-meta">
            <span class="stock-status ${stockClass}">${stockText}</span>
            <span class="branch">${escapeHtml(p.branchName || "Main")}</span>
          </div>
          <div class="product-actions">
            <button class="btn btn-wa" onclick="orderWhatsApp('${p.id}')">WhatsApp</button>
            <button class="btn btn-call" onclick="callVendor('${p.id}')">Call</button>
          </div>
        </div>
      </article>
    `;
          })
          .join("");

  const cleanPhone = (num?: string) => (num ? num.replace(/[^0-9+]/g, "") : "");
  const cleanWa = (num?: string) => (num ? num.replace(/[^0-9]/g, "") : "");

  const branchRows = branches
    .map((branch) => {
      const waLink = cleanWa(branch.whatsapp)
        ? `<a href="https://wa.me/${cleanWa(branch.whatsapp)}" class="btn btn-wa" style="flex:1;" target="_blank">WhatsApp</a>`
        : "";
      const callLink = cleanPhone(branch.phone)
        ? `<a href="tel:${cleanPhone(branch.phone)}" class="btn btn-call" style="flex:1;">Call</a>`
        : "";
      return `
      <div class="info-card">
        <h3>${escapeHtml(branch.name || "Branch")}</h3>
        <div class="info-row"><strong>Address:</strong> ${escapeHtml(branch.address || "N/A")}</div>
        <div class="info-row"><strong>Area:</strong> ${escapeHtml(branch.suburb || "N/A")} / ${escapeHtml(branch.district || "N/A")} / ${escapeHtml(branch.cityTown || "N/A")} / ${escapeHtml(branch.province || "N/A")}</div>
        <div class="info-row"><strong>Manager:</strong> ${escapeHtml(branch.managerName || "N/A")}</div>
        <div class="info-row"><strong>Hours:</strong> ${escapeHtml(branch.openingHours || "N/A")}</div>
        <div class="info-actions">${callLink}${waLink}</div>
      </div>
    `;
    })
    .join("");

  const staffRows = staff
    .map((person) => {
      const waLink = cleanWa(person.whatsapp)
        ? `<a href="https://wa.me/${cleanWa(person.whatsapp)}" class="btn btn-wa" style="flex:1;" target="_blank">WhatsApp</a>`
        : "";
      const callLink = cleanPhone(person.phone)
        ? `<a href="tel:${cleanPhone(person.phone)}" class="btn btn-call" style="flex:1;">Call</a>`
        : "";
      return `
      <div class="info-card">
        <h3>${escapeHtml(person.fullName || "Staff")}</h3>
        <div class="info-row"><strong>Role:</strong> ${escapeHtml(person.role || "N/A")}</div>
        <div class="info-actions">${callLink}${waLink}</div>
      </div>
    `;
    })
    .join("");

  const deliveryRows =
    deliveryStaff
      .map((driver) => {
        const waLink = cleanWa(driver.whatsapp)
          ? `<a href="https://wa.me/${cleanWa(driver.whatsapp)}" class="btn btn-wa" style="flex:1;" target="_blank">WhatsApp</a>`
          : "";
        const callLink = cleanPhone(driver.phone)
          ? `<a href="tel:${cleanPhone(driver.phone)}" class="btn btn-call" style="flex:1;">Call</a>`
          : "";
        return `
      <div class="info-card">
        <h3>${escapeHtml(driver.fullName || "Delivery")}</h3>
        <div class="info-row"><strong>Vehicle Type:</strong> ${escapeHtml(driver.vehicleType || "N/A")}</div>
        <div class="info-row"><strong>Service Area:</strong> ${escapeHtml(driver.serviceArea || "N/A")}</div>
        <div class="info-row"><strong>Notes:</strong> Please contact to confirm delivery availability.</div>
        <div class="info-actions">${callLink}${waLink}</div>
      </div>
    `;
      })
      .join("") ||
    '<p style="color:var(--stone-500); font-size:14px;">Please contact vendor directly for delivery arrangements.</p>';

  const vendorBusinessHtml = `
    <div class="info-card">
      <h3>Head Office / Owner</h3>
      <div class="info-row"><strong>Name:</strong> ${escapeHtml(vendor.ownerFullName || vendor.name)}</div>
      <div class="info-row"><strong>Email:</strong> ${escapeHtml(vendor.email || "N/A")}</div>
      <div class="info-row"><strong>Hours:</strong> ${escapeHtml(vendor.openingHours || "N/A")}</div>
      <div class="info-actions">
        ${cleanPhone(vendor.mainPhone) ? `<a href="tel:${cleanPhone(vendor.mainPhone)}" class="btn btn-call" style="flex:1">Call HQ</a>` : ""}
        ${cleanWa(vendor.whatsappNumber) ? `<a href="https://wa.me/${cleanWa(vendor.whatsappNumber)}" class="btn btn-wa" style="flex:1" target="_blank">WhatsApp HQ</a>` : ""}
      </div>
    </div>
  `;

  const productCount = vendorProducts.length;
  const imageCount = vendorProducts.filter((p) => !!p.imageUrl).length;

  const communityLink = cahLinks.find((l) => l.whatsappCommunityLink);
  const channelLink = cahLinks.find((l) => l.whatsappChannelLink);
  const groupLink = cahLinks.find(
    (l) => l.whatsappGroupLink || l.catalogueDistributionGroupLink,
  );
  const supportLink = cahLinks.find((l) => l.supportNumber);

  const supportMsg = encodeURIComponent(
    `Hello iTred Support, I need help with this vendor storefront: ${vendor.name} - ${vendor.systemCode}`,
  );
  const supportUrl = supportLink
    ? `https://wa.me/${supportLink.supportNumber?.replace(/[^0-9]/g, "")}?text=${supportMsg}`
    : "";

  const logoSrc = normalizeImageUrl(vendor.logoUrl);
  const bannerSrc = normalizeImageUrl(vendor.bannerUrl);
  const mainSector = escapeHtml(vendor.sector || "General");
  const cahJoinUrl =
    communityLink?.whatsappCommunityLink ||
    groupLink?.whatsappGroupLink ||
    groupLink?.catalogueDistributionGroupLink ||
    "https://itred.com/join";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${escapeHtml(title || `${vendor.name} Storefront`)}</title>
  <style>
    :root {
      color-scheme: light;
      --orange: #f97316;
      --charcoal: #262626;
      --bg: #ffffff;
      --stone-50: #fafaf9;
      --stone-100: #f5f5f4;
      --stone-200: #e7e5e4;
      --stone-400: #a8a29e;
      --stone-500: #78716c;
      --stone-600: #57534e;
      --stone-800: #292524;
    }
    * { box-sizing: border-box; border-radius: 0 !important; }
    body { margin: 0; min-height: 100vh; background: var(--stone-50); color: var(--charcoal); overflow-wrap: break-word; word-wrap: break-word; font-family: system-ui, -apple-system, sans-serif; padding-bottom: 70px; overflow-x: hidden; }
    img { max-width: 100%; display: block; }
    button, input { font: inherit; }
    
    .header { background: var(--bg); border-bottom: 1px solid var(--stone-200); position: relative; }
    .banner-container { width: 100%; height: 160px; background: var(--stone-200); position: relative; }
    .banner-img { width: 100%; height: 100%; object-fit: cover; }
    .logo-badge { position: absolute; bottom: -40px; left: 20px; width: 80px; height: 80px; background: var(--bg); border: 4px solid var(--bg); border-radius: 50% !important; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10; display: flex; align-items: center; justify-content: center; }
    .logo-img { width: 100%; height: 100%; object-fit: contain; border-radius: 50% !important; }
    
    .header-content { padding: 50px 20px 20px; }
    .header-content h1 { margin: 0 0 4px; font-size: 24px; font-weight: 900; line-height: 1.2; }
    .slogan { margin: 0 0 12px; font-size: 14px; color: var(--stone-500); }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .tag { background: var(--stone-100); padding: 4px 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; color: var(--stone-600); }
    .badge-verified { background: var(--charcoal); color: var(--orange); padding: 4px 8px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .powered-by { margin: 0; font-size: 10px; font-weight: bold; text-transform: uppercase; color: var(--stone-400); }
    
    .search-container { position: sticky; top: 0; z-index: 100; background: var(--bg); padding: 12px 20px; border-bottom: 2px solid var(--orange); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .search-input { width: 100%; padding: 12px 16px; font-size: 14px; border: 1px solid var(--stone-200); background: var(--stone-50); outline: none; font-weight: 600; }
    .search-input:focus { border-color: var(--orange); background: var(--bg); }
    
    .tab-pane { display: none; padding: 20px; max-width: 1200px; margin: 0 auto; }
    .tab-pane.active { display: block; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
    @media (min-width: 640px) { .product-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); } }
    
    .product-card { background: var(--bg); border: 1px solid var(--stone-200); display: flex; flex-direction: column; }
    .product-img-wrapper { position: relative; width: 100%; padding-top: 100%; background: var(--stone-50); cursor: pointer; border-bottom: 1px solid var(--stone-100); }
    .product-img-wrapper img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
    .product-info { padding: 12px; display: flex; flex-direction: column; flex: 1; }
    .product-brand { font-size: 9px; font-weight: bold; text-transform: uppercase; color: var(--stone-400); margin-bottom: 4px; }
    .product-name { font-size: 14px; font-weight: 700; margin: 0 0 8px; color: var(--charcoal); cursor: pointer; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
    .product-price { font-size: 16px; font-weight: 900; color: var(--orange); margin-bottom: 8px; }
    .product-meta { font-size: 10px; color: var(--stone-500); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .stock-status { font-weight: bold; text-transform: uppercase; }
    .stock-in { color: #16a34a; }
    .stock-out { color: #dc2626; }
    
    .product-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; border: none; cursor: pointer; text-decoration: none; text-align: center; }
    .btn-wa { background: #16a34a; color: white; }
    .btn-call { background: var(--stone-800); color: white; }
    .btn-outline { border: 1px solid var(--stone-400); color: var(--bg); background: transparent; }
    .btn-outline:hover { border-color: var(--orange); color: var(--orange); }
    .btn-primary { background: var(--orange); color: white; width: 100%; padding: 12px; font-size: 14px; }
    
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: flex-end; justify-content: center; }
    .modal-overlay.active { display: flex; }
    @media (min-width: 640px) { .modal-overlay { align-items: center; } }
    .modal-content { background: var(--bg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; position: relative; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .modal-close { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; background: var(--bg); border: 1px solid var(--stone-200); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; cursor: pointer; z-index: 10; color: var(--charcoal); }
    .modal-img { width: 100%; height: 300px; object-fit: cover; background: var(--stone-100); }
    .modal-body { padding: 20px; }
    .modal-title { font-size: 20px; font-weight: 900; margin: 0 0 8px; line-height: 1.2; }
    .modal-price { font-size: 24px; font-weight: 900; color: var(--orange); margin-bottom: 16px; }
    .modal-desc { font-size: 14px; color: var(--stone-600); line-height: 1.5; margin-bottom: 20px; white-space: pre-wrap; }
    .modal-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 12px; }
    .modal-meta-item { background: var(--stone-50); padding: 10px; border: 1px solid var(--stone-200); }
    .modal-meta-label { display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; color: var(--stone-400); margin-bottom: 4px; }
    .modal-meta-value { font-weight: 700; color: var(--charcoal); }
    .modal-actions { display: flex; flex-direction: column; gap: 10px; }
    
    .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; background: var(--bg); border-top: 1px solid var(--stone-200); display: flex; z-index: 500; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); }
    .nav-btn { flex: 1; padding: 16px 4px; background: none; border: none; border-top: 2px solid transparent; font-size: 10px; font-weight: bold; text-transform: uppercase; color: var(--stone-500); cursor: pointer; transition: all 0.2s; text-align: center; }
    .nav-btn.active { color: var(--orange); border-top-color: var(--orange); background: var(--stone-50); }
    
    .info-card { background: var(--bg); border: 1px solid var(--stone-200); padding: 16px; margin-bottom: 16px; }
    .info-card h3 { margin: 0 0 12px; font-size: 16px; font-weight: 900; color: var(--charcoal); }
    .info-row { margin-bottom: 8px; font-size: 13px; color: var(--stone-600); }
    .info-row strong { color: var(--charcoal); }
    .info-actions { display: flex; gap: 8px; margin-top: 16px; }
    
    .viral-footer { margin-top: 40px; padding: 30px 20px; background: var(--charcoal); color: var(--bg); text-align: center; }
    .viral-footer p { margin: 0 0 10px; font-size: 12px; }
    .viral-footer strong { color: var(--orange); font-size: 14px; text-transform: uppercase; }
    .viral-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; max-width: 300px; margin-left: auto; margin-right: auto; }
    
    .legal-text { font-size: 12px; line-height: 1.6; color: var(--stone-600); background: var(--bg); padding: 20px; border: 1px solid var(--stone-200); }
    .legal-text h4 { margin: 20px 0 8px; font-size: 14px; color: var(--charcoal); }
    .legal-text h4:first-child { margin-top: 0; }
    
    .svy-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; display:none; align-items:center; justify-content:center; padding:16px; font-family:system-ui, sans-serif; }
    .svy-box { background:var(--bg, #fff); width:100%; max-width:400px; padding:24px; position:relative; color:var(--charcoal, #333); max-height:90vh; overflow-y:auto; }
    .svy-close { position:absolute; right:12px; top:12px; background:none; border:none; font-size:24px; cursor:pointer; color:#888; }
    .svy-btn { display:block; width:100%; padding:14px; margin-bottom:8px; border:1px solid var(--stone-200, #ddd); background:var(--stone-50, #f9f9f9); text-align:left; font-size:14px; font-weight:bold; cursor:pointer; color:var(--charcoal, #333); }
    .svy-btn:hover { border-color:var(--orange, #FF6B00); color:var(--orange, #FF6B00); background:var(--orange-50, #fff3ed); }
    .svy-input { width:100%; padding:12px; border:1px solid var(--stone-200, #ddd); margin-bottom:12px; font-size:14px; font-family:inherit; }
    .svy-wa { display:block; width:100%; padding:14px; background:#16a34a; color:#fff; text-align:center; font-weight:bold; text-decoration:none; margin-top:16px; border:none; cursor:pointer; }
    .svy-h3 { margin-top:0; font-size:18px; margin-bottom:12px; color:var(--charcoal, #111); line-height:1.2; }
    .svy-p { font-size:13px; color:var(--stone-500, #555); margin-top:0; margin-bottom:16px; line-height:1.4; }
    .svy-link { display:block; background:none; border:none; color:var(--stone-400, #888); font-size:12px; cursor:pointer; text-decoration:underline; width:100%; text-align:center; padding:12px; margin-top:8px; }
  </style>
</head>
<body>
  <div id="ios-notice" style="display:none; padding:12px; background:#fef3c7; color:#92400e; font-size:12px; font-weight:bold; text-align:center;">
    iPhone users may get the best experience from the hosted storefront link. Continue offline if needed.
    <button onclick="document.getElementById('ios-notice').style.display='none'" style="margin-left:10px; border:none; background:none; font-weight:bold;">✕</button>
  </div>

  <header class="header">
    <div class="banner-container">
      <img src="${bannerSrc}" class="banner-img" />
      <div class="logo-badge">
        <img src="${logoSrc}" class="logo-img" />
      </div>
    </div>
    <div class="header-content">
      <h1>${escapeHtml(vendor.name)}</h1>
      <p class="slogan">${escapeHtml(slogan || "A complete vendor showcase.")}</p>
      <div class="tags">
        <span class="tag">${escapeHtml(mainSector)}</span>
        <span class="badge-verified">Verified iTred Vendor</span>
      </div>
      <p class="powered-by">Powered by seiGEN Commerce</p>
    </div>
    
    <div class="search-container">
      <input type="text" id="search-input" class="search-input" placeholder="Search products, brand, price, location..." oninput="handleSearch()" />
    </div>
  </header>

  <main class="main-content" id="main-content">
    <div id="tab-products" class="tab-pane active">
      <div class="product-grid">${productItems}</div>
    </div>

    <div id="tab-contact" class="tab-pane">
        ${vendorBusinessHtml}
        ${staffRows}
    </div>

    <div id="tab-branches" class="tab-pane">
        ${branchRows}
    </div>

    <div id="tab-delivery" class="tab-pane">
        ${deliveryHtml}
    </div>

    <div id="tab-terms" class="tab-pane">
      <div class="legal-text">
        <h4>Pricing & Availability</h4>
        <p>All products, pricing, and availability are subject to change. Please contact the vendor directly via WhatsApp or Call to confirm current stock levels before making any payment or traveling to a branch.</p>
        
        <h4>Warranty & Returns</h4>
        <p>Warranty conditions and return policies are defined strictly by the listed vendor. Ensure you request and retain a valid receipt or invoice upon purchase.</p>
      
        <h4>Delivery</h4>
        <p>Delivery terms, costs, and timelines are negotiated directly between the customer and the vendor or their listed delivery personnel.</p>
      
        <h4>Privacy</h4>
        <p>This offline storefront does not automatically collect personal tracking data. Information shared via WhatsApp or calls is subject to the vendor's own privacy practices.</p>
      
        <h4>seiGEN Commerce Disclaimer</h4>
        <p>Products are supplied by the listed vendor. iTred and seiGEN Commerce provide catalogue, visibility, and contact infrastructure. Final sale, warranty, product quality, and delivery terms remain between the customer and vendor unless otherwise stated.</p>
      </div>
    </div>
    
    <footer class="footer">
      <div class="viral-footer">
        <p><strong>Powered by seiGEN Commerce</strong></p>
        <p>Want a storefront like this for your business?</p>
        <p>Join iTred Vendor Network</p>
        <div class="viral-actions">
           <button class="btn btn-wa" onclick="logHubClick('contact_seigen', getFeedbackUrl('I%20want%20a%20storefront'))">Contact seiGEN Commerce</button>
           <button class="btn btn-outline" onclick="logHubClick('join_cah', '${cahJoinUrl}')">Join Commerce Access Hub</button>
        </div>
      </div>
    </footer>
  </main>

  <nav class="bottom-nav">
    <button class="nav-btn active" onclick="switchTab('products', this)">Products</button>
    <button class="nav-btn" onclick="switchTab('contact', this)">Contact</button>
    <button class="nav-btn" onclick="switchTab('branches', this)">Branches</button>
    <button class="nav-btn" onclick="switchTab('delivery', this)">Delivery</button>
    <button class="nav-btn" onclick="switchTab('terms', this)">Terms</button>
  </nav>

  <div id="modal-overlay" class="modal-overlay">
    <div class="modal-content">
      <button class="modal-close" onclick="closeModal()">×</button>
      <img id="m-img" class="modal-img" />
      <div class="modal-body">
        <h2 id="m-name" class="modal-title"></h2>
        <div id="m-price" class="modal-price"></div>
        <div id="m-desc" class="modal-desc"></div>
        
        <div class="modal-meta-grid">
          <div class="modal-meta-item">
            <span class="modal-meta-label">SKU / Code</span>
            <span id="m-sku" class="modal-meta-value"></span>
          </div>
          <div class="modal-meta-item">
            <span class="modal-meta-label">Stock Status</span>
            <span id="m-stock" class="modal-meta-value"></span>
          </div>
          <div class="modal-meta-item">
            <span class="modal-meta-label">Branch</span>
            <span id="m-branch" class="modal-meta-value"></span>
          </div>
          <div class="modal-meta-item">
            <span class="modal-meta-label">Vendor</span>
            <span id="m-vendor" class="modal-meta-value"></span>
          </div>
          <div class="modal-meta-item">
            <span class="modal-meta-label">Delivery</span>
            <span id="m-delivery" class="modal-meta-value"></span>
          </div>
        </div>

        <div class="modal-actions">
          <button id="m-btn-wa" class="btn btn-wa" style="width:100%; padding:14px; font-size:14px;">WhatsApp Order</button>
          <div style="display:flex; gap:10px;">
            <button id="m-btn-call" class="btn btn-call" style="flex:1; padding:12px;">Call Vendor</button>
            <button id="m-btn-share" class="btn btn-outline" style="flex:1; padding:12px; color:var(--charcoal); border-color:var(--stone-200);">Share Product</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div id="svyOverlay" class="svy-overlay">
    <div class="svy-box">
      <button class="svy-close" onclick="closeSurvey()">×</button>
      <div id="svyContent"></div>
    </div>
  </div>

  <script>
    // --- Commerce Intelligence Core ---
    const ITRED_EVENTS_KEY = 'itred_offline_commerce_events';
    const ITRED_LEADS_KEY = 'itred_pending_leads';
    const ITRED_SESSION_KEY = 'itred_device_session_id';
    const FEEDBACK_WA = ${JSON.stringify(feedbackWhatsAppNumber || "")};
    const SYNC_ENDPOINT = ${JSON.stringify(syncEndpointUrl || "")};

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
        const newEvent = {
          ...event,
          eventId: 'EVT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          synced: false,
          deviceSessionId: getDeviceSessionId(),
        };
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
                source: "itred_offline_storefront",
                storefrontId: STOREFRONT_ID,
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
    const EXPIRY_DATE = ${expiryDate ? `"${expiryDate}"` : "null"};
    
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
          <button class="svy-btn" onclick="triggerHelpfulnessSurvey(true)">Give Feedback</button>
        \`;
        showSurveyHtml(html);
      }
    }

    function triggerHelpfulnessSurvey(force = false) {
      if (force || canShowPopup(ITRED_LAST_HELP, 24)) {
        safeLocalStorageSet(ITRED_LAST_HELP, Date.now());
        const html = \`
          <h3 class="svy-h3" style="margin-bottom:20px;">Is this catalogue helping you find what you need?</h3>
          <button class="svy-btn" onclick="submitHelpfulness('Yes, it helped')">Yes, it helped</button>
          <button class="svy-btn" onclick="submitHelpfulness('Partly helped')">Partly helped</button>
          <button class="svy-btn" onclick="submitHelpfulness('No, I did not find what I wanted')">No, I did not find what I wanted</button>
          <button class="svy-btn" onclick="submitHelpfulness('I need assistance')">I need assistance</button>
          <div style="margin-top:20px;">
            <label style="font-size:12px; font-weight:bold; display:block; margin-bottom:6px;">Optional comment:</label>
            <input type="text" id="helpComment" placeholder="What product/vendor are you looking for?" class="svy-input" />
          </div>
          <button class="svy-link" onclick="closeSurvey()">Not Now</button>
        \`;
        showSurveyHtml(html);
      }
    }

    function submitHelpfulness(answer) {
      const commentEl = document.getElementById('helpComment');
      const comment = commentEl ? commentEl.value : '';
      logOfflineEvent({ eventType: 'SURVEY_ANSWERED', sourceType: 'storefront', payload: { survey: 'helpfulness', answer: answer, comment: comment } });
      const text = encodeURIComponent("Feedback: " + answer + "\\nComment: " + comment);
      document.getElementById('svyContent').innerHTML = \`
        <h3 class="svy-h3">Thank you for your feedback!</h3>
        <button class="svy-wa" onclick="window.open(getFeedbackUrl('\${text}'))">Send Feedback to seiGEN Commerce on WhatsApp</button>
        <button class="svy-link" onclick="closeSurvey()">Close</button>\`;
    }

    function triggerExpirySurvey() {
      if (canShowPopup(ITRED_EXPIRY_SHOWN, 999999)) {
        safeLocalStorageSet(ITRED_EXPIRY_SHOWN, "true");
        showSurveyHtml(\`
          <h3 class="svy-h3" style="margin-bottom:20px;">This catalogue is about to expire. Did it help you connect with vendors or products?</h3>
          <button class="svy-btn" onclick="submitExpiry('Yes')">Yes</button>
          <button class="svy-btn" onclick="submitExpiry('Partly')">Partly</button>
          <button class="svy-btn" onclick="submitExpiry('No')">No</button>
          <button class="svy-btn" onclick="submitExpiry('I need updated catalogue')">I need updated catalogue</button>
          <button class="svy-link" onclick="closeSurvey()">Not Now</button>\`);
        logOfflineEvent({ eventType: 'EXPIRY_SURVEY_OPENED', sourceType: 'storefront', payload: { status: 'opened' } });
      }
    }

    function submitExpiry(answer) {
      logOfflineEvent({ eventType: 'SURVEY_ANSWERED', sourceType: 'storefront', payload: { survey: 'expiry', answer: answer } });
      const text = encodeURIComponent("Expiry Feedback: " + answer);
      document.getElementById('svyContent').innerHTML = \`<h3 class="svy-h3">Thank you for your feedback!</h3><button class="svy-wa" onclick="window.open(getFeedbackUrl('\${text}'))">Send Feedback to seiGEN Commerce on WhatsApp</button><button class="svy-link" onclick="closeSurvey()">Close</button>\`;
    }

    function triggerNoResultsSurvey() {
      if (canShowPopup('', 0)) {
        showSurveyHtml(\`<h3 class="svy-h3">We could not find that product.</h3><p class="svy-p" style="margin-bottom:20px;">Do you want seiGEN Commerce to help source it?</p><input type="text" id="nrProduct" placeholder="Product needed" class="svy-input" /><input type="text" id="nrLocation" placeholder="Location" class="svy-input" /><input type="text" id="nrBudget" placeholder="Budget (optional)" class="svy-input" /><input type="text" id="nrContact" placeholder="Contact (optional)" class="svy-input" /><button class="svy-btn" style="background:#111; color:#fff; text-align:center; margin-top:8px;" onclick="submitNoResults()">Submit Sourcing Request</button><button class="svy-link" onclick="closeSurvey()">Not Now</button>\`);
      }
    }

    function submitNoResults() {
      const product = document.getElementById('nrProduct') ? document.getElementById('nrProduct').value : '';
      const location = document.getElementById('nrLocation') ? document.getElementById('nrLocation').value : '';
      if (!product || !location) { alert('Please provide product and location'); return; }
      logOfflineEvent({ eventType: 'LEAD_FOLLOWUP_ANSWERED', sourceType: 'storefront', payload: { survey: 'sourcing_request', product: product, location: location, budget: document.getElementById('nrBudget') ? document.getElementById('nrBudget').value : '', contact: document.getElementById('nrContact') ? document.getElementById('nrContact').value : '' } });
      const text = encodeURIComponent("Sourcing Request\\nProduct: " + product + "\\nLocation: " + location + "\\nBudget: " + (document.getElementById('nrBudget') ? document.getElementById('nrBudget').value : '') + "\\nContact: " + (document.getElementById('nrContact') ? document.getElementById('nrContact').value : ''));
      document.getElementById('svyContent').innerHTML = \`<h3 class="svy-h3">Request Prepared!</h3><button class="svy-wa" onclick="window.open(getFeedbackUrl('\${text}'))">Send Request to seiGEN Commerce on WhatsApp</button><button class="svy-link" onclick="closeSurvey()">Close</button>\`;
    }

    function checkExpiry() {
      if (EXPIRY_DATE) { const hoursLeft = (new Date(EXPIRY_DATE).getTime() - Date.now()) / 3600000; if (hoursLeft <= 48) { triggerExpirySurvey(); return true; } } return false;
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
        '<button class="svy-btn" onclick="submitLeadFollowUp(\\'' + lead.leadRef + '\\', \\'Yes, I was helped\\')">Yes, I was helped</button>' +
        '<button class="svy-btn" onclick="submitLeadFollowUp(\\'' + lead.leadRef + '\\', \\'Vendor did not respond\\')">Vendor did not respond</button>' +
        '<button class="svy-btn" onclick="submitLeadFollowUp(\\'' + lead.leadRef + '\\', \\'Product was unavailable\\')">Product was unavailable</button>' +
        '<button class="svy-btn" onclick="submitLeadFollowUp(\\'' + lead.leadRef + '\\', \\'Price was different\\')">Price was different</button>' +
        '<button class="svy-btn" onclick="submitLeadFollowUp(\\'' + lead.leadRef + '\\', \\'I still need help\\')">I still need help</button>' +
        '<div style="margin-top:20px;">' +
          '<label style="font-size:12px; font-weight:bold; display:block; margin-bottom:6px;">Optional comment:</label>' +
          '<input type="text" id="leadComment" placeholder="Any additional details?" class="svy-input" />' +
        '</div>' +
        '<button class="svy-link" onclick="closeSurvey()">Not Now</button>';
      showSurveyHtml(html);
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
        sourceType: 'storefront',
        storefrontId: lead.storefrontId,
        vendorId: lead.vendorId,
        vendorName: lead.vendorName,
        productId: lead.productId,
        productName: lead.productName,
        leadRef: leadRef,
        payload: { survey: 'lead_followup', answer: answer, comment: comment }
      });

      const text = "SCI CUSTOMER FEEDBACK\\n\\nLead Ref: " + leadRef + "\\nCatalogue/Storefront: " + lead.storefrontId + "\\nVendor: " + lead.vendorName + "\\nProduct: " + lead.productName + "\\nCustomer answer: " + answer + "\\nComment: " + comment + "\\nTime: " + new Date().toISOString() + "\\n\\nPlease follow up.";
      const encodedText = encodeURIComponent(text);

      document.getElementById('svyContent').innerHTML = 
        '<h3 class="svy-h3">Thank you for your feedback!</h3>' +
        '<button class="svy-wa" onclick="window.open(getFeedbackUrl(\\'' + encodedText + '\\'))">Send Feedback to seiGEN Commerce</button>' +
        '<button class="svy-link" onclick="closeSurvey()">Close</button>';
    }

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
    // --- End Commerce Intelligence Core ---

    const PRODUCTS = {
      ${vendorProducts
        .map(
          (p) => `
        "${p.id}": {
          name: ${JSON.stringify(p.name || "")},
          brand: ${JSON.stringify(p.brand || p.category || "")},
          price: ${p.sellingPrice || 0},
          stock: ${p.stockQuantity || 0},
          img: ${JSON.stringify(normalizeImageUrl(p.imageUrl))},
          desc: ${JSON.stringify(p.description || "")},
          sku: ${JSON.stringify(p.sku || p.productCode || "")},
          branch: ${JSON.stringify(p.branchName || "")},
          delivery: ${JSON.stringify(p.deliveryAvailable ? "Available" : "Check with vendor")}
        }
      `,
        )
        .join(",\n")}
    };
    const STOREFRONT_ID = ${JSON.stringify(storefrontId)};
    const VENDOR_ID = ${JSON.stringify(vendor.id || "")};
    const VENDOR_CODE = ${JSON.stringify(vendor.systemCode || "")};
    const VENDOR_NAME = ${JSON.stringify(vendor.name || "")};
    const VENDOR_SECTOR = ${JSON.stringify(vendor.sector || "")};
    const VENDOR_WA = ${JSON.stringify(vendor.whatsappNumber ? vendor.whatsappNumber.replace(/[^0-9]/g, "") : "")};
    const VENDOR_PHONE = ${JSON.stringify(vendor.mainPhone ? vendor.mainPhone.replace(/[^0-9+]/g, "") : "")};
    
    function orderWhatsApp(productId) {
      const p = PRODUCTS[productId];
      if (!p) return;
      const num = VENDOR_WA;
      if (!num) { alert("WhatsApp number not provided by vendor."); return; }
      
      const leadRef = 'ITRED-' + STOREFRONT_ID + '-' + VENDOR_ID + '-' + productId;
      
      storePendingLead({
        leadRef: leadRef,
        timestamp: new Date().toISOString(),
        vendorId: VENDOR_ID,
        vendorName: VENDOR_NAME,
        productId: productId,
        productName: p.name,
        storefrontId: STOREFRONT_ID,
        sector: VENDOR_SECTOR,
        actionType: 'WHATSAPP',
        followUpDueAt: Date.now() + 30 * 60000,
        answered: false
      });

      logOfflineEvent({
        eventType: 'WHATSAPP_VENDOR_CLICKED',
        sourceType: 'storefront',
        storefrontId: STOREFRONT_ID,
        vendorId: VENDOR_ID,
        vendorName: VENDOR_NAME,
        sector: VENDOR_SECTOR,
        productId: productId,
        productName: p.name,
        leadRef: leadRef,
        payload: { price: p.price, waNumber: num }
      });

      const text = "Hi " + VENDOR_NAME + ", I saw this product on iTred powered by seiGEN Commerce.\\n\\nProduct: " + p.name + "\\nPrice: USD " + p.price.toFixed(2) + "\\nRef: " + leadRef + "\\n\\nPlease confirm availability.";
      window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(text), "_blank");
    }

    function callVendor(productId) {
      const p = PRODUCTS[productId];
      const num = VENDOR_PHONE;
      if (!num) { alert("Phone number not provided by vendor."); return; }

      const leadRef = 'ITRED-' + STOREFRONT_ID + '-' + VENDOR_ID + '-' + productId;

      storePendingLead({
        leadRef: leadRef,
        timestamp: new Date().toISOString(),
        vendorId: VENDOR_ID,
        vendorName: VENDOR_NAME,
        productId: productId,
        productName: p ? p.name : undefined,
        storefrontId: STOREFRONT_ID,
        sector: VENDOR_SECTOR,
        actionType: 'CALL',
        followUpDueAt: Date.now() + 30 * 60000,
        answered: false
      });

      logOfflineEvent({
        eventType: 'CALL_VENDOR_CLICKED',
        sourceType: 'storefront',
        storefrontId: STOREFRONT_ID,
        vendorId: VENDOR_ID,
        vendorName: VENDOR_NAME,
        sector: VENDOR_SECTOR,
        productId: productId,
        productName: p ? p.name : undefined,
        leadRef: leadRef,
        payload: { phone: num }
      });

      window.location.href = "tel:" + num;
    }

    function shareProduct(productId) {
      const p = PRODUCTS[productId];
      if (!p) return;
      const text = "Check out " + p.name + " from " + VENDOR_NAME + " on their iTred Storefront!";
      if (navigator.share) {
        navigator.share({ title: p.name, text: text }).catch(console.error);
      } else {
        const num = VENDOR_WA;
        if (num) {
          window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
        } else {
          prompt("Copy this text to share:", text);
        }
      }
    }

    function openProductModal(productId) {
      const p = PRODUCTS[productId];
      if (!p) return;

      logOfflineEvent({
        eventType: 'PRODUCT_VIEWED',
        sourceType: 'storefront',
        storefrontId: STOREFRONT_ID,
        vendorId: VENDOR_ID,
        vendorName: VENDOR_NAME,
        sector: VENDOR_SECTOR,
        productId: productId,
        productName: p.name,
        category: p.brand,
        payload: { price: p.price, brand: p.brand }
      });
      
      document.getElementById('m-img').src = p.img;
      document.getElementById('m-name').innerText = p.name;
      document.getElementById('m-price').innerText = 'USD ' + p.price.toFixed(2);
      document.getElementById('m-desc').innerText = p.desc;
      document.getElementById('m-sku').innerText = p.sku;
      document.getElementById('m-stock').innerText = p.stock > 0 ? 'In Stock' : 'Out of Stock';
      document.getElementById('m-branch').innerText = p.branch;
      document.getElementById('m-vendor').innerText = VENDOR_NAME;
      document.getElementById('m-delivery').innerText = p.delivery;
      
      sessionProductViews++;
      if (sessionProductViews >= 2) {
        setTimeout(triggerHelpfulnessSurvey, 2000);
      }

      document.getElementById('m-btn-wa').onclick = function() { orderWhatsApp(productId); };
      document.getElementById('m-btn-call').onclick = function() { callVendor(productId); };
      document.getElementById('m-btn-share').onclick = function() { shareProduct(productId); };
      
      document.getElementById('modal-overlay').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('active');
      document.body.style.overflow = '';
    }

    function switchTab(tabId, btn) {
      document.querySelectorAll('.tab-pane').forEach(function(el) { el.classList.remove('active') });
      document.querySelectorAll('.nav-btn').forEach(function(el) { el.classList.remove('active') });
      document.getElementById('tab-' + tabId).classList.add('active');
      btn.classList.add('active');
      window.scrollTo(0, 0);
    }

    let searchTimeout;
    let lastQuery = '';
    function handleSearch() {
      const input = document.getElementById('search-input');
      if(!input) return;
      const query = input.value.toLowerCase().trim();
      const terms = query.split(/\\s+/).filter(function(t) { return t });
      const cards = document.querySelectorAll('.product-card');
      let matchCount = 0;
      
      cards.forEach(function(card) {
        if (terms.length === 0) {
          card.style.display = '';
          matchCount++;
          return;
        }
        const searchStr = card.getAttribute('data-search') || '';
        const matches = terms.every(function(term) { return searchStr.includes(term) });
        card.style.display = matches ? '' : 'none';
        if (matches) {
          matchCount++;
        }
      });

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if (query.length < 2 || query === lastQuery) {
          return;
        }
        lastQuery = query;

        sessionSearches++;
        if (matchCount === 0) {
          sessionEmptySearches++;
          if (sessionEmptySearches >= 2) {
             setTimeout(triggerNoResultsSurvey, 1500);
          }
        } else if (sessionSearches >= 2) {
           setTimeout(triggerHelpfulnessSurvey, 2000);
        }

        logOfflineEvent({
          eventType: matchCount > 0 ? 'SEARCH_PERFORMED' : 'NO_RESULTS_SEARCH',
          sourceType: 'storefront',
          storefrontId: STOREFRONT_ID,
          vendorId: VENDOR_ID,
          vendorName: VENDOR_NAME,
          sector: VENDOR_SECTOR,
          payload: { query: query, results: matchCount }
        });
      }, 900);
    }

    window.addEventListener("online", syncOfflineEvents);

    document.addEventListener("DOMContentLoaded", function() {
      if (window.location.protocol === 'file:' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        document.getElementById('ios-notice').style.display = 'block';
      }

      const isReturn = !!safeLocalStorageGet(ITRED_SESSION_KEY);
      logOfflineEvent({
        eventType: isReturn ? 'RETURN_VISIT' : 'STOREFRONT_OPENED',
        sourceType: 'storefront',
        storefrontId: STOREFRONT_ID,
        vendorId: VENDOR_ID,
        vendorName: VENDOR_NAME,
        sector: VENDOR_SECTOR,
        payload: { userAgent: navigator.userAgent }
      });
      
      setTimeout(syncOfflineEvents, 2000);

      setTimeout(() => {
        let shown = checkExpiry();
        if (!shown) shown = checkPendingLeads();
        if (!shown && isReturn) {
          triggerWelcomeBack();
        }
      }, 2500);
    });

    function logHubClick(linkId, url) {
      logOfflineEvent({
          eventType: 'HUB_LINK_CLICKED',
          sourceType: 'storefront',
          storefrontId: STOREFRONT_ID,
          vendorId: VENDOR_ID,
          vendorName: VENDOR_NAME,
          sector: VENDOR_SECTOR,
          payload: { linkId: linkId, url: url }
      });
      window.open(url, '_blank');
    }
  </script>
</body>
</html>`;
};
