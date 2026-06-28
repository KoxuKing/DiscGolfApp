import { type Disc, type DiscCategory } from './training';

export const DISCIT_DISCS_URL = 'https://discit-api.fly.dev/disc';
export const DISCIT_ATTRIBUTION = 'Disc data supplied by DiscIt API.';

export type DiscItApiDisc = {
  id?: string;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  speed?: string | number | null;
  glide?: string | number | null;
  turn?: string | number | null;
  fade?: string | number | null;
  stability?: string | null;
  link?: string | null;
  pic?: string | null;
  name_slug?: string | null;
  brand_slug?: string | null;
};

export type ImportedDisc = {
  source: 'discit';
  sourceId: string;
  sourceSlug: string;
  name: string;
  brand: string;
  category: DiscCategory;
  apiCategory: string;
  speed?: number;
  glide?: number;
  turn?: number;
  fade?: number;
  stability: string;
  imageUrl: string;
  infoUrl: string;
  brandSlug: string;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function discCategoryFromApiDisc(apiCategory: string, speed?: number): DiscCategory {
  const category = apiCategory.toLowerCase();

  if (category.includes('putt') || (speed !== undefined && speed <= 3)) {
    return 'putter';
  }

  if (category.includes('mid') || (speed !== undefined && speed <= 5)) {
    return 'mid-range';
  }

  if (category.includes('distance') || (speed !== undefined && speed >= 10)) {
    return 'distance driver';
  }

  return 'fairway driver';
}

export function normalizeDiscItDisc(input: DiscItApiDisc): ImportedDisc | null {
  const sourceId = cleanText(input.id);
  const name = cleanText(input.name);

  if (!sourceId || !name) {
    return null;
  }

  const brand = cleanText(input.brand);
  const apiCategory = cleanText(input.category);
  const speed = cleanNumber(input.speed);
  const glide = cleanNumber(input.glide);
  const turn = cleanNumber(input.turn);
  const fade = cleanNumber(input.fade);

  return {
    source: 'discit',
    sourceId,
    sourceSlug: cleanText(input.name_slug),
    name,
    brand,
    category: discCategoryFromApiDisc(apiCategory, speed),
    apiCategory,
    ...(speed !== undefined ? { speed } : {}),
    ...(glide !== undefined ? { glide } : {}),
    ...(turn !== undefined ? { turn } : {}),
    ...(fade !== undefined ? { fade } : {}),
    stability: cleanText(input.stability),
    imageUrl: cleanText(input.pic),
    infoUrl: cleanText(input.link),
    brandSlug: cleanText(input.brand_slug),
  };
}

export function normalizeDiscItResponse(input: DiscItApiDisc[]): ImportedDisc[] {
  return Array.isArray(input) ? input.flatMap((disc) => normalizeDiscItDisc(disc) ?? []) : [];
}

export function importedDiscDisplayName(disc: ImportedDisc) {
  return disc.brand ? `${disc.brand} ${disc.name}` : disc.name;
}

export function createDiscMetadataFromImport(disc: ImportedDisc, importedAt = new Date().toISOString()): Partial<Disc> {
  return {
    brand: disc.brand,
    speed: disc.speed,
    glide: disc.glide,
    turn: disc.turn,
    fade: disc.fade,
    stability: disc.stability,
    source: 'discit',
    sourceId: disc.sourceId,
    sourceSlug: disc.sourceSlug,
    brandSlug: disc.brandSlug,
    imageUrl: disc.imageUrl,
    infoUrl: disc.infoUrl,
    importedAt,
    attribution: DISCIT_ATTRIBUTION,
  };
}

export function isDiscAlreadyImported(discs: Disc[], importedDisc: ImportedDisc) {
  return discs.some((disc) => disc.source === 'discit' && disc.sourceId === importedDisc.sourceId);
}

export async function fetchDiscItDiscs(search = '', fetcher: typeof fetch = fetch) {
  const query = search.trim();
  const url = query ? `${DISCIT_DISCS_URL}?name=${encodeURIComponent(query)}` : DISCIT_DISCS_URL;
  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`DiscIt request failed with status ${response.status}`);
  }

  return normalizeDiscItResponse((await response.json()) as DiscItApiDisc[]);
}
