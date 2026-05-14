const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
} = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBlZDSj-dNjHELKkXeXzK3tx6UI_e8mi0w",
  authDomain: "gen-lang-client-0459000055.firebaseapp.com",
  projectId: "gen-lang-client-0459000055",
  storageBucket: "gen-lang-client-0459000055.firebasestorage.app",
  messagingSenderId: "728385482689",
  appId: "1:728385482689:web:fd7ccc78fb97b6ab2a0940",
  measurementId: "G-XGPEGF89LQ",
};

const STAFF_COLLECTION = "itred_console_staff";

function timeValue(value) {
  if (!value) return 0;
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
}

function rankStaff(record) {
  const status = String(record.status || "").toLowerCase();
  const activeScore = status === "active" ? 1000000000000000 : 0;
  const updatedScore = timeValue(record.updatedAt);
  const createdScore = timeValue(record.createdAt);
  return activeScore + updatedScore + createdScore;
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, STAFF_COLLECTION));
  const rows = snap.docs.map((d) => ({
    docId: d.id,
    ...d.data(),
  }));

  const groups = new Map();

  for (const row of rows) {
    const staffCode = String(row.staffCode || "").trim();

    if (!staffCode) {
      console.log("SKIP: staff record has no staffCode:", row.docId);
      continue;
    }

    if (!groups.has(staffCode)) groups.set(staffCode, []);
    groups.get(staffCode).push(row);
  }

  let deletedCount = 0;

  for (const [staffCode, group] of groups.entries()) {
    if (group.length <= 1) continue;

    group.sort((a, b) => rankStaff(b) - rankStaff(a));

    const keep = group[0];
    const remove = group.slice(1);

    console.log("");
    console.log("DUPLICATE STAFF CODE:", staffCode);
    console.log("KEEP:", keep.docId, "|", keep.displayName || keep.fullName, "|", keep.email, "|", keep.status);

    for (const item of remove) {
      console.log("DELETE:", item.docId, "|", item.displayName || item.fullName, "|", item.email, "|", item.status);
      await deleteDoc(doc(db, STAFF_COLLECTION, item.docId));
      deletedCount++;
    }
  }

  console.log("");
  console.log("Duplicate staff cleanup complete.");
  console.log("Deleted records:", deletedCount);
}

main().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
