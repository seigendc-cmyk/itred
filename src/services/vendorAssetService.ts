/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const vendorAssetService = {
  uploadVendorLogo: async (vendorId: string, blob: Blob): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `vendor-assets/${vendorId}/logo.webp`);
    await uploadBytes(storageRef, blob, { contentType: "image/webp" });
    return await getDownloadURL(storageRef);
  },

  uploadVendorBanner: async (vendorId: string, blob: Blob): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `vendor-assets/${vendorId}/banner.webp`);
    await uploadBytes(storageRef, blob, { contentType: "image/webp" });
    return await getDownloadURL(storageRef);
  },
};
