export function isProductQuotaBillable(product: any): boolean {
  const status = String(
    product.status ?? product.lifecycleStatus ?? "active",
  ).toLowerCase();
  const visibility = String(product.visibility ?? "public").toLowerCase();

  if (product.deletedAt) return false;

  if (
    [
      "deleted",
      "archived",
      "discontinued",
      "hidden",
      "draft",
      "inactive",
    ].includes(status)
  ) {
    return false;
  }

  if (["hidden", "archived"].includes(visibility)) {
    return false;
  }

  return (
    ["active", "out_of_stock", "low_stock"].includes(status) || status === ""
  );
}

export function getBillableProductsForVendor(
  products: any[],
  vendorId: string,
) {
  return products.filter(
    (p) => p.vendorId === vendorId && isProductQuotaBillable(p),
  );
}

export function getBillableBrandedProductsForVendor(
  products: any[],
  vendorId: string,
) {
  return getBillableProductsForVendor(products, vendorId).filter(
    (product) => product.productMode === "branded_product",
  );
}
