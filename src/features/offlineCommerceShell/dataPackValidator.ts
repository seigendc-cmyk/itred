import {
  OFFLINE_COMMERCE_PACK_TYPE,
  OFFLINE_COMMERCE_PACK_VERSION,
} from "./offlineShellConstants";
import {
  OfflineCommercePack,
  OfflineShellImportValidationReport,
  OfflineShellPayloadEstimate,
  OfflineShellValidationResult,
} from "./types";

const sizeLabel = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const payloadWeight = (bytes: number): OfflineShellPayloadEstimate["weight"] => {
  if (bytes < 2 * 1024 * 1024) return "good";
  if (bytes <= 10 * 1024 * 1024) return "warning";
  return "heavy";
};

const isDataUri = (value: unknown) =>
  typeof value === "string" && value.trim().toLowerCase().startsWith("data:");

const isSafeLinkUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^(https?:\/\/|tel:|mailto:)/i.test(trimmed);
};

const countPackImages = (pack: Partial<OfflineCommercePack> | null | undefined) => {
  const vendors = Array.isArray(pack?.vendors) ? pack.vendors : [];
  let imageCount = 0;
  let dataUriImageCount = 0;

  vendors.forEach((vendor) => {
    [vendor.logoDataUri, vendor.bannerDataUri].forEach((image) => {
      if (!image) return;
      imageCount += 1;
      if (isDataUri(image)) dataUriImageCount += 1;
    });
    if (Array.isArray(vendor.products)) {
      vendor.products.forEach((product) => {
        if (!product.imageDataUri) return;
        imageCount += 1;
        if (isDataUri(product.imageDataUri)) dataUriImageCount += 1;
      });
    }
  });

  return { imageCount, dataUriImageCount };
};

export function estimateOfflineCommercePackPayload(
  pack: Partial<OfflineCommercePack> | null | undefined,
): OfflineShellPayloadEstimate {
  const vendors = Array.isArray(pack?.vendors) ? pack.vendors : [];
  const productCount = vendors.reduce(
    (sum, vendor) => sum + (Array.isArray(vendor.products) ? vendor.products.length : 0),
    0,
  );
  const serialized = pack ? JSON.stringify(pack) : "";
  const sizeBytes = new Blob([serialized]).size;
  const { imageCount, dataUriImageCount } = countPackImages(pack);

  return {
    sizeBytes,
    sizeLabel: sizeLabel(sizeBytes),
    vendorCount: vendors.length,
    productCount,
    imageCount,
    dataUriImageCount,
    weight: payloadWeight(sizeBytes),
  };
}

function findUndefinedPath(value: unknown, path = "pack"): string | null {
  if (value === undefined) return path;
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findUndefinedPath(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }

  for (const [key, item] of Object.entries(value)) {
    const found = findUndefinedPath(item, `${path}.${key}`);
    if (found) return found;
  }

  return null;
}

export function validateOfflineCommercePack(
  pack: Partial<OfflineCommercePack> | null | undefined,
): OfflineShellValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pack) {
    return {
      isValid: false,
      errors: ["Data pack is empty or unreadable."],
      warnings,
    };
  }

  if (pack.packType !== OFFLINE_COMMERCE_PACK_TYPE) {
    errors.push("Data pack type is not supported by this shell.");
  }

  if (pack.version !== OFFLINE_COMMERCE_PACK_VERSION) {
    warnings.push("Data pack version differs from the current shell version.");
  }

  if (!pack.generatedAt) {
    errors.push("Data pack is missing generatedAt.");
  }

  if (!pack.expiresAt || Number.isNaN(new Date(pack.expiresAt).getTime())) {
    errors.push("Data pack expiry is missing or invalid.");
  } else if (new Date(pack.expiresAt).getTime() <= Date.now()) {
    errors.push("Data pack has expired.");
  }

  if (!Array.isArray(pack.vendors)) {
    errors.push("Data pack vendors must be an array.");
  } else if (pack.vendors.length === 0) {
    errors.push("At least one vendor must be selected.");
  } else {
    pack.vendors.forEach((vendor, index) => {
      if (!vendor.vendorId) {
        errors.push(`Vendor at position ${index + 1} is missing vendorId.`);
      }
      if (!vendor.name) {
        errors.push(`Vendor at position ${index + 1} is missing name.`);
      }
      if (!vendor.whatsapp && !vendor.phone) {
        errors.push(`Vendor ${vendor.name || vendor.vendorId || index + 1} is missing WhatsApp or phone.`);
      }
      if (!Array.isArray(vendor.products)) {
        errors.push(`Vendor ${vendor.vendorId || index + 1} products must be an array.`);
      } else if (vendor.products.length === 0) {
        errors.push(`Vendor ${vendor.name || vendor.vendorId || index + 1} has no products.`);
      } else {
        vendor.products.forEach((product, productIndex) => {
          const label = `Vendor ${vendor.name || vendor.vendorId || index + 1}, product ${productIndex + 1}`;
          if (!product || typeof product !== "object") {
            errors.push(`${label} is malformed.`);
            return;
          }
          if (!product.id) {
            errors.push(`${label} is missing id.`);
          }
          if (!product.productName) {
            errors.push(`${label} is missing productName.`);
          }
          if (!product.category) {
            errors.push(`${label} is missing category.`);
          }
          if (!product.sector) {
            errors.push(`${label} is missing sector.`);
          }
          if (typeof product.price !== "number" || Number.isNaN(product.price)) {
            errors.push(`${label} has an invalid price.`);
          }
          if (!Array.isArray(product.tags)) {
            errors.push(`${label} tags must be an array.`);
          }
          if (!Array.isArray(product.keywords)) {
            errors.push(`${label} keywords must be an array.`);
          }
        });
      }
    });
  }

  if (!Array.isArray(pack.accessHubLinks)) {
    errors.push("Data pack accessHubLinks must be an array.");
  } else {
    pack.accessHubLinks.forEach((link, index) => {
      if (!link || typeof link !== "object") {
        errors.push(`Access Hub link at position ${index + 1} is malformed.`);
        return;
      }
      if (!link.id) {
        errors.push(`Access Hub link at position ${index + 1} is missing id.`);
      }
      if (!link.url || !isSafeLinkUrl(link.url)) {
        errors.push(`Access Hub link ${link.title || link.name || index + 1} has an invalid URL.`);
      }
    });
  }

  if (!pack.legal) {
    warnings.push("Data pack has no legal content.");
  }

  if (!pack.support || typeof pack.support !== "object") {
    errors.push("Data pack support must be an object.");
  } else if (!pack.support.supportPhone && !pack.support.phone) {
    warnings.push("Data pack has no support phone.");
  }

  const undefinedPath = findUndefinedPath(pack);
  if (undefinedPath) {
    errors.push(`Data pack contains an undefined field at ${undefinedPath}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function buildOfflineCommerceImportValidationReport(
  pack: Partial<OfflineCommercePack> | null | undefined,
  parseErrors: string[] = [],
): OfflineShellImportValidationReport {
  const validation = validateOfflineCommercePack(pack);
  const payload = estimateOfflineCommercePackPayload(pack);
  const errors = [...parseErrors, ...validation.errors];
  const metadata = pack?.metadata || {};
  const title =
    typeof metadata.title === "string"
      ? metadata.title
      : "iTred Offline Commerce Pack";

  if (payload.weight === "warning") {
    validation.warnings.push("Payload is 2-10MB. Import may be slower on low-end devices.");
  }

  if (payload.weight === "heavy") {
    validation.warnings.push("Payload is above 10MB. Consider reducing embedded images.");
  }

  return {
    isValid: errors.length === 0,
    title,
    packType: String(pack?.packType || ""),
    version: String(pack?.version || ""),
    generatedAt: String(pack?.generatedAt || ""),
    expiresAt: String(pack?.expiresAt || ""),
    vendorCount: payload.vendorCount,
    productCount: payload.productCount,
    errors,
    warnings: validation.warnings,
    payload,
  };
}
