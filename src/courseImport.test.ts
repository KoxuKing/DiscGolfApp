import { describe, expect, it, vi } from 'vitest';
import {
  DISCGOLFAPI_FINLAND_COURSES_URL,
  createCourseDraftFromImport,
  fetchFinlandDiscGolfCourses,
  isCourseAlreadyImported,
  normalizeDiscGolfApiCoursesResponse,
  sortImportedCourses,
} from './courseImport';
import { createCourse, createCourseHoles } from './training';

describe('course import', () => {
  it('normalizes DiscGolfAPI courses and drops unusable records', () => {
    const courses = normalizeDiscGolfApiCoursesResponse({
      courses: [
        {
          id: 'crs_tampere',
          slug: 'tampere-course',
          name: ' Tampere DiscGolfPark ',
          lat: 61.5,
          lon: 23.7,
          locality: 'Tampere',
          primary_layout: {
            holes: 9,
            par_total: 27,
            length_meters: 810,
          },
        },
        { id: '', name: 'Missing id' },
        { id: 'missing-name', name: '' },
      ],
    });

    expect(courses).toEqual([
      {
        source: 'discgolfapi',
        sourceId: 'crs_tampere',
        sourceSlug: 'tampere-course',
        name: 'Tampere DiscGolfPark',
        lat: 61.5,
        lon: 23.7,
        locality: 'Tampere',
        holeCount: 9,
        parTotal: 27,
        lengthMeters: 810,
      },
    ]);
  });

  it('sorts imported courses by GPS distance when location is available', () => {
    const [far, near] = normalizeDiscGolfApiCoursesResponse({
      courses: [
        { id: 'far', name: 'Far Course', lat: 65, lon: 25 },
        { id: 'near', name: 'Near Course', lat: 61.49, lon: 23.77 },
      ],
    });

    const sorted = sortImportedCourses([far, near], { lat: 61.5, lon: 23.76 });

    expect(sorted[0]).toMatchObject({ sourceId: 'near' });
    expect(sorted[0].distanceKm).toBeLessThan(2);
    expect(sorted[1]).toMatchObject({ sourceId: 'far' });
  });

  it('creates editable course drafts with safe hole defaults and attribution', () => {
    const [courseWithLayout, courseWithoutLayout] = normalizeDiscGolfApiCoursesResponse({
      courses: [
        {
          id: 'layout',
          slug: 'layout-course',
          name: 'Layout Course',
          locality: 'Nokia',
          primary_layout: { holes: 3, length_meters: 300 },
        },
        { id: 'fallback', name: 'Fallback Course' },
      ],
    });

    const draft = createCourseDraftFromImport(courseWithLayout, '2026-06-28T12:00:00.000Z');
    const fallbackDraft = createCourseDraftFromImport(courseWithoutLayout, '2026-06-28T12:00:00.000Z');

    expect(draft.name).toBe('Layout Course');
    expect(draft.holes).toHaveLength(3);
    expect(draft.holes[0]).toMatchObject({ par: 3, distanceMeters: 100 });
    expect(draft.metadata).toMatchObject({
      source: 'discgolfapi',
      sourceId: 'layout',
      sourceSlug: 'layout-course',
      locality: 'Nokia',
      importedAt: '2026-06-28T12:00:00.000Z',
    });
    expect(draft.metadata.attribution).toContain('DiscGolfAPI');
    expect(fallbackDraft.holes).toHaveLength(18);
    expect(fallbackDraft.holes[0]).toMatchObject({ par: 3, distanceMeters: 80 });
  });

  it('detects already imported courses by source id', () => {
    const [imported] = normalizeDiscGolfApiCoursesResponse({
      courses: [{ id: 'crs_existing', name: 'Existing Course' }],
    });
    const saved = createCourse('Existing Course', createCourseHoles(18), {
      source: 'discgolfapi',
      sourceId: 'crs_existing',
    });

    expect(isCourseAlreadyImported([saved], imported)).toBe(true);
    expect(isCourseAlreadyImported([], imported)).toBe(false);
  });

  it('fetches Finland courses from DiscGolfAPI', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            courses: [{ id: 'crs_api', name: 'API Course' }],
          }),
          { status: 200 }
        )
      )
    );

    await expect(fetchFinlandDiscGolfCourses(fetcher as typeof fetch)).resolves.toMatchObject([
      { sourceId: 'crs_api', name: 'API Course' },
    ]);
    expect(fetcher).toHaveBeenCalledWith(DISCGOLFAPI_FINLAND_COURSES_URL);
  });
});
