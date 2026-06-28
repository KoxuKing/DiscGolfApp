import { describe, expect, it } from 'vitest';
import {
  DISCS_KEY,
  DRAFT_KEY,
  STORAGE_KEY,
  accuracyLabel,
  averageDistanceLabel,
  calculateProgressStats,
  completedThrows,
  createAiHistoryExport,
  createAiHistoryExportText,
  createBlankSession,
  createDisc,
  readDraft,
  readStoredDiscs,
  readStoredSessions,
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
    const disc = createDisc('  Pure  ', 'putter');

    saveDiscs([disc]);

    expect(JSON.parse(localStorage.getItem(DISCS_KEY) ?? '[]')).toHaveLength(1);
    expect(readStoredDiscs()).toMatchObject([{ name: 'Pure', category: 'putter' }]);

    localStorage.setItem(DISCS_KEY, JSON.stringify([{ name: '', category: 'mid-range' }, { name: 'Bad' }]));
    expect(readStoredDiscs()).toEqual([]);

    localStorage.setItem(DISCS_KEY, 'not json');
    expect(readStoredDiscs()).toEqual([]);
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
