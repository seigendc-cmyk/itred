const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
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

function getYearMonth() {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0")
  );
}

function extractNumber(code) {
  const n = parseInt(String(code || "").split("-").pop() || "0", 10);
  return Number.isNaN(n) ? 0 : n;
}

function makeCode(yearMonth, number) {
  return `ITR-STF-${yearMonth}-${String(number).padStart(4, "0")}`;
}

function rankStaff(row) {
  const status = String(row.status || "").toLowerCase();
  const activeScore = status === "active" ? 1000000000 : 0;
  const updatedAt = row.updatedAt ? new Date(row.updatedAt).getTime() || 0 : 0;
  const createdAt = row.createdAt ? new Date(row.createdAt).getTime() || 0 : 0;
  return activeScore + updatedAt + createdAt;
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, STAFF_COLLECTION));
  const staff = snap.docs.map((d) => ({
    docId: d.id,
    ...d.data(),
  }));

  const yearMonth = getYearMonth();
  const prefix = `ITR-STF-${yearMonth}-`;

  const usedCodes = new Set(
    staff
      .map((s) => String(s.staffCode || "").trim())
      .filter(Boolean)
  );

  let highest = 0;
  for (const s of staff) {
    const code = String(s.staffCode || "");
    if (code.startsWith(prefix)) {
      highest = Math.max(highest, extractNumber(code));
    }
  }

  const groups = new Map();

  for (const row of staff) {
    const code = String(row.staffCode || "").trim();
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(row);
  }

  let updatedCount = 0;

  for (const [code, group] of groups.entries()) {
    if (group.length <= 1) continue;

    group.sort((a, b) => rankStaff(b) - rankStaff(a));

    const keep = group[0];
    const duplicates = group.slice(1);

    console.log("");
    console.log("DUPLICATE CODE:", code);
    console.log("KEEP:", keep.docId, "|", keep.displayName || keep.fullName, "|", keep.email, "|", keep.status);

    for (const dup of duplicates) {
      let newCode = "";

      do {
        highest += 1;
        newCode = makeCode(yearMonth, highest);
      } while (usedCodes.has(newCode));

      usedCodes.add(newCode);

      console.log("RENUMBER:", dup.docId, "|", dup.displayName || dup.fullName, "|", dup.email, "|", code, "=>", newCode);

      await updateDoc(doc(db, STAFF_COLLECTION, dup.docId), {
        staffCode: newCode,
        updatedAt: new Date().toISOString(),
        duplicateRepairNote: `Auto-renumbered from duplicate staff code ${code}`,
      });

      updatedCount++;
    }
  }

  console.log("");
  console.log("Duplicate staff-code repair complete.");
  console.log("Records renumbered:", updatedCount);
}

main().catch((error) => {
  console.error("Repair failed:", error);
  process.exit(1);
});
