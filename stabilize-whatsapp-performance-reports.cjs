const fs = require("fs");

const file = "src/pages/WhatsAppPerformanceReports.tsx";

if (!fs.existsSync(file)) {
  console.error("Missing file:", file);
  process.exit(1);
}

let code = fs.readFileSync(file, "utf8");
fs.writeFileSync(`${file}.backup-stabilize-whatsapp-reports-${Date.now()}`, code);

// 1. Remove the notification useEffect that depends on execSummary/vendorReports.
// This is non-critical BI notification logic and can be rebuilt later safely.
const effectPattern = /\n\s*useEffect\(\(\) => \{\s*if \(execSummary\.overdueFollowUps > 0\) \{[\s\S]*?vendorReports\.forEach\(\(v\) => \{[\s\S]*?\}\);\s*\}, \[execSummary, vendorReports\]\);\s*/m;

if (effectPattern.test(code)) {
  code = code.replace(effectPattern, "\n\n  // WhatsApp report notification automation temporarily disabled for runtime stability.\n  // Rebuild this later through a debounced service after all report arrays are initialized.\n\n");
  console.log("Removed WhatsApp reports notification useEffect.");
} else {
  console.warn("Notification useEffect pattern not found. Continuing.");
}

// 2. Move loadData function above the first useEffect if current file has useEffect before loadData.
const firstLoadEffect = `  useEffect(() => {
    loadData();
    setRpns(rpnService.getAll());
    setStaffList(staffService.getAllStaff());
  }, []);

  const loadData = () => {
    const logs = whatsappActivityService.getLogs();
    setRawLogs(Array.isArray(logs) ? logs : []);
  };
`;

const saferLoadBlock = `  const loadData = () => {
    const logs = whatsappActivityService.getLogs();
    setRawLogs(Array.isArray(logs) ? logs : []);
  };

  useEffect(() => {
    loadData();
    setRpns(rpnService.getAll());
    setStaffList(staffService.getAllStaff());
  }, []);
`;

if (code.includes(firstLoadEffect)) {
  code = code.replace(firstLoadEffect, saferLoadBlock);
  console.log("Moved loadData above useEffect.");
} else {
  console.warn("Exact loadData/useEffect block not found. Continuing.");
}

// 3. Add a build marker comment so we know this file changed.
if (!code.includes("WHATSAPP_REPORTS_RUNTIME_STABILITY_PATCH")) {
  code = code.replace(
    "export const WhatsAppPerformanceReports: React.FC = () => {",
    "export const WhatsAppPerformanceReports: React.FC = () => {\n  // WHATSAPP_REPORTS_RUNTIME_STABILITY_PATCH"
  );
}

fs.writeFileSync(file, code);
console.log("WhatsAppPerformanceReports runtime stabilization patch complete.");
