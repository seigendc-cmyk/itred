import type { Product } from "../types.ts";

export interface CatalogueImageOptimizationOptions {
  targetBytes?: number;
  warningBytes?: number;
  maxBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  minQuality?: number;
  maxQuality?: number;
  background?: string;
  outputType?: "image/webp";
  groupKeyBuilder?: (product: Product) => string;
}

export interface OptimizedImageResult {
  base64: string;
  dataUrl: string;
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  quality: number;
  status: "target" | "quality-fallback" | "warning" | "blocked" | "failed";
  originalUrl?: string;
  error?: string;
  originalFormat?: string;
  optimizedFormat?: string;
  originalBytes?: number;
  wasConvertedToWebP?: boolean;
  optimizationStatus?: string;
  reductionPercent?: number;
}

export interface CatalogueImageOptimizationSummary {
  rawProductCount: number;
  productImagesFound: number;
  imagesOptimized: number;
  averageOptimizedBytes: number;
  totalEstimatedPayloadBytes: number;
  aboveTargetCount: number;
  aboveWarningCount: number;
  aboveMaxCount: number;
  failedCount: number;
  groupedRows: number;
  uniqueThumbnails: number;
  imageReductionPercent: number;
}

export interface CatalogueImageOptimizationResult {
  products: Product[];
  summary: CatalogueImageOptimizationSummary;
  images: Record<string, OptimizedImageResult>;
}

const DEFAULT_OPTIONS: Required<
  Omit<CatalogueImageOptimizationOptions, "groupKeyBuilder">
> = {
  targetBytes: 8192,
  warningBytes: 12288,
  maxBytes: 20480,
  maxWidth: 160,
  maxHeight: 160,
  minQuality: 0.35,
  maxQuality: 0.82,
  background: "#ffffff",
  outputType: "image/webp",
};

const DIMENSION_STEPS = [160, 140, 120, 96];

const getProductImage = (product: Product): string => {
  const item = product as any;
  const firstImageObject = Array.isArray(item.images)
    ? item.images.find((image: any) => image?.url || image?.imageUrl)
    : null;
  return (
    item.imageUrl ||
    item.primaryImageUrl ||
    item.image ||
    (Array.isArray(item.imageUrls) ? item.imageUrls[0] : "") ||
    (typeof item.images?.[0] === "string"
      ? item.images[0]
      : firstImageObject?.url || firstImageObject?.imageUrl || "") ||
    (Array.isArray(item.additionalImages) ? item.additionalImages[0] : "") ||
    ""
  );
};

const getProductGalleryImages = (product: Product, limit = 6) => {
  const item = product as any;
  const raw = [
    ...(Array.isArray(item.images) ? item.images : []),
    ...(Array.isArray(item.imageUrls) ? item.imageUrls : []),
    ...(Array.isArray(item.galleryImages) ? item.galleryImages : []),
    ...(Array.isArray(item.additionalImages) ? item.additionalImages : []),
    item.imageUrl,
  ];
  const seen = new Set<string>();
  return raw
    .map((image: any, index) => {
      const url = String(
        typeof image === "string" ? image : image?.url || image?.imageUrl || "",
      ).trim();
      if (!url || seen.has(url)) return null;
      seen.add(url);
      return {
        url,
        alt: image?.alt ?? item.name ?? item.productName ?? null,
        sortOrder: index,
        isPrimary: index === 0,
      };
    })
    .filter(Boolean)
    .slice(0, limit);
};

const normalizeKeyPart = (value: unknown, preserveCodes = false): string =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(preserveCodes ? /[^a-z0-9\-\s]/g : /[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");

const fallbackGroupKey = (product: Product): string => {
  const item = product as any;
  const sku = normalizeKeyPart(
    item.sku ||
      item.productCode ||
      item.barcode ||
      item.standardSku ||
      item.vendorSku,
    true,
  );
  if (sku && sku.length >= 4) return `sku:${sku}`;
  const name = normalizeKeyPart(item.name || item.productName);
  const category = normalizeKeyPart(item.category);
  const sector = normalizeKeyPart(item.sector);
  if (name && (category || sector))
    return ["name", name, category, sector].filter(Boolean).join(":");
  return `id:${item.id || Math.random().toString(36).slice(2)}`;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export failed"));
      },
      "image/webp",
      quality,
    );
  });

const loadImageFromSource = async (
  fileOrUrl: File | Blob | string,
): Promise<HTMLImageElement> => {
  const image = new Image();
  image.decoding = "async";

  let objectUrl = "";
  if (typeof fileOrUrl === "string") {
    if (/^https?:\/\//i.test(fileOrUrl)) {
      image.crossOrigin = "anonymous";
    }
    image.src = fileOrUrl;
  } else {
    objectUrl = URL.createObjectURL(fileOrUrl);
    image.src = objectUrl;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be loaded"));
    });
    return image;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};

const drawContainThumbnail = (
  image: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  background: string,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, maxWidth, maxHeight);

  const sourceWidth = image.naturalWidth || image.width || maxWidth;
  const sourceHeight = image.naturalHeight || image.height || maxHeight;
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const drawWidth = Math.max(1, Math.round(sourceWidth * ratio));
  const drawHeight = Math.max(1, Math.round(sourceHeight * ratio));
  const x = Math.round((maxWidth - drawWidth) / 2);
  const y = Math.round((maxHeight - drawHeight) / 2);
  ctx.drawImage(image, x, y, drawWidth, drawHeight);

  return canvas;
};

export const estimateBase64Size = (base64: string): number => {
  const clean =
    String(base64 || "")
      .split(",")
      .pop() || "";
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
};

export const optimizeImageToWebP = async (
  fileOrUrl: File | Blob | string,
  options: CatalogueImageOptimizationOptions = {},
): Promise<OptimizedImageResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const image = await loadImageFromSource(fileOrUrl);
  const dimensionSteps = Array.from(
    new Set(
      [opts.maxWidth, ...DIMENSION_STEPS]
        .filter((size) => size <= opts.maxWidth && size <= opts.maxHeight)
        .sort((a, b) => b - a),
    ),
  );

  let best: OptimizedImageResult | null = null;

  for (const size of dimensionSteps) {
    const width = Math.min(size, opts.maxWidth);
    const height = Math.min(size, opts.maxHeight);
    const canvas = drawContainThumbnail(image, width, height, opts.background);
    const qualitySteps = [
      opts.maxQuality,
      0.72,
      0.62,
      0.52,
      0.44,
      opts.minQuality,
    ]
      .filter(
        (quality, index, values) =>
          quality >= opts.minQuality && values.indexOf(quality) === index,
      )
      .sort((a, b) => b - a);

    for (const quality of qualitySteps) {
      const blob = await canvasToBlob(canvas, opts.outputType, quality);
      const dataUrl = await blobToDataUrl(blob);
      const resultBytes = blob.size || estimateBase64Size(dataUrl);
      const result: OptimizedImageResult = {
        base64: dataUrl.split(",")[1] || "",
        dataUrl,
        blob,
        bytes: resultBytes,
        width,
        height,
        quality,
        status: "target",
        originalUrl: typeof fileOrUrl === "string" ? fileOrUrl : undefined,
        originalFormat,
        optimizedFormat: "webp",
        originalBytes,
        wasConvertedToWebP: true,
        optimizationStatus: "target",
        reductionPercent: originalBytes
          ? Math.max(
              0,
              Math.round(((originalBytes - resultBytes) / originalBytes) * 100),
            )
          : 0,
      };

      if (
        !best ||
        result.bytes < best.bytes ||
        (best.bytes > opts.targetBytes && result.quality > best.quality)
      ) {
        best = result;
      }

      if (result.bytes <= opts.targetBytes) {
        best = result;
        break;
      }
    }
    if (best && best.bytes <= opts.targetBytes) break;
  }

  if (!best) throw new Error("Image optimization failed");

  best.status =
    best.bytes <= opts.warningBytes
      ? "quality-fallback"
      : best.bytes <= opts.maxBytes
        ? "warning"
        : "blocked";
  best.optimizationStatus = best.status;

  return best;
};

export const optimizeCatalogueImages = async (
  products: Product[],
  options: CatalogueImageOptimizationOptions = {},
): Promise<CatalogueImageOptimizationResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const groupKeyBuilder = options.groupKeyBuilder || fallbackGroupKey;
  const groups = new Map<string, Product[]>();

  products.forEach((product) => {
    const key = groupKeyBuilder(product);
    groups.set(key, [...(groups.get(key) || []), product]);
  });

  const optimizedByGroup: Record<string, OptimizedImageResult> = {};
  const productImagesFound = products.filter(
    (product) => !!getProductImage(product),
  ).length;
  let imagesOptimized = 0;
  let failedCount = 0;

  for (const [groupKey, groupProducts] of groups.entries()) {
    const representative = groupProducts.find(
      (product) => !!getProductImage(product),
    );
    const imageUrl = representative ? getProductImage(representative) : "";
    if (!imageUrl) continue;

    try {
      const result = await optimizeImageToWebP(imageUrl, opts);
      optimizedByGroup[groupKey] = result;
      imagesOptimized += 1;
    } catch (error) {
      failedCount += 1;
      optimizedByGroup[groupKey] = {
        base64: "",
        dataUrl: imageUrl,
        blob: new Blob(),
        bytes: 0,
        width: 0,
        height: 0,
        quality: 0,
        status: "failed",
        originalUrl: imageUrl,
        error:
          error instanceof Error ? error.message : "Image optimization failed",
        originalFormat: "unknown",
        optimizedFormat: "failed",
        originalBytes: 0,
        wasConvertedToWebP: false,
        optimizationStatus: "failed",
        reductionPercent: 0,
      };
    }
  }

  const productsForExport = products.map((product, index) => {
    const groupKey = groupKeyBuilder(product);
    const groupProducts = groups.get(groupKey) || [];
    const representativeIndex = groupProducts.findIndex(
      (item) => !!getProductImage(item),
    );
    const representative =
      representativeIndex >= 0
        ? groupProducts[representativeIndex]
        : groupProducts[0];
    const isRepresentative = representative === product;
    const optimized = optimizedByGroup[groupKey];
    const originalImageUrl = getProductImage(product);
    const item: any = {
      ...product,
      originalImageUrl,
      catalogueImageGroupKey: groupKey,
      imageOptimizationStatus:
        optimized?.status || (originalImageUrl ? "failed" : "missing"),
      imageOptimizationBytes: optimized?.bytes || 0,
    };

    delete item.primaryImageUrl;
    delete item.image;
    delete item.imageUrls;
    delete item.galleryImages;
    const galleryImages = getProductGalleryImages(product, 6);

    if (
      isRepresentative &&
      optimized?.dataUrl &&
      optimized.status !== "failed"
    ) {
      item.imageUrl = optimized.dataUrl;
    } else {
      item.imageUrl = "";
    }

    item.images = [
      ...(item.imageUrl
        ? [
            {
              url: item.imageUrl,
              alt: item.name || item.productName || null,
              sortOrder: 0,
              isPrimary: true,
            },
          ]
        : []),
      ...galleryImages
        .filter((image: any) => image.url !== originalImageUrl)
        .slice(0, item.imageUrl ? 5 : 6)
        .map((image: any, offset: number) => ({
          ...image,
          sortOrder: (item.imageUrl ? 1 : 0) + offset,
          isPrimary: !item.imageUrl && offset === 0,
        })),
    ];
    item.additionalImages = item.images.slice(1).map((image: any) => image.url);

    item.catalogueImageSortIndex = index;
    return item as Product;
  });

  const diagnosticsArray = Object.values(optimizedByGroup).map((r) => ({
    originalFormat: r.originalFormat || "unknown",
    optimizedFormat: r.optimizedFormat || "failed",
    originalBytes: r.originalBytes || 0,
    optimizedBytes: r.bytes,
    reductionPercent: r.reductionPercent || 0,
    wasConvertedToWebP: r.wasConvertedToWebP || false,
    optimizationStatus: r.optimizationStatus || r.status,
  }));
  if (diagnosticsArray.length > 0) {
    console.table(diagnosticsArray);
  }

  const optimizedImages = Object.values(optimizedByGroup).filter(
    (item) => item.status !== "failed",
  );
  const totalEstimatedPayloadBytes = optimizedImages.reduce(
    (total, item) => total + item.bytes,
    0,
  );
  const averageOptimizedBytes = optimizedImages.length
    ? Math.round(totalEstimatedPayloadBytes / optimizedImages.length)
    : 0;
  const uniqueThumbnails = optimizedImages.length;

  return {
    products: productsForExport,
    images: optimizedByGroup,
    summary: {
      rawProductCount: products.length,
      productImagesFound,
      imagesOptimized,
      averageOptimizedBytes,
      totalEstimatedPayloadBytes,
      aboveTargetCount: optimizedImages.filter(
        (item) => item.bytes > opts.targetBytes,
      ).length,
      aboveWarningCount: optimizedImages.filter(
        (item) => item.bytes > opts.warningBytes,
      ).length,
      aboveMaxCount: optimizedImages.filter(
        (item) => item.bytes > opts.maxBytes,
      ).length,
      failedCount,
      groupedRows: products.length,
      uniqueThumbnails,
      imageReductionPercent:
        products.length > 0
          ? Math.max(
              0,
              Math.round(
                ((products.length - uniqueThumbnails) / products.length) * 100,
              ),
            )
          : 0,
    },
  };
};
