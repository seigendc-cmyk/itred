/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const compressImage = async (
  file: File,
  maxWidth: number = 480,
  quality: number = 0.65
): Promise<{ base64: string; compressedSize: number }> => {
  if (typeof window === 'undefined' || typeof FileReader === 'undefined') {
    throw new Error('Browser environment required for image compression');
  }

  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
              height = (maxWidth / width) * height;
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Convert to webp
            const base64 = canvas.toDataURL('image/webp', quality);
            
            // Calculate approximate size
            const compressedSize = Math.round((base64.length * 3) / 4);
            
            resolve({ base64, compressedSize });
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = (e) => reject(new Error('Image loading failed'));
      };
      reader.onerror = (e) => reject(new Error('File reading failed'));
    } catch (error) {
      reject(error);
    }
  });
};
