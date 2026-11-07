export interface IndexEntry {
  id: string;
  familyID?: string;
  name: string;
  version: string;
  language: string;
  contentType: 'pageImages' | 'text' | 'publication' | 'audio';
  contentRating?: string;
  releaseTrack?: string;
  status?: string;
  manifest: { path: string; sha256: string };
  icon: { path: string; sha256: string };
  slug?: string;
  baseURL?: string;
}

export interface ModuleManifest {
  contractVersion: number;
  id: string;
  familyID: string;
  name: string;
  version: string;
  minimumAppVersion: string;
  contentType: string;
  contentRating: string;
  releaseTrack: string;
  capabilities: string[];
  baseURL: string;
  universalURLs?: string[];
  entry: { path: string; sha256: string };
  icon: { path: string; sha256: string };
  hosts: string[];
  attribution?: {
    author?: string;
    website?: string;
    sourceCode?: string;
  };
}

export interface CatalogItem {
  id: string;
  title: string;
  image?: string;
  url?: string;
  subtitle?: string;
  latestChapter?: string;
  badge?: string;
}

export interface DiscoverySection {
  id: string;
  title: string;
  items: CatalogItem[];
}

export interface ItemDetails {
  id: string;
  title: string;
  image?: string;
  synopsis?: string;
  description?: string;
  status?: string;
  author?: string;
  artist?: string;
  tags?: string[];
  genres?: string[];
  rating?: string | number;
  url?: string;
}

export interface ChapterItem {
  id: string;
  title: string;
  number?: number;
  date?: string;
  dateUpload?: string;
  url?: string;
}

export interface ProbeStage {
  ok: boolean;
  durationMs?: number;
  error?: string;
  count?: number;
  handlers?: string[];
  terminal?: string;
  sections?: Array<{ id: string; title: string; count: number }>;
  sample?: any[];
  deliveries?: any[];
}

export interface ProbeReport {
  module: string;
  moduleID: string;
  name: string;
  version: string;
  contentType: string;
  releaseTrack: string;
  mode: string;
  passed: boolean;
  stages: Record<string, ProbeStage>;
  timingsMs: Record<string, number>;
  lifecycle: any[];
  error?: string | null;
  durationMs: number;
}
