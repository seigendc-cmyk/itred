import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  CACHE_SIZE_UNLIMITED,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBlZDSj-dNjHELKkXeXzK3tx6UI_e8mi0w",
  authDomain: "gen-lang-client-0459000055.firebaseapp.com",
  projectId: "gen-lang-client-0459000055",
  storageBucket: "gen-lang-client-0459000055.firebasestorage.app",
  messagingSenderId: "728385482689",
  appId: "1:728385482689:web:cb330248a28dfcd82a0940",
  measurementId: "G-263DWQ022R",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  }),
});

export const storage = getStorage(app);

export const analyticsPromise =
  typeof window !== "undefined"
    ? isSupported()
        .then((supported) => (supported ? getAnalytics(app) : null))
        .catch((error) => {
          console.warn("Firebase analytics could not be initialized:", error);
          return null;
        })
    : Promise.resolve(null);

console.info("[Firebase] Initialized app, auth, firestore, storage.");