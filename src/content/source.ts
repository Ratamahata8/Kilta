import generated from "./kilta.generated.json" with { type: "json" };
import type { Snapshot } from "../lib/types";
export type SourceAsset = {
  id: string; kind: "image"; alt: string; caption: string; source: string;
  focal_x: number; focal_y: number; width: number; height: number;
  card: { path: string; width: number; height: number };
  hero: { path: string; width: number; height: number };
  archiveFile: string; sourceURL: string; sha256: string; originalMime: string;
};
export type ContentBundle = {
  extractedAt: string; entries: Snapshot[]; media: SourceAsset[];
  audit: { manifestCount: number; verifiedCount: number; missingFiles: string[]; notes: string[] };
};
export const contentBundle = generated as ContentBundle;
