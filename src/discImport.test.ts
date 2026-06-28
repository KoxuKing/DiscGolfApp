import { describe, expect, it, vi } from 'vitest';
import {
  DISCIT_DISCS_URL,
  createDiscMetadataFromImport,
  discCategoryFromApiDisc,
  fetchDiscItDiscs,
  importedDiscDisplayName,
  isDiscAlreadyImported,
  normalizeDiscItResponse,
} from './discImport';
import { createDisc } from './training';

describe('disc import', () => {
  it('normalizes DiscIt discs and maps categories from speed and API category', () => {
    const discs = normalizeDiscItResponse([
      {
        id: 'zone-id',
        name: 'Zone',
        brand: 'Discraft',
        category: 'Putt & Approach',
        speed: '4',
        glide: '3',
        turn: '0',
        fade: '3',
        stability: 'Overstable',
        link: 'https://example.com/zone',
        pic: 'https://example.com/zone.webp',
        name_slug: 'zone',
        brand_slug: 'discraft',
      },
      { id: '', name: 'Bad' },
      { id: 'missing-name', name: '' },
    ]);

    expect(discs).toEqual([
      {
        source: 'discit',
        sourceId: 'zone-id',
        sourceSlug: 'zone',
        name: 'Zone',
        brand: 'Discraft',
        category: 'putter',
        apiCategory: 'Putt & Approach',
        speed: 4,
        glide: 3,
        turn: 0,
        fade: 3,
        stability: 'Overstable',
        imageUrl: 'https://example.com/zone.webp',
        infoUrl: 'https://example.com/zone',
        brandSlug: 'discraft',
      },
    ]);

    expect(importedDiscDisplayName(discs[0])).toBe('Discraft Zone');
  });

  it('derives app disc categories from DiscIt category and speed', () => {
    expect(discCategoryFromApiDisc('Putter', 2)).toBe('putter');
    expect(discCategoryFromApiDisc('Midrange', 5)).toBe('mid-range');
    expect(discCategoryFromApiDisc('Control Driver', 8)).toBe('fairway driver');
    expect(discCategoryFromApiDisc('Distance Driver', 12)).toBe('distance driver');
  });

  it('creates saved disc metadata and detects already imported discs', () => {
    const [imported] = normalizeDiscItResponse([{ id: 'disc-id', name: 'Aviar', brand: 'Innova', speed: '2' }]);
    const saved = createDisc(importedDiscDisplayName(imported), imported.category, createDiscMetadataFromImport(imported));

    expect(saved).toMatchObject({
      name: 'Innova Aviar',
      category: 'putter',
      source: 'discit',
      sourceId: 'disc-id',
      brand: 'Innova',
      speed: 2,
    });
    expect(saved.attribution).toContain('DiscIt');
    expect(isDiscAlreadyImported([saved], imported)).toBe(true);
    expect(isDiscAlreadyImported([], imported)).toBe(false);
  });

  it('fetches DiscIt discs with optional name search', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([{ id: 'disc-id', name: 'Aviar', brand: 'Innova' }]), { status: 200 })
      )
    );

    await expect(fetchDiscItDiscs('aviar', fetcher as typeof fetch)).resolves.toMatchObject([
      { sourceId: 'disc-id', name: 'Aviar', brand: 'Innova' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(`${DISCIT_DISCS_URL}?name=aviar`);
  });
});
