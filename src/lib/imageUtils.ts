/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface CompressionResult {
  base64: string;
  metadata: {
    originalName: string;
    originalSize: number;
    compressedSize: number;
    format: string;
    width: number;
    height: number;
  };
}

export const compressImage = async (
  file: File,
  maxWidth: number = 360, // Target thumbnail width: 320px to 360px
  quality: number = 0.65  // Use WebP quality between 0.60 and 0.70
): Promise<CompressionResult> => {
  return new Promise((resolve, reject) => {
    // Basic validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return reject(new Error('Invalid image format. Only JPG, JPEG, PNG, and WebP are allowed.'));
    }

    if (file.size > 8 * 1024 * 1024) {
      return reject(new Error('Image is too large. Maximum size is 8MB.'));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio resizing
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get canvas context.'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP with quality compression
        const base64 = canvas.toDataURL('image/webp', quality);
        
        // Calculate compressed size (approximate from base64)
        const stringLength = base64.length - 'data:image/webp;base64,'.length;
        const sizeInBytes = Math.ceil(stringLength * 0.75);

        resolve({
          base64: base64,
          metadata: {
            originalName: file.name,
            originalSize: file.size,
            compressedSize: sizeInBytes,
            format: 'webp',
            width: width,
            height: height
          }
        });
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
  });
};

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
