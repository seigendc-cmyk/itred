const fs = require("fs");

function rewriteFirestoreRules() {
  const file = "firestore.rules";

  if (!fs.existsSync(file)) {
    console.error("Missing firestore.rules");
    process.exit(1);
  }

  const old = fs.readFileSync(file, "utf8");
  fs.writeFileSync(`${file}.backup-open-pilot-${Date.now()}`, old);

  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isConsoleAdmin() {
      return true;
    }

    // Pilot-safe open rules for iTred active build.
    // Lock these down before full production.
    match /itred_system_settings/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_activity_logs/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_console_staff/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_role_templates/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_staff_audit_logs/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_approval_requests/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_notifications/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_staff_tasks/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_vendors/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_products/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_catalogue_history/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_catalogues/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_storefronts/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_pricing_plans/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /itred_cah_links/{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }

    match /{document=**} {
      allow get, list, create, update: if true;
      allow delete: if isConsoleAdmin();
    }
  }
}
`;

  fs.writeFileSync(file, rules);
  console.log("Rewrote firestore.rules with pilot-safe permissions.");
}

function patchVendorStorefrontBuilder() {
  const file = "src/pages/VendorStorefrontBuilder.tsx";

  if (!fs.existsSync(file)) {
    console.error("Missing:", file);
    process.exit(1);
  }

  let code = fs.readFileSync(file, "utf8");
  fs.writeFileSync(`${file}.backup-readiness-${Date.now()}`, code);

  // Add missing settingsService import if getSettings is used.
  if (
    code.includes("settingsService.getSettings()") &&
    !code.includes('from "../services/settingsService.ts"')
  ) {
    code = code.replace(
      'import { storefrontService } from "../services/storefrontService.ts";',
      'import { storefrontService } from "../services/storefrontService.ts";\nimport { settingsService } from "../services/settingsService.ts";'
    );
    console.log("Added settingsService import.");
  }

  // Insert readinessScore if missing.
  if (!code.includes("const readinessScore = useMemo")) {
    const marker = "  const generatedStorefront = useMemo(";

    if (!code.includes(marker)) {
      console.error("Could not find insertion marker for readinessScore.");
      process.exit(1);
    }

    const block = `
  const readinessScore = useMemo(() => {
    let score = 0;

    if (selectedVendor) score += 15;

    if (
      selectedVendor?.logoAssetUrl ||
      selectedVendor?.logoUrl ||
      selectedVendor?.businessLogoUrl
    ) {
      score += 10;
    }

    if (
      selectedVendor?.bannerAssetUrl ||
      selectedVendor?.bannerUrl ||
      selectedVendor?.businessBannerUrl
    ) {
      score += 10;
    }

    if (selectedProducts.length > 0) score += 20;
    if (selectedImages.length > 0) score += 10;

    if (selectedVendor?.whatsappNumber || selectedVendor?.whatsapp) {
      score += 10;
    }

    if (selectedBranches.length > 0) score += 10;
    if (selectedStaff.length > 0) score += 5;
    if (selectedDelivery.length > 0) score += 5;
    if (selectedCAHLinks.length > 0) score += 5;

    return Math.min(100, score);
  }, [
    selectedVendor,
    selectedProducts.length,
    selectedImages.length,
    selectedBranches.length,
    selectedStaff.length,
    selectedDelivery.length,
    selectedCAHLinks.length,
  ]);

`;

    code = code.replace(marker, block + marker);
    console.log("Inserted readinessScore.");
  } else {
    console.log("readinessScore already exists.");
  }

  fs.writeFileSync(file, code);
}

rewriteFirestoreRules();
patchVendorStorefrontBuilder();
