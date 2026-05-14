/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Vendor } from "../types.ts";

const FILLER_WORDS = new Set([
  "the",
  "and",
  "of",
  "pvt",
  "ltd",
  "private",
  "limited",
  "shop",
  "store",
  "business",
]);

export function normalizeText(input: string | undefined | null): string {
  if (!input) return "";
  let text = String(input).toLowerCase().trim();
  text = text.replace(/&/g, " and ");
  text = text.replace(/['`’]/g, "");
  text = text.replace(/[^\w\s]/g, " ");

  const words = text.split(/\s+/);
  const filtered = words.filter((w) => !FILLER_WORDS.has(w));
  return filtered.join(" ").replace(/\s+/g, " ").trim();
}

export function tokenize(input: string | undefined | null): string[] {
  const text = normalizeText(input);
  if (!text) return [];
  return text
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .sort();
}

export function tokenSetSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  if (tokensA.length === 0 && tokensB.length === 0) return 100;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let intersection = 0;
  const tempB = [...tokensB];

  for (const token of tokensA) {
    const idx = tempB.indexOf(token);
    if (idx !== -1) {
      intersection++;
      tempB.splice(idx, 1);
    }
  }

  return Math.round(
    ((2 * intersection) / (tokensA.length + tokensB.length)) * 100,
  );
}

function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}

export function orderedTextSimilarity(a: string, b: string): number {
  const normA = normalizeText(a).replace(/\s+/g, "");
  const normB = normalizeText(b).replace(/\s+/g, "");

  if (normA === normB) return 100;
  if (normA.length < 2 || normB.length < 2) return 0;

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);

  let intersection = 0;
  const tempB = [...bigramsB];

  for (const bg of bigramsA) {
    const idx = tempB.indexOf(bg);
    if (idx !== -1) {
      intersection++;
      tempB.splice(idx, 1);
    }
  }

  return Math.round(
    ((2 * intersection) / (bigramsA.length + bigramsB.length)) * 100,
  );
}

export type SimilarityLevel = "exact" | "high" | "medium" | "low" | "none";

export interface SimilarityResult {
  score: number;
  level: SimilarityLevel;
  reason: string;
}

export function calculateEntitySimilarity(
  inputName: string,
  existingName: string,
  _options?: any,
): SimilarityResult {
  if (!inputName || !existingName)
    return { score: 0, level: "none", reason: "Missing input." };

  const tokenScore = tokenSetSimilarity(inputName, existingName);
  const orderedScore = orderedTextSimilarity(inputName, existingName);

  // Weighted formula: 70% token overlap (ignores word order), 30% sequence overlap
  const score = Math.round(tokenScore * 0.7 + orderedScore * 0.3);

  let level: SimilarityLevel = "none";
  let reason = "Different entities detected.";

  if (score >= 95) {
    level = "exact";
    reason = "Nearly identical terminology and structure.";
  } else if (score >= 85) {
    level = "high";
    reason = "Strong overlap in significant identifiers.";
  } else if (score >= 70) {
    level = "medium";
    reason = "Partial keyword overlap detected.";
  } else if (score >= 50) {
    level = "low";
    reason = "Weak similarity, possible coincidence.";
  }

  return { score, level, reason };
}

export interface RecordMatch<T> {
  record: T;
  similarity: SimilarityResult;
}

export function findSimilarRecords<T>(
  inputName: string,
  records: T[],
  getName: (item: T) => string,
): RecordMatch<T>[] {
  const matches: RecordMatch<T>[] = [];

  for (const record of records) {
    const existingName = getName(record);
    const similarity = calculateEntitySimilarity(inputName, existingName);
    if (similarity.score >= 50) {
      matches.push({ record, similarity });
    }
  }
  return matches
    .sort((a, b) => b.similarity.score - a.similarity.score)
    .slice(0, 10);
}

export function findSimilarProducts(
  input: Partial<Product>,
  products: Product[],
): RecordMatch<Product>[] {
  const inputString = [input.name, input.brand, input.category, input.sector]
    .filter(Boolean)
    .join(" ");
  return findSimilarRecords(inputString, products, (p) =>
    [p.name, p.brand, p.category, p.sector].filter(Boolean).join(" "),
  );
}

export function findSimilarVendors(
  input: Partial<Vendor>,
  vendors: Vendor[],
): RecordMatch<Vendor>[] {
  const inputString = [
    input.name,
    input.tradingName,
    input.catalogueDisplayName,
  ]
    .filter(Boolean)
    .join(" ");
  return findSimilarRecords(inputString, vendors, (v) =>
    [v.name, v.tradingName, v.catalogueDisplayName].filter(Boolean).join(" "),
  );
}
