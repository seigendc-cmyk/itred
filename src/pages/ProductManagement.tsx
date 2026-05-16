/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Edit3,
  Image as ImageIcon,
  Layers,
  Package,
  PackageSearch,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BrandedAlertModal,
  ConfirmDialog,
  DataPanel,
  EmptyState,
  PrimaryButton,
  SearchInput,
  SecondaryButton,
  StatCard,
  StatusBadge,
  TablePanel,
} from "../components/CommonUI.tsx";
import { MasterProduct, ProductStatus } from "../types.ts";
import { productService } from "../services/productService.ts";
import { permissionService } from "../services/permissionService.ts";
import { staffAuditService } from "../services/staffAuditService.ts";
import { compressImage, formatSize } from "../lib/imageUtils.ts";

const PRODUCT_STATUSES: ProductStatus[] = [
  "active",
  "hidden",
  "discontinued",
  "pending_review",
];

const inputClass =
  "w-full border-2 border-stone-200 bg-white p-3 text-xs font-bold uppercase outline-none focus:border-brand-orange";

const buildSearchableText = (product: Partial<MasterProduct>) =>
  [
    product.productName,
    product.brand,
    product.category,
    product.sector,
    product.description,
    product.barcode,
    product.standardSku,
    ...(product.tags || []),
    ...(product.keywords || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const newMasterProduct = (): MasterProduct => {
  const now = new Date().toISOString();
  return {
    id: `MP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    productName: "",
    brand: "",
    category: "",
    sector: "",
    description: "",
    barcode: "",
    standardSku: "",
    tags: [],
    keywords: [],
    imageUrl: "",
    additionalImages: [],
    unit: "Each",
    searchableText: "",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
};

export const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [editingProduct, setEditingProduct] =
    useState<MasterProduct | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Array<{ product: MasterProduct; score: number }>
  >([]);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: "success" | "error" | "warning" | "info";
  }>({ isOpen: false, title: "seiGEN Commerce", message: "", type: "success" });

  const showAlert = (message: string, type: "success" | "error" | "warning" | "info" = "success") =>
    setAlertConfig({ isOpen: true, title: "seiGEN Commerce", message, type });

  const loadData = async () => {
    await productService.migrateLegacyProducts();
    setProducts(await productService.getMasterProducts());
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!editingProduct?.productName && !editingProduct?.barcode) {
      setDuplicates([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void productService
        .findDuplicateMasterProducts(editingProduct)
        .then(setDuplicates);
    }, 150);
    return () => window.clearTimeout(handle);
  }, [
    editingProduct?.id,
    editingProduct?.productName,
    editingProduct?.barcode,
    editingProduct?.brand,
    editingProduct?.category,
  ]);

  const sectors = useMemo(
    () => Array.from(new Set(products.map((p) => p.sector).filter(Boolean))),
    [products],
  );
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    [products],
  );
  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const terms = search.toLowerCase().split(" ").filter(Boolean);
    return products.filter((product) => {
      const matchesSearch = terms.every((term) =>
        product.searchableText.includes(term),
      );
      const matchesSector =
        sectorFilter === "all" || product.sector === sectorFilter;
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;
      const matchesBrand =
        brandFilter === "all" || product.brand === brandFilter;
      return matchesSearch && matchesSector && matchesCategory && matchesBrand;
    });
  }, [products, search, sectorFilter, categoryFilter, brandFilter]);

  const stats = useMemo(
    () => ({
      total: products.length,
      active: products.filter((p) => p.status === "active").length,
      missingImage: products.filter((p) => !p.imageUrl).length,
      duplicateWatch: duplicates.length,
    }),
    [products, duplicates.length],
  );

  const updateEditing = (patch: Partial<MasterProduct>) => {
    setEditingProduct((prev) =>
      prev
        ? {
            ...prev,
            ...patch,
            searchableText: buildSearchableText({ ...prev, ...patch }),
          }
        : prev,
    );
  };

  const handleAdd = () => setEditingProduct(newMasterProduct());
  const handleEdit = (product: MasterProduct) => setEditingProduct(product);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressImage(file, 720, 0.7);
      updateEditing({ imageUrl: result.base64 });
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Image processing failed.",
        "error",
      );
    }
  };

  const handleSave = async () => {
    if (!editingProduct) return;
    if (!editingProduct.productName || !editingProduct.category || !editingProduct.sector) {
      showAlert("Product name, category and sector are required.", "error");
      return;
    }
    if (
      duplicates.some((d) => d.score >= 90) &&
      !permissionService.canApprove("product")
    ) {
      showAlert("Possible existing product detected. Link vendors to the existing master product or ask a manager to approve a new one.", "warning");
      return;
    }

    const isNew = !products.some((p) => p.id === editingProduct.id);
    const productToSave: MasterProduct = {
      ...editingProduct,
      tags: editingProduct.tags || [],
      keywords: editingProduct.keywords || [],
      searchableText: buildSearchableText(editingProduct),
      updatedAt: new Date().toISOString(),
    };
    await productService.saveMasterProduct(productToSave);
    void staffAuditService.logAction({
      eventType: isNew ? "RECORD_CREATED" : "RECORD_UPDATED",
      module: "product",
      severity: "info",
      action: `${isNew ? "Created" : "Updated"} master product ${productToSave.productName}`,
      recordType: "master_product",
      recordId: productToSave.id,
      recordName: productToSave.productName,
      afterSnapshot: productToSave,
    });
    await loadData();
    setEditingProduct(null);
    showAlert("Master product saved.");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const product = products.find((p) => p.id === deleteId);
    await productService.deleteMasterProduct(deleteId);
    void staffAuditService.logAction({
      eventType: "RECORD_DELETED",
      module: "product",
      severity: "high",
      action: `Deleted master product ${product?.productName || deleteId}`,
      recordType: "master_product",
      recordId: deleteId,
      beforeSnapshot: product,
    });
    setDeleteId(null);
    await loadData();
    showAlert("Master product deleted.", "success");
  };

  const renderEditor = () => {
    if (!editingProduct) return null;
    return (
      <div className="fixed inset-0 z-50 bg-brand-charcoal/70 p-4 flex items-center justify-center">
        <DataPanel
          title="Master Product Record"
          subtitle="Global reusable product identity. Vendor price and stock live in Vendor Product Offers."
          className="w-full max-w-5xl max-h-[92vh] bg-white border-t-4 border-t-brand-orange shadow-2xl"
        >
          <div className="p-6 space-y-6 overflow-y-auto">
            {duplicates.length > 0 && (
              <div className="border-2 border-orange-200 bg-orange-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle size={18} className="text-brand-orange shrink-0" />
                  <div>
                    <p className="text-xs font-black uppercase text-brand-charcoal">
                      Possible existing product detected.
                    </p>
                    <p className="text-[10px] font-bold uppercase text-stone-500">
                      Avoid duplicates. Reuse the existing master product when appropriate.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {duplicates.map((match) => (
                    <button
                      key={match.product.id}
                      onClick={() => setEditingProduct(match.product)}
                      className="text-left bg-white border border-orange-200 p-3 hover:border-brand-orange"
                    >
                      <p className="text-xs font-black uppercase text-brand-charcoal">
                        {match.product.productName}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-stone-400">
                        {match.product.brand || "No brand"} / {match.product.category} / {match.score}% match
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Product Name *
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.productName}
                  onChange={(e) => updateEditing({ productName: e.target.value })}
                  placeholder="Nivea Cocoa Butter Body Cream"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Brand
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.brand || ""}
                  onChange={(e) => updateEditing({ brand: e.target.value })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Barcode
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.barcode || ""}
                  onChange={(e) => updateEditing({ barcode: e.target.value })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Sector *
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.sector || ""}
                  onChange={(e) => updateEditing({ sector: e.target.value })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Category *
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.category || ""}
                  onChange={(e) => updateEditing({ category: e.target.value })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Standard SKU
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.standardSku || ""}
                  onChange={(e) => updateEditing({ standardSku: e.target.value })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Unit
                </span>
                <input
                  className={inputClass}
                  value={editingProduct.unit || ""}
                  onChange={(e) => updateEditing({ unit: e.target.value })}
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Tags
                </span>
                <input
                  className={inputClass}
                  value={(editingProduct.tags || []).join(", ")}
                  onChange={(e) =>
                    updateEditing({
                      tags: e.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="body lotion, skin care"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Keywords
                </span>
                <input
                  className={inputClass}
                  value={(editingProduct.keywords || []).join(", ")}
                  onChange={(e) =>
                    updateEditing({
                      keywords: e.target.value
                        .split(",")
                        .map((keyword) => keyword.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="nivea cream, cocoa butter"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Description
                </span>
                <textarea
                  rows={4}
                  className={`${inputClass} normal-case`}
                  value={editingProduct.description || ""}
                  onChange={(e) => updateEditing({ description: e.target.value })}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-2 border-dashed border-stone-200 p-8 text-center relative">
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleImageUpload}
                />
                <Upload size={28} className="mx-auto text-stone-300 mb-3" />
                <p className="text-[10px] font-black uppercase text-stone-400">
                  Upload Master Product Image
                </p>
              </div>
              <div className="border border-stone-200 p-4">
                {editingProduct.imageUrl ? (
                  <>
                    <img
                      src={editingProduct.imageUrl}
                      alt="Master product"
                      className="h-44 w-full object-contain bg-stone-50"
                    />
                    <p className="mt-2 text-[10px] font-bold uppercase text-stone-400">
                      Image embedded for catalogue fallback
                    </p>
                  </>
                ) : (
                  <div className="h-44 flex items-center justify-center bg-stone-50 text-stone-300">
                    <ImageIcon size={36} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PRODUCT_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => updateEditing({ status })}
                  className={`border-2 p-3 text-[10px] font-black uppercase ${
                    editingProduct.status === status
                      ? "border-brand-charcoal bg-brand-charcoal text-white"
                      : "border-stone-200 bg-white text-stone-400"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5 bg-stone-50 border-t border-stone-200 flex gap-3">
            <SecondaryButton className="flex-1" onClick={() => setEditingProduct(null)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton className="flex-1" onClick={handleSave}>
              <Save size={14} className="mr-2" /> Save Master Product
            </PrimaryButton>
          </div>
        </DataPanel>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      <BrandedAlertModal
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Master Product"
        message="This removes the master product record. Existing vendor offers for this product will no longer join correctly."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Master Products" value={stats.total} icon={Package} />
        <StatCard label="Active" value={stats.active} icon={Layers} variant="success" />
        <StatCard
          label="Missing Images"
          value={stats.missingImage}
          icon={ImageIcon}
          variant={stats.missingImage > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Duplicate Watch"
          value={stats.duplicateWatch}
          icon={AlertTriangle}
          variant={stats.duplicateWatch > 0 ? "error" : "neutral"}
        />
      </div>

      <DataPanel
        title="Master Product Library"
        subtitle="Create products once globally. Vendors attach price, stock and location through product offers."
        actions={
          permissionService.canCreate("productManagement") && (
            <PrimaryButton onClick={handleAdd}>
              <Plus size={14} className="mr-2" /> New Master Product
            </PrimaryButton>
          )
        }
      >
        <div className="p-5 border-b border-stone-200 grid grid-cols-1 md:grid-cols-5 gap-3 bg-stone-50">
          <SearchInput
            className="md:col-span-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, brand, barcode, keywords..."
          />
          <select className={inputClass} value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
            <option value="all">All sectors</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
          <select className={inputClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select className={inputClass} value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="all">All brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>
        <TablePanel
          title="Product Identity Registry"
          headers={["Image", "Product", "Brand", "Category", "Sector", "Barcode / SKU", "Status", "Actions"]}
        >
          {filteredProducts.map((product) => (
            <tr key={product.id} className="hover:bg-stone-50">
              <td className="px-6 py-4">
                <div className="h-12 w-12 border border-stone-200 bg-stone-50 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <PackageSearch size={18} className="text-stone-300" />
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <p className="text-xs font-black uppercase text-brand-charcoal">{product.productName}</p>
                <p className="text-[10px] font-bold uppercase text-stone-400">{product.tags?.slice(0, 3).join(", ") || "No tags"}</p>
              </td>
              <td className="px-6 py-4 text-xs font-bold uppercase">{product.brand || "-"}</td>
              <td className="px-6 py-4 text-xs font-bold uppercase">{product.category || "-"}</td>
              <td className="px-6 py-4 text-xs font-bold uppercase">{product.sector || "-"}</td>
              <td className="px-6 py-4 text-[10px] font-mono text-stone-500">
                <p>{product.barcode || "No barcode"}</p>
                <p>{product.standardSku || "No SKU"}</p>
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={product.status} variant={product.status === "active" ? "success" : "neutral"} />
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  <SecondaryButton size="sm" onClick={() => handleEdit(product)}>
                    <Edit3 size={12} className="mr-1" /> Edit
                  </SecondaryButton>
                  {permissionService.canDelete("productManagement") && (
                    <button
                      className="p-2 border border-stone-200 text-stone-400 hover:border-red-500 hover:text-red-600"
                      onClick={() => setDeleteId(product.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {filteredProducts.length === 0 && (
            <tr>
              <td colSpan={8} className="p-10">
                <EmptyState
                  icon={Search}
                  title="No Master Products Found"
                  description="Create the first reusable product or adjust your filters."
                />
              </td>
            </tr>
          )}
        </TablePanel>
      </DataPanel>

      <DataPanel title="Architecture Note" className="border-t-4 border-t-brand-orange">
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-stone-200 p-4">
            <Package size={18} className="text-brand-orange mb-2" />
            <p className="text-xs font-black uppercase">Master Product</p>
            <p className="text-[10px] font-bold text-stone-500 mt-1">
              Identity, brand, category, images, barcode and search metadata.
            </p>
          </div>
          <div className="border border-stone-200 p-4">
            <Tag size={18} className="text-brand-orange mb-2" />
            <p className="text-xs font-black uppercase">Vendor Offer</p>
            <p className="text-[10px] font-bold text-stone-500 mt-1">
              Price, stock, branch, publish status, delivery and vendor notes.
            </p>
          </div>
          <div className="border border-stone-200 p-4">
            <Archive size={18} className="text-brand-orange mb-2" />
            <p className="text-xs font-black uppercase">Migration Safe</p>
            <p className="text-[10px] font-bold text-stone-500 mt-1">
              Old vendor-bound products are converted into one master plus many offers.
            </p>
          </div>
        </div>
      </DataPanel>

      {renderEditor()}
    </div>
  );
};
