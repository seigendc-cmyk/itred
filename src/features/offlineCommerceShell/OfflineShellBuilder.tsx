import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Database,
  Download,
  FileCheck2,
  PackagePlus,
  Search,
  Square,
  Upload,
} from "lucide-react";
import { CAHLink, Vendor } from "../../types";
import { vendorService } from "../../services/vendorService";
import { cahService } from "../../services/cahService";
import {
  generateOfflineCommercePack,
  serializeOfflineCommercePack,
} from "./offlineShellExporter";
import { buildOfflineCommerceImportValidationReport } from "./dataPackValidator";
import { generateOfflineCommerceShellHtml } from "./offlineShellHtmlGenerator";
import {
  OfflineCommercePack,
  OfflineImageQualityMode,
  OfflineShellImportValidationReport,
  OfflineProductInclusionMode,
  OfflineShellValidationReport,
} from "./types";

const shellCards = [
  {
    title: "Generate shell",
    description: "Prepare the offline storefront shell that will later run from PWA or APK packaging.",
    icon: Database,
  },
  {
    title: "Generate data pack",
    description: "Bundle vendors, products, support details, access links, and legal content into a portable file.",
    icon: PackagePlus,
  },
  {
    title: "Import/update data pack",
    description: "Load a new pack into the offline shell storage without replacing the app shell.",
    icon: Upload,
  },
  {
    title: "Validation report",
    description: "Check pack type, version, vendors, products, expiry, and support readiness before release.",
    icon: FileCheck2,
  },
];

const expiryOptions = [7, 14, 21, 28] as const;
const imageQualityModes: { id: OfflineImageQualityMode; label: string; detail: string }[] = [
  { id: "light", label: "Light", detail: "360px / 0.65 WebP" },
  { id: "standard", label: "Standard", detail: "600px / 0.75 WebP" },
  { id: "high", label: "High", detail: "900px / 0.85 WebP" },
];

const timestampForFileName = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
};

const formatDate = (value: string) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
};

const emptyReport: OfflineShellValidationReport = {
  vendorsIncluded: 0,
  productsIncluded: 0,
  vendorsMissingWhatsapp: [],
  productsMissingImages: [],
  vendorsWithoutOfflineImages: [],
  totalImages: 0,
  dataUriImages: 0,
  remoteUrlImages: 0,
  heavyImageWarnings: [],
  accessHubLinksIncluded: 0,
  estimatedPayloadSizeBytes: 0,
  estimatedPayloadSizeLabel: "0 B",
  errors: [],
  warnings: [],
};

export function OfflineShellBuilder() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accessHubLinks, setAccessHubLinks] = useState<CAHLink[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [selectedAccessHubLinkIds, setSelectedAccessHubLinkIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [productInclusionMode, setProductInclusionMode] =
    useState<OfflineProductInclusionMode>("all_active_published_products");
  const [imageQualityMode, setImageQualityMode] =
    useState<OfflineImageQualityMode>("light");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [expiryDays, setExpiryDays] = useState<(typeof expiryOptions)[number]>(14);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [generatedPack, setGeneratedPack] = useState<OfflineCommercePack | null>(null);
  const [report, setReport] = useState<OfflineShellValidationReport>(emptyReport);
  const [importReport, setImportReport] =
    useState<OfflineShellImportValidationReport | null>(null);
  const [importFileName, setImportFileName] = useState("");

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      vendorService.getActive(),
      Promise.resolve(cahService.getLinks()),
    ])
      .then(([activeVendors, links]) => {
        if (!isMounted) return;
        setVendors(activeVendors);
        setAccessHubLinks(
          links.filter((link) => link.status === "active" && link.showInCatalogue !== false),
        );
        setLoadError("");
      })
      .catch((error) => {
        console.error("Failed to load active vendors for offline shell", error);
        if (isMounted) {
          setLoadError("Active vendors could not be loaded.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredVendors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return vendors;
    return vendors.filter((vendor) =>
      [
        vendor.name,
        vendor.tradingName,
        vendor.vendorCode,
        vendor.systemCode,
        vendor.sector,
        vendor.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [searchTerm, vendors]);

  const selectedVendorSet = useMemo(
    () => new Set(selectedVendorIds),
    [selectedVendorIds],
  );

  const selectedAccessHubLinkSet = useMemo(
    () => new Set(selectedAccessHubLinkIds),
    [selectedAccessHubLinkIds],
  );

  const toggleVendor = (vendorId: string) => {
    setGeneratedPack(null);
    setSelectedVendorIds((current) =>
      current.includes(vendorId)
        ? current.filter((id) => id !== vendorId)
        : [...current, vendorId],
    );
  };

  const selectAllActiveVendors = () => {
    setGeneratedPack(null);
    setSelectedVendorIds(vendors.map((vendor) => vendor.id));
  };

  const clearSelection = () => {
    setGeneratedPack(null);
    setSelectedVendorIds([]);
    setReport(emptyReport);
  };

  const toggleAccessHubLink = (linkId: string) => {
    setGeneratedPack(null);
    setSelectedAccessHubLinkIds((current) =>
      current.includes(linkId)
        ? current.filter((id) => id !== linkId)
        : [...current, linkId],
    );
  };

  const selectAllPublishedAccessHubLinks = () => {
    setGeneratedPack(null);
    setSelectedAccessHubLinkIds(accessHubLinks.map((link) => link.id));
  };

  const clearAccessHubLinks = () => {
    setGeneratedPack(null);
    setSelectedAccessHubLinkIds([]);
  };

  const handleGeneratePack = async () => {
    setIsGenerating(true);
    try {
      const result = await generateOfflineCommercePack({
        vendorIds: selectedVendorIds,
        productInclusionMode,
        inStockOnly,
        expiryDays,
        imageQualityMode,
        accessHubLinkIds: selectedAccessHubLinkIds,
      });
      setGeneratedPack(result.pack);
      setReport(result.report);
    } catch (error) {
      console.error("Failed to generate offline commerce pack", error);
      setGeneratedPack(null);
      setReport({
        ...emptyReport,
        errors: ["Offline commerce pack generation failed."],
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPack = () => {
    if (!generatedPack) return;

    const content = serializeOfflineCommercePack(generatedPack);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `itred-offline-pack-${timestampForFileName()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadShell = () => {
    const content = generateOfflineCommerceShellHtml();
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "itred-offline-commerce-shell.html";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleValidateImport = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setImportFileName(file?.name || "");

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      setImportReport(
        buildOfflineCommerceImportValidationReport(null, [
          "Selected file must be a .json data pack.",
        ]),
      );
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<OfflineCommercePack>;
      setImportReport(buildOfflineCommerceImportValidationReport(parsed));
    } catch (error) {
      console.error("Failed to parse offline commerce data pack", error);
      setImportReport(
        buildOfflineCommerceImportValidationReport(null, [
          "Selected file is not valid JSON.",
        ]),
      );
    }
  };

  return (
    <div className="space-y-8">
      <section className="border-l-4 border-brand-orange bg-stone-50 p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">
          Offline commerce layer
        </p>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-brand-charcoal">
          iTred Offline Commerce Shell
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-stone-600">
          A lightweight foundation for multi-vendor offline storefronts. The shell will stay installed while imported data packs update vendor and product content in local IndexedDB storage.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {shellCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center bg-brand-charcoal text-white">
                <Icon size={18} />
              </div>
              <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
                {card.title}
              </h2>
              <p className="mt-3 text-xs font-medium leading-5 text-stone-500">
                {card.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
                  Vendor selector
                </h2>
                <p className="mt-1 text-xs font-medium text-stone-500">
                  {selectedVendorIds.length} of {vendors.length} active vendors selected
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllActiveVendors}
                  className="bg-brand-charcoal px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-brand-orange"
                >
                  Select all active
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="border border-stone-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:border-brand-orange hover:text-brand-orange"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="border-b border-stone-200 p-5">
              <label className="flex items-center gap-3 border border-stone-200 bg-stone-50 px-3 py-2">
                <Search size={16} className="text-stone-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search vendors"
                  className="w-full bg-transparent text-sm font-medium text-brand-charcoal outline-none placeholder:text-stone-400"
                />
              </label>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-xs font-bold uppercase tracking-widest text-stone-400">
                  Loading active vendors...
                </div>
              ) : loadError ? (
                <div className="p-6 text-xs font-bold uppercase tracking-widest text-red-600">
                  {loadError}
                </div>
              ) : filteredVendors.length === 0 ? (
                <div className="p-6 text-xs font-bold uppercase tracking-widest text-stone-400">
                  No active vendors found.
                </div>
              ) : (
                filteredVendors.map((vendor) => {
                  const isSelected = selectedVendorSet.has(vendor.id);
                  const Icon = isSelected ? CheckSquare : Square;
                  return (
                    <button
                      key={vendor.id}
                      type="button"
                      onClick={() => toggleVendor(vendor.id)}
                      className={`flex w-full items-start gap-3 border-b border-stone-100 p-4 text-left hover:bg-stone-50 ${
                        isSelected ? "bg-orange-50/40" : "bg-white"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={isSelected ? "text-brand-orange" : "text-stone-300"}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black uppercase tracking-tight text-brand-charcoal">
                          {vendor.tradingName || vendor.name}
                        </span>
                        <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-stone-400">
                          {vendor.vendorCode || vendor.systemCode || "No code"} / {vendor.sector || "No sector"} / {vendor.category || "No category"}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
                Product inclusion
              </h2>
              <div className="mt-4 grid gap-3">
                <label className="flex cursor-pointer items-start gap-3 border border-stone-200 p-3 hover:border-brand-orange">
                  <input
                    type="radio"
                    checked={productInclusionMode === "all_active_published_products"}
                    onChange={() =>
                      setProductInclusionMode("all_active_published_products")
                    }
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-xs font-black uppercase tracking-wide text-brand-charcoal">
                      All active published products
                    </span>
                    <span className="mt-1 block text-xs font-medium leading-5 text-stone-500">
                      Include catalogue-published products for the selected active vendors.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 border border-stone-200 p-3 hover:border-brand-orange">
                  <input
                    type="radio"
                    checked={productInclusionMode === "selected_vendors_only"}
                    onChange={() => setProductInclusionMode("selected_vendors_only")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-xs font-black uppercase tracking-wide text-brand-charcoal">
                      Selected vendors only
                    </span>
                    <span className="mt-1 block text-xs font-medium leading-5 text-stone-500">
                      Keep the generated pack scoped to the selected vendor list.
                    </span>
                  </span>
                </label>
                <label className="mt-2 flex cursor-pointer items-center justify-between border border-stone-200 p-3">
                  <span className="text-xs font-black uppercase tracking-wide text-brand-charcoal">
                    In-stock only
                  </span>
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(event) => setInStockOnly(event.target.checked)}
                  />
                </label>
              </div>
            </div>

            <div className="border border-stone-200 bg-white p-5">
              <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
                Expiry
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {expiryOptions.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setExpiryDays(days)}
                    className={`border px-4 py-3 text-xs font-black uppercase tracking-widest ${
                      expiryDays === days
                        ? "border-brand-orange bg-brand-orange text-white"
                        : "border-stone-200 text-stone-600 hover:border-brand-orange hover:text-brand-orange"
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleGeneratePack}
                disabled={isGenerating || selectedVendorIds.length === 0}
                className="mt-6 w-full bg-brand-charcoal px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "Generating..." : "Generate data pack"}
              </button>
              <button
                type="button"
                onClick={handleDownloadPack}
                disabled={!generatedPack}
                className="mt-3 flex w-full items-center justify-center gap-2 border border-stone-200 px-4 py-3 text-xs font-black uppercase tracking-widest text-brand-charcoal hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={15} />
                Download data pack
              </button>
              <button
                type="button"
                onClick={handleDownloadShell}
                className="mt-3 flex w-full items-center justify-center gap-2 bg-brand-charcoal px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-brand-orange"
              >
                <Download size={15} />
                Download offline shell
              </button>
            </div>
          </div>

          <div className="border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
              Image quality mode
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {imageQualityModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setGeneratedPack(null);
                    setImageQualityMode(mode.id);
                  }}
                  className={`border p-3 text-left ${
                    imageQualityMode === mode.id
                      ? "border-brand-orange bg-orange-50"
                      : "border-stone-200 hover:border-brand-orange"
                  }`}
                >
                  <span className="block text-xs font-black uppercase tracking-wide text-brand-charcoal">
                    {mode.label}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-stone-400">
                    {mode.detail}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-stone-500">
              Inline images are converted to WebP where the browser can process them. Remote URLs are kept and flagged because they may not appear offline.
            </p>
          </div>

          <div className="border border-stone-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-stone-200 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
                  Commerce Access Hub links
                </h2>
                <p className="mt-1 text-xs font-medium text-stone-500">
                  {selectedAccessHubLinkIds.length} of {accessHubLinks.length} published links selected
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllPublishedAccessHubLinks}
                  className="bg-brand-charcoal px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-brand-orange"
                >
                  Select all published
                </button>
                <button
                  type="button"
                  onClick={clearAccessHubLinks}
                  className="border border-stone-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:border-brand-orange hover:text-brand-orange"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {accessHubLinks.length === 0 ? (
                <div className="p-6 text-xs font-bold uppercase tracking-widest text-stone-400">
                  No published Commerce Access Hub links found.
                </div>
              ) : (
                accessHubLinks.map((link) => {
                  const isSelected = selectedAccessHubLinkSet.has(link.id);
                  const Icon = isSelected ? CheckSquare : Square;
                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => toggleAccessHubLink(link.id)}
                      className={`flex w-full items-start gap-3 border-b border-stone-100 p-4 text-left hover:bg-stone-50 ${
                        isSelected ? "bg-orange-50/40" : "bg-white"
                      }`}
                    >
                      <Icon
                        size={18}
                        className={isSelected ? "text-brand-orange" : "text-stone-300"}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black uppercase tracking-tight text-brand-charcoal">
                          {link.name}
                        </span>
                        <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-wide text-stone-400">
                          {link.type || "Link"} / {link.sector || "All sectors"} / {link.url || link.whatsappUrl || "No URL"}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
                  Validate data pack
                </h2>
                <p className="mt-1 text-xs font-medium text-stone-500">
                  {importFileName || "No import file selected"}
                </p>
              </div>
              <label className="cursor-pointer border border-stone-200 px-4 py-3 text-xs font-black uppercase tracking-widest text-brand-charcoal hover:border-brand-orange hover:text-brand-orange">
                Choose JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleValidateImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-black uppercase tracking-wide text-brand-charcoal">
              Validation report
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Vendors" value={String(report.vendorsIncluded)} />
              <Metric label="Products" value={String(report.productsIncluded)} />
              <Metric
                label="Estimated payload"
                value={report.estimatedPayloadSizeLabel}
                className="col-span-2"
              />
              <Metric label="Total images" value={String(report.totalImages)} />
              <Metric label="Data URI images" value={String(report.dataUriImages)} />
              <Metric label="Remote URL images" value={String(report.remoteUrlImages)} />
              <Metric label="Access Hub links" value={String(report.accessHubLinksIncluded)} />
              <Metric
                label="Image mode"
                value={imageQualityModes.find((mode) => mode.id === imageQualityMode)?.label || "Light"}
              />
            </div>

            <div className="mt-5 space-y-4">
              <ReportList title="Errors" items={report.errors} tone="error" />
              <ReportList title="Warnings" items={report.warnings} tone="warning" />
              <ReportList
                title="Heavy image warnings"
                items={report.heavyImageWarnings.slice(0, 8)}
                tone="warning"
                suffix={
                  report.heavyImageWarnings.length > 8
                    ? `+${report.heavyImageWarnings.length - 8} more`
                    : ""
                }
              />
              <ReportList
                title="Vendors without offline images"
                items={report.vendorsWithoutOfflineImages.slice(0, 8)}
                tone="warning"
                suffix={
                  report.vendorsWithoutOfflineImages.length > 8
                    ? `+${report.vendorsWithoutOfflineImages.length - 8} more`
                    : ""
                }
              />
              <ReportList
                title="Vendors missing WhatsApp"
                items={report.vendorsMissingWhatsapp}
                tone="warning"
              />
              <ReportList
                title="Products missing images"
                items={report.productsMissingImages.slice(0, 8)}
                tone="neutral"
                suffix={
                  report.productsMissingImages.length > 8
                    ? `+${report.productsMissingImages.length - 8} more`
                    : ""
                }
              />
            </div>

            {generatedPack && (
              <div className="mt-5 border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  Pack object generated
                </p>
                <p className="mt-2 text-xs font-medium leading-5 text-emerald-800">
                  Type {generatedPack.packType}, version {generatedPack.version}, expires{" "}
                  {new Date(generatedPack.expiresAt || "").toLocaleDateString()}.
                </p>
              </div>
            )}
          </div>

          {importReport && (
            <div className="border border-stone-200 bg-white p-5">
              <div
                className={`border p-3 ${
                  importReport.isValid
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    importReport.isValid ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {importReport.isValid ? "Valid data pack" : "Invalid data pack"}
                </p>
                <p className="mt-2 text-sm font-black uppercase tracking-tight text-brand-charcoal">
                  {importReport.title}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Version" value={importReport.version || "Missing"} />
                <Metric label="Pack type" value={importReport.packType || "Missing"} />
                <Metric
                  label="Generated"
                  value={formatDate(importReport.generatedAt)}
                  className="col-span-2"
                />
                <Metric
                  label="Expires"
                  value={formatDate(importReport.expiresAt)}
                  className="col-span-2"
                />
                <Metric label="Vendors" value={String(importReport.vendorCount)} />
                <Metric label="Products" value={String(importReport.productCount)} />
                <Metric label="Images" value={String(importReport.payload.imageCount)} />
                <Metric
                  label="Data URI images"
                  value={String(importReport.payload.dataUriImageCount)}
                />
                <Metric
                  label="Payload"
                  value={`${importReport.payload.sizeLabel} / ${importReport.payload.weight}`}
                  className="col-span-2"
                />
              </div>

              <div className="mt-5 space-y-4">
                <ReportList title="Import errors" items={importReport.errors} tone="error" />
                <ReportList
                  title="Import warnings"
                  items={importReport.warnings}
                  tone="warning"
                />
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`border border-stone-200 p-3 ${className}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-brand-charcoal">
        {value}
      </p>
    </div>
  );
}

function ReportList({
  title,
  items,
  tone,
  suffix = "",
}: {
  title: string;
  items: string[];
  tone: "error" | "warning" | "neutral";
  suffix?: string;
}) {
  const color =
    tone === "error"
      ? "text-red-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-stone-600";

  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-300">
          None
        </p>
      ) : (
        <ul className={`mt-2 space-y-1 text-xs font-medium leading-5 ${color}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {suffix && <li>{suffix}</li>}
        </ul>
      )}
    </div>
  );
}
