/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CAHLinksPanel } from "../components/CAHLinksPanel.tsx";
import { CAHBoothsPanel } from "../components/CAHBoothsPanel.tsx";
import { Layers, Server, LayoutDashboard } from "lucide-react";
import { permissionService } from "../services/permissionService.ts";

export const CAHManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"links" | "booths">("links");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b-2 border-stone-100 pb-2">
        {permissionService.canView("accessHub") && (
          <button
            onClick={() => setActiveTab("links")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase transition-colors ${activeTab === "links" ? "text-brand-orange border-b-2 border-brand-orange -mb-[10px]" : "text-stone-400 hover:text-stone-600"}`}
          >
            <Layers size={16} /> Distribution Links
          </button>
        )}
        {permissionService.canView("cahBooths") && (
          <button
            onClick={() => setActiveTab("booths")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase transition-colors ${activeTab === "booths" ? "text-brand-orange border-b-2 border-brand-orange -mb-[10px]" : "text-stone-400 hover:text-stone-600"}`}
          >
            <Server size={16} /> CAH Booths
          </button>
        )}
        {!permissionService.canView("accessHub") &&
          !permissionService.canView("cahBooths") && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase text-stone-400">
              <LayoutDashboard size={16} /> No CAH access
            </div>
          )}
      </div>

      <div className="pt-4" id="access-hub-header" tabIndex={-1}>
        {activeTab === "links" && permissionService.canView("accessHub") ? (
          <CAHLinksPanel />
        ) : null}
        {activeTab === "booths" && permissionService.canView("cahBooths") ? (
          <CAHBoothsPanel />
        ) : null}
      </div>
    </div>
  );
};
