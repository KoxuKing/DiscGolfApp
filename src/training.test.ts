import { describe, expect, it } from 'vitest';
import {
  COURSES_KEY,
  COURSE_RUNS_KEY,
  DISCS_KEY,
  DISTANCE_THROWS_KEY,
  DRAFT_KEY,
  STORAGE_KEY,
  accuracyLabel,
  averageDistanceThrows,
  averageDistanceLabel,
  bestDistanceThrow,
  calculateProgressStats,
  completedThrows,
  createAiHistoryExport,
  createAiHistoryExportText,
  createBlankSession,
  createCourse,
  createCourseHoles,
  createCourseRun,
  createCourseRunThrow,
  createDistanceThrow,
  createDisc,
  courseRunPlayerSummary,
  courseRunScoreToPar,
  finalizeSessionForSave,
  gpsDistanceMeters,
  readDraft,
  readStoredCourseRuns,
  readStoredCourses,
  readStoredDistanceThrows,
  readStoredDiscs,
  readStoredSessions,
  saveCourseRuns,
  saveCourses,
  saveDistanceThrows,
  saveDiscs,
  saveDraft,
  saveSessions,
  sessionMaxScore,
  sessionMostCommonParameter,
  sessionMostCommonParameterLabel,
  sessionScore,
  sessionThrowCount,
  totalMaxScore,
  totalThrowCount,
  type ErrorType,
  type SectionId,
} from './training';

function makeScoredSession(trainingType: SectionId, score: number, throws: number, error: ErrorType = '') {
  const session = createBlankSession(trainingType, { plannedThrows: throws });
  let remaining = score;

  session.sessionThrows = session.sessionThrows.map((result) => {
    if (remaining <= 0) {
      return result;
    }

    if (trainingType === 'putting') {
      remaining -= 1;
      return { ...result, score: 1, completed: true, error };
    }

    if (trainingType === 'approaches') {
      if (remaining >= 2) {
        remaining -= 2;
        return { ...result, completed: true, error, approachDistanceMeters: '2', approachDirection: 'left' };
      }

      remaining -= 1;
      return { ...result, completed: true, error, approachDistanceMeters: '5', approachDirection: 'left' };
    }

    remaining -= 1;
    return { ...result, completed: true, error, approachDistanceMeters: '5', approachDirection: 'right' };
  });

  return session;
}

describe('training model', () => {
  it('keeps the original training catalog while allowing custom sessions', () => {
    expect(totalMaxScore).toBe(100);
    expect(totalThrowCount).toBe(80);

    const session = createBlankSession('putting', { distanceMeters: '8', plannedThrows: 12 });

    expect(session.trainingType).toBe('putting');
    expect(session.distanceMeters).toBe('8');
    expect(session.plannedThrows).toBe(12);
    expect(session.sessionThrows).toHaveLength(12);
    expect(sessionMaxScore(session)).toBe(12);
    expect(sessionThrowCount(session)).toBe(12);
  });

  it('scores only completed applied throws', () => {
    const session = createBlankSession('approaches', { distanceMeters: '45', plannedThrows: 4 });

    session.sessionThrows[0] = {
      ...session.sessionThrows[0],
      completed: false,
      approachDistanceMeters: '2',
      approachDirection: 'front',
    };
    session.sessionThrows[1] = {
      ...session.sessionThrows[1],
      completed: true,
      error: 'left',
      approachDistanceMeters: '5',
      approachDirection: 'left',
    };
    session.sessionThrows[2] = {
      ...session.sessionThrows[2],
      completed: true,
      error: 'long',
      approachDistanceMeters: '9',
      approachDirection: 'back',
    };

    expect(sessionScore(session)).toBe(0);
    expect(completedThrows(session)).toBe(2);
    expect(sessionMaxScore(session)).toBe(8);
    expect(accuracyLabel(session)).toBe('0%');
    expect(averageDistanceLabel(session)).toBe('7 m');
  });

  it('finalizes early saved sessions to completed throws', () => {
    const session = createBlankSession('putting', { plannedThrows: 5 });
    session.sessionThrows[0] = { ...session.sessionThrows[0], completed: true, score: 1 };
    session.sessionThrows[1] = { ...session.sessionThrows[1], completed: true, score: 0 };

    const finalized = finalizeSessionForSave(session);

    expect(finalized.plannedThrows).toBe(2);
    expect(finalized.sessionThrows).toHaveLength(2);
    expect(sessionMaxScore(finalized)).toBe(2);
    expect(sessionScore(finalized)).toBe(1);
  });

  it('calculates progress stats across custom session types', () => {
    const sessions = [
      makeScoredSession('putting', 8, 10, 'left'),
      makeScoredSession('forehand', 4, 5, 'left'),
      makeScoredSession('approaches', 8, 10, 'right'),
      makeScoredSession('midranges', 2, 5),
    ];

    const stats = calculateProgressStats(sessions);

    expect(stats.lastScore).toBe('8/10');
    expect(stats.bestScore).toBe('8/10');
    expect(stats.averageLastFour).toBe('3.8 m');
    expect(stats.averageLastFourLabel).toBe('Avg dist');
    expect(stats.commonError).toBe('left (12)');
  });

  it('reads and writes sessions and drafts in localStorage', () => {
    const session = createBlankSession('forehand', { distanceMeters: '55', plannedThrows: 6 });
    session.date = '2026-06-28';
    session.windDirection = 'Headwind';
    session.wind = 'Medium';
    session.notes = 'Field session';
    session.sessionThrows[0] = {
      ...session.sessionThrows[0],
      completed: true,
      error: 'griplock',
      approachDistanceMeters: '5',
      approachDirection: 'right',
      releaseIssue: 'early release',
      puttResult: 'miss left',
    };

    saveSessions([session]);
    saveDraft(session);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
    expect(readStoredSessions()).toHaveLength(1);
    expect(sessionScore(readStoredSessions()[0])).toBe(1);
    expect(localStorage.getItem(DRAFT_KEY)).toContain('Field session');
    expect(readDraft()?.distanceMeters).toBe('55');
    expect(readDraft()?.plannedThrows).toBe(6);
    expect(readDraft()?.sessionThrows[0].releaseIssue).toBe('early release');

    localStorage.setItem(STORAGE_KEY, 'not json');
    localStorage.setItem(DRAFT_KEY, '{}');

    expect(readStoredSessions()).toEqual([]);
    expect(readDraft()).toBeNull();
  });

  it('reads and writes saved discs in localStorage', () => {
    const disc = createDisc('  Pure  ', 'putter', {
      brand: 'Latitude 64',
      speed: 3,
      glide: 3,
      turn: -1,
      fade: 1,
      stability: 'Stable',
      source: 'discit',
      sourceId: 'pure-id',
      sourceSlug: 'pure',
      brandSlug: 'latitude-64',
      imageUrl: 'https://example.com/pure.webp',
      infoUrl: 'https://example.com/pure',
      importedAt: '2026-06-28T12:00:00.000Z',
      attribution: 'Disc data supplied by DiscIt API.',
    });

    saveDiscs([disc]);

    expect(JSON.parse(localStorage.getItem(DISCS_KEY) ?? '[]')).toHaveLength(1);
    expect(readStoredDiscs()).toMatchObject([
      {
        name: 'Pure',
        category: 'putter',
        brand: 'Latitude 64',
        speed: 3,
        glide: 3,
        turn: -1,
        fade: 1,
        stability: 'Stable',
        source: 'discit',
        sourceId: 'pure-id',
        sourceSlug: 'pure',
        brandSlug: 'latitude-64',
        imageUrl: 'https://example.com/pure.webp',
        infoUrl: 'https://example.com/pure',
        importedAt: '2026-06-28T12:00:00.000Z',
        attribution: 'Disc data supplied by DiscIt API.',
      },
    ]);

    localStorage.setItem(DISCS_KEY, JSON.stringify([{ name: '', category: 'mid-range' }, { name: 'Bad' }]));
    expect(readStoredDiscs()).toEqual([]);

    localStorage.setItem(DISCS_KEY, 'not json');
    expect(readStoredDiscs()).toEqual([]);
  });

  it('creates and stores courses with local course runs for multiple players', () => {
    const course = createCourse(
      '  Local Park  ',
      createCourseHoles(2).map((hole, index) => ({
        ...hole,
        par: index === 0 ? 3 : 4,
        distanceMeters: index === 0 ? 85 : 126,
      })),
      {
        source: 'discgolfapi',
        sourceId: 'crs_local_park',
        sourceSlug: 'local-park',
        lat: 61.5,
        lon: 23.7,
        locality: 'Tampere',
        importedAt: '2026-06-28T12:00:00.000Z',
        attribution: 'Course data supplied by DiscGolfAPI.',
      }
    );

    saveCourses([course]);

    expect(JSON.parse(localStorage.getItem(COURSES_KEY) ?? '[]')).toHaveLength(1);
    expect(readStoredCourses()[0]).toMatchObject({
      name: 'Local Park',
      source: 'discgolfapi',
      sourceId: 'crs_local_park',
      sourceSlug: 'local-park',
      lat: 61.5,
      lon: 23.7,
      locality: 'Tampere',
      importedAt: '2026-06-28T12:00:00.000Z',
      attribution: 'Course data supplied by DiscGolfAPI.',
      holes: [
        { number: 1, par: 3, distanceMeters: 85 },
        { number: 2, par: 4, distanceMeters: 126 },
      ],
    });

    const run = createCourseRun(course, ['Alex', 'Sam'], '2026-06-28');
    const alex = run.players[0];

    run.holes[0].players[alex.id].throws.push(
      createCourseRunThrow(1, {
        discId: 'disc-zone',
        style: 'backhand',
        angle: 'hyzer',
        notes: 'Safe gap',
      }),
      createCourseRunThrow(2, {
        style: 'putt',
        angle: 'flat',
      })
    );
    run.holes[0].players[alex.id].notes = 'Good first shot.';

    saveCourseRuns([run]);

    expect(JSON.parse(localStorage.getItem(COURSE_RUNS_KEY) ?? '[]')).toHaveLength(1);

    const storedRun = readStoredCourseRuns()[0];

    expect(storedRun).toMatchObject({
      courseName: 'Local Park',
      date: '2026-06-28',
      players: [{ name: 'Alex' }, { name: 'Sam' }],
      holes: [
        { number: 1, par: 3, distanceMeters: 85 },
        { number: 2, par: 4, distanceMeters: 126 },
      ],
    });
    expect(storedRun.holes[0].players[alex.id].throws[0]).toMatchObject({
      throwNumber: 1,
      discId: 'disc-zone',
      style: 'backhand',
      angle: 'hyzer',
      notes: 'Safe gap',
    });
    expect(storedRun.holes[0].players[alex.id].notes).toBe('Good first shot.');
    expect(courseRunScoreToPar(storedRun, alex.id)).toBe(-1);
    expect(courseRunPlayerSummary(storedRun, alex.id)).toBe('2 throws, 1/2 holes, -1');

    localStorage.setItem(COURSES_KEY, 'not json');
    localStorage.setItem(COURSE_RUNS_KEY, '{}');

    expect(readStoredCourses()).toEqual([]);
    expect(readStoredCourseRuns()).toEqual([]);
  });

  it('measures and stores GPS distance throws locally', () => {
    const start = {
      lat: 0,
      lon: 0,
      accuracyMeters: 4,
      recordedAt: '2026-06-28T12:00:00.000Z',
    };
    const end = {
      lat: 0,
      lon: 0.001,
      accuracyMeters: 5,
      recordedAt: '2026-06-28T12:01:00.000Z',
    };
    const distanceThrow = createDistanceThrow(start, end, {
      date: '2026-06-28',
      discId: 'disc-id',
      style: 'backhand',
      angle: 'hyzer',
      wind: 'Light',
      windDirection: 'Tailwind',
      notes: 'Flat field',
    });

    expect(gpsDistanceMeters(start, end)).toBeCloseTo(111.2, 1);
    expect(distanceThrow.distanceMeters).toBeCloseTo(111.2, 1);

    const shorterThrow = {
      ...distanceThrow,
      id: 'shorter',
      distanceMeters: 80,
      createdAt: '2026-06-28T12:02:00.000Z',
    };

    saveDistanceThrows([distanceThrow, shorterThrow]);

    expect(JSON.parse(localStorage.getItem(DISTANCE_THROWS_KEY) ?? '[]')).toHaveLength(2);
    expect(readStoredDistanceThrows()[0]).toMatchObject({
      date: '2026-06-28',
      discId: 'disc-id',
      style: 'backhand',
      angle: 'hyzer',
      wind: 'Light',
      windDirection: 'Tailwind',
      notes: 'Flat field',
      start,
      end,
    });
    expect(bestDistanceThrow(readStoredDistanceThrows())?.id).toBe(distanceThrow.id);
    expect(averageDistanceThrows(readStoredDistanceThrows())).toBeCloseTo((distanceThrow.distanceMeters + 80) / 2, 1);

    localStorage.setItem(DISTANCE_THROWS_KEY, 'not json');
    expect(readStoredDistanceThrows()).toEqual([]);
  });

  it('summarizes the most common tracked parameter in one session', () => {
    const session = createBlankSession('forehand', { plannedThrows: 4 });
    session.sessionThrows[0] = { ...session.sessionThrows[0], completed: true, releaseIssue: 'wobble' };
    session.sessionThrows[1] = { ...session.sessionThrows[1], completed: true, releaseIssue: 'wobble' };
    session.sessionThrows[2] = { ...session.sessionThrows[2], completed: true, releaseIssue: 'griplock' };
    session.sessionThrows[3] = { ...session.sessionThrows[3], completed: true, error: 'left' };

    expect(sessionMostCommonParameter(session)).toMatchObject({
      label: 'Release wobble',
      category: 'Release',
      value: 'wobble',
      count: 2,
    });
    expect(sessionMostCommonParameterLabel(session)).toBe('Release wobble (2)');
  });

  it('creates an AI-friendly history export with summaries and throw details', () => {
    const disc = createDisc('Zone', 'putter');
    const approach = createBlankSession('approaches', { distanceMeters: '40', plannedThrows: 2 });
    approach.date = '2026-06-20';
    approach.windDirection = 'Headwind';
    approach.wind = 'Light';
    approach.notes = 'Hyzer release focus';
    approach.sessionThrows[0] = {
      ...approach.sessionThrows[0],
      completed: true,
      discId: disc.id,
      error: 'left',
      approachDistanceMeters: '2.5',
      approachDirection: 'front',
      releaseIssue: 'wobble',
    };

    const putting = createBlankSession('putting', { distanceMeters: '8', plannedThrows: 1 });
    putting.sessionThrows[0] = {
      ...putting.sessionThrows[0],
      completed: true,
      score: 1,
      puttResult: 'chains middle',
    };

    const exported = createAiHistoryExport([approach, putting], [disc], '2026-06-28T12:00:00.000Z');

    expect(exported.format).toBe('disc-golf-training-history-v1');
    expect(exported.summary).toMatchObject({
      sessionCount: 2,
      completedThrowCount: 2,
      lastScore: '2/4',
      bestScore: '1/1',
      mostCommonError: 'left (1)',
    });
    expect(exported.summary.sessionsByType).toMatchObject({ approaches: 1, putting: 1, midranges: 0, forehand: 0 });
    expect(exported.discs[0]).toMatchObject({ id: disc.id, name: 'Zone', category: 'putter' });
    expect(exported.sessions[0]).toMatchObject({
      trainingType: 'approaches',
      trainingTitle: 'Putter approaches',
      plannedDistanceMeters: '40',
      plannedThrows: 2,
      completedThrows: 1,
      score: 2,
      maxScore: 4,
      metric: { label: 'Avg dist', value: '2.5 m' },
      topParameter: { label: 'Release wobble', category: 'Release', value: 'wobble', count: 1 },
      averageDistanceToBasketMeters: 2.5,
      conditions: {
        wind: 'Light',
        windDirection: 'Headwind',
        fatigue: 3,
        notes: 'Hyzer release focus',
      },
    });
    expect(exported.sessions[0].throws[0]).toMatchObject({
      throwNumber: 1,
      completed: true,
      score: 2,
      disc: { id: disc.id, name: 'Zone', category: 'putter' },
      error: 'left',
      distanceToBasketMeters: 2.5,
      directionFromBasket: 'front',
      releaseIssue: 'wobble',
    });
    expect(exported.sessions[0].throws[1]).toEqual({ throwNumber: 2, completed: false });
    expect(JSON.parse(createAiHistoryExportText([putting], [], '2026-06-28T12:00:00.000Z')).analysisPrompt).toContain(
      'Analyze this disc golf training history'
    );
  });
});
