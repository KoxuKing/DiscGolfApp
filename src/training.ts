export const STORAGE_KEY = 'disc-golf-training-sessions-v1';
export const DRAFT_KEY = 'disc-golf-training-draft-v1';
export const DISCS_KEY = 'disc-golf-training-discs-v1';

export type SectionId = 'approaches' | 'putting' | 'midranges' | 'forehand';
export type TrainingType = SectionId | 'full';
export type DiscCategory = 'putter' | 'mid-range' | 'fairway driver' | 'distance driver';
export type ErrorType =
  | ''
  | 'left'
  | 'right'
  | 'short'
  | 'long'
  | 'wobble'
  | 'nose up'
  | 'griplock'
  | 'turnover';
export type PuttResult =
  | ''
  | 'chains middle'
  | 'chains left'
  | 'chains right'
  | 'chains top'
  | 'chains bottom'
  | 'miss left'
  | 'miss right'
  | 'miss high'
  | 'miss low'
  | 'miss short'
  | 'miss long';
export type ApproachDirection = '' | 'left' | 'right' | 'front' | 'back';
export type ReleaseIssue = '' | 'wobble' | 'too high' | 'too low' | 'griplock' | 'early release';

export type ScoreOption = {
  value: number;
  label: string;
};

export type Drill = {
  id: string;
  label: string;
  maxPerThrow: number;
  scoreOptions: ScoreOption[];
};

export type SectionConfig = {
  id: SectionId;
  title: string;
  maxScore: number;
  accent: string;
  drills: Drill[];
};

export type ThrowResult = {
  score: number | null;
  completed: boolean;
  error: ErrorType;
  discId?: string;
  puttResult?: PuttResult;
  approachDistanceMeters?: string;
  approachDirection?: ApproachDirection;
  releaseIssue?: ReleaseIssue;
};

export type ThrowMap = Record<SectionId, Record<string, ThrowResult[]>>;

export type TrainingSession = {
  id: string;
  createdAt: string;
  trainingType: TrainingType;
  distanceMeters: string;
  plannedThrows: number;
  currentThrowIndex: number;
  date: string;
  wind: string;
  windDirection: string;
  fatigue: number;
  notes: string;
  sessionThrows: ThrowResult[];
  throws: ThrowMap;
};

export type ProgressStats = {
  lastScore: string | null;
  bestScore: string | null;
  averageLastFour: string | null;
  averageLastFourLabel: string;
  commonError: string;
};

export type SessionParameterSummary = {
  label: string;
  category: string;
  value: string;
  count: number;
};

export type Disc = {
  id: string;
  name: string;
  category: DiscCategory;
  createdAt: string;
};

export type AiHistoryExport = ReturnType<typeof createAiHistoryExport>;

const approachOptions: ScoreOption[] = [
  { value: 2, label: '0-3 m' },
  { value: 1, label: '3-7 m' },
  { value: 0, label: '>7 m' },
  { value: -1, label: 'Long -1' },
];

const madeOptions: ScoreOption[] = [
  { value: 1, label: 'Made' },
  { value: 0, label: 'Miss' },
];

const hitOptions: ScoreOption[] = [
  { value: 1, label: 'Hit' },
  { value: 0, label: 'Miss' },
];

const cleanOptions: ScoreOption[] = [
  { value: 1, label: 'Clean' },
  { value: 0, label: 'Fail' },
];

export const sections: SectionConfig[] = [
  {
    id: 'approaches',
    title: 'Putter approaches',
    maxScore: 40,
    accent: 'green',
    drills: ['30 m', '40 m', '50 m', '60 m'].map((label) => ({
      id: label,
      label,
      maxPerThrow: 2,
      scoreOptions: approachOptions,
    })),
  },
  {
    id: 'putting',
    title: 'Putting',
    maxScore: 25,
    accent: 'amber',
    drills: ['5 m', '7 m', '9 m', '10 m', 'Lag 12-15 m'].map((label) => ({
      id: label,
      label,
      maxPerThrow: 1,
      scoreOptions: madeOptions,
    })),
  },
  {
    id: 'midranges',
    title: 'Midranges',
    maxScore: 20,
    accent: 'blue',
    drills: ['70 m', '80 m', '90 m', '100 m'].map((label) => ({
      id: label,
      label,
      maxPerThrow: 1,
      scoreOptions: hitOptions,
    })),
  },
  {
    id: 'forehand',
    title: 'Forehand',
    maxScore: 15,
    accent: 'red',
    drills: ['30 m', '50 m', '70 m'].map((label) => ({
      id: label,
      label,
      maxPerThrow: 1,
      scoreOptions: cleanOptions,
    })),
  },
];

export const totalMaxScore = sections.reduce((sum, section) => sum + section.maxScore, 0);
export const totalThrowCount = sections.reduce((sum, section) => sum + section.drills.length * 5, 0);

export const errorTypes: ErrorType[] = [
  '',
  'left',
  'right',
  'short',
  'long',
  'wobble',
  'nose up',
  'griplock',
  'turnover',
];
export const madePuttResults: PuttResult[] = [
  'chains middle',
  'chains left',
  'chains right',
  'chains top',
  'chains bottom',
];
export const missedPuttResults: PuttResult[] = [
  'miss left',
  'miss right',
  'miss high',
  'miss low',
  'miss short',
  'miss long',
];
export const puttResults: PuttResult[] = ['', ...madePuttResults, ...missedPuttResults];
export const approachDirections: ApproachDirection[] = ['', 'left', 'right', 'front', 'back'];
export const releaseIssues: ReleaseIssue[] = ['', 'wobble', 'too high', 'too low', 'griplock', 'early release'];
export const windDirections = ['', 'Headwind', 'Tailwind', 'Left-to-right', 'Right-to-left', 'Swirling'];
export const windStrengths = ['', 'Calm', 'Light', 'Medium', 'Strong', 'Gusty'];
export const discCategories: DiscCategory[] = ['putter', 'mid-range', 'fairway driver', 'distance driver'];
export const defaultProximityDistanceMeters = '5';
export const defaultProximityDirection: ApproachDirection = 'front';

export function todayIsoDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sectionById(sectionId: SectionId) {
  return sections.find((section) => section.id === sectionId) ?? sections[0];
}

export function maxPerThrow(trainingType: TrainingType) {
  if (trainingType === 'approaches') {
    return 2;
  }

  return 1;
}

export function scoreOptionsForType(trainingType: TrainingType) {
  return trainingType === 'putting' ? madeOptions : [];
}

export function usesManualScore(trainingType: TrainingType) {
  return trainingType === 'putting';
}

export function usesProximityScore(trainingType: TrainingType) {
  return trainingType === 'approaches' || trainingType === 'midranges' || trainingType === 'forehand';
}

export function puttResultsForScore(score: number | null) {
  if (score === 1) {
    return madePuttResults;
  }

  if (score === 0) {
    return missedPuttResults;
  }

  return [];
}

export function defaultPuttResultForScore(score: number | null): PuttResult {
  return puttResultsForScore(score)[0] ?? '';
}

export function puttResultMatchesScore(score: number | null, puttResult: PuttResult | undefined) {
  return puttResultsForScore(score).includes(puttResult ?? '');
}

function effectiveProximityDistance(result: ThrowResult) {
  const rawDistance = (result.approachDistanceMeters ?? '').trim() || defaultProximityDistanceMeters;
  const distance = Number.parseFloat(rawDistance);
  return Number.isFinite(distance) ? distance : null;
}

export function applyThrowDefaults(trainingType: TrainingType, result: ThrowResult) {
  if (trainingType === 'putting') {
    return {
      ...result,
      puttResult: puttResultMatchesScore(result.score, result.puttResult)
        ? result.puttResult
        : defaultPuttResultForScore(result.score),
    };
  }

  if (!usesProximityScore(trainingType)) {
    return result;
  }

  return {
    ...result,
    approachDistanceMeters: (result.approachDistanceMeters ?? '').trim() || defaultProximityDistanceMeters,
    approachDirection: result.approachDirection || defaultProximityDirection,
  };
}

export function proximityScore(trainingType: TrainingType, result: ThrowResult) {
  const distance = effectiveProximityDistance(result);

  if (distance === null) {
    return null;
  }

  if (trainingType === 'approaches') {
    if (result.approachDirection === 'back' && distance > 7) {
      return -1;
    }

    if (distance <= 3) {
      return 2;
    }

    if (distance <= 7) {
      return 1;
    }

    return 0;
  }

  if (trainingType === 'midranges' || trainingType === 'forehand') {
    return distance <= 7 ? 1 : 0;
  }

  return result.score;
}

export function scoreForThrow(trainingType: TrainingType, result: ThrowResult) {
  if (usesProximityScore(trainingType)) {
    return proximityScore(trainingType, result);
  }

  return result.score;
}

export function canApplyThrow(trainingType: TrainingType, result: ThrowResult) {
  if (usesProximityScore(trainingType)) {
    return proximityScore(trainingType, result) !== null;
  }

  return result.score !== null;
}

export function defaultDistanceForType(trainingType: TrainingType) {
  const distances: Record<SectionId, string> = {
    approaches: '40',
    putting: '7',
    midranges: '80',
    forehand: '50',
  };

  return trainingType === 'full' ? '' : distances[trainingType];
}

export function createBlankThrow(): ThrowResult {
  return {
    score: null,
    completed: false,
    error: '',
    discId: '',
    puttResult: '',
    approachDistanceMeters: defaultProximityDistanceMeters,
    approachDirection: defaultProximityDirection,
    releaseIssue: '',
  };
}

export function createSessionThrows(plannedThrows: number) {
  return Array.from({ length: Math.max(1, plannedThrows) }, () => createBlankThrow());
}

export function createInitialThrows(): ThrowMap {
  return sections.reduce((sectionMap, section) => {
    sectionMap[section.id] = section.drills.reduce<Record<string, ThrowResult[]>>((drillMap, drill) => {
      drillMap[drill.id] = Array.from({ length: 5 }, () => createBlankThrow());
      return drillMap;
    }, {});
    return sectionMap;
  }, {} as ThrowMap);
}

export function createBlankSession(
  trainingType: TrainingType = 'approaches',
  options: { distanceMeters?: string; plannedThrows?: number } = {}
): TrainingSession {
  const plannedThrows = clampPlannedThrows(options.plannedThrows ?? 10);

  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    trainingType,
    distanceMeters: options.distanceMeters ?? defaultDistanceForType(trainingType),
    plannedThrows,
    currentThrowIndex: 0,
    date: todayIsoDate(),
    wind: '',
    windDirection: '',
    fatigue: 3,
    notes: '',
    sessionThrows: createSessionThrows(plannedThrows),
    throws: createInitialThrows(),
  };
}

export function clampPlannedThrows(value: number) {
  if (!Number.isFinite(value)) {
    return 10;
  }

  return Math.min(200, Math.max(1, Math.round(value)));
}

export function normalizeThrow(input: Partial<ThrowResult> | undefined): ThrowResult {
  return {
    score: input?.score ?? null,
    completed: input?.completed ?? input?.score !== null,
    error: input?.error ?? '',
    discId: input?.discId ?? '',
    puttResult: input?.puttResult ?? '',
    approachDistanceMeters: input?.approachDistanceMeters ?? '',
    approachDirection: input?.approachDirection ?? '',
    releaseIssue: input?.releaseIssue ?? '',
  };
}

function flattenLegacyThrows(input: TrainingSession, trainingType: TrainingType) {
  const sourceThrows = input.throws ?? createInitialThrows();
  const sourceSections = trainingType === 'full' ? sections : [sectionById(trainingType)];

  return sourceSections.flatMap((section) =>
    section.drills.flatMap((drill) => (sourceThrows[section.id]?.[drill.id] ?? []).map(normalizeThrow))
  );
}

function normalizeThrowList(input: TrainingSession, trainingType: TrainingType) {
  if (Array.isArray(input.sessionThrows) && input.sessionThrows.length > 0) {
    return input.sessionThrows.map(normalizeThrow);
  }

  const legacyThrows = flattenLegacyThrows(input, trainingType);
  return legacyThrows.length > 0 ? legacyThrows : createSessionThrows(input.plannedThrows ?? 10);
}

export function getSessionSections(session: TrainingSession) {
  if (session.trainingType === 'full') {
    return sections;
  }

  return [sectionById(session.trainingType)];
}

export function sessionTitle(session: TrainingSession) {
  if (session.trainingType === 'full') {
    return 'Full training';
  }

  return sectionById(session.trainingType).title;
}

export function sessionMaxScore(session: TrainingSession) {
  if (session.trainingType === 'full') {
    return totalMaxScore;
  }

  return session.plannedThrows * maxPerThrow(session.trainingType);
}

export function sessionThrowCount(session: TrainingSession) {
  return session.plannedThrows;
}

export function completedSessionThrows(session: TrainingSession) {
  return session.sessionThrows.filter((result) => result.completed);
}

export function sessionScore(session: TrainingSession) {
  return completedSessionThrows(session).reduce((sum, result) => sum + (scoreForThrow(session.trainingType, result) ?? 0), 0);
}

export function completedThrows(session: TrainingSession) {
  return completedSessionThrows(session).length;
}

export function isSessionComplete(session: TrainingSession) {
  return completedThrows(session) >= session.plannedThrows;
}

export function currentThrowIndex(session: TrainingSession) {
  if (isSessionComplete(session)) {
    return Math.max(0, session.plannedThrows - 1);
  }

  const firstOpen = session.sessionThrows.findIndex((result) => !result.completed);
  return firstOpen === -1 ? Math.max(0, session.plannedThrows - 1) : firstOpen;
}

export function currentThrowNumber(session: TrainingSession) {
  if (isSessionComplete(session)) {
    return session.plannedThrows;
  }

  return currentThrowIndex(session) + 1;
}

export function currentThrow(session: TrainingSession) {
  return session.sessionThrows[currentThrowIndex(session)] ?? createBlankThrow();
}

export function scoreLabel(session: TrainingSession) {
  return `${sessionScore(session)}/${sessionMaxScore(session)}`;
}

export function sessionPercent(session: TrainingSession) {
  const maxScore = sessionMaxScore(session);
  if (maxScore === 0) {
    return 0;
  }

  return sessionScore(session) / maxScore;
}

export function sessionAccuracy(session: TrainingSession) {
  return Math.round(sessionPercent(session) * 100);
}

export function accuracyLabel(session: TrainingSession) {
  return `${sessionAccuracy(session)}%`;
}

export function distanceToBasket(result: ThrowResult) {
  const distance = Number.parseFloat(result.approachDistanceMeters ?? '');
  return Number.isFinite(distance) ? distance : null;
}

export function completedDistanceValues(session: TrainingSession) {
  if (!usesProximityScore(session.trainingType)) {
    return [];
  }

  return completedSessionThrows(session).flatMap((result) => {
    const distance = distanceToBasket(result);
    return distance === null ? [] : [distance];
  });
}

export function averageDistanceToBasket(session: TrainingSession) {
  const distances = completedDistanceValues(session);
  if (distances.length === 0) {
    return null;
  }

  return distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
}

export function distanceLabel(value: number) {
  return `${formatScore(value)} m`;
}

export function averageDistanceLabel(session: TrainingSession) {
  const averageDistance = averageDistanceToBasket(session);
  return averageDistance === null ? '-' : distanceLabel(averageDistance);
}

export function sessionMetricName(session: TrainingSession) {
  return session.trainingType === 'putting' ? 'Accuracy' : 'Avg dist';
}

export function sessionMetricValue(session: TrainingSession) {
  return session.trainingType === 'putting' ? accuracyLabel(session) : averageDistanceLabel(session);
}

export function sessionMetricBadge(session: TrainingSession) {
  return session.trainingType === 'putting' ? accuracyLabel(session) : `Avg ${averageDistanceLabel(session)}`;
}

export function sessionScoreAriaLabel(session: TrainingSession) {
  const scoreText = `Current score ${sessionScore(session)} out of ${sessionMaxScore(session)}`;
  if (session.trainingType === 'putting') {
    return `${scoreText}, accuracy ${accuracyLabel(session)}`;
  }

  const averageDistance = averageDistanceToBasket(session);
  return `${scoreText}, average distance ${averageDistance === null ? 'no throws' : distanceLabel(averageDistance)}`;
}

export function sectionScore(session: TrainingSession, section: SectionConfig) {
  if (session.trainingType === section.id) {
    return sessionScore(session);
  }

  return section.drills.reduce((sum, drill) => {
    return (
      sum +
      (session.throws[section.id]?.[drill.id] ?? []).reduce((drillSum, result) => {
        return drillSum + (result.completed || result.score !== null ? scoreForThrow(section.id, result) ?? 0 : 0);
      }, 0)
    );
  }, 0);
}

export function sessionConditionParts(session: TrainingSession) {
  return [
    session.distanceMeters ? `${session.distanceMeters} m` : '',
    `${session.plannedThrows} throws`,
    session.windDirection,
    session.wind ? `${session.wind} wind` : '',
    `Fatigue ${session.fatigue}`,
  ].filter(Boolean);
}

export function sessionConditionLabel(session: TrainingSession) {
  const parts = sessionConditionParts(session);
  return parts.length > 0 ? parts.join(' - ') : 'No conditions';
}

function addParameterCount(
  counts: Map<string, SessionParameterSummary>,
  category: string,
  value: string | undefined
) {
  if (!value) {
    return;
  }

  const key = `${category}:${value}`;
  const current = counts.get(key);

  counts.set(key, {
    label: `${category} ${value}`,
    category,
    value,
    count: (current?.count ?? 0) + 1,
  });
}

export function sessionMostCommonParameter(session: TrainingSession) {
  const counts = new Map<string, SessionParameterSummary>();

  completedSessionThrows(session).forEach((result) => {
    addParameterCount(counts, 'Release', result.releaseIssue);
    addParameterCount(counts, 'Putt', result.puttResult);
    addParameterCount(counts, 'Error', result.error);
  });

  const [top] = [...counts.values()].sort((a, b) => b.count - a.count);
  return top ?? null;
}

export function sessionMostCommonParameterLabel(session: TrainingSession) {
  const parameter = sessionMostCommonParameter(session);
  return parameter ? `${parameter.label} (${parameter.count})` : 'None yet';
}

function normalizeSession(input: TrainingSession): TrainingSession {
  const trainingType = input.trainingType ?? 'full';
  const sessionThrows = normalizeThrowList(input, trainingType);
  const plannedThrows = clampPlannedThrows(input.plannedThrows ?? sessionThrows.length);
  const paddedThrows = [...sessionThrows.slice(0, plannedThrows)];

  while (paddedThrows.length < plannedThrows) {
    paddedThrows.push(createBlankThrow());
  }

  return {
    ...input,
    trainingType,
    distanceMeters: input.distanceMeters ?? defaultDistanceForType(trainingType),
    plannedThrows,
    currentThrowIndex: Math.min(input.currentThrowIndex ?? currentThrowIndex({ ...input, sessionThrows: paddedThrows, plannedThrows } as TrainingSession), plannedThrows - 1),
    wind: input.wind ?? '',
    windDirection: input.windDirection ?? '',
    fatigue: input.fatigue ?? 3,
    notes: input.notes ?? '',
    sessionThrows: paddedThrows,
    throws: input.throws ?? createInitialThrows(),
  };
}

export function readStoredSessions(): TrainingSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as TrainingSession[];
    return Array.isArray(parsed) ? parsed.map(normalizeSession) : [];
  } catch {
    return [];
  }
}

export function readDraft(): TrainingSession | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as TrainingSession;
    if (!parsed.date) {
      return null;
    }

    return normalizeSession(parsed);
  } catch {
    return null;
  }
}

function normalizeDisc(input: Partial<Disc> | undefined): Disc | null {
  const name = input?.name?.trim();
  const category = input?.category;

  if (!name || !category || !discCategories.includes(category)) {
    return null;
  }

  return {
    id: input.id || makeId(),
    name,
    category,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function createDisc(name: string, category: DiscCategory): Disc {
  const normalized = normalizeDisc({ id: makeId(), name, category, createdAt: new Date().toISOString() });

  if (!normalized) {
    throw new Error('Disc name and category are required');
  }

  return normalized;
}

export function readStoredDiscs(): Disc[] {
  try {
    const raw = localStorage.getItem(DISCS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Disc[];
    return Array.isArray(parsed) ? parsed.flatMap((disc) => normalizeDisc(disc) ?? []) : [];
  } catch {
    return [];
  }
}

export function saveDiscs(discsToSave: Disc[]) {
  localStorage.setItem(DISCS_KEY, JSON.stringify(discsToSave));
}

export function saveSessions(sessionsToSave: TrainingSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToSave));
}

export function saveDraft(draft: TrainingSession | null) {
  if (!draft) {
    localStorage.removeItem(DRAFT_KEY);
    return;
  }

  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function mostCommonError(sessionsToRead: TrainingSession[]) {
  const counts = new Map<ErrorType, number>();

  sessionsToRead.forEach((session) => {
    session.sessionThrows.forEach((result) => {
      if (result.completed && result.error) {
        counts.set(result.error, (counts.get(result.error) ?? 0) + 1);
      }
    });
  });

  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top ? `${top[0]} (${top[1]})` : 'None yet';
}

export function calculateProgressStats(sessionsToRead: TrainingSession[]): ProgressStats {
  const lastFour = sessionsToRead.slice(0, 4);
  const recentDistances = lastFour.flatMap(completedDistanceValues);
  const showingPuttingAverage =
    recentDistances.length === 0 && lastFour.length > 0 && lastFour.every((session) => session.trainingType === 'putting');
  const averageLastFour =
    recentDistances.length > 0
      ? distanceLabel(recentDistances.reduce((sum, distance) => sum + distance, 0) / recentDistances.length)
      : showingPuttingAverage
        ? `${Math.round((lastFour.reduce((sum, session) => sum + sessionPercent(session), 0) / lastFour.length) * 100)}%`
        : null;
  const averageLastFourLabel = recentDistances.length > 0 ? 'Avg dist' : showingPuttingAverage ? 'Avg putting' : 'Avg dist';
  const bestSession =
    sessionsToRead.length > 0
      ? [...sessionsToRead].sort((a, b) => sessionPercent(b) - sessionPercent(a))[0]
      : null;

  return {
    lastScore: sessionsToRead[0] ? scoreLabel(sessionsToRead[0]) : null,
    bestScore: bestSession ? scoreLabel(bestSession) : null,
    averageLastFour,
    averageLastFourLabel,
    commonError: mostCommonError(sessionsToRead),
  };
}

function sessionsByType(sessionsToExport: TrainingSession[]) {
  return sections.reduce<Record<SectionId, number>>((counts, section) => {
    counts[section.id] = sessionsToExport.filter((session) => session.trainingType === section.id).length;
    return counts;
  }, {} as Record<SectionId, number>);
}

function exportDisc(disc: Disc | undefined) {
  return disc ? { id: disc.id, name: disc.name, category: disc.category } : undefined;
}

function exportThrow(trainingType: TrainingType, result: ThrowResult, index: number, discsById: Map<string, Disc>) {
  const disc = exportDisc(result.discId ? discsById.get(result.discId) : undefined);

  if (!result.completed) {
    return {
      throwNumber: index + 1,
      completed: false,
      ...(disc ? { disc } : {}),
    };
  }

  const proximityDistance = usesProximityScore(trainingType) ? distanceToBasket(result) : null;

  return {
    throwNumber: index + 1,
    completed: true,
    score: scoreForThrow(trainingType, result) ?? 0,
    ...(disc ? { disc } : {}),
    error: result.error || undefined,
    puttResult: trainingType === 'putting' ? result.puttResult || undefined : undefined,
    distanceToBasketMeters: proximityDistance ?? undefined,
    directionFromBasket: usesProximityScore(trainingType) ? result.approachDirection || undefined : undefined,
    releaseIssue: usesProximityScore(trainingType) ? result.releaseIssue || undefined : undefined,
  };
}

export function createAiHistoryExport(
  sessionsToExport: TrainingSession[],
  discsToExport: Disc[] = [],
  exportedAt = new Date().toISOString()
) {
  const stats = calculateProgressStats(sessionsToExport);
  const discsById = new Map(discsToExport.map((disc) => [disc.id, disc]));

  return {
    format: 'disc-golf-training-history-v1',
    exportedAt,
    analysisPrompt:
      'Analyze this disc golf training history. Look for progress trends, common misses, wind/fatigue patterns, and concrete practice recommendations.',
    summary: {
      sessionCount: sessionsToExport.length,
      completedThrowCount: sessionsToExport.reduce((sum, session) => sum + completedThrows(session), 0),
      sessionsByType: sessionsByType(sessionsToExport),
      lastScore: stats.lastScore,
      bestScore: stats.bestScore,
      recentAverageMetric: {
        label: stats.averageLastFourLabel,
        value: stats.averageLastFour,
      },
      mostCommonError: stats.commonError,
    },
    discs: discsToExport.map((disc) => ({
      id: disc.id,
      name: disc.name,
      category: disc.category,
      createdAt: disc.createdAt,
    })),
    sessions: sessionsToExport.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      date: session.date,
      trainingType: session.trainingType,
      trainingTitle: sessionTitle(session),
      plannedDistanceMeters: session.distanceMeters,
      plannedThrows: session.plannedThrows,
      completedThrows: completedThrows(session),
      score: sessionScore(session),
      maxScore: sessionMaxScore(session),
      metric: {
        label: sessionMetricName(session),
        value: sessionMetricValue(session),
      },
      topParameter: sessionMostCommonParameter(session) ?? undefined,
      accuracyPercent: session.trainingType === 'putting' ? sessionAccuracy(session) : undefined,
      averageDistanceToBasketMeters: averageDistanceToBasket(session) ?? undefined,
      conditions: {
        wind: session.wind || undefined,
        windDirection: session.windDirection || undefined,
        fatigue: session.fatigue,
        notes: session.notes || undefined,
      },
      throws: session.sessionThrows.map((result, index) => exportThrow(session.trainingType, result, index, discsById)),
    })),
  };
}

export function createAiHistoryExportText(
  sessionsToExport: TrainingSession[],
  discsToExport: Disc[] = [],
  exportedAt = new Date().toISOString()
) {
  return JSON.stringify(createAiHistoryExport(sessionsToExport, discsToExport, exportedAt), null, 2);
}

export function aiHistoryExportFilename(date = new Date()) {
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return `disc-golf-history-${date.toISOString().slice(0, 10)}.json`;
}

export function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function testIdPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
