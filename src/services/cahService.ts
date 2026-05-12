/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CAHLink, CAHBooth, CAHBoothAsset } from '../types.ts';
import { localStorageService } from './localStorageService.ts';

const CAH_LINKS_KEY = 'itred_cah_links';
const CAH_BOOTHS_KEY = 'itred_cah_booths';
const CAH_BOOTH_ASSETS_KEY = 'itred_cah_booth_assets';

export const cahService = {
  getLinks: (): CAHLink[] => {
    return localStorageService.get(CAH_LINKS_KEY) || [];
  },

  saveLinks: (links: CAHLink[]): void => {
    localStorageService.set(CAH_LINKS_KEY, links);
  },

  saveLink: (link: CAHLink): void => {
    const links = cahService.getLinks();
    const index = links.findIndex(l => l.id === link.id);
    if (index >= 0) {
      links[index] = { ...link, updatedAt: new Date().toISOString() };
    } else {
      links.push({
        ...link,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    cahService.saveLinks(links);
  },

  deleteLink: (id: string): void => {
    const links = cahService.getLinks();
    const filtered = links.filter(l => l.id !== id);
    cahService.saveLinks(filtered);
  },

  validateWhatsAppUrl: (url: string): boolean => {
    if (!url) return false;
    // Basic WhatsApp link pattern: https://chat.whatsapp.com/..., https://wa.me/..., etc
    return url.startsWith('https://chat.whatsapp.com/') || 
           url.startsWith('https://wa.me/') || 
           url.startsWith('https://whatsapp.com/channel/');
  },

  getBooths: (): CAHBooth[] => {
    return localStorageService.get(CAH_BOOTHS_KEY) || [];
  },

  saveBooths: (booths: CAHBooth[]): void => {
    localStorageService.set(CAH_BOOTHS_KEY, booths);
  },

  saveBooth: (booth: CAHBooth): void => {
    const booths = cahService.getBooths();
    const index = booths.findIndex(b => b.id === booth.id);
    if (index >= 0) {
      booths[index] = { ...booth, updatedAt: new Date().toISOString() };
    } else {
      booths.push({
        ...booth,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    cahService.saveBooths(booths);
  },

  getBoothAssets: (): CAHBoothAsset[] => {
    return localStorageService.get(CAH_BOOTH_ASSETS_KEY) || [];
  },

  getAssetsForBooth: (boothId: string): CAHBoothAsset[] => {
    return cahService.getBoothAssets().filter(a => a.boothId === boothId);
  },

  saveBoothAssets: (assets: CAHBoothAsset[]): void => {
    localStorageService.set(CAH_BOOTH_ASSETS_KEY, assets);
  },

  saveBoothAsset: (asset: CAHBoothAsset): void => {
    const assets = cahService.getBoothAssets();
    const index = assets.findIndex(a => a.id === asset.id);
    if (index >= 0) {
      assets[index] = { ...asset, updatedAt: new Date().toISOString() };
    } else {
      assets.push({
        ...asset,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    cahService.saveBoothAssets(assets);
  }
};
