import { safeArray, safeString } from './safe'

const normalizeKey = (value: unknown) => safeString(value).trim().toLowerCase()

export const getVendorMatchKeys = (vendor: unknown): string[] => {
  const record = (vendor || {}) as Record<string, unknown>
  return safeArray([
    record.id,
    record.vendorId,
    record.vendorCode,
    record.code,
    record.businessId,
    record.serial,
    record.vendorSerial
  ])
    .map(normalizeKey)
    .filter(Boolean)
}

export const productMatchesVendor = (
  product: unknown,
  vendor: unknown
): boolean => {
  const vendorKeys = getVendorMatchKeys(vendor)
  const record = (product || {}) as Record<string, unknown>
  const productKeys = safeArray([
    record.vendorId,
    record.vendorCode,
    record.ownerVendorId,
    record.sourceVendorId,
    record.vendorSerial,
    record.businessId
  ])
    .map(normalizeKey)
    .filter(Boolean)

  return productKeys.some(key => vendorKeys.includes(key))
}
