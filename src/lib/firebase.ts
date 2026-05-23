import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  enableIndexedDbPersistence,
  getFirestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBlZDSj-dNjHELKkXeXzK3tx6UI_e8mi0w",
  authDomain: "gen-lang-client-0459000055.firebaseapp.com",
  projectId: "gen-lang-client-0459000055",
  storageBucket: "gen-lang-client-0459000055.firebasestorage.app",
  messagingSenderId: "728385482689",
  appId: "1:728385482689:web:fd7ccc78fb97b6ab2a0940",
  measurementId: "G-XGPEGF89LQ",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((error) => {
    if (error?.code === "failed-precondition") {
      console.warn(
        "Firestore offline persistence is unavailable because multiple tabs are open.",
      );
      return;
    }
    if (error?.code === "unimplemented") {
      console.warn(
        "Firestore offline persistence is not supported in this browser.",
      );
      return;
    }
    console.warn("Firestore offline persistence could not be enabled.", error);
  });
}

export const analyticsPromise =
  typeof window !== "undefined"
    ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
    : Promise.resolve(null);
