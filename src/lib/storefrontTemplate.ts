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
import { CATALOGUE_LEGAL_SOT } from "../features/catalogueBuilderV2/catalogueLegalSot.ts";

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

const getProductGalleryImages = (product: Product, limit = 6) => {
  const raw = [
    ...(((product as any).images || []) as any[]),
    ...(((product as any).galleryImages || []) as any[]),
    ...(((product as any).imageUrls || []) as any[]),
    ...(product.additionalImages || []),
    product.imageUrl,
  ];
  const seen = new Set<string>();
  return raw
    .map((item: any) =>
      String(typeof item === "string" ? item : item?.url || item?.imageUrl || "").trim(),
    )
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, limit);
};

const smallerText = (text: string) => escapeHtml(text || "");

const renderLegalParagraphs = (value: string) =>
  String(value || "")
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join("");

const renderStorefrontLegalSot = () => `
        <h4>Privacy policy</h4>
        ${renderLegalParagraphs(CATALOGUE_LEGAL_SOT.privacyPolicy)}

        <h4>Business terms</h4>
        ${renderLegalParagraphs(CATALOGUE_LEGAL_SOT.businessTerms)}

        <h4>Warranties</h4>
        ${renderLegalParagraphs(CATALOGUE_LEGAL_SOT.warranties)}

        <h4>Indemnity and limitation of liability</h4>
        ${renderLegalParagraphs(CATALOGUE_LEGAL_SOT.indemnity)}
`;

const normalizeLookup = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getCahWhatsappUrl = (link?: Partial<CAHLink> | any) => {
  const candidates = [
    link?.whatsappCommunityLink,
    link?.whatsappGroupLink,
    link?.whatsappChannelLink,
    link?.catalogueDistributionGroupLink,
    link?.customerDiscoveryGroupLink,
    link?.vendorSupportGroupLink,
    link?.supportLink,
    link?.whatsappUrl,
    link?.url,
  ];
  return (
    candidates
      .map((candidate) => String(candidate || "").trim())
      .find((candidate) =>
        /^https:\/\/(chat\.whatsapp\.com|wa\.me|www\.whatsapp\.com|whatsapp\.com)\//i.test(
          candidate,
        ),
      ) || ""
  );
};

const isActiveCahLink = (link?: Partial<CAHLink> | any) => {
  const status = normalizeLookup(link?.status || (link?.isActive ? "active" : ""));
  return link?.isActive === true || status === "active";
};

const resolveVendorsProductsDiscoveryCahUrl = (
  cahLinks: CAHLink[],
  defaultCAHLink?: string,
) => {
  const activeLinks = cahLinks.filter(
    (link) => isActiveCahLink(link) && !!getCahWhatsappUrl(link),
  );
  const targetName = normalizeLookup("Vendors Products Discovery");
  const exactLink = activeLinks.find(
    (link: any) =>
      normalizeLookup(link.title || link.name || link.whatsappCommunityName) ===
      targetName,
  );
  const allValues = new Set(["all sector", "all sections", "all"]);
  const allSectorLink = activeLinks.find((link: any) => {
    const sector = normalizeLookup(link.sector);
    const category = normalizeLookup(link.category);
    return allValues.has(sector) || allValues.has(category);
  });
  const defaultLink = String(defaultCAHLink || "").trim();
  const validDefault = /^https:\/\/(chat\.whatsapp\.com|wa\.me|www\.whatsapp\.com|whatsapp\.com)\//i.test(
    defaultLink,
  )
    ? defaultLink
    : "";
  const resolvedLink = exactLink || allSectorLink;
  const cahHref = resolvedLink ? getCahWhatsappUrl(resolvedLink) : validDefault;
  const source = exactLink
    ? "vendors-products-discovery"
    : allSectorLink
      ? "all-sector"
      : validDefault
        ? "default"
        : "disabled";

  if (!cahHref) {
    console.warn("Vendors Products Discovery Access Hub link not found.");
  }
  console.table({
    resolvedCAHLink: cahHref,
    source,
  });

  return { cahHref, source };
};

const WHATSAPP_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L4 20.2l1.1-3.8A8.5 8.5 0 1 1 20.5 11.8Z"></path><path d="M8.8 8.2c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.4.5c-.1.1-.2.3 0 .5.5.9 1.2 1.7 2.4 2.3.3.2.4.1.6-.1l.7-.8c.2-.2.4-.2.7-.1l1.6.8c.3.1.4.3.4.6-.1.7-.6 1.4-1.2 1.6-.6.3-2.7.2-5-1.7-2.1-1.7-3.4-3.8-3.5-5 0-.4.1-.7.3-1Z"></path></svg>';
const CALL_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z"></path></svg>';
const SEARCH_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>';
const CLEAR_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
const CART_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H6"></path></svg>';
const MENU_DOTS_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>';
const CLOSE_ICON_SVG = CLEAR_ICON_SVG;

const iconButton = (
  className: string,
  label: string,
  icon: string,
  attrs: string = "",
  text?: string,
) =>
  `<button class="${className}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${attrs}>${icon}${text ? `<span>${escapeHtml(text)}</span>` : ""}</button>`;

const iconLink = (
  className: string,
  label: string,
  icon: string,
  href: string,
  attrs: string = "",
  text?: string,
) =>
  `<a href="${href}" class="${className}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${attrs}>${icon}${text ? `<span>${escapeHtml(text)}</span>` : ""}</a>`;

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
  allowCart: boolean = false,
  allowWhatsappOrders: boolean = false,
  selectedVendorId?: string,
  feedbackWhatsAppNumber?: string,
  syncEndpointUrl?: string,
  defaultCAHLink?: string,
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
  const cleanPhone = (num?: string) => (num ? num.replace(/[^0-9+]/g, "") : "");
  const cleanWa = (num?: string) => (num ? num.replace(/[^0-9]/g, "") : "");
  const cartEnabled = !!allowCart && !!allowWhatsappOrders;
  const getBranchForProduct = (product: Product) =>
    branches.find((branch) => branch.id && branch.id === product.branchId) ||
    branches.find(
      (branch) =>
        branch.name &&
        product.branchName &&
        branch.name.toLowerCase() === product.branchName.toLowerCase(),
    );

  if (vendorProducts.length === 0) {
    // We will handle the empty state rendering later in the function,
    // but the filtering is done here.
  }

  const productItems =
    vendorProducts.length === 0
      ? '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--muted); background: #f9f9f9; border: 1px dashed var(--border); border-radius: 8px;">No products available for this vendor.</div>'
      : vendorProducts
          .map((p) => {
            const gallery = getProductGalleryImages(p, 6);
            if (getProductGalleryImages(p, 99).length > gallery.length) {
              console.warn("Listing exceeded image limit, truncating to first 6 images.");
            }
            const imageSrc = normalizeImageUrl(gallery[0] || p.imageUrl);
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
                (p.sellingPrice || 0).toString(),
              ]
                .join(" ")
                .toLowerCase(),
            );
            const stockClass = p.stockQuantity > 0 ? "stock-in" : "stock-out";
            const stockText = p.stockQuantity > 0 ? "In Stock" : "Out of Stock";
            const isOutOfStock = (Number(p.stockQuantity) || 0) <= 0;
            const allowsBackorder = !!(p as any).allowBackorder;
            const productBranch = getBranchForProduct(p);
            const productWhatsapp =
              cleanWa(productBranch?.whatsapp) || cleanWa(vendor.whatsappNumber);
            const productPhone =
              cleanPhone(productBranch?.phone) || cleanPhone(vendor.mainPhone);
            const waButton = allowWhatsApp && productWhatsapp
              ? iconButton(
                  "icon-btn icon-btn-whatsapp product-wa-btn",
                  "Order on WhatsApp",
                  WHATSAPP_ICON_SVG,
                  `data-product-id="${escapeHtml(p.id)}" data-action="whatsapp"`,
                )
              : "";
            const callButton = allowCall && productPhone
              ? iconButton(
                  "icon-btn icon-btn-call product-call-btn",
                  "Call Vendor",
                  CALL_ICON_SVG,
                  `data-product-id="${escapeHtml(p.id)}" data-action="call"`,
                )
              : "";
            const cartButton =
              cartEnabled && isOutOfStock && !allowsBackorder
                ? `<button class="cart-add-btn disabled" type="button" disabled aria-disabled="true">Out of stock</button>`
                : cartEnabled
                  ? `<button class="cart-add-btn product-cart-btn" type="button" data-product-id="${escapeHtml(p.id)}" data-action="cart">Add to Cart</button>`
                  : "";

            const modeBadge =
              p.productMode === "branded_product" ? "BRANDED" : "LINKED";
            const brandName =
              p.productMode === "branded_product" && p.brandDisplayName
                ? p.brandDisplayName
                : p.brand || p.category || vendor.sector || "General";
            const rawPrice = (p as any).sellingPrice;
            const numericPrice = Number(rawPrice);
            const hasPrice =
              rawPrice !== undefined &&
              rawPrice !== null &&
              rawPrice !== "" &&
              Number.isFinite(numericPrice);
            const priceLabel = hasPrice
              ? `${escapeHtml((p as any).currency || (vendor as any).currency || "USD")} ${numericPrice.toFixed(2)}`
              : "Price on enquiry";

            return `
      <article class="product-card" data-id="${escapeHtml(p.id)}" data-search="${searchString}">
        <div class="product-img-wrapper product-view-btn" data-product-id="${escapeHtml(p.id)}" data-action="view" role="button" tabindex="0">
          <img src="${imageSrc}" loading="lazy" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'" />
        </div>
        <div class="product-info">
          <div class="product-brand">${escapeHtml(brandName)} · ${modeBadge}</div>
          <h3 class="product-name product-view-btn" data-product-id="${escapeHtml(p.id)}" data-action="view" role="button" tabindex="0">${escapeHtml(p.name)}</h3>
          <div class="product-price">${priceLabel}</div>
          <div class="product-meta">
            <span class="stock-status ${stockClass}">${stockText}</span>
            <span class="branch">${escapeHtml(p.branchName || "Main")}</span>
          </div>
          <div class="product-actions icon-action-row">
            ${waButton}
            ${callButton}
            ${iconButton("icon-btn icon-btn-orange product-view-btn", "View product details", SEARCH_ICON_SVG, `data-product-id="${escapeHtml(p.id)}" data-action="view"`)}
          </div>
          ${cartButton}
        </div>
      </article>
    `;
          })
          .join("");

  const branchRows = branches
    .map((branch) => {
      const waLink = cleanWa(branch.whatsapp)
        ? iconLink("icon-btn icon-btn-whatsapp", "WhatsApp branch", WHATSAPP_ICON_SVG, `https://wa.me/${cleanWa(branch.whatsapp)}`, 'target="_blank" rel="noopener"')
        : "";
      const callLink = cleanPhone(branch.phone)
        ? iconLink("icon-btn icon-btn-call", "Call branch", CALL_ICON_SVG, `tel:${cleanPhone(branch.phone)}`)
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
        ? iconLink("icon-btn icon-btn-whatsapp", "WhatsApp staff member", WHATSAPP_ICON_SVG, `https://wa.me/${cleanWa(person.whatsapp)}`, 'target="_blank" rel="noopener"')
        : "";
      const callLink = cleanPhone(person.phone)
        ? iconLink("icon-btn icon-btn-call", "Call staff member", CALL_ICON_SVG, `tel:${cleanPhone(person.phone)}`)
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
          ? iconLink("icon-btn icon-btn-whatsapp", "WhatsApp delivery contact", WHATSAPP_ICON_SVG, `https://wa.me/${cleanWa(driver.whatsapp)}`, 'target="_blank" rel="noopener"')
          : "";
        const callLink = cleanPhone(driver.phone)
          ? iconLink("icon-btn icon-btn-call", "Call delivery contact", CALL_ICON_SVG, `tel:${cleanPhone(driver.phone)}`)
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
        ${cleanPhone(vendor.mainPhone) ? iconLink("icon-btn-label icon-btn-call", "Call HQ", CALL_ICON_SVG, `tel:${cleanPhone(vendor.mainPhone)}`, "", "Call HQ") : ""}
        ${cleanWa(vendor.whatsappNumber) ? iconLink("icon-btn-label icon-btn-whatsapp", "WhatsApp HQ", WHATSAPP_ICON_SVG, `https://wa.me/${cleanWa(vendor.whatsappNumber)}`, 'target="_blank" rel="noopener"', "WhatsApp HQ") : ""}
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

  const logoSrc = normalizeImageUrl(
    vendor.logoAssetUrl || vendor.logoUrl || vendor.businessLogoUrl,
  );
  const bannerSrc = normalizeImageUrl(
    vendor.bannerAssetUrl || vendor.bannerUrl || vendor.businessBannerUrl,
  );
  const mainSector = escapeHtml(vendor.sector || "General");
  const { cahHref: cahJoinUrl } = resolveVendorsProductsDiscoveryCahUrl(
    cahLinks,
    defaultCAHLink,
  );
  const joinCahCtaHtml = cahJoinUrl
    ? `<a class="btn btn-outline footer-cta join-cah" href="${escapeHtml(cahJoinUrl)}" target="_blank" rel="noopener" onclick="logHubClick('join_cah', '${escapeHtml(cahJoinUrl)}'); return false;">Join Commerce Access Hub</a>`
    : `<button class="btn btn-outline footer-cta join-cah" type="button" disabled aria-disabled="true" title="Vendors Products Discovery Access Hub link not found." onclick="console.warn('Vendors Products Discovery Access Hub link not found.')">Join Commerce Access Hub</button>`;

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
    
    .product-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: auto; }
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
    .storefront-modal-image-wrap { width: 100%; max-height: min(58vh, 420px); min-height: 220px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f3f4f6; border-bottom: 1px solid var(--stone-100); }
    .storefront-modal-image { width: 100%; height: 100%; max-height: min(58vh, 420px); object-fit: contain; object-position: center; display: block; background: #f3f4f6; }
    .modal-gallery { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; padding: 8px; border-bottom: 1px solid var(--stone-100); }
    .modal-thumb { height: 54px; width: 100%; object-fit: cover; border: 2px solid var(--stone-200); background: var(--stone-50); cursor: pointer; }
    .modal-thumb.active { border-color: var(--orange); }
    .modal-body { padding: 20px; }
    .modal-title { font-size: 20px; font-weight: 900; margin: 0 0 8px; line-height: 1.2; }
    .modal-price { font-size: 24px; font-weight: 900; color: var(--orange); margin-bottom: 16px; }
    .modal-desc { font-size: 14px; color: var(--stone-600); line-height: 1.5; margin-bottom: 20px; white-space: pre-wrap; }
    .modal-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 12px; }
    .modal-meta-item { background: var(--stone-50); padding: 10px; border: 1px solid var(--stone-200); }
    .modal-meta-label { display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; color: var(--stone-400); margin-bottom: 4px; }
    .modal-meta-value { font-weight: 700; color: var(--charcoal); }
    .modal-actions { display: flex; flex-direction: column; gap: 10px; }
    .icon-action-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
    .icon-btn {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      border: 0 !important;
      box-shadow: none !important;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      cursor: pointer;
      color: var(--charcoal);
      background: transparent !important;
      padding: 0;
      outline: none;
    }
    .icon-btn svg, .icon-btn-label svg {
      width: 22px;
      height: 22px;
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .icon-btn-whatsapp { background: transparent !important; border: 0 !important; box-shadow: none !important; color: #16a34a; }
    .icon-btn-call { background: transparent !important; border: 0 !important; box-shadow: none !important; color: #111827; }
    .icon-btn-orange { background: transparent !important; border: 0 !important; box-shadow: none !important; color: var(--orange); }
    .icon-btn-ghost { background: transparent !important; color: var(--orange); border: 0 !important; box-shadow: none !important; }
    .icon-btn:hover {
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      opacity: 0.78;
      transform: scale(1.04);
    }
    .icon-btn:focus-visible {
      outline: 2px solid rgba(249, 115, 22, 0.45);
      outline-offset: 3px;
    }
    .icon-btn-label { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 12px; border: 1px solid var(--stone-200); background: #fff; color: var(--charcoal); text-decoration: none; font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .icon-btn-label .icon-btn, .icon-btn-label > svg { margin-right: 4px; }
    .cart-add-btn { width: 100%; min-height: 40px; margin-top: 10px; border: 1px solid var(--orange); background: var(--orange); color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase; cursor: pointer; }
    .cart-add-btn.disabled, .cart-add-btn:disabled { border-color: var(--stone-200); background: var(--stone-100); color: var(--stone-500); cursor: not-allowed; }
    .cart-fab { position: fixed; right: 14px; bottom: 78px; z-index: 700; width: 56px; height: 56px; border: 2px solid var(--orange); background: var(--charcoal); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 10px 24px rgba(0,0,0,0.22); }
    .cart-fab svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .cart-count { position: absolute; top: -8px; right: -8px; min-width: 24px; height: 24px; padding: 0 6px; background: var(--orange); color: #fff; border: 2px solid #fff; font-size: 11px; font-weight: 900; line-height: 20px; text-align: center; }
    .cart-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.72); z-index: 1100; align-items: flex-end; justify-content: center; }
    .cart-overlay.active { display: flex; }
    .cart-drawer { width: 100%; max-width: 540px; max-height: 92vh; overflow-y: auto; background: #fff; border-top: 4px solid var(--orange); }
    @media (min-width: 640px) { .cart-overlay { align-items: center; } .cart-drawer { border: 4px solid var(--orange); } }
    .cart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--stone-200); }
    .cart-head h2 { margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase; }
    .cart-close { width: 38px; height: 38px; border: 1px solid var(--stone-200); background: #fff; color: var(--charcoal); font-size: 20px; font-weight: 900; cursor: pointer; }
    .cart-body { padding: 14px 16px 18px; }
    .cart-empty { padding: 22px; border: 1px dashed var(--stone-200); color: var(--stone-500); font-size: 12px; font-weight: 800; text-align: center; text-transform: uppercase; }
    .cart-line { display: grid; grid-template-columns: 58px 1fr; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--stone-100); }
    .cart-line img { width: 58px; height: 58px; object-fit: cover; border: 1px solid var(--stone-200); background: var(--stone-50); }
    .cart-line-name { margin: 0 0 4px; font-size: 13px; font-weight: 900; line-height: 1.25; }
    .cart-line-meta { margin: 0 0 8px; font-size: 10px; color: var(--stone-500); font-weight: 800; text-transform: uppercase; }
    .cart-line-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .cart-stepper { display: inline-flex; align-items: center; border: 1px solid var(--stone-200); }
    .cart-stepper button { width: 34px; height: 34px; border: 0; background: var(--stone-100); color: var(--charcoal); font-weight: 900; cursor: pointer; }
    .cart-stepper span { min-width: 34px; text-align: center; font-size: 12px; font-weight: 900; }
    .cart-line-total { font-size: 12px; font-weight: 900; color: var(--orange); text-align: right; }
    .cart-remove { margin-top: 8px; border: 0; background: transparent; color: #dc2626; font-size: 10px; font-weight: 900; text-transform: uppercase; cursor: pointer; padding: 0; }
    .cart-fields { display: grid; gap: 8px; margin-top: 14px; }
    .cart-fields input, .cart-fields textarea { width: 100%; border: 1px solid var(--stone-200); background: var(--stone-50); padding: 10px; font-size: 13px; font-weight: 700; outline: none; }
    .cart-fields textarea { min-height: 74px; resize: vertical; }
    .cart-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; padding: 12px 0; border-top: 2px solid var(--stone-200); font-size: 14px; font-weight: 900; text-transform: uppercase; }
    .cart-actions { display: grid; gap: 8px; margin-top: 8px; }
    .cart-send { min-height: 44px; border: 0; background: #16a34a; color: #fff; font-size: 12px; font-weight: 900; text-transform: uppercase; cursor: pointer; }
    .cart-send:disabled { background: var(--stone-200); color: var(--stone-500); cursor: not-allowed; }
    .cart-clear { min-height: 40px; border: 1px solid var(--stone-300, #d6d3d1); background: #fff; color: var(--stone-600); font-size: 11px; font-weight: 900; text-transform: uppercase; cursor: pointer; }
    .horizontal-scroll-container { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding: 2px 18px 8px 0; scrollbar-width: none; }
    .horizontal-scroll-container::-webkit-scrollbar { display: none; }
    .horizontal-scroll-card { flex: 0 0 80%; max-width: 320px; scroll-snap-align: start; }
    #tab-branches .info-grid, #tab-contact .info-grid, #tab-delivery .info-grid { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding-right: 18px; scrollbar-width: none; }
    #tab-branches .info-grid::-webkit-scrollbar, #tab-contact .info-grid::-webkit-scrollbar, #tab-delivery .info-grid::-webkit-scrollbar { display: none; }
    #tab-branches .info-card, #tab-contact .info-card, #tab-delivery .info-card { flex: 0 0 80%; max-width: 320px; scroll-snap-align: start; }
    
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
      <img src="${bannerSrc}" class="banner-img" onerror="this.style.display='none'" />
      <div class="logo-badge">
        <img src="${logoSrc}" class="logo-img" onerror="this.style.display='none'" />
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
      <div class="info-grid">
        ${vendorBusinessHtml}
        ${staffRows}
      </div>
    </div>

    <div id="tab-branches" class="tab-pane">
      <div class="info-grid">
        ${branchRows}
      </div>
    </div>

    <div id="tab-delivery" class="tab-pane">
      <div class="info-grid">
        ${deliveryRows}
      </div>
    </div>

    <div id="tab-terms" class="tab-pane">
      <div class="legal-text">
        ${renderStorefrontLegalSot()}
      </div>
    </div>
    
    <footer class="footer">
      <div class="viral-footer">
        <p><strong>Powered by seiGEN Commerce</strong></p>
        <p>Want a storefront like this for your business?</p>
        <p>Join iTred Vendor Network</p>
        <div class="viral-actions">
           <button class="btn btn-wa" onclick="logHubClick('contact_seigen', getFeedbackUrl('I%20want%20a%20storefront'))">Contact seiGEN Commerce</button>
           ${joinCahCtaHtml}
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

  ${
    cartEnabled
      ? `<button id="cart-fab" class="cart-fab" type="button" aria-label="Open cart" title="Open cart" onclick="openCart()">${CART_ICON_SVG}<span id="cart-count" class="cart-count">0</span></button>

  <div id="cart-overlay" class="cart-overlay">
    <div class="cart-drawer">
      <div class="cart-head">
        <h2>Order Cart</h2>
        <button class="cart-close" type="button" onclick="closeCart()" aria-label="Close cart">x</button>
      </div>
      <div class="cart-body">
        <div id="cart-lines"></div>
        <div class="cart-fields">
          <input id="cart-customer-name" type="text" placeholder="Customer name" />
          <input id="cart-location" type="text" placeholder="Location (optional)" />
          <textarea id="cart-note" placeholder="Note (optional)"></textarea>
        </div>
        <div class="cart-summary">
          <span>Subtotal</span>
          <span id="cart-subtotal">$0</span>
        </div>
        <div class="cart-actions">
          <button class="cart-send" type="button" onclick="sendCartOrder()" ${cleanWa(vendor.whatsappNumber) ? "" : "disabled aria-disabled=\"true\""}>${cleanWa(vendor.whatsappNumber) ? "Send Order on WhatsApp" : "Vendor WhatsApp number is missing."}</button>
          <button class="cart-clear" type="button" onclick="clearCart()">Clear Cart</button>
        </div>
      </div>
    </div>
  </div>`
      : ""
  }

  <div id="modal-overlay" class="modal-overlay">
    <div class="modal-content">
      <button class="modal-close" onclick="closeModal()">×</button>
      <div class="storefront-modal-image-wrap">
        <img id="m-img" class="storefront-modal-image" onerror="this.style.display='none'" />
      </div>
      <div id="m-gallery" class="modal-gallery"></div>
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
          <div class="icon-action-row">
            <button id="m-btn-wa" class="icon-btn-label icon-btn-whatsapp" aria-label="Order on WhatsApp" title="Order on WhatsApp">${WHATSAPP_ICON_SVG}<span>WhatsApp</span></button>
            <button id="m-btn-call" class="icon-btn-label icon-btn-call" aria-label="Call Vendor" title="Call Vendor">${CALL_ICON_SVG}<span>Call</span></button>
            <button id="m-btn-share" class="icon-btn-label icon-btn-ghost" aria-label="Share Product" title="Share Product">${SEARCH_ICON_SVG}<span>Share</span></button>
          </div>
          ${cartEnabled ? `<button id="m-btn-cart" class="cart-add-btn" type="button">Add to Cart</button>` : ""}
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
    const FEEDBACK_WA = ${JSON.stringify(feedbackWhatsAppNumber || "").replace(/</g, "\\u003c")};
    const SYNC_ENDPOINT = ${JSON.stringify(syncEndpointUrl || "").replace(/</g, "\\u003c")};

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
        ${JSON.stringify(p.id)}: {
          id: ${JSON.stringify(p.id || "").replace(/</g, "\\u003c")},
          name: ${JSON.stringify(p.name || "").replace(/</g, "\\u003c")},
          vendorId: ${JSON.stringify(p.vendorId || vendor.id || "").replace(/</g, "\\u003c")},
          vendorName: ${JSON.stringify(p.vendorName || vendor.name || "").replace(/</g, "\\u003c")},
          brand: ${JSON.stringify(p.brand || p.category || "").replace(/</g, "\\u003c")},
          price: ${
            (p as any).sellingPrice !== undefined &&
            (p as any).sellingPrice !== null &&
            (p as any).sellingPrice !== "" &&
            Number.isFinite(Number((p as any).sellingPrice))
              ? Number((p as any).sellingPrice)
              : "null"
          },
          currency: ${JSON.stringify((p as any).currency || (vendor as any).currency || "USD").replace(/</g, "\\u003c")},
          stock: ${p.stockQuantity || 0},
          img: ${JSON.stringify(normalizeImageUrl(getProductGalleryImages(p, 6)[0] || p.imageUrl)).replace(/</g, "\\u003c")},
          images: ${JSON.stringify(getProductGalleryImages(p, 6).map(normalizeImageUrl)).replace(/</g, "\\u003c")},
          desc: ${JSON.stringify(p.description || "").replace(/</g, "\\u003c")},
          sku: ${JSON.stringify(p.sku || p.productCode || "").replace(/</g, "\\u003c")},
          branchId: ${JSON.stringify(p.branchId || "").replace(/</g, "\\u003c")},
          branch: ${JSON.stringify(p.branchName || "").replace(/</g, "\\u003c")},
          delivery: ${JSON.stringify(p.deliveryAvailable ? "Available" : "Check with vendor").replace(/</g, "\\u003c")}
        }
      `,
        )
        .join(",\n")}
    };
    const BRANCHES = {
      ${branches
        .map(
          (branch) => `
        ${JSON.stringify(branch.id)}: {
          id: ${JSON.stringify(branch.id || "").replace(/</g, "\\u003c")},
          name: ${JSON.stringify(branch.name || "").replace(/</g, "\\u003c")},
          phone: ${JSON.stringify(cleanPhone(branch.phone)).replace(/</g, "\\u003c")},
          whatsapp: ${JSON.stringify(cleanWa(branch.whatsapp)).replace(/</g, "\\u003c")}
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
    const CART_ENABLED = ${cartEnabled ? "true" : "false"};
    const WHATSAPP_ORDERS_ENABLED = ${allowWhatsappOrders ? "true" : "false"};
    const CART_KEY = 'itred_storefront_cart_' + (STOREFRONT_ID || VENDOR_ID);
    const CART_CUSTOMER_KEY = CART_KEY + '_customer';

    function showStorefrontMessage(message) {
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.style.position = 'fixed';
      toast.style.left = '16px';
      toast.style.right = '16px';
      toast.style.bottom = '86px';
      toast.style.zIndex = '12000';
      toast.style.background = '#262626';
      toast.style.color = '#fff';
      toast.style.borderTop = '4px solid #f97316';
      toast.style.padding = '14px 16px';
      toast.style.fontSize = '13px';
      toast.style.fontWeight = '800';
      toast.style.textTransform = 'uppercase';
      toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.22)';
      document.body.appendChild(toast);
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 3200);
    }

    function cleanRuntimePhone(value) {
      return value ? String(value).replace(/[^0-9+]/g, '') : '';
    }

    function cleanRuntimeWhatsapp(value) {
      return value ? String(value).replace(/[^0-9]/g, '') : '';
    }

    function getBranchForProduct(product) {
      if (!product) return null;
      if (product.branchId && BRANCHES[product.branchId]) return BRANCHES[product.branchId];
      const branchName = String(product.branch || '').toLowerCase();
      if (!branchName) return null;
      const keys = Object.keys(BRANCHES);
      for (let i = 0; i < keys.length; i++) {
        const branch = BRANCHES[keys[i]];
        if (String(branch.name || '').toLowerCase() === branchName) return branch;
      }
      return null;
    }

    function getProductWhatsapp(product) {
      const productBranch = getBranchForProduct(product);
      return cleanRuntimeWhatsapp(productBranch && productBranch.whatsapp) || VENDOR_WA || '';
    }

    function getProductPhone(product) {
      const productBranch = getBranchForProduct(product);
      return cleanRuntimePhone(productBranch && productBranch.phone) || VENDOR_PHONE || '';
    }

    function safeJsonParse(raw, fallback) {
      try {
        const parsed = JSON.parse(raw || '');
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch (e) {
        return fallback;
      }
    }

    function normalizeCartItem(item) {
      if (!item || !item.productId) return null;
      const qty = Math.max(1, Number(item.qty) || 1);
      const price = Number(item.price);
      return {
        productId: String(item.productId),
        productName: String(item.productName || 'Product'),
        vendorId: String(item.vendorId || VENDOR_ID),
        vendorName: String(item.vendorName || VENDOR_NAME),
        sku: item.sku ? String(item.sku) : null,
        price: Number.isFinite(price) ? price : null,
        currency: String(item.currency || 'USD'),
        qty: qty,
        imageUrl: item.imageUrl || null,
        branchName: item.branchName || null
      };
    }

    function loadCart() {
      if (!CART_ENABLED) return [];
      const raw = safeLocalStorageGet(CART_KEY);
      const parsed = safeJsonParse(raw, []);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeCartItem).filter(Boolean);
    }

    function saveCart(items) {
      if (!CART_ENABLED) return;
      const safeItems = Array.isArray(items)
        ? items.map(normalizeCartItem).filter(Boolean)
        : [];
      safeLocalStorageSet(CART_KEY, JSON.stringify(safeItems));
      renderCart();
    }

    function getCartCustomer() {
      const parsed = safeJsonParse(safeLocalStorageGet(CART_CUSTOMER_KEY), {});
      return {
        customerName: String(parsed.customerName || ''),
        location: String(parsed.location || ''),
        note: String(parsed.note || '')
      };
    }

    function saveCartCustomer() {
      if (!CART_ENABLED) return;
      const nameEl = document.getElementById('cart-customer-name');
      const locationEl = document.getElementById('cart-location');
      const noteEl = document.getElementById('cart-note');
      safeLocalStorageSet(CART_CUSTOMER_KEY, JSON.stringify({
        customerName: nameEl ? nameEl.value : '',
        location: locationEl ? locationEl.value : '',
        note: noteEl ? noteEl.value : ''
      }));
    }

    function productToCartItem(productId) {
      const product = PRODUCTS[productId];
      if (!product) return null;
      return normalizeCartItem({
        productId: productId,
        productName: product.name,
        vendorId: product.vendorId || VENDOR_ID,
        vendorName: product.vendorName || VENDOR_NAME,
        sku: product.sku || null,
        price: product.price,
        currency: product.currency || 'USD',
        qty: 1,
        imageUrl: product.img || null,
        branchName: product.branch || null
      });
    }

    function addToCart(productId) {
      if (!CART_ENABLED) return;
      const item = productToCartItem(productId);
      if (!item) return;
      const cart = loadCart();
      const existing = cart.find(function(line) { return line.productId === item.productId; });
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push(item);
      }
      saveCart(cart);
      logOfflineEvent({ eventType: 'cart_add', sourceType: 'storefront', storefrontId: STOREFRONT_ID, vendorId: VENDOR_ID, vendorName: VENDOR_NAME, productId: item.productId, productName: item.productName, payload: { qty: existing ? existing.qty : 1 } });
      showStorefrontMessage('Added to cart.');
    }

    function removeFromCart(productId) {
      const cart = loadCart().filter(function(item) { return item.productId !== productId; });
      saveCart(cart);
      logOfflineEvent({ eventType: 'cart_remove', sourceType: 'storefront', storefrontId: STOREFRONT_ID, vendorId: VENDOR_ID, vendorName: VENDOR_NAME, productId: productId });
    }

    function updateCartQty(productId, qty) {
      const nextQty = Math.max(1, Number(qty) || 1);
      const cart = loadCart().map(function(item) {
        if (item.productId === productId) item.qty = nextQty;
        return item;
      });
      saveCart(cart);
      logOfflineEvent({ eventType: 'cart_update_qty', sourceType: 'storefront', storefrontId: STOREFRONT_ID, vendorId: VENDOR_ID, vendorName: VENDOR_NAME, productId: productId, payload: { qty: nextQty } });
    }

    function clearCart() {
      saveCart([]);
      logOfflineEvent({ eventType: 'cart_clear', sourceType: 'storefront', storefrontId: STOREFRONT_ID, vendorId: VENDOR_ID, vendorName: VENDOR_NAME });
    }

    function formatMoney(currency, value) {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue) || numberValue <= 0) return 'POR';
      return '$' + Math.round(numberValue).toLocaleString('en-US');
    }

    function truncateText(text, len) {
      text = String(text == null ? '' : text).replace(/\\s+/g, ' ').trim();
      if (text.length <= len) return text;
      return text.slice(0, Math.max(0, len - 3)).replace(/\\s+$/g, '') + '...';
    }

    function padRight(text, len) {
      text = String(text == null ? '' : text);
      if (text.length >= len) return text.slice(0, len);
      return text + Array(len - text.length + 1).join(' ');
    }

    function padLeft(text, len) {
      text = String(text == null ? '' : text);
      if (text.length >= len) return text;
      return Array(len - text.length + 1).join(' ') + text;
    }

    function receiptLine(len) {
      return Array((len || 54) + 1).join('-');
    }

    function receiptDate() {
      return new Date().toISOString().slice(0, 10);
    }

    function cartSubtotal(cart) {
      return cart.reduce(function(sum, item) {
        return sum + (Number.isFinite(Number(item.price)) ? Number(item.price) * item.qty : 0);
      }, 0);
    }

    function renderCart() {
      if (!CART_ENABLED) return;
      const cart = loadCart();
      const count = cart.reduce(function(sum, item) { return sum + item.qty; }, 0);
      const countEl = document.getElementById('cart-count');
      if (countEl) countEl.textContent = String(count);
      const linesEl = document.getElementById('cart-lines');
      if (!linesEl) return;
      if (cart.length === 0) {
        linesEl.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
      } else {
        linesEl.innerHTML = cart.map(function(item) {
          const lineTotal = Number.isFinite(Number(item.price)) && Number(item.price) > 0 ? Number(item.price) * item.qty : null;
          return '<div class="cart-line">' +
            '<img src="' + escapeHtml(item.imageUrl || '') + '" alt="' + escapeHtml(item.productName) + '" onerror="this.style.display=\\'none\\'" />' +
            '<div>' +
              '<p class="cart-line-name">' + escapeHtml(item.productName) + '</p>' +
              '<p class="cart-line-meta">SKU: ' + escapeHtml(item.sku || 'N/A') + ' | ' + escapeHtml(item.branchName || 'Main') + '</p>' +
              '<div class="cart-line-bottom">' +
                '<div class="cart-stepper">' +
                  '<button type="button" onclick="updateCartQty(\\'' + escapeHtml(item.productId) + '\\',' + Math.max(1, item.qty - 1) + ')">-</button>' +
                  '<span>' + item.qty + '</span>' +
                  '<button type="button" onclick="updateCartQty(\\'' + escapeHtml(item.productId) + '\\',' + (item.qty + 1) + ')">+</button>' +
                '</div>' +
                '<div class="cart-line-total">' + escapeHtml(lineTotal === null ? 'POR' : formatMoney(item.currency, lineTotal)) + '</div>' +
              '</div>' +
              '<button class="cart-remove" type="button" onclick="removeFromCart(\\'' + escapeHtml(item.productId) + '\\')">Remove</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      const subtotalEl = document.getElementById('cart-subtotal');
      if (subtotalEl) subtotalEl.textContent = formatMoney('$', cartSubtotal(cart));
    }

    function hydrateCartCustomerFields() {
      if (!CART_ENABLED) return;
      const customer = getCartCustomer();
      const nameEl = document.getElementById('cart-customer-name');
      const locationEl = document.getElementById('cart-location');
      const noteEl = document.getElementById('cart-note');
      if (nameEl) nameEl.value = customer.customerName;
      if (locationEl) locationEl.value = customer.location;
      if (noteEl) noteEl.value = customer.note;
      [nameEl, locationEl, noteEl].forEach(function(el) {
        if (el) el.addEventListener('input', saveCartCustomer);
      });
    }

    function openCart() {
      if (!CART_ENABLED) return;
      renderCart();
      const overlay = document.getElementById('cart-overlay');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeCart() {
      const overlay = document.getElementById('cart-overlay');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    function buildCartOrderMessage(cart, customer) {
      const width = 54;
      const lines = [
        'iTred sales lead voucher',
        '',
        'Customer name: ' + customer.customerName,
        'Vendor: ' + VENDOR_NAME,
        'Date: ' + receiptDate(),
        '',
        'Products',
        receiptLine(width),
        padRight('No', 4) + padRight('Product', 24) + padLeft('Qty', 5) + padLeft('UP', 8) + padLeft('Amt', 10),
        receiptLine(width)
      ];
      cart.forEach(function(item, index) {
        const unitPrice = Number(item.price || 0);
        const lineTotal = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice * item.qty : 0;
        lines.push(
          padRight(String(index + 1) + '.', 4) +
          padRight(truncateText(item.productName || 'Product', 24), 24) +
          padLeft(item.qty, 5) +
          padLeft(formatMoney(item.currency, unitPrice), 8) +
          padLeft(lineTotal > 0 ? formatMoney(item.currency, lineTotal) : 'POR', 10)
        );
      });
      lines.push(receiptLine(width));
      lines.push(padRight('Total sales lead value:', 36) + padLeft(formatMoney('$', cartSubtotal(cart)), 18));
      lines.push(receiptLine(width));
      lines.push('');
      if (customer.location) lines.push('Location: ' + customer.location);
      if (customer.note) lines.push('Note: ' + customer.note);
      if (customer.location || customer.note) lines.push('');
      lines.push('Please confirm stock availability, pricing, collection/delivery options and payment instructions.');
      lines.push('');
      lines.push('Powered by seiGEN Commerce');
      return lines.join('\\n');
    }

    function sendCartOrder() {
      if (!CART_ENABLED || !WHATSAPP_ORDERS_ENABLED) return;
      const cart = loadCart();
      if (cart.length === 0) {
        showStorefrontMessage('Cart is empty.');
        return;
      }
      const num = VENDOR_WA;
      if (!num) {
        showStorefrontMessage('Vendor WhatsApp number is missing.');
        return;
      }
      saveCartCustomer();
      const customer = getCartCustomer();
      if (!customer.customerName.trim()) {
        const nameEl = document.getElementById('cart-customer-name');
        if (nameEl) {
          nameEl.focus();
          nameEl.style.outline = '2px solid #f97316';
        }
        showStorefrontMessage('Please enter customer name.');
        return;
      }
      const nameEl = document.getElementById('cart-customer-name');
      if (nameEl) nameEl.style.outline = '';
      const message = buildCartOrderMessage(cart, customer);
      logOfflineEvent({ eventType: 'order_created', sourceType: 'storefront', storefrontId: STOREFRONT_ID, vendorId: VENDOR_ID, vendorName: VENDOR_NAME, payload: { itemCount: cart.length, subtotal: cartSubtotal(cart) } });
      logOfflineEvent({ eventType: 'whatsapp_order_click', sourceType: 'storefront', storefrontId: STOREFRONT_ID, vendorId: VENDOR_ID, vendorName: VENDOR_NAME, payload: { itemCount: cart.length } });
      window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
    }
    
    function orderWhatsApp(productId) {
      const p = PRODUCTS[productId];
      if (!p) return;
      const num = getProductWhatsapp(p);
      if (!num) {
        showStorefrontMessage("WhatsApp number not available for this product/vendor.");
        return;
      }
      
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

      const text = "Hi " + VENDOR_NAME + ", I saw this product on iTred powered by seiGEN Commerce.\\n\\nProduct: " + p.name + "\\nPrice: " + formatMoney(p.currency, p.price) + "\\nRef: " + leadRef + "\\n\\nPlease confirm availability.";
      window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(text), "_blank");
    }

    function callVendor(productId) {
      const p = PRODUCTS[productId];
      const num = getProductPhone(p);
      if (!num) {
        showStorefrontMessage("Phone number not available for this product/vendor.");
        return;
      }

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
      
      const gallery = Array.isArray(p.images) && p.images.length ? p.images : [p.img];
      document.getElementById('m-img').src = gallery[0] || p.img;
      const galleryEl = document.getElementById('m-gallery');
      if (galleryEl) {
        galleryEl.innerHTML = gallery.length > 1
          ? gallery.map(function(src, index) {
              return '<img src="' + escapeHtml(src) + '" class="modal-thumb ' + (index === 0 ? 'active' : '') + '" data-src="' + escapeHtml(src) + '" loading="lazy" />';
            }).join('')
          : '';
        galleryEl.querySelectorAll('.modal-thumb').forEach(function(img) {
          img.addEventListener('click', function() {
            document.getElementById('m-img').src = img.getAttribute('data-src') || '';
            galleryEl.querySelectorAll('.modal-thumb').forEach(function(item) { item.classList.remove('active'); });
            img.classList.add('active');
          });
        });
      }
      document.getElementById('m-name').innerText = p.name;
      document.getElementById('m-price').innerText = formatMoney(p.currency, p.price);
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

      const waBtn = document.getElementById('m-btn-wa');
      const productWhatsapp = getProductWhatsapp(p);
      if (waBtn) {
        waBtn.style.display = productWhatsapp ? 'inline-flex' : 'none';
        waBtn.onclick = productWhatsapp ? function() { orderWhatsApp(productId); } : null;
      }

      const callBtn = document.getElementById('m-btn-call');
      const productPhone = getProductPhone(p);
      if (callBtn) {
        callBtn.style.display = productPhone ? 'inline-flex' : 'none';
        callBtn.onclick = productPhone ? function() { callVendor(productId); } : null;
      }

      document.getElementById('m-btn-share').onclick = function() { shareProduct(productId); };
      const cartBtn = document.getElementById('m-btn-cart');
      if (cartBtn) {
        cartBtn.style.display = CART_ENABLED ? 'block' : 'none';
        cartBtn.onclick = function() { addToCart(productId); };
      }
      
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
      if (CART_ENABLED) {
        hydrateCartCustomerFields();
        renderCart();
      }

      setTimeout(() => {
        let shown = checkExpiry();
        if (!shown) shown = checkPendingLeads();
        if (!shown && isReturn) {
          triggerWelcomeBack();
        }
      }, 2500);

      document.querySelectorAll('[data-action][data-product-id]').forEach(function(btn) {
        btn.addEventListener('click', function(event) {
          event.stopPropagation();
          const productId = btn.getAttribute('data-product-id');
          const action = btn.getAttribute('data-action');
          if (action === 'whatsapp') orderWhatsApp(productId);
          if (action === 'call') callVendor(productId);
          if (action === 'view') openProductModal(productId);
          if (action === 'cart') addToCart(productId);
        });
        btn.addEventListener('keydown', function(event) {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          btn.click();
        });
      });
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
