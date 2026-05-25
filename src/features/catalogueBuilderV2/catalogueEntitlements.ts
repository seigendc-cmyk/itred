import {
  CatalogueEntitlementResult,
  CataloguePlan,
  CatalogueVendor
} from './types'
import { safeNumber, safeString } from './safe'

const isUnlimited = (value: unknown) =>
  value === -1 || safeString(value).toLowerCase() === 'unlimited'

const resolveLimit = (
  plan: CataloguePlan | null | undefined,
  fields: string[]
): number | 'unlimited' | null => {
  if (!plan) return null
  const features =
    plan.features && !Array.isArray(plan.features)
      ? (plan.features as Record<string, unknown>)
      : {}
  const entitlements = plan.entitlements || {}

  const candidates = fields.map(field => {
    if (field.startsWith('features.')) {
      return features[field.replace('features.', '')]
    }
    if (field.startsWith('entitlements.')) {
      return entitlements[field.replace('entitlements.', '')]
    }
    return (plan as Record<string, unknown>)[field]
  })

  for (const value of candidates) {
    if (value === undefined || value === null || value === '') continue
    if (isUnlimited(value)) return 'unlimited'
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }

  return null
}

export const resolveCatalogueProductLimit = (
  plan: CataloguePlan | null | undefined
) =>
  resolveLimit(plan, [
    'maxProductsPerCatalogue',
    'catalogueProductLimit',
    'productLimit',
    'maxProducts',
    'productsAllowed',
    'features.maxProductsPerCatalogue',
    'features.catalogueProductLimit',
    'features.productLimit',
    'entitlements.maxProductsPerCatalogue',
    'entitlements.productLimit'
  ])

export const resolveCatalogueEntitlements = (
  vendor: CatalogueVendor | null | undefined,
  plan: CataloguePlan | null | undefined
): CatalogueEntitlementResult => {
  const productLimit = resolveCatalogueProductLimit(plan)
  const imageAllowance = resolveLimit(plan, ['maxImagesPerCatalogue'])
  const deploymentsAllowed = resolveLimit(plan, [
    'cataloguesIncludedPerMonth',
    'maxDeploymentsPerMonth'
  ])
  const blockedReasons: string[] = []
  const subscriptionStatus = safeString(vendor?.subscriptionStatus || 'active')
    .trim()
    .toLowerCase()

  if (!plan) {
    blockedReasons.push('No active plan resolved.')
  }
  if (plan?.enableCatalogueGeneration === false) {
    blockedReasons.push('Catalogue generation is disabled for this plan.')
  }
  if (
    subscriptionStatus &&
    !['active', 'trial', 'past_due', 'grace_period', 'due', 'overdue'].includes(
      subscriptionStatus
    )
  ) {
    blockedReasons.push(`Subscription is ${subscriptionStatus}.`)
  }
  if (productLimit === 0) {
    blockedReasons.push('Plan product limit is explicitly 0.')
  }

  return {
    planName: safeString(plan?.name || vendor?.planName || 'Unresolved Plan'),
    productLimit,
    imageAllowance,
    deploymentsRemaining:
      deploymentsAllowed === 'unlimited'
        ? 'unlimited'
        : deploymentsAllowed === null
        ? null
        : Math.max(0, safeNumber(deploymentsAllowed)),
    unresolvedLimit: !!plan && productLimit === null,
    blockedReasons
  }
}
