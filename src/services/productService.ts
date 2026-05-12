/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, ProductStatus } from "../types.ts";
import { getStorageAdapter } from "./storageService.ts";
import { asArray } from "../utils/safeData.ts";
import { analyticsService } from "./analyticsService.ts";

const PRODUCTS_KEY = "itred_products";

export const productService = {
  getProducts: async (): Promise<Product[]> => {
    try {
      const data = await getStorageAdapter().getItem<Product[]>(PRODUCTS_KEY);
      return asArray<Product>(data);
    } catch (error) {
      console.warn("Firebase Error: Failed to get products", error);
      return [];
    }
  },

  saveProducts: async (products: Product[]): Promise<void> => {
    await getStorageAdapter().setItem(PRODUCTS_KEY, products);
  },

  getProductById: async (id: string): Promise<Product | undefined> => {
    const products = await productService.getProducts();
    return products.find((p) => p.id === id);
  },

  saveProduct: async (product: Product): Promise<void> => {
    const products = await productService.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    const oldProduct = index >= 0 ? products[index] : null;

    if (index >= 0) {
      products[index] = { ...product, updatedAt: new Date().toISOString() };

      // Check for farm produce specific events
      if (product.isFarmProduce) {
        await analyticsService.logEvent({
          eventType: "FARM_PRODUCE_UPDATED",
          actorType: "rpn",
          actorName: "Field RPN",
          productId: product.id,
          productName: product.name,
          vendorId: product.vendorId,
          details: {
            cropType: product.cropType,
            harvestStatus: product.harvestStatus,
            quantityAvailable: product.quantityAvailable,
          },
        });

        // Check for availability changes
        if (
          oldProduct &&
          oldProduct.availabilityDate !== product.availabilityDate
        ) {
          await analyticsService.logEvent({
            eventType: "FARM_PRODUCE_AVAILABILITY_CHANGED",
            actorType: "rpn",
            actorName: "Field RPN",
            productId: product.id,
            productName: product.name,
            vendorId: product.vendorId,
            details: {
              oldDate: oldProduct.availabilityDate,
              newDate: product.availabilityDate,
              cropType: product.cropType,
            },
          });
        }
      } else {
        await analyticsService.logEvent({
          eventType: "PRODUCT_UPDATED",
          actorType: "rpn",
          actorName: "Field RPN",
          productId: product.id,
          productName: product.name,
          vendorId: product.vendorId,
          details: { fields: ["generic_update"] },
        });
      }

      if (oldProduct && oldProduct.sellingPrice !== product.sellingPrice) {
        await analyticsService.logEvent({
          eventType: "PRODUCT_PRICE_UPDATED",
          actorType: "rpn",
          actorName: "Field RPN",
          productId: product.id,
          productName: product.name,
          vendorId: product.vendorId,
          details: {
            oldPrice: oldProduct.sellingPrice,
            newPrice: product.sellingPrice,
          },
        });
      }

      if (
        oldProduct &&
        oldProduct.imageUrl !== product.imageUrl &&
        product.imageUrl
      ) {
        await analyticsService.logEvent({
          eventType: "PRODUCT_IMAGE_UPLOADED",
          actorType: "rpn",
          actorName: "Field RPN",
          productId: product.id,
          productName: product.name,
          vendorId: product.vendorId,
          details: { imageStatus: "uploaded" },
        });
      }
    } else {
      products.push({
        ...product,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (product.isFarmProduce) {
        await analyticsService.logEvent({
          eventType: "FARM_PRODUCE_CREATED",
          actorType: "rpn",
          actorName: "Field RPN",
          productId: product.id,
          productName: product.name,
          vendorId: product.vendorId,
          details: {
            cropType: product.cropType,
            harvestStatus: product.harvestStatus,
            quantityAvailable: product.quantityAvailable,
          },
        });
      } else {
        await analyticsService.logEvent({
          eventType: "PRODUCT_CREATED",
          actorType: "rpn",
          actorName: "Field RPN",
          productId: product.id,
          productName: product.name,
          vendorId: product.vendorId,
          details: { name: product.name, sku: product.sku },
        });
      }

      if (product.imageUrl) {
        await analyticsService.logEvent({
          eventType: "PRODUCT_IMAGE_UPLOADED",
          actorType: "rpn",
          actorName: "Field RPN",
          productId: product.id,
          productName: product.name,
          vendorId: product.vendorId,
          details: { imageStatus: "initial_upload" },
        });
      }
    }
    await productService.saveProducts(products);
  },

  deleteProduct: async (id: string): Promise<void> => {
    const products = (await productService.getProducts()).filter(
      (p) => p.id !== id,
    );
    await productService.saveProducts(products);
  },

  getProductsByVendor: async (vendorId: string): Promise<Product[]> => {
    const products = await productService.getProducts();
    return products.filter((p) => p.vendorId === vendorId);
  },

  // Bulk Operations
  bulkUpdateSectorCategory: async (
    productIds: string[],
    sector: string,
    category: string,
  ): Promise<void> => {
    const products = await productService.getProducts();
    productIds.forEach((id) => {
      const product = products.find((p) => p.id === id);
      if (product) {
        product.sector = sector;
        product.category = category;
        product.updatedAt = new Date().toISOString();
      }
    });
    await productService.saveProducts(products);
  },

  bulkUpdatePublishStatus: async (
    productIds: string[],
    publish: boolean,
  ): Promise<void> => {
    const products = await productService.getProducts();
    productIds.forEach((id) => {
      const product = products.find((p) => p.id === id);
      if (product) {
        product.publishToCatalogue = publish;
        product.updatedAt = new Date().toISOString();
      }
    });
    await productService.saveProducts(products);
  },

  bulkUpdateStatus: async (
    productIds: string[],
    status: ProductStatus,
  ): Promise<void> => {
    const products = await productService.getProducts();
    productIds.forEach((id) => {
      const product = products.find((p) => p.id === id);
      if (product) {
        product.status = status;
        product.updatedAt = new Date().toISOString();
      }
    });
    await productService.saveProducts(products);
  },
};
