import { InventorySpotCheck } from '../types';
import { localStorageService } from './localStorageService';

const SPOT_CHECKS_KEY = 'itred_inventory_spot_checks';

export const inventorySpotCheckService = {
  getSpotChecks: (): InventorySpotCheck[] => {
    return localStorageService.get<InventorySpotCheck[]>(SPOT_CHECKS_KEY) || [];
  },

  saveSpotCheck: (spotCheck: InventorySpotCheck): void => {
    const spotChecks = inventorySpotCheckService.getSpotChecks();
    const index = spotChecks.findIndex(s => s.id === spotCheck.id);
    if (index > -1) {
      spotChecks[index] = spotCheck;
    } else {
      spotChecks.push(spotCheck);
    }
    localStorageService.set(SPOT_CHECKS_KEY, spotChecks);
  },

  deleteSpotCheck: (id: string): void => {
    const spotChecks = inventorySpotCheckService.getSpotChecks();
    const updated = spotChecks.filter(s => s.id !== id);
    localStorageService.set(SPOT_CHECKS_KEY, updated);
  },

  getSpotChecksByVendor: (vendorId: string): InventorySpotCheck[] => {
    return inventorySpotCheckService.getSpotChecks().filter(s => s.vendorId === vendorId);
  },

  getSpotChecksByMonth: (vendorId: string, month: number, year: number): InventorySpotCheck[] => {
    return inventorySpotCheckService.getSpotChecks().filter(s => {
      const date = new Date(s.checkDate);
      return s.vendorId === vendorId && 
             date.getMonth() === month && 
             date.getFullYear() === year &&
             s.status === 'completed';
    });
  }
};
