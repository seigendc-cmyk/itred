/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  PageHeader,
  DataPanel,
  TablePanel,
  ConfirmDialog,
  FormSection,
  FormField,
} from "../components/CommonUI.tsx";
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Users,
  ChevronRight,
  DollarSign,
  UserPlus,
} from "lucide-react";
import { pricingPlanService } from "../services/pricingPlanService.ts";
import { vendorService } from "../services/vendorService.ts";
import { productService } from "../services/productService.ts";
import { permissionService } from "../services/permissionService.ts";
import { analyticsService } from "../services/analyticsService.ts";
import { PricingPlan, Vendor, Product } from "../types.ts";
import { asArray } from "../utils/safeData.ts";
import { staffAuditService } from "../services/staffAuditService.ts";

export const PricingPlans: React.FC = () => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<PricingPlan> | null>(
    null,
  );

  const [viewMode, setViewMode] = useState<
    "cards" | "comparison" | "itred_vendors"
  >("cards");

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [vendorToAssign, setVendorToAssign] = useState<Vendor | null>(null);
  const [targetPlanId, setTargetPlanId] = useState<string>("");

  const [newFeature, setNewFeature] = useState("");

  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const safePlans = asArray<PricingPlan>(plans);
  const safeVendors = asArray<Vendor>(vendors);
  const safeProducts = asArray<Product>(products);

  const underlineInputClass =
    "w-full bg-stone-50 border-0 border-b-2 border-stone-300 focus:border-brand-orange focus:ring-0 outline-none rounded-none px-4 py-3 text-sm font-bold text-brand-charcoal transition-colors";

  const loadData = async () => {
    try {
      const [rawPlans, rawVendors, rawProducts] = await Promise.all([
        pricingPlanService.getPlans(),
        vendorService.getVendors(),
        productService.getProducts(),
      ]);

      setPlans(asArray<PricingPlan>(rawPlans));
      setVendors(asArray<Vendor>(rawVendors));
      setProducts(asArray<Product>(rawProducts));
    } catch (error) {
      console.warn(
        "Pricing Plans data failed to load. Using empty arrays.",
        error,
      );
      setPlans([]);
      setVendors([]);
      setProducts([]);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const vendorsByPlan = useMemo(() => {
    const map: Record<string, Vendor[]> = {};

    safeVendors.forEach((vendor) => {
      const planId = vendor.planId || "unassigned";

      if (!map[planId]) {
        map[planId] = [];
      }

      map[planId].push(vendor);
    });

    return map;
  }, [safeVendors]);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingPlan?.name) {
      alert("Plan name is required.");
      return;
    }

    setIsSavingPlan(true);

    try {
      const oldPlan = safePlans.find((p) => p.id === editingPlan.id);
      const planToSave = {
        ...editingPlan,
        id: editingPlan.id || `plan-${Date.now()}`,
        status: editingPlan.status || "active",
        monthlyPrice: Number(editingPlan.monthlyPrice) || 0,
        currency: editingPlan.currency || "USD",
        maxProducts: Number(editingPlan.maxProducts) || 0,
        maxVendorsPerCatalogue: Number(editingPlan.maxVendorsPerCatalogue) || 1,
        maxImagesPerCatalogue: Number(editingPlan.maxImagesPerCatalogue) || 0,
        deploymentFrequency: editingPlan.deploymentFrequency || "monthly",
        maxDeploymentsPerMonth: Number(editingPlan.maxDeploymentsPerMonth) || 0,
        maxCahLinks: Number(editingPlan.maxCahLinks) || 0,
        maxBranchesPerVendor: Number(editingPlan.maxBranchesPerVendor) || 1,
        maxStaffPerVendor: Number(editingPlan.maxStaffPerVendor) || 1,
        maxDeliveryContactsPerVendor:
          Number(editingPlan.maxDeliveryContactsPerVendor) || 1,
        isWhatsAppProductButtonEnabled:
          !!editingPlan.isWhatsAppProductButtonEnabled,
        isDirectCallProductButtonEnabled:
          !!editingPlan.isDirectCallProductButtonEnabled,
        isVendorWhatsAppGroupLinkEnabled:
          !!editingPlan.isVendorWhatsAppGroupLinkEnabled,
        isVendorWhatsAppChannelLinkEnabled:
          !!editingPlan.isVendorWhatsAppChannelLinkEnabled,
        isInventorySpotCheckIncluded:
          !!editingPlan.isInventorySpotCheckIncluded,
        inventorySpotChecksPerMonth:
          Number(editingPlan.inventorySpotChecksPerMonth) || 0,
        biAnalyticsLevel: editingPlan.biAnalyticsLevel || "none",
        rpnSupportLevel: editingPlan.rpnSupportLevel || "none",
        isCollectionReminderEnabled: !!editingPlan.isCollectionReminderEnabled,
        isHostedCatalogueSupportEnabled:
          !!editingPlan.isHostedCatalogueSupportEnabled,
        isVendorStorefrontBuilderEnabled:
          !!editingPlan.isVendorStorefrontBuilderEnabled,
        maxStorefrontImages: Number(editingPlan.maxStorefrontImages) || 0,
        maxStorefrontDeploymentsPerMonth:
          Number(editingPlan.maxStorefrontDeploymentsPerMonth) || 0,
        features: asArray<string>(editingPlan.features),
        createdBy: editingPlan.createdBy || "Admin",
        updatedBy: "Admin",
        createdAt: editingPlan.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as PricingPlan;

      await pricingPlanService.savePlan(planToSave);

      analyticsService.logEvent({
        eventType: editingPlan.id ? "PLAN_UPDATED" : "PLAN_CREATED",
        actorType: "admin",
        actorName: "System Admin",
        details: {
          planId: planToSave.id,
          name: planToSave.name,
          price: planToSave.monthlyPrice,
        },
      });

      // Non-blocking staff audit logging
      try {
        if (oldPlan) {
          void staffAuditService.logUpdate(
            "pricing",
            "pricing_plan",
            planToSave.id,
            planToSave.name,
            oldPlan,
            planToSave,
          );
          if (oldPlan.monthlyPrice !== planToSave.monthlyPrice) {
            void staffAuditService.logAction({
              eventType: "PRICE_CHANGED",
              module: "pricing",
              action: `Plan price changed for ${planToSave.name}`,
              severity: "critical",
              recordType: "pricing_plan",
              recordId: planToSave.id,
              recordName: planToSave.name,
            });
          }
        } else {
          void staffAuditService.logCreate(
            "pricing",
            "pricing_plan",
            planToSave.id,
            planToSave.name,
            planToSave,
          );
        }
      } catch (auditErr) {
        console.error("Audit log failed", auditErr);
      }

      await loadData();
      setIsFormOpen(false);
      setEditingPlan(null);
      alert("Saved successfully");
    } catch (error: any) {
      console.error("Pricing plan save failed", error);
      alert(
        error.message ||
          "Pricing plan was not saved. Check Firebase permissions or network.",
      );
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if ((vendorsByPlan[id] || []).length > 0) {
      alert(
        "Cannot delete plan with active subscribers. Reassign vendors first.",
      );
      return;
    }

    if (!confirm("Are you sure you want to delete this pricing plan?")) {
      return;
    }

    try {
      const plan = safePlans.find((p) => p.id === id);

      await pricingPlanService.deletePlan(id);

      analyticsService.logEvent({
        eventType: "PLAN_UPDATED",
        actorType: "admin",
        actorName: "System Admin",
        details: {
          action: "deleted",
          planId: id,
          name: plan?.name,
        },
      });

      await loadData();
      alert("Deleted successfully");

      // Non-blocking staff audit logging
      try {
        void staffAuditService.logDelete(
          "pricing",
          "pricing_plan",
          id,
          plan?.name || "Unknown",
        );
      } catch (e) {
        console.error("Audit log failed", e);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Delete failed");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const plan = safePlans.find((p) => p.id === id);

      await pricingPlanService.updateStatus(id, newStatus as any);

      analyticsService.logEvent({
        eventType: "PLAN_UPDATED",
        actorType: "admin",
        actorName: "System Admin",
        details: {
          planId: id,
          name: plan?.name,
          status: newStatus,
        },
      });

      await loadData();
      alert("Saved successfully");

      // Non-blocking staff audit logging
      try {
        void staffAuditService.logAction({
          eventType: "RECORD_UPDATED",
          module: "pricing",
          action: `Plan status changed to ${newStatus} for ${plan?.name}`,
          severity: "critical",
          recordType: "pricing_plan",
          recordId: id,
          recordName: plan?.name,
        });
      } catch (e) {
        console.error("Audit log failed", e);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Save failed");
    }
  };

  const handleAssignPlan = async () => {
    if (!vendorToAssign || !targetPlanId) return;

    try {
      const updatedVendor = {
        ...vendorToAssign,
        planId: targetPlanId,
        updatedAt: new Date().toISOString(),
        updatedBy: "Admin",
      };

      await vendorService.updateVendor(updatedVendor);

      analyticsService.logEvent({
        eventType: "PLAN_ASSIGNED_TO_VENDOR",
        actorType: "admin",
        actorName: "System Admin",
        vendorId: vendorToAssign.id,
        vendorName: vendorToAssign.name,
        details: { planId: targetPlanId },
      });

      await loadData();
      setIsAssignModalOpen(false);
      setVendorToAssign(null);
      setTargetPlanId("");
      alert("Saved successfully");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Save failed");
    }
  };

  const getUsage = (vendorId: string) => {
    const vendorProducts = safeProducts.filter((p) => p.vendorId === vendorId);
    const vendor = safeVendors.find((v) => v.id === vendorId);
    const branches = asArray((vendor as any)?.branches).length;
    const staff = asArray((vendor as any)?.staff).length;

    return {
      products: vendorProducts.length,
      images: vendorProducts.filter((p) => p.imageUrl).length,
      branches,
      staff,
    };
  };

  const checkLimits = (vendor: Vendor, plan: PricingPlan) => {
    const usage = getUsage(vendor.id);
    const issues: string[] = [];

    if (usage.products > Number(plan.maxProducts || 0)) {
      issues.push(`Products: ${usage.products}/${plan.maxProducts}`);
    }

    if (usage.branches > Number(plan.maxBranchesPerVendor || 0)) {
      issues.push(`Branches: ${usage.branches}/${plan.maxBranchesPerVendor}`);
    }

    if (usage.staff > Number(plan.maxStaffPerVendor || 0)) {
      issues.push(`Staff: ${usage.staff}/${plan.maxStaffPerVendor}`);
    }

    return issues;
  };

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;

    setEditingPlan((prev) => ({
      ...prev,
      features: [...asArray<string>(prev?.features), newFeature.trim()],
    }));

    setNewFeature("");
  };

  const removeFeature = (idx: number) => {
    setEditingPlan((prev) => ({
      ...prev,
      features: asArray<string>(prev?.features).filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="pb-20" id="pricing-header" tabIndex={-1}>
      <div className="flex justify-between items-center mb-8">
        <PageHeader
          title="Pricing"
          subtitle="Manage vendor tiers and resource limits."
        />

        {permissionService.canEdit("pricing") && (
          <div className="flex gap-4">
            <div className="flex bg-stone-100 p-1 rounded">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === "cards" ? "bg-white shadow-sm" : "text-stone-400"
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode("comparison")}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === "comparison"
                    ? "bg-white shadow-sm"
                    : "text-stone-400"
                }`}
              >
                Plan Matrix
              </button>
              <button
                onClick={() => setViewMode("itred_vendors")}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewMode === "itred_vendors"
                    ? "bg-white shadow-sm"
                    : "text-stone-400"
                }`}
              >
                Vendors
              </button>
            </div>

            <button
              onClick={() => {
                setEditingPlan({});
                setIsFormOpen(true);
              }}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> New Plan
            </button>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-brand-charcoal/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-2xl border-4 border-brand-charcoal">
            <div className="p-8 border-b border-stone-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-sm uppercase font-bold tracking-[0.4em]">
                {editingPlan?.id
                  ? "Edit Plan Definition"
                  : "Draft New Pricing Tier"}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-stone-400 hover:text-brand-charcoal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-10 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <FormSection title="General Information">
                  <FormField label="Plan Name" required>
                    <input
                      type="text"
                      value={editingPlan?.name || ""}
                      onChange={(e) =>
                        setEditingPlan({ ...editingPlan, name: e.target.value })
                      }
                      className={underlineInputClass}
                      placeholder="e.g. Enterprise Plus"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-6">
                    <FormField label="Price">
                      <div className="relative">
                        <DollarSign
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                        />
                        <input
                          type="number"
                          value={editingPlan?.monthlyPrice ?? ""}
                          onChange={(e) =>
                            setEditingPlan({
                              ...editingPlan,
                              monthlyPrice: Number(e.target.value),
                            })
                          }
                          className={`${underlineInputClass} pl-10`}
                        />
                      </div>
                    </FormField>

                    <FormField label="Currency">
                      <select
                        value={editingPlan?.currency || "USD"}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            currency: e.target.value,
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value="USD">USD</option>
                        <option value="ZAR">ZAR</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Trial Period (Days)">
                    <input
                      type="number"
                      value={editingPlan?.trialDays ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          trialDays: Number(e.target.value),
                        })
                      }
                      className={underlineInputClass}
                    />
                  </FormField>
                </FormSection>

                <FormSection title="Storefront Features">
                  <div className="grid grid-cols-2 gap-6">
                    <FormField label="Max Products">
                      <input
                        type="number"
                        value={editingPlan?.maxProducts ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxProducts: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label="Max Images / Cat">
                      <input
                        type="number"
                        value={editingPlan?.maxImagesPerCatalogue ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxImagesPerCatalogue: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label="Vendors / Cat">
                      <input
                        type="number"
                        value={editingPlan?.maxVendorsPerCatalogue ?? 1}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxVendorsPerCatalogue: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label="Storefront Images">
                      <input
                        type="number"
                        value={editingPlan?.maxStorefrontImages ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxStorefrontImages: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label="Gens / Month">
                      <input
                        type="number"
                        value={editingPlan?.maxDeploymentsPerMonth ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxDeploymentsPerMonth: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label="Expiry Period (Days)">
                      <input
                        type="number"
                        value={editingPlan?.storefrontExpiryPeriodDays ?? ""}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            storefrontExpiryPeriodDays: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>
                </FormSection>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <FormSection title="Staff & Branches">
                  <div className="grid grid-cols-3 gap-6">
                    <FormField label="Branches">
                      <input
                        type="number"
                        value={editingPlan?.maxBranchesPerVendor ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxBranchesPerVendor: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label="Staff">
                      <input
                        type="number"
                        value={editingPlan?.maxStaffPerVendor ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxStaffPerVendor: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>

                    <FormField label="Drivers">
                      <input
                        type="number"
                        value={editingPlan?.maxDeliveryContactsPerVendor ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxDeliveryContactsPerVendor: Number(
                              e.target.value,
                            ),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>

                  <FormField label="Max CAH Links">
                    <input
                      type="number"
                      value={editingPlan?.maxCahLinks ?? 0}
                      onChange={(e) =>
                        setEditingPlan({
                          ...editingPlan,
                          maxCahLinks: Number(e.target.value),
                        })
                      }
                      className={underlineInputClass}
                    />
                  </FormField>
                </FormSection>

                <FormSection title="Update Frequency">
                  <div className="grid grid-cols-2 gap-6">
                    <FormField label="Frequency">
                      <select
                        value={editingPlan?.deploymentFrequency || "monthly"}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            deploymentFrequency: e.target.value as any,
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="bi-weekly">Bi-Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </FormField>

                    <FormField label="Max Deployments / Mo">
                      <input
                        type="number"
                        value={editingPlan?.maxDeploymentsPerMonth ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            maxDeploymentsPerMonth: Number(e.target.value),
                          })
                        }
                        className={underlineInputClass}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title="Support & Analytics">
                  <div className="grid grid-cols-2 gap-6">
                    <FormField label="BI Analytics Level">
                      <select
                        value={editingPlan?.biAnalyticsLevel || "none"}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            biAnalyticsLevel: e.target.value as any,
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value="none">None</option>
                        <option value="basic">Basic</option>
                        <option value="standard">Standard</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </FormField>

                    <FormField label="RPN Support Level">
                      <select
                        value={editingPlan?.rpnSupportLevel || "none"}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            rpnSupportLevel: e.target.value as any,
                          })
                        }
                        className={underlineInputClass}
                      >
                        <option value="none">None</option>
                        <option value="basic">Basic</option>
                        <option value="standard">Standard</option>
                        <option value="priority">Priority</option>
                      </select>
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title="Inventory Control">
                  <div className="grid grid-cols-2 gap-6">
                    <FeatureToggle
                      label="Spot Checks Included"
                      active={!!editingPlan?.isInventorySpotCheckIncluded}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isInventorySpotCheckIncluded:
                            !editingPlan?.isInventorySpotCheckIncluded,
                        })
                      }
                    />

                    <FormField label="Checks / Month">
                      <input
                        type="number"
                        disabled={!editingPlan?.isInventorySpotCheckIncluded}
                        value={editingPlan?.inventorySpotChecksPerMonth ?? 0}
                        onChange={(e) =>
                          setEditingPlan({
                            ...editingPlan,
                            inventorySpotChecksPerMonth: Number(e.target.value),
                          })
                        }
                        className={`${underlineInputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                      />
                    </FormField>
                  </div>
                </FormSection>

                <FormSection title="Storefront Customization">
                  <div className="grid grid-cols-2 gap-6">
                    <FeatureToggle
                      label="WhatsApp Product Button"
                      active={!!editingPlan?.isWhatsAppProductButtonEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isWhatsAppProductButtonEnabled:
                            !editingPlan?.isWhatsAppProductButtonEnabled,
                        })
                      }
                    />

                    <FeatureToggle
                      label="Direct Call Button"
                      active={!!editingPlan?.isDirectCallProductButtonEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isDirectCallProductButtonEnabled:
                            !editingPlan?.isDirectCallProductButtonEnabled,
                        })
                      }
                    />

                    <FeatureToggle
                      label="WA Group Links"
                      active={!!editingPlan?.isVendorWhatsAppGroupLinkEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorWhatsAppGroupLinkEnabled:
                            !editingPlan?.isVendorWhatsAppGroupLinkEnabled,
                        })
                      }
                    />

                    <FeatureToggle
                      label="WA Channel Links"
                      active={!!editingPlan?.isVendorWhatsAppChannelLinkEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorWhatsAppChannelLinkEnabled:
                            !editingPlan?.isVendorWhatsAppChannelLinkEnabled,
                        })
                      }
                    />

                    <FeatureToggle
                      label="Vendor Storefront Builder"
                      active={!!editingPlan?.isVendorStorefrontBuilderEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontBuilderEnabled:
                            !editingPlan?.isVendorStorefrontBuilderEnabled,
                        })
                      }
                    />

                    <FeatureToggle
                      label="Banner/Logo Supported"
                      active={!!editingPlan?.isVendorStorefrontBannerSupported}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontBannerSupported:
                            !editingPlan?.isVendorStorefrontBannerSupported,
                        })
                      }
                    />

                    <FeatureToggle
                      label="Product Search Enabled"
                      active={!!editingPlan?.isVendorStorefrontSearchSupported}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontSearchSupported:
                            !editingPlan?.isVendorStorefrontSearchSupported,
                        })
                      }
                    />

                    <FeatureToggle
                      label="Access Hub Links"
                      active={
                        !!editingPlan?.isVendorStorefrontCahLinksSupported
                      }
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isVendorStorefrontCahLinksSupported:
                            !editingPlan?.isVendorStorefrontCahLinksSupported,
                        })
                      }
                    />
                  </div>
                </FormSection>

                <FormSection title="Backend Ops">
                  <div className="grid grid-cols-2 gap-6">
                    <FeatureToggle
                      label="Collection Reminders"
                      active={!!editingPlan?.isCollectionReminderEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isCollectionReminderEnabled:
                            !editingPlan?.isCollectionReminderEnabled,
                        })
                      }
                    />

                    <FeatureToggle
                      label="Hosted Support"
                      active={!!editingPlan?.isHostedCatalogueSupportEnabled}
                      onClick={() =>
                        setEditingPlan({
                          ...editingPlan,
                          isHostedCatalogueSupportEnabled:
                            !editingPlan?.isHostedCatalogueSupportEnabled,
                        })
                      }
                    />
                  </div>
                </FormSection>
              </div>

              <FormSection title="Custom Marketing Features">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFeature}
                      onChange={(e) => setNewFeature(e.target.value)}
                      className={`${underlineInputClass} flex-1`}
                      placeholder="Add custom feature..."
                    />
                    <button
                      type="button"
                      onClick={handleAddFeature}
                      className="bg-brand-charcoal text-white px-6 py-3 text-xs font-bold uppercase transition-colors hover:bg-brand-orange"
                    >
                      Add
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {asArray<string>(editingPlan?.features).map(
                      (feature, i) => (
                        <div
                          key={`${feature}-${i}`}
                          className="flex items-center justify-between p-3 border border-stone-100 bg-stone-50"
                        >
                          <span className="text-[10px] font-bold uppercase">
                            {feature}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFeature(i)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </FormSection>

              <div className="pt-10 flex gap-4">
                <button
                  type="submit"
                  className="flex-1 btn btn-primary py-5 text-sm"
                  disabled={isSavingPlan}
                >
                  {isSavingPlan ? "Saving..." : "Save Pricing Plan"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-10 py-5 text-xs font-bold uppercase tracking-widest bg-stone-100 hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {safePlans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col border-2 ${
                plan.status === "active"
                  ? "border-brand-charcoal bg-white"
                  : "border-stone-200 opacity-60 bg-stone-50"
              }`}
            >
              <div className="p-8 border-b border-stone-100 relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => {
                      if (permissionService.canEdit("pricing")) {
                        setEditingPlan(plan);
                        setIsFormOpen(true);
                      } else {
                        alert("Permission denied to edit pricing plans.");
                      }
                    }}
                    className={`p-2 text-stone-400 hover:text-brand-orange transition-all ${
                      !permissionService.canEdit("pricing")
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    onClick={() => {
                      if (permissionService.canDelete("pricing")) {
                        void handleDeletePlan(plan.id);
                      } else {
                        alert("Permission denied to delete pricing plans.");
                      }
                    }}
                    className={`p-2 text-stone-400 hover:text-red-500 transition-all ${
                      !permissionService.canDelete("pricing")
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <h3 className="text-sm uppercase font-bold tracking-[0.4em] mb-4">
                  {plan.name}
                </h3>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight">
                    {plan.currency} {plan.monthlyPrice}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-stone-400">
                    / Monthly
                  </span>
                </div>
              </div>

              <div className="p-8 space-y-6 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <MiniLimit label="Products" value={plan.maxProducts} />
                  <MiniLimit label="CAH Links" value={plan.maxCahLinks} />
                  <MiniLimit
                    label="Branches"
                    value={plan.maxBranchesPerVendor}
                  />
                  <MiniLimit label="Staff" value={plan.maxStaffPerVendor} />
                </div>

                <div className="space-y-4">
                  <FeatureItem
                    label="Direct Call"
                    active={!!plan.isDirectCallProductButtonEnabled}
                  />
                  <FeatureItem
                    label="WhatsApp Order"
                    active={!!plan.isWhatsAppProductButtonEnabled}
                  />
                  <FeatureItem
                    label="Social Links"
                    active={
                      !!plan.isVendorWhatsAppGroupLinkEnabled ||
                      !!plan.isVendorWhatsAppChannelLinkEnabled
                    }
                  />
                  <FeatureItem
                    label="Hosted Support"
                    active={!!plan.isHostedCatalogueSupportEnabled}
                  />
                </div>

                <div className="mt-6 pt-6 border-t border-stone-100">
                  <p className="text-[9px] font-bold uppercase text-stone-400 mb-2">
                    Live Subscribers
                  </p>
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-brand-orange" />
                    <span className="text-xs font-bold leading-none">
                      {(vendorsByPlan[plan.id] || []).length} Vendors Assigned
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 border-t border-stone-100">
                <button
                  onClick={() => {
                    if (permissionService.canEdit("pricing")) {
                      void handleToggleStatus(plan.id, plan.status);
                    } else {
                      alert("Permission denied to change plan status.");
                    }
                  }}
                  className={`w-full py-3 text-[9px] font-bold uppercase tracking-widest border border-stone-200 hover:bg-white transition-all ${
                    !permissionService.canEdit("pricing")
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {plan.status === "active" ? "Suspend Plan" : "Activate Plan"}
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              if (permissionService.canCreate("pricing")) {
                setEditingPlan({});
                setIsFormOpen(true);
              } else {
                alert("Permission denied to create pricing plans.");
              }
            }}
            className={`flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200 hover:border-brand-orange hover:bg-orange-50 transition-all text-stone-400 hover:text-brand-orange group ${
              !permissionService.canCreate("pricing")
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            disabled={!permissionService.canCreate("pricing")}
          >
            <Plus
              size={48}
              className="mb-4 stroke-1 group-hover:scale-110 transition-transform"
            />
            <span className="text-xs uppercase font-bold tracking-[0.2em]">
              Add Pricing Tier
            </span>
          </button>
        </div>
      )}

      {viewMode === "comparison" && (
        <TablePanel
          title="Plan Matrix"
          subtitle="Direct comparison of all operational limits across tiers."
          headers={["Feature / Metric", ...safePlans.map((p) => p.name)]}
        >
          <ComparisonRow
            label="Monthly Price"
            field="monthlyPrice"
            prefix="$"
            plans={safePlans}
          />
          <ComparisonRow
            label="Max Products"
            field="maxProducts"
            plans={safePlans}
          />
          <ComparisonRow
            label="Max Images / Cat"
            field="maxImagesPerCatalogue"
            plans={safePlans}
          />
          <ComparisonRow
            label="Freq Type"
            field="deploymentFrequency"
            plans={safePlans}
          />
          <ComparisonRow
            label="Dplys / Month"
            field="maxDeploymentsPerMonth"
            plans={safePlans}
          />
          <ComparisonRow
            label="CAH Links"
            field="maxCahLinks"
            plans={safePlans}
          />
          <ComparisonRow
            label="Max Branches"
            field="maxBranchesPerVendor"
            plans={safePlans}
          />
          <ComparisonRow
            label="Max Staff"
            field="maxStaffPerVendor"
            plans={safePlans}
          />
          <ComparisonRow
            label="Max Drivers"
            field="maxDeliveryContactsPerVendor"
            plans={safePlans}
          />
          <ComparisonRow
            label="BI Level"
            field="biAnalyticsLevel"
            plans={safePlans}
          />
          <ComparisonRow
            label="RPN Support"
            field="rpnSupportLevel"
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label="WhatsApp Button"
            field="isWhatsAppProductButtonEnabled"
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label="Direct Call"
            field="isDirectCallProductButtonEnabled"
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label="WA Join Links"
            field="isVendorWhatsAppGroupLinkEnabled"
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label="Inventory Check"
            field="isInventorySpotCheckIncluded"
            plans={safePlans}
          />
          <ComparisonBooleanRow
            label="Hosted Support"
            field="isHostedCatalogueSupportEnabled"
            plans={safePlans}
          />
          <ComparisonRow
            label="Trial Period"
            field="trialDays"
            suffix=" Days"
            plans={safePlans}
          />
        </TablePanel>
      )}

      {viewMode === "itred_vendors" && (
        <div className="space-y-10">
          {safePlans.map((plan) => (
            <DataPanel
              key={plan.id}
              title={`${plan.name} Subscribers`}
              subtitle={`${(vendorsByPlan[plan.id] || []).length} vendors currently on this plan`}
            >
              {(vendorsByPlan[plan.id] || []).length > 0 ? (
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(vendorsByPlan[plan.id] || []).map((vendor) => {
                    const issues = checkLimits(vendor, plan);

                    return (
                      <div
                        key={vendor.id}
                        className={`p-6 border-2 flex flex-col gap-4 relative group transition-all ${
                          issues.length > 0
                            ? "border-red-100 bg-red-50/10"
                            : "border-stone-100 bg-white hover:border-brand-orange"
                        }`}
                      >
                        {issues.length > 0 && (
                          <div
                            className="absolute top-2 right-2 text-red-500"
                            title="Plan limits exceeded"
                          >
                            <AlertTriangle size={16} />
                          </div>
                        )}

                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold uppercase text-brand-charcoal">
                              {vendor.name}
                            </p>
                            <p className="text-[9px] text-stone-400 uppercase tracking-wider">
                              {vendor.tradingName}
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              setVendorToAssign(vendor);
                              setTargetPlanId(vendor.planId || "");
                              setIsAssignModalOpen(true);
                            }}
                            className="p-2 bg-stone-100 text-stone-400 hover:bg-brand-charcoal hover:text-white transition-all rounded shadow-sm"
                            title="Reassign Plan"
                          >
                            <UserPlus size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {issues.map((issue, idx) => (
                            <div
                              key={`${issue}-${idx}`}
                              className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-red-500 bg-red-50 px-2 py-1 rounded"
                            >
                              <AlertTriangle size={10} /> {issue}
                            </div>
                          ))}

                          {issues.length === 0 && (
                            <div className="col-span-2 flex items-center gap-1.5 text-[9px] font-bold uppercase text-emerald-500 bg-emerald-50 px-2 py-1 rounded">
                              <Check size={10} /> Limits Verified
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-stone-100 flex justify-between items-center">
                          <p className="text-[9px] font-bold text-stone-400 uppercase">
                            Usage Score
                          </p>
                          <ChevronRight
                            size={14}
                            className="text-stone-300 group-hover:text-brand-orange transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center italic text-stone-400 text-xs py-20 font-bold uppercase tracking-widest">
                  No active subscribers for Tier: {plan.name}
                </div>
              )}
            </DataPanel>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={isAssignModalOpen}
        title="Reassign Vendor Plan"
        message={`Move ${vendorToAssign?.name || "this vendor"} to a different pricing tier. This affects their resource boundaries.`}
        confirmLabel="Initialize Reassignment"
        onConfirm={handleAssignPlan}
        onCancel={() => {
          setIsAssignModalOpen(false);
          setVendorToAssign(null);
          setTargetPlanId("");
        }}
      >
        <div className="mt-4">
          <label className="text-[10px] font-bold uppercase text-stone-400 block mb-2">
            Target Pricing Plan
          </label>
          <select
            className={underlineInputClass}
            value={targetPlanId}
            onChange={(e) => setTargetPlanId(e.target.value)}
          >
            <option value="">Select Plan...</option>
            {safePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name.toUpperCase()} - {plan.currency} {plan.monthlyPrice}
                /mo
              </option>
            ))}
          </select>
        </div>
      </ConfirmDialog>
    </div>
  );
};

const FeatureToggle: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-4 border-2 text-left transition-all ${
      active
        ? "border-brand-orange bg-orange-50/30"
        : "border-stone-100 hover:border-stone-200 bg-white"
    }`}
  >
    <div className="flex justify-between items-center mb-2">
      <p className="text-[9px] font-bold uppercase tracking-widest">{label}</p>
      <div
        className={`w-3 h-3 rounded-full ${
          active ? "bg-brand-orange" : "bg-stone-200"
        }`}
      />
    </div>
    <p
      className={`text-[8px] font-bold uppercase ${
        active ? "text-brand-orange" : "text-stone-400"
      }`}
    >
      {active ? "Module Enabled" : "Module Disabled"}
    </p>
  </button>
);

const MiniLimit: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="p-2 border border-stone-100 bg-stone-50">
    <p className="text-[8px] font-bold text-stone-400 uppercase mb-0.5">
      {label}
    </p>
    <p className="text-sm font-bold tracking-tight">
      {value === Infinity ? "∞" : value}
    </p>
  </div>
);

const FeatureItem: React.FC<{ label: string; active: boolean }> = ({
  label,
  active,
}) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-4 h-4 flex items-center justify-center border ${
        active
          ? "border-brand-orange bg-brand-orange text-white"
          : "border-stone-200 text-stone-200"
      }`}
    >
      {active ? <Check size={10} /> : <X size={10} />}
    </div>
    <span
      className={`text-[10px] font-bold uppercase tracking-wider ${
        active ? "text-brand-charcoal" : "text-stone-300"
      }`}
    >
      {label}
    </span>
  </div>
);

const ComparisonRow: React.FC<{
  label: string;
  field: keyof PricingPlan;
  prefix?: string;
  suffix?: string;
  plans: PricingPlan[];
}> = ({ label, field, prefix = "", suffix = "", plans }) => (
  <tr className="hover:bg-stone-50">
    <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-50/50">
      {label}
    </td>
    {asArray<PricingPlan>(plans).map((plan) => (
      <td
        key={plan.id}
        className="px-6 py-4 text-center text-xs font-bold font-mono"
      >
        {prefix}
        {plan[field] === Infinity ? "Unlimited" : String(plan[field] ?? "")}
        {suffix}
      </td>
    ))}
  </tr>
);

const ComparisonBooleanRow: React.FC<{
  label: string;
  field: keyof PricingPlan;
  plans: PricingPlan[];
}> = ({ label, field, plans }) => (
  <tr className="hover:bg-stone-50">
    <td className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-50/50">
      {label}
    </td>
    {asArray<PricingPlan>(plans).map((plan) => (
      <td key={plan.id} className="px-6 py-4 text-center">
        <div className="flex justify-center">
          {plan[field] ? (
            <div className="w-5 h-5 bg-green-50 text-green-600 rounded flex items-center justify-center">
              <Check size={14} />
            </div>
          ) : (
            <div className="w-5 h-5 bg-stone-50 text-stone-300 rounded flex items-center justify-center">
              <X size={14} />
            </div>
          )}
        </div>
      </td>
    ))}
  </tr>
);

export default PricingPlans;
