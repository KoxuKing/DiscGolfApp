import {
  clampCourseDistance,
  clampHoleCount,
  createCourseHoles,
  type Course,
  type CourseHole,
} from './training';

export const DISCGOLFAPI_FINLAND_COURSES_URL = 'https://io.discgolfapi.com/v1/courses?country=FI&limit=500';
export const DISCGOLFAPI_ATTRIBUTION = 'Course data supplied by DiscGolfAPI. Free to use with attribution.';

export type Coordinates = {
  lat: number;
  lon: number;
};

export type DiscGolfApiCourse = {
  id?: string;
  slug?: string | null;
  name?: string | null;
  lat?: number | null;
  lon?: number | null;
  locality?: string | null;
  holes?: number | null;
  primary_layout?: {
    holes?: number | null;
    par_total?: number | null;
    length_meters?: number | null;
  } | null;
};

export type DiscGolfApiCoursesResponse = {
  courses?: DiscGolfApiCourse[];
};

export type ImportedCourse = {
  source: 'discgolfapi';
  sourceId: string;
  sourceSlug: string;
  name: string;
  lat?: number;
  lon?: number;
  locality: string;
  holeCount: number | null;
  parTotal: number | null;
  lengthMeters: number | null;
  distanceKm?: number;
};

export type ImportedCourseDraft = {
  name: string;
  holes: CourseHole[];
  metadata: Partial<Course>;
};

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function positiveInteger(value: unknown) {
  const numberValue = cleanNumber(value);
  return numberValue && numberValue > 0 ? Math.round(numberValue) : null;
}

export function normalizeDiscGolfApiCourse(input: DiscGolfApiCourse): ImportedCourse | null {
  const sourceId = cleanText(input.id);
  const name = cleanText(input.name);

  if (!sourceId || !name) {
    return null;
  }

  const layout = input.primary_layout ?? null;
  const holeCount = positiveInteger(layout?.holes ?? input.holes);
  const parTotal = positiveInteger(layout?.par_total);
  const lengthMeters = positiveInteger(layout?.length_meters);
  const lat = cleanNumber(input.lat);
  const lon = cleanNumber(input.lon);

  return {
    source: 'discgolfapi',
    sourceId,
    sourceSlug: cleanText(input.slug),
    name,
    ...(lat !== null ? { lat } : {}),
    ...(lon !== null ? { lon } : {}),
    locality: cleanText(input.locality),
    holeCount,
    parTotal,
    lengthMeters,
  };
}

export function normalizeDiscGolfApiCoursesResponse(input: DiscGolfApiCoursesResponse): ImportedCourse[] {
  return Array.isArray(input.courses) ? input.courses.flatMap((course) => normalizeDiscGolfApiCourse(course) ?? []) : [];
}

export function distanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to.lat - from.lat);
  const lonDelta = toRadians(to.lon - from.lon);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function sortImportedCourses(courses: ImportedCourse[], location: Coordinates | null = null) {
  const withDistance = courses.map((course) => {
    if (location && course.lat !== undefined && course.lon !== undefined) {
      return { ...course, distanceKm: distanceKm(location, { lat: course.lat, lon: course.lon }) };
    }

    return course;
  });

  return withDistance.sort((a, b) => {
    const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;

    if (aDistance !== bDistance) {
      return aDistance - bDistance;
    }

    return a.name.localeCompare(b.name);
  });
}

export function createCourseDraftFromImport(course: ImportedCourse, importedAt = new Date().toISOString()): ImportedCourseDraft {
  const holeCount = clampHoleCount(course.holeCount ?? 18);
  const defaultDistance = clampCourseDistance(
    course.lengthMeters && holeCount > 0 ? Math.round(course.lengthMeters / holeCount) : 80
  );
  const holes = createCourseHoles(holeCount).map((hole) => ({
    ...hole,
    par: 3,
    distanceMeters: defaultDistance,
  }));

  return {
    name: course.name,
    holes,
    metadata: {
      source: 'discgolfapi',
      sourceId: course.sourceId,
      sourceSlug: course.sourceSlug,
      ...(course.lat !== undefined ? { lat: course.lat } : {}),
      ...(course.lon !== undefined ? { lon: course.lon } : {}),
      ...(course.locality ? { locality: course.locality } : {}),
      importedAt,
      attribution: DISCGOLFAPI_ATTRIBUTION,
    },
  };
}

export function isCourseAlreadyImported(courses: Course[], importedCourse: ImportedCourse) {
  return courses.some(
    (course) => course.source === 'discgolfapi' && course.sourceId && course.sourceId === importedCourse.sourceId
  );
}

export async function fetchFinlandDiscGolfCourses(fetcher: typeof fetch = fetch) {
  const response = await fetcher(DISCGOLFAPI_FINLAND_COURSES_URL);

  if (!response.ok) {
    throw new Error(`DiscGolfAPI request failed with status ${response.status}`);
  }

  return normalizeDiscGolfApiCoursesResponse((await response.json()) as DiscGolfApiCoursesResponse);
}
