import { storage } from "../lib/firebase.ts";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const vendorAssetService = {
  uploadVendorLogo: async (
    vendorId: string,
    fileBlob: Blob,
  ): Promise<string> => {
    const storageRef = ref(storage, `vendor-assets/${vendorId}/logo.webp`);
    await uploadBytes(storageRef, fileBlob);
    return await getDownloadURL(storageRef);
  },

  uploadVendorBanner: async (
    vendorId: string,
    fileBlob: Blob,
  ): Promise<string> => {
    const storageRef = ref(storage, `vendor-assets/${vendorId}/banner.webp`);
    await uploadBytes(storageRef, fileBlob);
    return await getDownloadURL(storageRef);
  },
};
