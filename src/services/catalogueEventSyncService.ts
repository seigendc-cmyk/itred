import { sanitizeForFirestore } from '../utils/firestoreSanitize'

export type OfflineCatalogueEvent = Record<string, unknown>

export const CATALOGUE_EVENTS_ENDPOINT = '/api/catalogue-events'

export function normalizeCatalogueEventBatch(events: OfflineCatalogueEvent[]) {
  return sanitizeForFirestore({
    events: Array.isArray(events) ? events : [],
  })
}

export const catalogueEventSyncService = {
  endpoint: CATALOGUE_EVENTS_ENDPOINT,
  normalizeBatch: normalizeCatalogueEventBatch,
}
