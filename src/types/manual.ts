import type React from "react";

export interface ManualTag {
  id: string;
  label: string;
}

export interface ManualGuide {
  id: string;
  title: string;
  summary: string;
  tags?: string[];
}

export interface ManualSection extends ManualGuide {
  body: React.ReactNode;
  searchText: string;
}

export interface TroubleshootingGuide {
  problem: string;
  likelyCause: string;
  fix: string;
}
