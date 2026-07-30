import { randomUUID } from "node:crypto";
import { sanitizeVisualAssetInput } from "./exportService";
import type {
  StoredVisualAsset,
  VisualAssetDescriptor,
  VisualAssetInput,
} from "./types";

const DEFAULT_TTL_MS = 20 * 60 * 1000;
const MAX_TTL_MS = 60 * 60 * 1000;
const MAX_ASSETS = 150;

declare global {
  var __finbroVisualAssetStore: Map<string, StoredVisualAsset> | undefined;
}

const records =
  globalThis.__finbroVisualAssetStore ??
  (globalThis.__finbroVisualAssetStore = new Map<string, StoredVisualAsset>());

function expiresAt(ttlMs: number) {
  const boundedTtl = Math.max(60_000, Math.min(ttlMs, MAX_TTL_MS));
  return new Date(Date.now() + boundedTtl).toISOString();
}

function prune(now = Date.now()) {
  for (const [assetId, record] of records) {
    if (Date.parse(record.expiresAt) <= now) records.delete(assetId);
  }
  while (records.size >= MAX_ASSETS) {
    const oldest = records.keys().next().value;
    if (!oldest) break;
    records.delete(oldest);
  }
}

function safeAssetId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value);
}

export function visualAssetDescriptor(asset: StoredVisualAsset): VisualAssetDescriptor {
  return {
    reportId: asset.reportId,
    assetId: asset.assetId,
    title: asset.title,
    subtitle: asset.subtitle,
    assetType: asset.assetType,
    category: asset.category,
    sectionId: asset.sectionId,
    sectionTitle: asset.sectionTitle,
    supportedFormats: asset.formats ?? [],
    dataset: asset.dataset,
    metadata: asset.metadata,
    createdAt: asset.createdAt,
    expiresAt: asset.expiresAt,
  };
}

export const visualAssetStore = {
  create(input: VisualAssetInput, options: { ttlMs?: number; assetId?: string } = {}) {
    prune();
    const assetId = options.assetId ?? randomUUID().replaceAll("-", "");
    if (!safeAssetId(assetId)) throw new Error("Invalid visual asset identifier.");
    const asset = sanitizeVisualAssetInput(input);
    const createdAt = new Date().toISOString();
    const record: StoredVisualAsset = {
      ...asset,
      assetId,
      createdAt,
      expiresAt: expiresAt(options.ttlMs ?? DEFAULT_TTL_MS),
    };
    records.set(assetId, structuredClone(record));
    return structuredClone(record);
  },
  get(assetId: string) {
    if (!safeAssetId(assetId)) return null;
    const record = records.get(assetId);
    if (!record) return null;
    if (Date.parse(record.expiresAt) <= Date.now()) {
      records.delete(assetId);
      return null;
    }
    return structuredClone(record);
  },
  list(reportId: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(reportId)) return [];
    prune();
    return [...records.values()]
      .filter((record) => record.reportId === reportId)
      .map((record) => visualAssetDescriptor(structuredClone(record)));
  },
  delete(assetId: string) {
    if (!safeAssetId(assetId)) return false;
    return records.delete(assetId);
  },
  clearExpired() {
    prune();
  },
};

export const VISUAL_ASSET_PERSISTENCE_LIMITATION =
  "Visual export assets use process-local temporary storage and may expire or be lost after a serverless restart.";
