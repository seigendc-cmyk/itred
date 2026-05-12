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
  expiryDate?: string,
  allowWhatsApp: boolean = false,
  allowCall: boolean = false,
  selectedVendorId?: string,
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

  const farmProduceItems = farmProduceProducts
    .map((product, index) => {
      const imageSrc = normalizeImageUrl(product.imageUrl);
      const globalIndex = products.indexOf(product);
      return `
      <article class="product-card" data-product-name="${escapeHtml(product.name.toLowerCase())}" data-product-category="${escapeHtml(product.cropType?.toLowerCase() || "")}" data-product-branch="${escapeHtml(product.farmLocation?.toLowerCase() || product.branchName?.toLowerCase() || "")}" data-is-farm-produce="true">
        <button type="button" class="product-media" data-detail-id="product-${globalIndex}">
          <img src="${imageSrc}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
        </button>
        <div class="product-card-body">
          <div class="product-meta">
            <span class="product-category">${escapeHtml(product.cropType || "Crop")}</span>
            <span class="product-branch">${escapeHtml(product.harvestStatus || "Status")}</span>
          </div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description || "")}</p>
          <div class="product-labels">
            <span>Available: ${escapeHtml(product.availabilityDate ? new Date(product.availabilityDate).toLocaleDateString() : "TBD")} • ${escapeHtml(product.quantityAvailable || 0)} ${escapeHtml(product.quantityUnit || "units")}</span>
          </div>
          <div class="product-labels">
            <span>Packaging: ${escapeHtml(product.packagingType || "N/A")} ${escapeHtml(product.packagingSize || "")} • Min Order: ${escapeHtml(product.minimumOrderQuantity || 1)}</span>
          </div>
          <div class="product-footer">
            <span class="product-price">USD ${product.sellingPrice.toFixed(2)}</span>
            ${allowWhatsApp && mainWhatsapp ? `<a class="btn btn-primary" href="${mainWhatsapp}?text=${encodeURIComponent(`Inquiry about ${product.name} (${product.cropType || "Crop"})`)}" target="_blank" rel="noreferrer" style="font-size: 0.8rem; padding: 8px 12px;">WhatsApp</a>` : ""}
            <button type="button" class="btn-secondary view-details" data-detail-id="product-${globalIndex}">Details</button>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  const productItems =
    vendorProducts.length === 0
      ? '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--muted); background: #f9f9f9; border: 1px dashed var(--border); border-radius: 8px;">No products available for this vendor.</div>'
      : vendorProducts
          .map((product, index) => {
            const imageSrc = normalizeImageUrl(product.imageUrl);
            const tags =
              product.tags?.join(", ") || product.category || vendor.sector;

            // Farm produce specific rendering
            const isFarmProduce = product.isFarmProduce;
            const farmProduceDetails = isFarmProduce
              ? `
        <div class="product-meta">
          <span class="product-category">${escapeHtml(product.cropType || "Crop")}</span>
          <span class="product-branch">${escapeHtml(product.harvestStatus || "Status")}</span>
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description || "")}</p>
        <div class="product-labels">
          <span>Available: ${escapeHtml(product.availabilityDate ? new Date(product.availabilityDate).toLocaleDateString() : "TBD")} • ${escapeHtml(product.quantityAvailable || 0)} ${escapeHtml(product.quantityUnit || "units")}</span>
        </div>
        <div class="product-labels">
          <span>Packaging: ${escapeHtml(product.packagingType || "N/A")} ${escapeHtml(product.packagingSize || "")} • Farm: ${escapeHtml(product.farmLocation || product.branchName || "Main")}</span>
        </div>
      `
              : `
        <div class="product-meta">
          <span class="product-category">${escapeHtml(product.category || "General")}</span>
          <span class="product-branch">${escapeHtml(product.branchName || "Main")}</span>
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description || "")}</p>
        <div class="product-labels">
          <span>${escapeHtml(product.unitOfMeasure)} • ${escapeHtml(tags)}</span>
        </div>
      `;

            return `
      <article class="product-card" data-product-name="${escapeHtml(product.name.toLowerCase())}" data-product-category="${escapeHtml(product.category.toLowerCase())}" data-product-branch="${escapeHtml(product.branchName?.toLowerCase())}" data-is-farm-produce="${isFarmProduce}">
        <button type="button" class="product-media" data-detail-id="product-${index}">
          <img src="${imageSrc}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
        </button>
        <div class="product-card-body">
          ${farmProduceDetails}
          <div class="product-footer">
            <span class="product-price">USD ${product.sellingPrice.toFixed(2)}</span>
            <button type="button" class="btn-primary" onclick="addToCart('${escapeHtml(product.id)}')">Add to Cart</button>
            <button type="button" class="btn-secondary view-details" data-detail-id="product-${index}">Quick view</button>
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
        ? `<a href="https://wa.me/${cleanWa(branch.whatsapp)}" class="btn btn-primary" style="flex:1; font-size:0.75rem; padding:8px;" target="_blank">WhatsApp</a>`
        : "";
      const callLink = cleanPhone(branch.phone)
        ? `<a href="tel:${cleanPhone(branch.phone)}" class="btn btn-secondary" style="flex:1; font-size:0.75rem; padding:8px;">Call</a>`
        : "";
      return `
      <div class="info-card">
        <strong style="font-size:1.1rem; color:var(--orange);">${escapeHtml(branch.name || "Not supplied")}</strong>
        <div style="font-size:0.85rem; display:grid; gap:4px; margin-top:8px;">
          <span><strong>Address:</strong> ${escapeHtml(branch.address || "Not supplied")}</span>
          <span><strong>District/Suburb:</strong> ${escapeHtml(branch.district || "Not supplied")} / ${escapeHtml(branch.suburb || "Not supplied")}</span>
          <span><strong>Contact:</strong> ${escapeHtml(branch.contactPerson || "Not supplied")}</span>
          <span><strong>Hours:</strong> ${escapeHtml(branch.openingHours || "Not supplied")}</span>
        </div>
        <div style="display:flex; gap:8px; margin-top:12px;">${callLink}${waLink}</div>
      </div>
    `;
    })
    .join("");

  const staffRows = staff
    .map((person) => {
      const waLink = cleanWa(person.whatsapp)
        ? `<a href="https://wa.me/${cleanWa(person.whatsapp)}" class="btn btn-primary" style="flex:1; font-size:0.75rem; padding:8px;" target="_blank">WhatsApp</a>`
        : "";
      const callLink = cleanPhone(person.phone)
        ? `<a href="tel:${cleanPhone(person.phone)}" class="btn btn-secondary" style="flex:1; font-size:0.75rem; padding:8px;">Call</a>`
        : "";
      return `
      <div class="info-card">
        <strong style="font-size:1.1rem; color:var(--orange);">${escapeHtml(person.fullName || "Not supplied")}</strong>
        <div style="font-size:0.85rem; display:grid; gap:4px; margin-top:8px;">
          <span><strong>Role:</strong> ${escapeHtml(person.role || "Not supplied")}</span>
          <span><strong>Branch:</strong> ${escapeHtml(person.branchAssigned || "Not supplied")}</span>
        </div>
        <div style="display:flex; gap:8px; margin-top:12px;">${callLink}${waLink}</div>
      </div>
    `;
    })
    .join("");

  const deliveryRows = deliveryStaff
    .map((driver) => {
      const waLink = cleanWa(driver.whatsapp)
        ? `<a href="https://wa.me/${cleanWa(driver.whatsapp)}" class="btn btn-primary" style="flex:1; font-size:0.75rem; padding:8px;" target="_blank">WhatsApp</a>`
        : "";
      const callLink = cleanPhone(driver.phone)
        ? `<a href="tel:${cleanPhone(driver.phone)}" class="btn btn-secondary" style="flex:1; font-size:0.75rem; padding:8px;">Call</a>`
        : "";
      return `
      <div class="info-card">
        <strong style="font-size:1.1rem; color:var(--orange);">${escapeHtml(driver.fullName || "Not supplied")}</strong>
        <div style="font-size:0.85rem; display:grid; gap:4px; margin-top:8px;">
          <span><strong>Vehicle:</strong> ${escapeHtml(driver.vehicleType || "Not supplied")}</span>
          <span><strong>Area:</strong> ${escapeHtml(driver.serviceArea || "Not supplied")}</span>
        </div>
        <div style="display:flex; gap:8px; margin-top:12px;">${callLink}${waLink}</div>
      </div>
    `;
    })
    .join("");

  const vendorBusinessHtml = `
    <div class="info-card" style="grid-column: 1 / -1; border-left: 4px solid var(--orange);">
      <strong style="font-size:1.25rem; color:var(--charcoal);">${escapeHtml(vendor.name || "Not supplied")}</strong>
      <div style="font-size:0.9rem; margin-bottom:12px; color:var(--muted);">Trading as: ${escapeHtml(vendor.tradingName || vendor.name || "Not supplied")}</div>
      <div style="display:grid; gap:8px; font-size:0.85rem;">
        <span><strong>Address:</strong> ${escapeHtml(vendor.streetAddress || "Not supplied")}</span>
        <span><strong>Location:</strong> ${escapeHtml(vendor.suburb || "Not supplied")}, ${escapeHtml(vendor.district || "Not supplied")}, ${escapeHtml(vendor.cityTown || "Not supplied")}, ${escapeHtml(vendor.province || "Not supplied")}</span>
        <span><strong>Hours:</strong> ${escapeHtml(vendor.openingHours || "Not supplied")}</span>
        <span><strong>Email:</strong> ${escapeHtml(vendor.email || "Not supplied")}</span>
      </div>
      <div style="display:flex; gap:8px; margin-top:16px; max-width: 400px;">
        ${cleanPhone(vendor.mainPhone) ? `<a href="tel:${cleanPhone(vendor.mainPhone)}" class="btn btn-secondary" style="flex:1;">Call HQ</a>` : ""}
        ${cleanWa(vendor.whatsappNumber) ? `<a href="https://wa.me/${cleanWa(vendor.whatsappNumber)}" class="btn btn-primary" style="flex:1;" target="_blank">WhatsApp HQ</a>` : ""}
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

  const cahItems = [];
  if (communityLink?.whatsappCommunityLink)
    cahItems.push(
      `<a href="${communityLink.whatsappCommunityLink}" target="_blank">WhatsApp Community</a>`,
    );
  if (channelLink?.whatsappChannelLink)
    cahItems.push(
      `<a href="${channelLink.whatsappChannelLink}" target="_blank">WhatsApp Channel</a>`,
    );
  if (groupLink)
    cahItems.push(
      `<a href="${groupLink.whatsappGroupLink || groupLink.catalogueDistributionGroupLink}" target="_blank">WhatsApp Groups</a>`,
    );
  if (supportUrl)
    cahItems.push(
      `<a href="${supportUrl}" target="_blank">Customer Support</a>`,
    );

  const logoSrc = normalizeImageUrl(vendor.logoUrl);
  const bannerSrc = normalizeImageUrl(vendor.bannerUrl);
  const businessDescription = escapeHtml(
    vendor.businessDescription ||
      "A trusted vendor with strong product selection.",
  );
  const mainSector = escapeHtml(vendor.sector || "General");
  const location = `${escapeHtml(vendor.cityTown || "")}${vendor.cityTown && vendor.province ? ", " : ""}${escapeHtml(vendor.province || "")}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeHtml(title || `${vendor.name} Storefront`)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, system-ui, sans-serif;
      color: #111111;
      background: #ffffff;
      --orange: #f97316;
      --charcoal: #262626;
      --muted: #64748b;
      --surface: #ffffff;
      --border: #e5e7eb;
    }
    * { box-sizing: border-box; border-radius: 0 !important; }
    body { margin: 0; min-height: 100vh; background: #ffffff; color: var(--charcoal); }
    button, input, select, textarea { font: inherit; }
    a { color: inherit; text-decoration: none; }
    
    /* Sticky Top Header */
    .top-header {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      width: 100%;
    }
    .header-top-bar {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .insignia {
      font-size: 0.65rem;
      font-weight: 800;
      color: var(--orange);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .vendor-header-name {
      font-size: 1.25rem;
      font-weight: 900;
      color: var(--charcoal);
      margin: 2px 0 0 0;
      line-height: 1.2;
    }
    .vendor-header-meta {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 2px;
      font-weight: 600;
    }
    .nav-menu {
      display: flex;
      flex-wrap: wrap;
      background: #ffffff;
      border-top: 1px solid var(--border);
    }
    .nav-link {
      flex: 1 1 auto;
      text-align: center;
      padding: 12px 8px;
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--charcoal);
      text-transform: uppercase;
      border-bottom: 2px solid transparent;
      transition: color 0.2s, border-color 0.2s;
    }
    .nav-link:hover, .nav-link.active {
      color: var(--orange);
      border-bottom-color: var(--orange);
    }

    .page-shell { width: 100%; max-width: 1200px; margin: 0 auto; padding: 24px 16px 40px; }
    .hero, .section, .footer, .grid, .card { background: #ffffff; border: 1px solid var(--border); }
    .hero { overflow: hidden; margin-bottom: 24px; }
    .hero-banner { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
    .hero-body { padding: 24px; display: grid; gap: 18px; }
    .logo { width: 96px; height: 96px; object-fit: contain; border: 1px solid var(--border); background: #fff; }
    .hero-title { display: flex; flex-direction: column; gap: 10px; }
    .hero-title h1 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.05; letter-spacing: -0.04em; }
    .hero-title p { margin: 0; max-width: 700px; line-height: 1.6; color: var(--muted); }
    .pill-list { display: flex; flex-wrap: wrap; gap: 10px; }
    .pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8fafc; color: var(--charcoal); font-size: 0.8rem; border: 1px solid var(--border); }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }
    .btn, .button-link { padding: 14px 20px; border: none; cursor: pointer; transition: transform 0.15s ease, background-color 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; }
    .btn-primary { background: var(--orange); color: #ffffff; }
    .btn-primary:hover { transform: translateY(-1px); }
    .btn-secondary { background: #f8fafc; color: var(--charcoal); border: 1px solid var(--border); }
    .section { padding: 24px; margin-bottom: 24px; }
    .section h2 { margin: 0 0 16px; font-size: 1.15rem; letter-spacing: -0.03em; }
    .section p { margin: 0; color: var(--muted); line-height: 1.75; }
    .grid { display: grid; gap: 18px; }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .info-card { padding: 16px; border: 1px solid var(--border); background: #fafafa; display: grid; gap: 8px; }
    .info-card strong { color: var(--charcoal); }
    .product-filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
    .product-filters input, .product-filters select { width: 100%; min-width: 160px; padding: 12px 14px; border: 1px solid var(--border); background: #fff; color: var(--charcoal); }
    .product-grid { display: grid; gap: 18px; }
    .product-card { display: grid; background: #fff; border: 1px solid var(--border); overflow: hidden; }
    .product-media { width: 100%; background: #f8fafc; border: none; cursor: pointer; padding: 0; }
    .product-media img { width: 100%; height: 220px; object-fit: cover; display: block; }
    .product-card-body { padding: 18px; display: grid; gap: 12px; }
    .product-meta { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .product-card h3 { margin: 0; font-size: 1rem; color: var(--charcoal); }
    .product-card p { margin: 0; color: var(--muted); line-height: 1.6; font-size: 0.95rem; min-height: 2.8em; }
    .product-labels { font-size: 0.8rem; color: var(--muted); }
    .product-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .product-price { font-size: 1rem; font-weight: 800; color: var(--charcoal); }
    .view-details { background: #f8fafc; color: var(--charcoal); border: 1px solid var(--border); }
    .footer-links { display: grid; gap: 10px; }
    .footer-link { display: flex; justify-content: space-between; gap: 12px; padding: 14px 16px; background: #f8fafc; border: 1px solid var(--border); }
    .footer-link a { color: var(--orange); font-weight: 700; }
    .details-panel { position: fixed; inset: 0; z-index: 20; background: rgba(15, 23, 42, 0.75); display: none; align-items: center; justify-content: center; padding: 24px; }
    .details-panel.active { display: flex; }
    .details-card { width: min(880px,100%); background: #ffffff; padding: 28px; position: relative; max-height: 90vh; overflow-y: auto; }
    .details-close { position: absolute; right: 16px; top: 16px; border: none; background: transparent; font-size: 1rem; cursor: pointer; color: var(--charcoal); }
    .details-card img { width: 100%; object-fit: cover; max-height: 320px; }
    .badge { display: inline-flex; padding: 8px 12px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: #f8fafc; color: var(--charcoal); border: 1px solid var(--border); }
    .footer { padding: 24px 0 0; }
    .footer-copy { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; color: var(--muted); font-size: 0.85rem; }
    @media (min-width: 768px) {
      .hero-body { grid-template-columns: auto 1fr; align-items: center; }
      .hero-meta { display: grid; gap: 10px; }
      .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 767px) {
      .hero-body { padding: 18px; }
      .hero-actions { flex-direction: column; align-items: stretch; }
      .product-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="top-header">
    <div class="header-top-bar">
      <div class="insignia">Powered by seiGEN Commerce - iTred</div>
      <div class="vendor-header-info">
        <h2 class="vendor-header-name">${escapeHtml(title || vendor.name)}</h2>
        <div class="vendor-header-meta">${escapeHtml(mainSector)} • ${escapeHtml(location)}</div>
      </div>
    </div>
    <nav class="nav-menu">
      <a href="#" class="nav-link active">Home</a>
      <a href="#itred_products" class="nav-link">Products</a>
      <a href="#cart" class="nav-link" id="nav-cart-link" onclick="openCart(event)">Cart (<span id="nav-cart-count">0</span>)</a>
      <a href="#contact" class="nav-link">Contact</a>
      <a href="#privacy" class="nav-link">Privacy Policy</a>
    </nav>
  </header>
  <div class="page-shell">
    <section class="hero">
      <img class="hero-banner" src="${bannerSrc}" alt="${escapeHtml(vendor.name)} banner" loading="lazy" decoding="async" />
      <div class="hero-body">
        ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="${escapeHtml(vendor.name)} logo" loading="lazy" decoding="async" />` : ""}
        <div class="hero-title">
          <div class="pill-list">
            <span class="pill">${escapeHtml(vendor.name)}</span>
            <span class="pill">${escapeHtml(mainSector)}</span>
            <span class="pill">${escapeHtml(location)}</span>
          </div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(slogan || businessDescription)}</p>
          <p class="pill" style="background:#ffedd5;color:#b45309;">${escapeHtml(vendor.businessDescription)}</p>
          <div class="hero-actions">
            ${allowWhatsApp && mainWhatsapp ? `<a class="btn btn-primary" href="${mainWhatsapp}" target="_blank" rel="noreferrer">Order on WhatsApp</a>` : ""}
            ${allowCall && mainCall ? `<a class="btn btn-secondary" href="${mainCall}">Call Vendor</a>` : ""}
            <a class="button-link" href="#products">Products</a>
            <a class="button-link" href="#branches">Branches</a>
            <a class="button-link" href="#delivery">Delivery</a>
            <a class="button-link" href="#cah-links">CAH</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>About ${escapeHtml(vendor.name)}</h2>
      <p>${businessDescription}</p>
      <div class="grid grid-3" style="margin-top:16px;">
        <div class="info-card"><strong>Main sector</strong><span>${mainSector}</span></div>
        <div class="info-card"><strong>Location</strong><span>${location}</span></div>
        <div class="info-card"><strong>Generated</strong><span>${escapeHtml(new Date(generatedAt).toLocaleDateString())}</span></div>
      </div>
    </section>

    <section class="section" id="itred_products">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
        <div>
          <h2>Products</h2>
          <p>${productCount} items • ${imageCount} images</p>
        </div>
        <div class="product-filters">
          <input id="filter-search" type="search" placeholder="Search products" />
          <select id="filter-branch"><option value="">All branches</option>${branches.map((b) => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join("")}</select>
          <select id="filter-category"><option value="">All categories</option>${[...new Set(products.map((p) => p.category).filter(Boolean))].map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="product-grid">${productItems}</div>
    </section>

    <section class="section" id="branches">
      <h2>Branches</h2>
      <ul class="grid grid-2">${branchRows || '<li class="info-card">No branches selected.</li>'}</ul>
    </section>

    <section class="section" id="staff">
      <h2>Staff & Contacts</h2>
      <ul class="grid grid-2">${staffRows || '<li class="info-card">No staff selected.</li>'}</ul>
    </section>

    <section class="section" id="delivery">
      <h2>Delivery Options</h2>
      <ul class="grid grid-2">${deliveryRows || '<li class="info-card">No delivery contacts selected.</li>'}</ul>
    </section>

    ${
      hasFarmProduce
        ? `
    <section class="section" id="farm-produce">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
        <div>
          <h2>Farm Produce</h2>
          <p>${farmProduceProducts.length} fresh items from ${escapeHtml(vendor.name)}</p>
        </div>
        <div class="product-filters">
          <select id="farm-filter-status">
            <option value="">All Status</option>
            <option value="planted">Planted</option>
            <option value="growing">Growing</option>
            <option value="ready soon">Ready Soon</option>
            <option value="ready now">Ready Now</option>
            <option value="sold out">Sold Out</option>
          </select>
          <select id="farm-filter-packaging">
            <option value="">All Packaging</option>
            ${[...new Set(farmProduceProducts.map((p) => p.packagingType).filter(Boolean))].map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="product-grid" id="farm-produce-grid">${farmProduceItems}</div>
    </section>
    `
        : ""
    }

    <footer class="footer" id="cah-links">
      ${
        cahItems.length > 0
          ? `<div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:24px; color:var(--charcoal);">
               <span>|</span> ${cahItems.join(" <span>|</span> ")} <span>|</span>
             </div>`
          : ""
      }
      <div class="footer-copy">
        <span>Powered by seiGEN Commerce - iTred</span>
        <span>Offline storefront package • Expires ${escapeHtml(expiryDate || "N/A")}</span>
      </div>
    </footer>
  </div>

  <div class="details-panel" id="cart-panel">
    <div class="details-card">
      <button class="details-close" id="cart-close">×</button>
      <h2 style="margin-top: 0; margin-bottom: 20px;">Your Cart</h2>
      <div id="cart-content" style="display: grid; gap: 12px; max-height: 50vh; overflow-y: auto;"></div>
      <div style="font-size: 1.25rem; font-weight: 800; margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px; display: flex; justify-content: space-between;">
        <span>Total:</span>
        <span id="cart-total-price">USD 0.00</span>
      </div>
      <button class="btn btn-primary" style="width: 100%; margin-top: 20px;" onclick="checkoutCart()">Order on WhatsApp</button>
    </div>
  </div>

  <div class="details-panel" id="detail-panel">
    <div class="details-card">
      <button class="details-close" id="details-close">×</button>
      <div id="details-content"></div>
    </div>
  </div>

  <script>
    const VENDOR_PRODUCTS = ${JSON.stringify(vendorProducts.map((p) => ({ id: p.id, name: p.name, price: p.sellingPrice || 0, sku: p.sku || "N/A" })))};
    const VENDOR_WHATSAPP = "${vendor.whatsappNumber ? vendor.whatsappNumber.replace(/[^0-9]/g, "") : ""}";
    const VENDOR_NAME = "${escapeHtml(vendor.name)}";
    const STORE_TITLE = "${escapeHtml(title || `${vendor.name} Storefront`)}";
    
    let cart = {};

    window.openCart = (e) => {
      e.preventDefault();
      document.getElementById('cart-panel').classList.add('active');
      renderCart();
    };

    document.getElementById('cart-close').addEventListener('click', () => {
      document.getElementById('cart-panel').classList.remove('active');
    });

    window.addToCart = (productId) => {
      const product = VENDOR_PRODUCTS.find(p => p.id === productId);
      if (!product) return;
      if (cart[productId]) {
        cart[productId].quantity += 1;
      } else {
        cart[productId] = { ...product, quantity: 1 };
      }
      updateCartCount();
      alert(product.name + " added to cart!");
    };

    window.removeFromCart = (productId) => {
      if (cart[productId]) {
        delete cart[productId];
        updateCartCount();
        renderCart();
      }
    };

    const updateCartCount = () => {
      const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
      document.getElementById('nav-cart-count').innerText = totalItems;
    };

    const renderCart = () => {
      const content = document.getElementById('cart-content');
      const items = Object.values(cart);
      
      if (items.length === 0) {
        content.innerHTML = '<p style="color: var(--muted); text-align: center;">Your cart is empty.</p>';
        document.getElementById('cart-total-price').innerText = 'USD 0.00';
        return;
      }

      let total = 0;
      content.innerHTML = items.map(item => {
        const lineTotal = item.price * item.quantity;
        total += lineTotal;
        return \`
          <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border); padding: 12px; background: #fafafa;">
            <div style="flex: 1;">
              <div style="font-weight: 800; font-size: 0.9rem;">\${item.name}</div>
              <div style="font-size: 0.8rem; color: var(--muted);">Qty: \${item.quantity} × USD \${item.price.toFixed(2)}</div>
            </div>
            <div style="font-weight: 800; margin-right: 16px;">USD \${lineTotal.toFixed(2)}</div>
            <button onclick="removeFromCart('\${item.id}')" style="background: none; border: none; color: #ef4444; font-weight: bold; cursor: pointer; padding: 4px;">Remove</button>
          </div>
        \`;
      }).join('');

      document.getElementById('cart-total-price').innerText = 'USD ' + total.toFixed(2);
    };

    window.checkoutCart = () => {
      const items = Object.values(cart);
      if (items.length === 0) {
        alert("Your cart is empty.");
        return;
      }
      if (!VENDOR_WHATSAPP) {
        alert("Vendor WhatsApp number is not available.");
        return;
      }

      let total = 0;
      let orderText = \`Hello \${VENDOR_NAME}, I would like to place an order from your catalogue (\${STORE_TITLE}).\\n\\nDate: \${new Date().toLocaleDateString()}\\n\\nOrder Details:\\n\`;
      
      items.forEach(item => {
        const lineTotal = item.price * item.quantity;
        total += lineTotal;
        orderText += \`- \${item.name} (Code: \${item.sku})\\n  Qty: \${item.quantity} x USD \${item.price.toFixed(2)} = USD \${lineTotal.toFixed(2)}\\n\`;
      });
      
      orderText += \`\\nTotal: USD \${total.toFixed(2)}\\n\\nPlease confirm availability.\`;

      const encodedText = encodeURIComponent(orderText);
      const waUrl = \`https://wa.me/\${VENDOR_WHATSAPP}?text=\${encodedText}\`;
      window.open(waUrl, '_blank');
    };

    const products = Array.from(document.querySelectorAll('.product-card'));
    const panel = document.getElementById('detail-panel');
    const detailsContent = document.getElementById('details-content');

    const openDetail = (detailId) => {
      const target = document.querySelector('[data-detail-id="' + detailId + '"]');
      if (!target) return;
      const card = target.closest('.product-card');
      if (!card) return;
      detailsContent.innerHTML = '<h2>' + card.querySelector('h3').textContent + '</h2>' +
        '<p>' + card.querySelector('p').textContent + '</p>' +
        '<p><strong>Branch:</strong> ' + card.dataset.productBranch + '</p>' +
        '<p><strong>Category:</strong> ' + card.dataset.productCategory + '</p>' +
        card.querySelector('.product-media').outerHTML;
      panel.classList.add('active');
    };

    document.body.addEventListener('click', (event) => {
      const button = event.target.closest('[data-detail-id]');
      if (button) {
        openDetail(button.dataset.detailId);
      }
    });

    document.getElementById('details-close').addEventListener('click', () => {
      panel.classList.remove('active');
      detailsContent.innerHTML = '';
    });

    const filterSearch = document.getElementById('filter-search');
    const filterBranch = document.getElementById('filter-branch');
    const filterCategory = document.getElementById('filter-category');
    const farmFilterStatus = document.getElementById('farm-filter-status');
    const farmFilterPackaging = document.getElementById('farm-filter-packaging');

    const updateFilters = () => {
      const query = filterSearch?.value.trim().toLowerCase() || '';
      const branch = filterBranch?.value.toLowerCase() || '';
      const category = filterCategory?.value.toLowerCase() || '';

      products.forEach(card => {
        const name = card.dataset.productName || '';
        const branchValue = card.dataset.productBranch || '';
        const categoryValue = card.dataset.productCategory || '';
        const matchesSearch = query === '' || query.split(' ').every(term => name.includes(term) || categoryValue.includes(term) || branchValue.includes(term));
        const matchesBranch = !branch || branchValue === branch;
        const matchesCategory = !category || categoryValue === category;
        card.style.display = matchesSearch && matchesBranch && matchesCategory ? 'grid' : 'none';
      });
    };

    const updateFarmFilters = () => {
      if (!farmFilterStatus || !farmFilterPackaging) return;
      
      const status = farmFilterStatus.value.toLowerCase();
      const packaging = farmFilterPackaging.value.toLowerCase();
      const farmCards = document.querySelectorAll('[data-is-farm-produce="true"]');
      
      farmCards.forEach(card => {
        const statusValue = card.dataset.productBranch || ''; // harvestStatus is stored in product-branch
        const packagingValue = card.querySelector('.product-labels')?.textContent?.toLowerCase() || '';
        const matchesStatus = !status || statusValue === status;
        const matchesPackaging = !packaging || packagingValue.includes(packaging);
        card.style.display = matchesStatus && matchesPackaging ? 'grid' : 'none';
      });
    };

    if (filterSearch) filterSearch.addEventListener('input', updateFilters);
    if (filterBranch) filterBranch.addEventListener('change', updateFilters);
    if (filterCategory) filterCategory.addEventListener('change', updateFilters);
    if (farmFilterStatus) farmFilterStatus.addEventListener('change', updateFarmFilters);
    if (farmFilterPackaging) farmFilterPackaging.addEventListener('change', updateFarmFilters);
  </script>
</body>
</html>`;
};
