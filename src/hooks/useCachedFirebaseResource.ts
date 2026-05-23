/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { firebaseHealthService } from "../services/firebaseHealthService.ts";

export function useCachedFirebaseResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<"cache" | "firebase" | "empty">("empty");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    const start = performance.now();
    try {
      const result = await fetcher();
      setData(result);
      setSource("firebase");
      setError(null);
    } catch (err: any) {
      setError(err);
      firebaseHealthService.reportError(err, `useCachedFirebaseResource:${key}`);
      setSource("cache");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [key, fetcher, ...dependencies]);

  useEffect(() => { void load(); }, [load]);

  return { data, isLoading, isRefreshing, error, source, reload: () => load(true) };
}