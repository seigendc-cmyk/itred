export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { items?: unknown }).items)
  ) {
    return (value as { items: T[] }).items;
  }

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: T[] }).data;
  }

  return [];
}

export function safeFilter<T>(
  value: unknown,
  predicate: (item: T, index: number, array: T[]) => boolean,
): T[] {
  return asArray<T>(value).filter(predicate);
}

export function safeMap<T, R>(
  value: unknown,
  mapper: (item: T, index: number, array: T[]) => R,
): R[] {
  return asArray<T>(value).map(mapper);
}

export function safeSlice<T>(
  value: unknown,
  start?: number,
  end?: number,
): T[] {
  return asArray<T>(value).slice(start, end);
}
