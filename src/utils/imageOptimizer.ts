/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OptimizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
}

export const optimizeImageToWebP = (
  file: File,
  options: OptimizeOptions,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const { maxWidth, maxHeight } = options;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return reject(new Error("Canvas context is not available"));
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to convert image to WebP"));
        },
        "image/webp",
        options.quality || 0.82,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image file"));
    };

    img.src = url;
  });
};

export const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
};

export const createImagePreviewUrl = (file: File | Blob): string => {
  return URL.createObjectURL(file);
};
