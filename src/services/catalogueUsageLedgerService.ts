/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CatalogueUsageLedgerEntry {
  id: string
  catalogueId: string
  vendorId: string
  vendorName: string
  generatedAt: string
  productCount: number
  imageCount: number
  creditUsed: number
  overageDue: number
  deploymentCount: number
  catalogueSizeBytes: number
  oversizedImagesExcluded: number
  overrideUsed: boolean
  overrideReason?: string
  createdByStaffId?: string
  createdByStaffName?: string
}

const STORAGE_KEY = 'itred_catalogue_usage_ledger'

const readEntries = (): CatalogueUsageLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeEntries = (entries: CatalogueUsageLedgerEntry[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

const makeId = (catalogueId: string, vendorId: string) =>
  `CUL-${catalogueId}-${vendorId}-${Date.now()}`

export const catalogueUsageLedgerService = {
  getEntries: (vendorId?: string): CatalogueUsageLedgerEntry[] => {
    const entries = readEntries()
    return vendorId
      ? entries.filter(entry => entry.vendorId === vendorId)
      : entries
  },

  recordEntry: (
    entry: Omit<CatalogueUsageLedgerEntry, 'id' | 'generatedAt'> &
      Partial<Pick<CatalogueUsageLedgerEntry, 'id' | 'generatedAt'>>
  ): CatalogueUsageLedgerEntry => {
    const saved: CatalogueUsageLedgerEntry = {
      ...entry,
      id: entry.id || makeId(entry.catalogueId, entry.vendorId),
      generatedAt: entry.generatedAt || new Date().toISOString()
    }
    writeEntries([...readEntries(), saved])
    return saved
  }
}
