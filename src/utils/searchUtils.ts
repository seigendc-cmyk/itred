/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const normalizeSearchText = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const matchesFreeOrderSearch = (
  recordText: unknown,
  query: unknown,
): boolean => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedRecord = normalizeSearchText(recordText);
  if (!normalizedRecord) return false;

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => normalizedRecord.includes(token));
};

export const buildSearchText = (
  values: Array<unknown> | Record<string, unknown>,
): string => {
  if (Array.isArray(values)) {
    return values.filter(Boolean).join(" | ");
  }

  return Object.values(values).filter(Boolean).join(" | ");
};
