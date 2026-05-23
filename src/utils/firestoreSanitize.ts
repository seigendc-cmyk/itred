export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return null as T;
  if (value === null) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as T;
  }

  if (typeof value === "object") {
    const cleaned: Record<string, unknown> = {};

    for (const [key, fieldValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      cleaned[key] = sanitizeForFirestore(fieldValue);
    }

    return cleaned as T;
  }

  return value;
}
