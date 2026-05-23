/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";
import {
  MasterDataCacheState,
  masterDataCacheService,
} from "../services/masterDataCacheService.ts";

export const useMasterDataCache = () => {
  const [state, setState] = useState<MasterDataCacheState>({
    fromCache: false,
    refreshing: false,
  });

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<MasterDataCacheState>).detail;
      setState((prev) => ({ ...prev, ...detail }));
    };

    window.addEventListener(masterDataCacheService.eventName, handleUpdate);
    return () => {
      window.removeEventListener(masterDataCacheService.eventName, handleUpdate);
    };
  }, []);

  return {
    ...state,
    refreshNow: () => masterDataCacheService.refreshAll(),
  };
};
