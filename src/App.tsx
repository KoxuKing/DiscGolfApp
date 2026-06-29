import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Disc3,
  Download,
  Flag,
  History,
  Home,
  Map,
  MapPin,
  PlusCircle,
  RotateCcw,
  Save,
  Search,
  Target,
  Trash2,
  Trophy,
  Undo2,
  Users,
} from 'lucide-react';
import {
  DISCGOLFAPI_ATTRIBUTION,
  createCourseDraftFromImport,
  fetchFinlandDiscGolfCourses,
  isCourseAlreadyImported,
  sortImportedCourses,
  type Coordinates,
  type ImportedCourse,
} from './courseImport';
import {
  DISCIT_ATTRIBUTION,
  createDiscMetadataFromImport,
  fetchDiscItDiscs,
  importedDiscDisplayName,
  isDiscAlreadyImported,
  type ImportedDisc,
} from './discImport';
import {
  approachDirections,
  applyThrowDefaults,
  aiHistoryExportFilename,
  calculateProgressStats,
  canApplyThrow,
  clampCourseDistance,
  clampCoursePar,
  clampHoleCount,
  clampPlannedThrows,
  completedThrows,
  averageDistanceThrows,
  bestDistanceThrow,
  courseRunCurrentHole,
  courseRunCurrentPlayer,
  courseRunPlayerHole,
  courseRunPlayerSummary,
  createDisc,
  createBlankSession,
  createAiHistoryExportText,
  createCourse,
  createCourseHoles,
  createCourseRun,
  createCourseRunThrow,
  createDistanceThrow,
  currentThrow,
  currentThrowIndex,
  currentThrowNumber,
  defaultPuttResultForScore,
  defaultDistanceForType,
  discCategories,
  errorTypes,
  finalizeSessionForSave,
  isSessionComplete,
  makeId,
  puttResultsForScore,
  readStoredCourses,
  readStoredCourseRuns,
  readStoredDistanceThrows,
  readDraft,
  readStoredDiscs,
  readStoredSessions,
  releaseIssues,
  saveCourses,
  saveCourseRuns,
  saveDistanceThrows,
  saveDiscs,
  saveDraft,
  saveSessions,
  scoreForThrow,
  scoreOptionsForType,
  sections,
  sessionConditionLabel,
  sessionMaxScore,
  sessionMetricBadge,
  sessionMetricName,
  sessionMetricValue,
  sessionMostCommonParameter,
  sessionMostCommonParameterLabel,
  sessionScoreAriaLabel,
  sessionScore,
  sessionThrowCount,
  sessionTitle,
  throwAngles,
  throwStyles,
  todayIsoDate,
  usesManualScore,
  usesProximityScore,
  windDirections,
  windStrengths,
  type Course,
  type CourseHole,
  type CourseRun,
  type CourseRunThrow,
  type DistanceThrow,
  type Disc,
  type DiscCategory,
  type ErrorType,
  type SectionId,
  type ThrowAngle,
  type ThrowResult,
  type ThrowStyle,
  type TrainingSession,
  type GpsPoint,
} from './training';

type View = 'home' | 'new' | 'track' | 'history' | 'discs' | 'courses' | 'course-run' | 'distance';

function isTrainingView(view: View) {
  return view === 'home' || view === 'new' || view === 'track' || view === 'history' || view === 'distance';
}

type SessionSetup = {
  trainingType: SectionId;
  distanceMeters: string;
  plannedThrows: string;
  date: string;
  wind: string;
  windDirection: string;
  fatigue: number;
  notes: string;
};

function createSessionSetup(): SessionSetup {
  return {
    trainingType: 'approaches',
    distanceMeters: defaultDistanceForType('approaches'),
    plannedThrows: '10',
    date: todayIsoDate(),
    wind: '',
    windDirection: '',
    fatigue: 3,
    notes: '',
  };
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function copyTextFallback(text: string) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();

  const copied = document.execCommand('copy');
  field.remove();

  if (!copied) {
    throw new Error('Copy failed');
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  copyTextFallback(text);
}

function getCurrentCoordinates() {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  });
}

function gpsPointFromPosition(position: GeolocationPosition): GpsPoint {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    recordedAt: new Date(position.timestamp).toISOString(),
  };
}

function getCurrentGpsPoint() {
  return new Promise<GpsPoint>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(gpsPointFromPosition(position)),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function gpsAccuracyText(point: GpsPoint | null) {
  return point?.accuracyMeters !== undefined ? `${Math.round(point.accuracyMeters)} m` : '-';
}

function parsedEditableNumber(value: string) {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function editableNumberValue(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}

function editableClampedNumber(value: string, clamp: (numberValue: number) => number) {
  return value.trim() === '' ? Number.NaN : clamp(Number(value));
}

function plannedThrowsFromSetup(setup: SessionSetup) {
  return clampPlannedThrows(parsedEditableNumber(setup.plannedThrows));
}

function discSelectLabel(disc: Disc) {
  const flight =
    disc.speed !== undefined && disc.glide !== undefined && disc.turn !== undefined && disc.fade !== undefined
      ? ` ${disc.speed}/${disc.glide}/${disc.turn}/${disc.fade}`
      : '';

  return `${disc.name} - ${disc.category}${flight}`;
}

function App() {
  const initialDraft = readDraft();
  const [draft, setDraft] = useState<TrainingSession | null>(() => initialDraft);
  const [sessions, setSessions] = useState<TrainingSession[]>(() => readStoredSessions());
  const [discs, setDiscs] = useState<Disc[]>(() => readStoredDiscs());
  const [courses, setCourses] = useState<Course[]>(() => readStoredCourses());
  const [courseRuns, setCourseRuns] = useState<CourseRun[]>(() => readStoredCourseRuns());
  const [distanceThrows, setDistanceThrows] = useState<DistanceThrow[]>(() => readStoredDistanceThrows());
  const [activeCourseRun, setActiveCourseRun] = useState<CourseRun | null>(null);
  const [activeView, setActiveView] = useState<View>(() => (initialDraft ? 'track' : 'home'));
  const [setup, setSetup] = useState<SessionSetup>(() => createSessionSetup());

  const stats = useMemo(() => {
    return calculateProgressStats(sessions);
  }, [sessions]);

  function updateDraft(nextDraft: TrainingSession | null) {
    setDraft(nextDraft);
    saveDraft(nextDraft);
  }

  function updateSetup<Key extends keyof SessionSetup>(key: Key, value: SessionSetup[Key]) {
    setSetup((current) => ({ ...current, [key]: value }));
  }

  function updateTrainingType(trainingType: SectionId) {
    setSetup((current) => ({
      ...current,
      trainingType,
      distanceMeters: defaultDistanceForType(trainingType),
    }));
  }

  function updateMeta<Key extends keyof Pick<TrainingSession, 'date' | 'wind' | 'windDirection' | 'fatigue' | 'notes'>>(
    key: Key,
    value: TrainingSession[Key]
  ) {
    if (!draft) {
      return;
    }

    updateDraft({ ...draft, [key]: value });
  }

  function updateCurrentThrow(patch: Partial<ThrowResult>) {
    if (!draft || isSessionComplete(draft)) {
      return;
    }

    const index = currentThrowIndex(draft);
    const nextThrows = draft.sessionThrows.map((result, resultIndex) =>
      resultIndex === index ? { ...result, ...patch } : result
    );

    updateDraft({ ...draft, sessionThrows: nextThrows, currentThrowIndex: index });
  }

  function applyCurrentThrow() {
    if (!draft || isSessionComplete(draft)) {
      return;
    }

    const index = currentThrowIndex(draft);
    const activeThrow = draft.sessionThrows[index];
    if (!canApplyThrow(draft.trainingType, activeThrow)) {
      return;
    }

    let appliedDiscId = '';
    const nextThrows = draft.sessionThrows.map((result, resultIndex) => {
      if (resultIndex !== index) {
        return result;
      }

      const throwToApply = applyThrowDefaults(draft.trainingType, result);
      appliedDiscId = throwToApply.discId ?? '';
      return { ...throwToApply, score: scoreForThrow(draft.trainingType, throwToApply), completed: true };
    });
    const nextOpen = nextThrows.findIndex((result) => !result.completed);
    const nextSessionThrows =
      nextOpen === -1
        ? nextThrows
        : nextThrows.map((result, resultIndex) =>
            resultIndex === nextOpen ? { ...result, discId: appliedDiscId } : result
          );

    updateDraft({
      ...draft,
      sessionThrows: nextSessionThrows,
      currentThrowIndex: nextOpen === -1 ? draft.plannedThrows - 1 : nextOpen,
    });
  }

  function undoLastThrow() {
    if (!draft) {
      return;
    }

    const lastCompletedIndex = draft.sessionThrows.map((result) => result.completed).lastIndexOf(true);
    if (lastCompletedIndex === -1) {
      return;
    }

    const nextThrows = draft.sessionThrows.map((result, resultIndex) =>
      resultIndex === lastCompletedIndex ? { ...result, completed: false } : result
    );

    updateDraft({ ...draft, sessionThrows: nextThrows, currentThrowIndex: lastCompletedIndex });
  }

  function startSession() {
    if (draft && completedThrows(draft) > 0 && !window.confirm('Start a new session and clear the current draft?')) {
      return;
    }

    const nextDraft: TrainingSession = {
      ...createBlankSession(setup.trainingType, {
        distanceMeters: setup.distanceMeters,
        plannedThrows: plannedThrowsFromSetup(setup),
      }),
      date: setup.date,
      wind: setup.wind,
      windDirection: setup.windDirection,
      fatigue: setup.fatigue,
      notes: setup.notes,
    };

    updateDraft(nextDraft);
    setActiveView('track');
  }

  function resetDraft() {
    if (!draft) {
      return;
    }

    if (completedThrows(draft) > 0 && !window.confirm('Clear the current session scores?')) {
      return;
    }

    const nextDraft: TrainingSession = {
      ...createBlankSession(draft.trainingType, {
        distanceMeters: draft.distanceMeters,
        plannedThrows: draft.plannedThrows,
      }),
      date: draft.date,
      wind: draft.wind,
      windDirection: draft.windDirection,
      fatigue: draft.fatigue,
      notes: draft.notes,
    };

    updateDraft(nextDraft);
  }

  function saveCurrentSession() {
    if (!draft) {
      return;
    }

    const sessionToSave = {
      ...finalizeSessionForSave(draft),
      id: makeId(),
      createdAt: new Date().toISOString(),
    };
    const nextSessions = [sessionToSave, ...sessions];

    setSessions(nextSessions);
    saveSessions(nextSessions);
    updateDraft(null);
    setSetup(createSessionSetup());
    setActiveView('history');
  }

  function deleteSession(sessionId: string) {
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);
    saveSessions(nextSessions);
  }

  function addDisc(name: string, category: DiscCategory, metadata: Partial<Disc> = {}) {
    const nextDiscs = [...discs, createDisc(name, category, metadata)];
    setDiscs(nextDiscs);
    saveDiscs(nextDiscs);
  }

  function deleteDisc(discId: string) {
    const nextDiscs = discs.filter((disc) => disc.id !== discId);
    setDiscs(nextDiscs);
    saveDiscs(nextDiscs);
  }

  function addCourse(name: string, holes: CourseHole[], metadata: Partial<Course> = {}) {
    const nextCourses = [...courses, createCourse(name, holes, metadata)];
    setCourses(nextCourses);
    saveCourses(nextCourses);
  }

  function deleteCourse(courseId: string) {
    const nextCourses = courses.filter((course) => course.id !== courseId);
    setCourses(nextCourses);
    saveCourses(nextCourses);
  }

  function startCourseRun(course: Course, playerNames: string[], date: string) {
    const nextRun = createCourseRun(course, playerNames, date);
    setActiveCourseRun(nextRun);
    setActiveView('course-run');
  }

  function updateActiveCourseRun(updater: (current: CourseRun) => CourseRun) {
    setActiveCourseRun((current) => {
      if (!current) {
        return current;
      }

      return updater(current);
    });
  }

  function addThrowToCourseRun(throwInput: Partial<Omit<CourseRunThrow, 'id' | 'throwNumber' | 'createdAt'>>) {
    updateActiveCourseRun((current) => {
      const hole = courseRunCurrentHole(current);
      const player = courseRunCurrentPlayer(current);

      if (!hole || !player) {
        return current;
      }

      const playerHole = courseRunPlayerHole(current, current.currentHoleIndex, player.id);
      const nextThrow = createCourseRunThrow(playerHole.throws.length + 1, throwInput);
      const nextHoles = current.holes.map((currentHole, index) => {
        if (index !== current.currentHoleIndex) {
          return currentHole;
        }

        return {
          ...currentHole,
          players: {
            ...currentHole.players,
            [player.id]: {
              ...playerHole,
              throws: [...playerHole.throws, nextThrow],
            },
          },
        };
      });

      return { ...current, holes: nextHoles, updatedAt: new Date().toISOString() };
    });
  }

  function updateCourseRunHoleNotes(notes: string) {
    updateActiveCourseRun((current) => {
      const hole = courseRunCurrentHole(current);
      const player = courseRunCurrentPlayer(current);

      if (!hole || !player) {
        return current;
      }

      const playerHole = courseRunPlayerHole(current, current.currentHoleIndex, player.id);
      const nextHoles = current.holes.map((currentHole, index) => {
        if (index !== current.currentHoleIndex) {
          return currentHole;
        }

        return {
          ...currentHole,
          players: {
            ...currentHole.players,
            [player.id]: {
              ...playerHole,
              notes,
            },
          },
        };
      });

      return { ...current, holes: nextHoles, updatedAt: new Date().toISOString() };
    });
  }

  function navigateCourseRun(holeIndex: number, playerIndex: number) {
    updateActiveCourseRun((current) => ({
      ...current,
      currentHoleIndex: Math.min(Math.max(0, holeIndex), current.holes.length - 1),
      currentPlayerIndex: Math.min(Math.max(0, playerIndex), current.players.length - 1),
    }));
  }

  function saveActiveCourseRun() {
    if (!activeCourseRun) {
      return;
    }

    const savedRun: CourseRun = {
      ...activeCourseRun,
      status: 'saved',
      updatedAt: new Date().toISOString(),
    };
    const nextRuns = [savedRun, ...courseRuns.filter((run) => run.id !== savedRun.id)];

    setCourseRuns(nextRuns);
    saveCourseRuns(nextRuns);
    setActiveCourseRun(null);
    setActiveView('courses');
  }

  function deleteCourseRun(runId: string) {
    const nextRuns = courseRuns.filter((run) => run.id !== runId);
    setCourseRuns(nextRuns);
    saveCourseRuns(nextRuns);
  }

  function saveMeasuredDistanceThrow(distanceThrow: DistanceThrow) {
    const nextThrows = [distanceThrow, ...distanceThrows];

    setDistanceThrows(nextThrows);
    saveDistanceThrows(nextThrows);
  }

  function deleteDistanceThrow(distanceThrowId: string) {
    const nextThrows = distanceThrows.filter((distanceThrow) => distanceThrow.id !== distanceThrowId);

    setDistanceThrows(nextThrows);
    saveDistanceThrows(nextThrows);
  }

  return (
    <main
      className={`app-shell ${
        activeView === 'track' || activeView === 'course-run' || activeView === 'distance' ? 'tracking-shell' : ''
      }`}
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">Disc golf</p>
          <h1>
            {activeView === 'track' && draft
              ? sessionTitle(draft)
              : activeView === 'course-run' && activeCourseRun
                ? activeCourseRun.courseName
                : 'Training tracker'}
          </h1>
        </div>
        {activeView === 'course-run' && activeCourseRun ? (
          <div
            className="score-badge"
            aria-label={`Course run hole ${courseRunCurrentHole(activeCourseRun)?.number ?? 1} of ${activeCourseRun.holes.length}`}
            data-testid="course-run-status"
          >
            <strong>{courseRunCurrentHole(activeCourseRun)?.number ?? 1}</strong>
            <span>/ {activeCourseRun.holes.length}</span>
            <em>{courseRunCurrentPlayer(activeCourseRun)?.name ?? 'Player'}</em>
          </div>
        ) : draft ? (
          <div
            className="score-badge"
            aria-label={sessionScoreAriaLabel(draft)}
            data-testid="current-score"
          >
            <strong>{sessionScore(draft)}</strong>
            <span>/ {sessionMaxScore(draft)}</span>
            <em>{sessionMetricBadge(draft)}</em>
          </div>
        ) : (
          <div className="score-badge" aria-label={`Saved sessions ${sessions.length}`} data-testid="session-count">
            <strong>{sessions.length}</strong>
            <span>sessions</span>
          </div>
        )}
      </header>

      {activeView !== 'track' && activeView !== 'course-run' && (
        <section className="stats-grid" aria-label="Progress stats">
          <StatCard
            icon={<Activity size={18} />}
            label="Last"
            value={stats.lastScore === null ? '-' : stats.lastScore}
            testId="stat-last"
          />
          <StatCard
            icon={<Trophy size={18} />}
            label="Best"
            value={stats.bestScore === null ? '-' : stats.bestScore}
            testId="stat-best"
          />
          <StatCard
            icon={<Target size={18} />}
            label={stats.averageLastFourLabel}
            value={stats.averageLastFour === null ? '-' : stats.averageLastFour}
            testId="stat-average"
          />
          <StatCard icon={<ClipboardList size={18} />} label="Error" value={stats.commonError} testId="stat-error" />
        </section>
      )}

      <nav className="view-tabs" aria-label="Views">
        <button className={isTrainingView(activeView) ? 'active' : ''} onClick={() => setActiveView('home')}>
          <Activity size={18} />
          Training
        </button>
        <button className={activeView === 'courses' ? 'active' : ''} onClick={() => setActiveView('courses')}>
          <Map size={18} />
          Courses
        </button>
        <button className={activeView === 'discs' ? 'active' : ''} onClick={() => setActiveView('discs')}>
          <Disc3 size={18} />
          Discs
        </button>
        {activeCourseRun && (
          <button className={activeView === 'course-run' ? 'active' : ''} onClick={() => setActiveView('course-run')}>
            <Flag size={18} />
            Round
          </button>
        )}
      </nav>

      {activeView === 'home' && (
        <HomeView
          hasDraft={Boolean(draft)}
          onNew={() => setActiveView('new')}
          onContinue={() => setActiveView('track')}
          onHistory={() => setActiveView('history')}
          onDistance={() => setActiveView('distance')}
        />
      )}

      {activeView === 'new' && (
        <NewSessionView
          setup={setup}
          onSetupChange={updateSetup}
          onTrainingTypeChange={updateTrainingType}
          onStart={startSession}
          onCancel={() => setActiveView('home')}
        />
      )}

      {activeView === 'track' && draft && (
        <TrackView
          draft={draft}
          discs={discs}
          onMetaChange={updateMeta}
          onThrowChange={updateCurrentThrow}
          onApplyThrow={applyCurrentThrow}
          onUndoThrow={undoLastThrow}
          onReset={resetDraft}
          onSave={saveCurrentSession}
        />
      )}

      {activeView === 'track' && !draft && (
        <HomeView
          hasDraft={false}
          onNew={() => setActiveView('new')}
          onHistory={() => setActiveView('history')}
          onDistance={() => setActiveView('distance')}
        />
      )}

      {activeView === 'history' && <HistoryView sessions={sessions} discs={discs} onDelete={deleteSession} />}
      {activeView === 'courses' && (
        <CoursesView
          courses={courses}
          courseRuns={courseRuns}
          onAdd={addCourse}
          onDelete={deleteCourse}
          onStartRun={startCourseRun}
          onDeleteRun={deleteCourseRun}
        />
      )}
      {activeView === 'course-run' && activeCourseRun && (
        <CourseRunView
          run={activeCourseRun}
          discs={discs}
          onAddThrow={addThrowToCourseRun}
          onHoleNotesChange={updateCourseRunHoleNotes}
          onNavigate={navigateCourseRun}
          onSave={saveActiveCourseRun}
          onCourses={() => setActiveView('courses')}
        />
      )}
      {activeView === 'course-run' && !activeCourseRun && (
        <CoursesView
          courses={courses}
          courseRuns={courseRuns}
          onAdd={addCourse}
          onDelete={deleteCourse}
          onStartRun={startCourseRun}
          onDeleteRun={deleteCourseRun}
        />
      )}
      {activeView === 'distance' && (
        <DistanceMeasureView
          discs={discs}
          distanceThrows={distanceThrows}
          onSave={saveMeasuredDistanceThrow}
          onDelete={deleteDistanceThrow}
        />
      )}
      {activeView === 'discs' && <DiscsView discs={discs} onAdd={addDisc} onDelete={deleteDisc} />}
    </main>
  );
}

type HomeViewProps = {
  hasDraft: boolean;
  onNew: () => void;
  onContinue?: () => void;
  onHistory: () => void;
  onDistance: () => void;
};

function HomeView({ hasDraft, onNew, onContinue, onHistory, onDistance }: HomeViewProps) {
  return (
    <section className="main-menu" aria-label="Training">
      <button className="primary-action menu-action" type="button" onClick={onNew} data-testid="new-session">
        <PlusCircle size={20} />
        New session
      </button>
      {hasDraft && onContinue && (
        <button className="secondary-action menu-action" type="button" onClick={onContinue}>
          <ClipboardList size={20} />
          Continue session
        </button>
      )}
      <button className="secondary-action menu-action" type="button" onClick={onDistance} data-testid="max-distance">
        <MapPin size={20} />
        Max distance
      </button>
      <button className="secondary-action menu-action" type="button" onClick={onHistory}>
        <History size={20} />
        History
      </button>

      <div className="training-type-grid">
        {sections.map((section) => (
          <div className={`type-summary ${section.accent}`} key={section.id}>
            <strong>{section.title}</strong>
            <span>
              Custom distance - {section.id === 'approaches' ? 2 : 1} pts/throw
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

type NewSessionViewProps = {
  setup: SessionSetup;
  onSetupChange: <Key extends keyof SessionSetup>(key: Key, value: SessionSetup[Key]) => void;
  onTrainingTypeChange: (trainingType: SectionId) => void;
  onStart: () => void;
  onCancel: () => void;
};

function NewSessionView({ setup, onSetupChange, onTrainingTypeChange, onStart, onCancel }: NewSessionViewProps) {
  return (
    <>
      <section className="new-session" aria-label="New session">
        <div className="section-heading compact-heading">
          <h2>New session</h2>
        </div>

        <div className="type-picker" aria-label="Training type">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`type-option ${section.accent} ${setup.trainingType === section.id ? 'selected' : ''}`}
              onClick={() => onTrainingTypeChange(section.id)}
              data-testid={`type-${section.id}`}
            >
              <span>{section.title}</span>
              <strong>{section.id === 'approaches' ? 2 : 1} pts</strong>
              <small>Set your own distance and throw count</small>
            </button>
          ))}
        </div>

        <section className="session-meta" aria-label="Session setup">
          <label>
            Distance
            <input
              inputMode="decimal"
              value={setup.distanceMeters}
              onChange={(event) => onSetupChange('distanceMeters', event.target.value)}
              data-testid="setup-distance"
              placeholder="m"
            />
          </label>
          <label>
            Throws
            <input
              inputMode="numeric"
              type="number"
              min="1"
              max="200"
              value={setup.plannedThrows}
              onChange={(event) => onSetupChange('plannedThrows', event.target.value)}
              data-testid="setup-throws"
            />
          </label>
          <label>
            Date
            <input type="date" value={setup.date} onChange={(event) => onSetupChange('date', event.target.value)} />
          </label>
          <label>
            Wind direction
            <select
              value={setup.windDirection}
              onChange={(event) => onSetupChange('windDirection', event.target.value)}
            >
              {windDirections.map((direction) => (
                <option key={direction || 'none'} value={direction}>
                  {direction || 'No direction'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wind
            <select value={setup.wind} onChange={(event) => onSetupChange('wind', event.target.value)}>
              {windStrengths.map((wind) => (
                <option key={wind || 'none'} value={wind}>
                  {wind || 'No wind set'}
                </option>
              ))}
            </select>
          </label>
          <FatigueControl value={setup.fatigue} onChange={(level) => onSetupChange('fatigue', level)} />
          <label className="notes-field">
            Notes
            <textarea
              value={setup.notes}
              onChange={(event) => onSetupChange('notes', event.target.value)}
              rows={3}
              placeholder="Disc choice, field, weather, focus..."
            />
          </label>
        </section>
      </section>

      <div className="action-bar">
        <button className="secondary-action" type="button" onClick={onCancel}>
          <Home size={18} />
          Menu
        </button>
        <button className="primary-action" type="button" onClick={onStart} data-testid="start-session">
          <PlusCircle size={18} />
          Start session
        </button>
      </div>
    </>
  );
}

type TrackViewProps = {
  draft: TrainingSession;
  discs: Disc[];
  onMetaChange: <Key extends keyof Pick<TrainingSession, 'date' | 'wind' | 'windDirection' | 'fatigue' | 'notes'>>(
    key: Key,
    value: TrainingSession[Key]
  ) => void;
  onThrowChange: (patch: Partial<ThrowResult>) => void;
  onApplyThrow: () => void;
  onUndoThrow: () => void;
  onReset: () => void;
  onSave: () => void;
};

function TrackView({
  draft,
  discs,
  onMetaChange,
  onThrowChange,
  onApplyThrow,
  onUndoThrow,
  onReset,
  onSave,
}: TrackViewProps) {
  const throwResult = currentThrow(draft);
  const complete = isSessionComplete(draft);
  const scoreOptions = scoreOptionsForType(draft.trainingType);
  const manualScore = usesManualScore(draft.trainingType);
  const proximityScore = usesProximityScore(draft.trainingType);
  const puttResultOptions = puttResultsForScore(throwResult.score);
  const puttResultValue = puttResultOptions.includes(throwResult.puttResult ?? '')
    ? throwResult.puttResult ?? ''
    : defaultPuttResultForScore(throwResult.score);
  const topParameter = sessionMostCommonParameter(draft);

  return (
    <>
      <section className="track-panel" aria-label="Active session">
        <div className="track-status">
          <div>
            <span>Throw</span>
            <strong>
              {currentThrowNumber(draft)} / {sessionThrowCount(draft)}
            </strong>
          </div>
          <div>
            <span>Distance</span>
            <strong>{draft.distanceMeters || '-'} m</strong>
          </div>
          <div>
            <span>{sessionMetricName(draft)}</span>
            <strong>{sessionMetricValue(draft)}</strong>
          </div>
        </div>

        <div className="summary-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (completedThrows(draft) / sessionThrowCount(draft)) * 100)}%` }} />
        </div>

        <p className="session-line">{sessionConditionLabel(draft)}</p>

        {complete ? (
          <div className="complete-panel" data-testid="session-complete">
            <h2>Session complete</h2>
            <p>
              {sessionScore(draft)}/{sessionMaxScore(draft)} - {sessionMetricBadge(draft)}
            </p>
            {topParameter && <span>Top parameter: {sessionMostCommonParameterLabel(draft)}</span>}
          </div>
        ) : (
          <article className="current-throw-card" data-testid="current-throw-card">
            <h2>Throw {currentThrowNumber(draft)}</h2>

            <label className="detail-field">
              Disc
              <select
                data-testid="current-disc"
                value={throwResult.discId ?? ''}
                onChange={(event) => onThrowChange({ discId: event.target.value })}
              >
                <option value="">No disc</option>
                {discs.map((disc) => (
                  <option key={disc.id} value={disc.id}>
                    {discSelectLabel(disc)}
                  </option>
                ))}
              </select>
            </label>

            {manualScore && (
              <div className="score-options single-score-options">
                {scoreOptions.map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    data-testid={`current-score-${option.value}`}
                    className={throwResult.score === option.value ? 'selected' : ''}
                    onClick={() =>
                      onThrowChange({ score: option.value, puttResult: defaultPuttResultForScore(option.value) })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {draft.trainingType === 'putting' && (
              <label className="detail-field">
                Putt result
                <select
                  data-testid="current-putt-result"
                  value={puttResultValue}
                  disabled={puttResultOptions.length === 0}
                  onChange={(event) => onThrowChange({ puttResult: event.target.value as ThrowResult['puttResult'] })}
                >
                  {puttResultOptions.length === 0 ? (
                    <option value="">Select made or miss</option>
                  ) : (
                    puttResultOptions.map((puttResult) => (
                      <option key={puttResult} value={puttResult}>
                        {puttResult}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}

            {proximityScore && (
              <div className="current-detail-grid">
                <label className="detail-field">
                  Basket distance
                  <input
                    inputMode="decimal"
                    placeholder="m"
                    value={throwResult.approachDistanceMeters ?? ''}
                    data-testid="current-approach-distance"
                    onChange={(event) => onThrowChange({ approachDistanceMeters: event.target.value })}
                  />
                </label>
                <label className="detail-field">
                  Direction
                  <select
                    value={throwResult.approachDirection ?? ''}
                    data-testid="current-approach-direction"
                    onChange={(event) =>
                      onThrowChange({ approachDirection: event.target.value as ThrowResult['approachDirection'] })
                    }
                  >
                    {approachDirections.map((direction) => (
                      <option key={direction || 'none'} value={direction}>
                        {direction || 'Direction'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="detail-field wide-field">
                  Release
                  <select
                    value={throwResult.releaseIssue ?? ''}
                    data-testid="current-release"
                    onChange={(event) =>
                      onThrowChange({ releaseIssue: event.target.value as ThrowResult['releaseIssue'] })
                    }
                  >
                    {releaseIssues.map((releaseIssue) => (
                      <option key={releaseIssue || 'none'} value={releaseIssue}>
                        {releaseIssue || 'Release'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {manualScore && (
              <label className="detail-field">
                Error
                <select
                  data-testid="current-error"
                  value={throwResult.error}
                  onChange={(event) => onThrowChange({ error: event.target.value as ErrorType })}
                >
                  {errorTypes.map((error) => (
                    <option key={error || 'none'} value={error}>
                      {error || 'No error'}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              className="primary-action apply-throw-action"
              type="button"
              onClick={onApplyThrow}
              disabled={!canApplyThrow(draft.trainingType, throwResult)}
              data-testid="apply-throw"
            >
              Apply throw
            </button>
          </article>
        )}

        <label className="detail-field compact-notes">
          Notes
          <textarea
            value={draft.notes}
            onChange={(event) => onMetaChange('notes', event.target.value)}
            rows={2}
            placeholder="Session notes..."
          />
        </label>
      </section>

      <div className="action-bar">
        <button className="secondary-action" type="button" onClick={onUndoThrow} title="Undo last throw">
          <Undo2 size={18} />
          Undo
        </button>
        <button className="secondary-action" type="button" onClick={onReset} title="Reset current session">
          <RotateCcw size={18} />
          Reset
        </button>
        <button className="primary-action" type="button" onClick={onSave} title="Save session" data-testid="save-session">
          <Save size={18} />
          Save
        </button>
      </div>
    </>
  );
}

type FatigueControlProps = {
  value: number;
  onChange: (level: number) => void;
};

function FatigueControl({ value, onChange }: FatigueControlProps) {
  return (
    <div className="fatigue-control">
      <span>Fatigue</span>
      <div className="fatigue-buttons" role="group" aria-label="Fatigue">
        {[1, 2, 3, 4, 5].map((level) => (
          <button key={level} className={value === level ? 'active' : ''} onClick={() => onChange(level)} type="button">
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: JSX.Element;
  label: string;
  value: string | number;
  testId: string;
};

function StatCard({ icon, label, value, testId }: StatCardProps) {
  return (
    <div className="stat-card" data-testid={testId}>
      <span className="stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type HistoryViewProps = {
  sessions: TrainingSession[];
  discs: Disc[];
  onDelete: (sessionId: string) => void;
};

function HistoryView({ sessions, discs, onDelete }: HistoryViewProps) {
  const [exportStatus, setExportStatus] = useState('');
  const aiExportText = useMemo(() => createAiHistoryExportText(sessions, discs), [sessions, discs]);

  async function copyAiData() {
    try {
      await copyText(aiExportText);
      setExportStatus('Copied for AI');
    } catch {
      setExportStatus('Copy failed');
    }
  }

  function exportJson() {
    downloadTextFile(aiHistoryExportFilename(), aiExportText);
    setExportStatus('Exported JSON');
  }

  if (sessions.length === 0) {
    return (
      <section className="empty-history">
        <History size={28} />
        <h2>No sessions yet</h2>
      </section>
    );
  }

  return (
    <section className="history-list" aria-label="Session history">
      <div className="history-export" aria-label="History export">
        <button className="secondary-action" type="button" onClick={copyAiData} data-testid="copy-ai-export">
          <Copy size={18} />
          Copy AI data
        </button>
        <button className="secondary-action" type="button" onClick={exportJson} data-testid="download-ai-export">
          <Download size={18} />
          Export JSON
        </button>
        {exportStatus && (
          <p className="export-status" role="status">
            {exportStatus}
          </p>
        )}
      </div>
      {sessions.map((session) => (
        <article className="history-card" key={session.id} data-testid="history-card">
          <div className="history-topline">
            <div>
              <h2>{sessionTitle(session)}</h2>
              <p>
                {session.date} - {sessionConditionLabel(session)} - {completedThrows(session)}/{sessionThrowCount(session)} throws
              </p>
            </div>
            <div className="history-score">
              <strong>{sessionScore(session)}</strong>
              <span>/ {sessionMaxScore(session)}</span>
              <small>{sessionMetricBadge(session)}</small>
            </div>
          </div>

          {sessionMostCommonParameter(session) && (
            <p className="session-parameter">Top parameter: {sessionMostCommonParameterLabel(session)}</p>
          )}

          {session.notes && <p className="history-notes">{session.notes}</p>}

          <button
            className="delete-action"
            type="button"
            onClick={() => {
              if (window.confirm('Delete this session?')) {
                onDelete(session.id);
              }
            }}
            title="Delete session"
          >
            <Trash2 size={17} />
            Delete
          </button>
        </article>
      ))}
    </section>
  );
}

type CoursesViewProps = {
  courses: Course[];
  courseRuns: CourseRun[];
  onAdd: (name: string, holes: CourseHole[], metadata?: Partial<Course>) => void;
  onDelete: (courseId: string) => void;
  onStartRun: (course: Course, playerNames: string[], date: string) => void;
  onDeleteRun: (runId: string) => void;
};

type CourseStartSetup = {
  courseId: string;
  date: string;
  players: string[];
};

function CoursesView({ courses, courseRuns, onAdd, onDelete, onStartRun, onDeleteRun }: CoursesViewProps) {
  const [name, setName] = useState('');
  const [holeCountInput, setHoleCountInput] = useState('18');
  const [holes, setHoles] = useState<CourseHole[]>(() => createCourseHoles(18));
  const [importMetadata, setImportMetadata] = useState<Partial<Course> | null>(null);
  const [importedCourses, setImportedCourses] = useState<ImportedCourse[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseImportStatus, setCourseImportStatus] = useState('');
  const [courseImportError, setCourseImportError] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [startSetup, setStartSetup] = useState<CourseStartSetup | null>(null);

  function updateHoleCount(value: number) {
    const nextCount = clampHoleCount(value);
    const generatedHoles = createCourseHoles(nextCount);

    setHoleCountInput(String(nextCount));
    setHoles((current) =>
      generatedHoles.map((generatedHole, index) =>
        current[index] ? { ...current[index], number: index + 1 } : generatedHole
      )
    );
  }

  function updateHoleCountInput(value: string) {
    setHoleCountInput(value);

    if (value.trim() !== '') {
      updateHoleCount(parsedEditableNumber(value));
    }
  }

  function updateHole(index: number, patch: Partial<CourseHole>) {
    setHoles((current) =>
      current.map((hole, holeIndex) => (holeIndex === index ? { ...hole, ...patch, number: holeIndex + 1 } : hole))
    );
  }

  function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    const normalizedHoles = holes.map((hole, index) => ({
      ...hole,
      number: index + 1,
      par: clampCoursePar(hole.par),
      distanceMeters: clampCourseDistance(hole.distanceMeters),
    }));

    onAdd(name, normalizedHoles, importMetadata ?? undefined);
    setName('');
    setHoleCountInput('18');
    setHoles(createCourseHoles(18));
    setImportMetadata(null);
  }

  async function findNearbyCourses() {
    setLoadingCourses(true);
    setCourseImportError('');
    setCourseImportStatus('Loading DiscGolfAPI courses...');

    let location: Coordinates | null = null;

    try {
      location = await getCurrentCoordinates();
    } catch {
      setCourseImportStatus('Location unavailable. Showing Finland course list.');
    }

    try {
      const coursesFromApi = await fetchFinlandDiscGolfCourses();
      setImportedCourses(sortImportedCourses(coursesFromApi, location));
      setCourseImportStatus(location ? 'Showing nearest Finnish courses.' : 'Showing Finnish courses. Use search to filter.');
    } catch {
      setImportedCourses([]);
      setCourseImportError('Could not load DiscGolfAPI courses. Check connection and try again.');
      setCourseImportStatus('');
    } finally {
      setLoadingCourses(false);
    }
  }

  function importCourse(importedCourse: ImportedCourse) {
    const draft = createCourseDraftFromImport(importedCourse);

    setName(draft.name);
    setHoleCountInput(String(draft.holes.length));
    setHoles(draft.holes);
    setImportMetadata(draft.metadata);
    setCourseImportStatus(`${importedCourse.name} loaded as editable draft.`);
  }

  const visibleImportedCourses = importedCourses
    .filter((course) => {
      const search = courseSearch.trim().toLowerCase();

      if (!search) {
        return true;
      }

      return `${course.name} ${course.locality}`.toLowerCase().includes(search);
    })
    .slice(0, 3);

  function beginStart(courseId: string) {
    setStartSetup({ courseId, date: todayIsoDate(), players: ['Player 1'] });
  }

  function updateStartSetup(patch: Partial<CourseStartSetup>) {
    setStartSetup((current) => (current ? { ...current, ...patch } : current));
  }

  function updatePlayerName(index: number, playerName: string) {
    setStartSetup((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        players: current.players.map((nameValue, playerIndex) => (playerIndex === index ? playerName : nameValue)),
      };
    });
  }

  function addPlayerField() {
    setStartSetup((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        players: [...current.players, `Player ${current.players.length + 1}`],
      };
    });
  }

  function removePlayerField(index: number) {
    setStartSetup((current) => {
      if (!current || current.players.length === 1) {
        return current;
      }

      return {
        ...current,
        players: current.players.filter((_player, playerIndex) => playerIndex !== index),
      };
    });
  }

  return (
    <section className="courses-panel" aria-label="Courses">
      <section className="course-finder" aria-label="Find nearby courses">
        <div className="section-heading compact-heading">
          <div>
            <h2>Find nearby courses</h2>
            <p>{DISCGOLFAPI_ATTRIBUTION}</p>
          </div>
        </div>

        <button
          className="primary-action"
          type="button"
          onClick={findNearbyCourses}
          disabled={loadingCourses}
          data-testid="find-nearby-courses"
        >
          <Map size={18} />
          {loadingCourses ? 'Loading...' : 'Find nearby courses'}
        </button>

        {importedCourses.length > 0 && (
          <label>
            Search courses
            <input
              value={courseSearch}
              onChange={(event) => setCourseSearch(event.target.value)}
              data-testid="course-search"
              placeholder="Course or city"
            />
          </label>
        )}

        {courseImportStatus && (
          <p className="import-status" role="status">
            {courseImportStatus}
          </p>
        )}
        {courseImportError && (
          <p className="import-error" role="alert">
            {courseImportError}
          </p>
        )}

        {visibleImportedCourses.length > 0 && (
          <section className="import-course-list" aria-label="DiscGolfAPI courses">
            {visibleImportedCourses.map((course) => {
              const alreadySaved = isCourseAlreadyImported(courses, course);

              return (
                <article className="import-course-card" key={course.sourceId} data-testid="import-course-card">
                  <div>
                    <h3>{course.name}</h3>
                    <p>
                      {course.locality || 'Finland'}
                      {course.distanceKm !== undefined ? ` - ${course.distanceKm.toFixed(1)} km` : ''}
                    </p>
                    <span>
                      {course.holeCount ? `${course.holeCount} holes` : '18-hole editable draft'}{' '}
                      {course.parTotal ? `- Par ${course.parTotal} ` : ''}
                      {course.lengthMeters ? `- ${course.lengthMeters} m layout` : ''}
                    </span>
                  </div>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => importCourse(course)}
                    disabled={alreadySaved}
                    data-testid={`import-course-${course.sourceId}`}
                  >
                    <PlusCircle size={18} />
                    {alreadySaved ? 'Saved' : 'Import'}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </section>

      <form className="course-form" onSubmit={submitCourse}>
        <div className="section-heading compact-heading">
          <h2>Add course</h2>
          {importMetadata?.source === 'discgolfapi' && <span>Imported draft</span>}
        </div>

        <label>
          Course name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid="course-name"
            placeholder="Home course"
          />
        </label>

        <label>
          Holes
          <input
            inputMode="numeric"
            type="number"
            min="1"
            max="36"
            value={holeCountInput}
            onChange={(event) => updateHoleCountInput(event.target.value)}
            data-testid="course-hole-count"
          />
        </label>

        <div className="course-hole-editor" aria-label="Course holes">
          {holes.map((hole, index) => (
            <div className="course-hole-row" key={hole.id}>
              <span>Hole {hole.number}</span>
              <label>
                Par
                <input
                  inputMode="numeric"
                  type="number"
                  min="1"
                  max="10"
                  value={editableNumberValue(hole.par)}
                  onChange={(event) => updateHole(index, { par: editableClampedNumber(event.target.value, clampCoursePar) })}
                  data-testid={`course-hole-${hole.number}-par`}
                />
              </label>
              <label>
                Distance
                <input
                  inputMode="numeric"
                  type="number"
                  min="1"
                  max="500"
                  value={editableNumberValue(hole.distanceMeters)}
                  onChange={(event) =>
                    updateHole(index, { distanceMeters: editableClampedNumber(event.target.value, clampCourseDistance) })
                  }
                  data-testid={`course-hole-${hole.number}-distance`}
                />
              </label>
            </div>
          ))}
        </div>

        {importMetadata?.source === 'discgolfapi' && (
          <p className="import-attribution" data-testid="import-attribution">
            {importMetadata.locality ? `${importMetadata.locality}. ` : ''}
            {importMetadata.attribution}
          </p>
        )}

        <button className="primary-action" type="submit" data-testid="add-course">
          <PlusCircle size={18} />
          Add course
        </button>
      </form>

      {courses.length === 0 ? (
        <section className="empty-history">
          <Map size={28} />
          <h2>No courses yet</h2>
        </section>
      ) : (
        <section className="course-list" aria-label="Saved courses">
          {courses.map((course) => {
            const totalPar = course.holes.reduce((sum, hole) => sum + hole.par, 0);
            const totalDistance = course.holes.reduce((sum, hole) => sum + hole.distanceMeters, 0);
            const isStarting = startSetup?.courseId === course.id;

            return (
              <article className="course-card" key={course.id} data-testid="course-card">
                <div>
                  <h2>{course.name}</h2>
                  <p>
                    {course.holes.length} holes - Par {totalPar} - {totalDistance} m
                  </p>
                </div>

                {isStarting && startSetup ? (
                  <section className="course-start-panel" aria-label={`Start ${course.name}`}>
                    <label>
                      Round date
                      <input
                        type="date"
                        value={startSetup.date}
                        onChange={(event) => updateStartSetup({ date: event.target.value })}
                        data-testid="course-run-date"
                      />
                    </label>

                    <div className="course-player-list">
                      {startSetup.players.map((playerName, index) => (
                        <label key={`${course.id}-${index}`}>
                          Player {index + 1}
                          <span className="player-input-row">
                            <input
                              value={playerName}
                              onChange={(event) => updatePlayerName(index, event.target.value)}
                              data-testid={`course-player-${index}`}
                            />
                            {startSetup.players.length > 1 && (
                              <button
                                className="delete-action compact-delete"
                                type="button"
                                onClick={() => removePlayerField(index)}
                                title={`Remove player ${index + 1}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="course-start-actions">
                      <button className="secondary-action" type="button" onClick={addPlayerField} data-testid="add-player">
                        <Users size={18} />
                        Add player
                      </button>
                      <button
                        className="primary-action"
                        type="button"
                        onClick={() => {
                          onStartRun(course, startSetup.players, startSetup.date);
                          setStartSetup(null);
                        }}
                        data-testid="start-course-run"
                      >
                        <Flag size={18} />
                        Start round
                      </button>
                    </div>
                  </section>
                ) : (
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => beginStart(course.id)}
                    data-testid="start-course"
                  >
                    <Flag size={18} />
                    Start course
                  </button>
                )}

                <button
                  className="delete-action"
                  type="button"
                  onClick={() => {
                    if (window.confirm('Delete this course?')) {
                      onDelete(course.id);
                    }
                  }}
                  title={`Delete ${course.name}`}
                >
                  <Trash2 size={17} />
                  Delete course
                </button>
              </article>
            );
          })}
        </section>
      )}

      {courseRuns.length > 0 && (
        <section className="course-run-history" aria-label="Saved course runs">
          <div className="section-heading compact-heading">
            <h2>Saved course runs</h2>
          </div>

          {courseRuns.map((run) => (
            <article className="course-run-card" key={run.id} data-testid="course-run-card">
              <div>
                <h2>{run.courseName}</h2>
                <p>
                  {run.date} - {run.players.length} player{run.players.length === 1 ? '' : 's'} - {run.holes.length}{' '}
                  holes
                </p>
              </div>
              <div className="course-run-player-summary">
                {run.players.map((player) => (
                  <span key={player.id}>
                    {player.name}: {courseRunPlayerSummary(run, player.id)}
                  </span>
                ))}
              </div>
              <button
                className="delete-action"
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this course run?')) {
                    onDeleteRun(run.id);
                  }
                }}
              >
                <Trash2 size={17} />
                Delete run
              </button>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

type CourseRunViewProps = {
  run: CourseRun;
  discs: Disc[];
  onAddThrow: (throwInput: Partial<Omit<CourseRunThrow, 'id' | 'throwNumber' | 'createdAt'>>) => void;
  onHoleNotesChange: (notes: string) => void;
  onNavigate: (holeIndex: number, playerIndex: number) => void;
  onSave: () => void;
  onCourses: () => void;
};

function CourseRunView({
  run,
  discs,
  onAddThrow,
  onHoleNotesChange,
  onNavigate,
  onSave,
  onCourses,
}: CourseRunViewProps) {
  const [discId, setDiscId] = useState('');
  const [style, setStyle] = useState<ThrowStyle>('');
  const [angle, setAngle] = useState<ThrowAngle>('');
  const [throwNotes, setThrowNotes] = useState('');
  const hole = courseRunCurrentHole(run);
  const player = courseRunCurrentPlayer(run);

  if (!hole || !player) {
    return (
      <section className="empty-history">
        <Flag size={28} />
        <h2>No active round</h2>
      </section>
    );
  }

  const playerHole = courseRunPlayerHole(run, run.currentHoleIndex, player.id);
  const lastThrow = playerHole.throws[playerHole.throws.length - 1];
  const positionNumber = run.currentHoleIndex * run.players.length + run.currentPlayerIndex + 1;
  const positionCount = run.holes.length * run.players.length;
  const atStart = run.currentHoleIndex === 0 && run.currentPlayerIndex === 0;
  const atEnd = run.currentHoleIndex === run.holes.length - 1 && run.currentPlayerIndex === run.players.length - 1;

  function previousPosition() {
    if (run.currentPlayerIndex > 0) {
      onNavigate(run.currentHoleIndex, run.currentPlayerIndex - 1);
      return;
    }

    if (run.currentHoleIndex > 0) {
      onNavigate(run.currentHoleIndex - 1, run.players.length - 1);
    }
  }

  function nextPosition() {
    if (run.currentPlayerIndex < run.players.length - 1) {
      onNavigate(run.currentHoleIndex, run.currentPlayerIndex + 1);
      return;
    }

    if (run.currentHoleIndex < run.holes.length - 1) {
      onNavigate(run.currentHoleIndex + 1, 0);
    }
  }

  function addThrow() {
    onAddThrow({ discId, style, angle, notes: throwNotes });
    setThrowNotes('');
  }

  return (
    <>
      <section className="course-run-panel" aria-label="Active course run">
        <div className="track-status">
          <div>
            <span>Hole</span>
            <strong>
              {hole.number} / {run.holes.length}
            </strong>
          </div>
          <div>
            <span>Par</span>
            <strong>{hole.par}</strong>
          </div>
          <div>
            <span>Distance</span>
            <strong>{hole.distanceMeters} m</strong>
          </div>
        </div>

        <div className="summary-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (positionNumber / positionCount) * 100)}%` }} />
        </div>

        <div className="player-switcher" role="group" aria-label="Players">
          {run.players.map((runPlayer, index) => (
            <button
              key={runPlayer.id}
              className={runPlayer.id === player.id ? 'active' : ''}
              type="button"
              onClick={() => onNavigate(run.currentHoleIndex, index)}
            >
              {runPlayer.name}
            </button>
          ))}
        </div>

        <p className="session-line">
          {player.name}: {courseRunPlayerSummary(run, player.id)}
        </p>

        <article className="current-throw-card course-throw-card" data-testid="course-run-current-hole">
          <h2>
            Hole {hole.number} - {player.name}
          </h2>

          <div className="current-detail-grid">
            <label className="detail-field wide-field">
              Disc
              <select value={discId} onChange={(event) => setDiscId(event.target.value)} data-testid="course-run-disc">
                <option value="">No disc</option>
                {discs.map((disc) => (
                  <option key={disc.id} value={disc.id}>
                    {discSelectLabel(disc)}
                  </option>
                ))}
              </select>
            </label>

            <label className="detail-field">
              Style
              <select
                value={style}
                onChange={(event) => setStyle(event.target.value as ThrowStyle)}
                data-testid="course-run-style"
              >
                {throwStyles.map((throwStyle) => (
                  <option key={throwStyle || 'none'} value={throwStyle}>
                    {throwStyle || 'No style'}
                  </option>
                ))}
              </select>
            </label>

            <label className="detail-field">
              Angle
              <select
                value={angle}
                onChange={(event) => setAngle(event.target.value as ThrowAngle)}
                data-testid="course-run-angle"
              >
                {throwAngles.map((throwAngle) => (
                  <option key={throwAngle || 'none'} value={throwAngle}>
                    {throwAngle || 'No angle'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="detail-field compact-notes">
            Throw notes
            <textarea
              value={throwNotes}
              onChange={(event) => setThrowNotes(event.target.value)}
              rows={2}
              data-testid="course-run-throw-notes"
              placeholder="Line, footing, release..."
            />
          </label>

          <button className="primary-action apply-throw-action" type="button" onClick={addThrow} data-testid="add-course-throw">
            <PlusCircle size={18} />
            Add throw
          </button>

          <p className="course-throw-count">
            Throws on this hole: <strong>{playerHole.throws.length}</strong>
          </p>

          {lastThrow && (
            <p className="last-throw">
              Last: {lastThrow.style || 'no style'}, {lastThrow.angle || 'no angle'}
              {lastThrow.notes ? ` - ${lastThrow.notes}` : ''}
            </p>
          )}
        </article>

        <label className="detail-field compact-notes">
          Hole notes
          <textarea
            value={playerHole.notes}
            onChange={(event) => onHoleNotesChange(event.target.value)}
            rows={2}
            data-testid="course-run-hole-notes"
            placeholder="Lie, wind, decision, mistake..."
          />
        </label>
      </section>

      <div className="action-bar">
        <button className="secondary-action" type="button" onClick={onCourses}>
          <Map size={18} />
          Courses
        </button>
        <button className="secondary-action" type="button" onClick={previousPosition} disabled={atStart}>
          <ChevronLeft size={18} />
          Prev
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={nextPosition}
          disabled={atEnd}
          data-testid="course-run-next"
        >
          Next
          <ChevronRight size={18} />
        </button>
        <button className="primary-action" type="button" onClick={onSave} data-testid="save-course-run">
          <Save size={18} />
          Save
        </button>
      </div>
    </>
  );
}

type DistanceMeasureViewProps = {
  discs: Disc[];
  distanceThrows: DistanceThrow[];
  onSave: (distanceThrow: DistanceThrow) => void;
  onDelete: (distanceThrowId: string) => void;
};

function DistanceMeasureView({ discs, distanceThrows, onSave, onDelete }: DistanceMeasureViewProps) {
  const [livePoint, setLivePoint] = useState<GpsPoint | null>(null);
  const [liveError, setLiveError] = useState('');
  const [startPoint, setStartPoint] = useState<GpsPoint | null>(null);
  const [endPoint, setEndPoint] = useState<GpsPoint | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [discId, setDiscId] = useState('');
  const [style, setStyle] = useState<ThrowStyle>('backhand');
  const [angle, setAngle] = useState<ThrowAngle>('flat');
  const [wind, setWind] = useState('');
  const [windDirection, setWindDirection] = useState('');
  const [notes, setNotes] = useState('');
  const measuredDistance = startPoint && endPoint ? createDistanceThrow(startPoint, endPoint).distanceMeters : null;
  const bestThrow = bestDistanceThrow(distanceThrows);
  const averageRecent = averageDistanceThrows(distanceThrows);

  useEffect(() => {
    let cancelled = false;

    if (!navigator.geolocation) {
      setLiveError('Live GPS unavailable on this device.');
      return undefined;
    }

    setLiveError('');

    if (!navigator.geolocation.watchPosition) {
      getCurrentGpsPoint()
        .then((point) => {
          if (!cancelled) {
            setLivePoint(point);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLiveError('Live GPS unavailable. Allow location permission and go outdoors.');
          }
        });

      return () => {
        cancelled = true;
      };
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        setLivePoint(gpsPointFromPosition(position));
        setLiveError('');
      },
      () => {
        if (!cancelled) {
          setLiveError('Live GPS unavailable. Allow location permission and go outdoors.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch?.(watchId);
    };
  }, []);

  async function captureStart() {
    setLoading(true);
    setError('');
    setStatus(livePoint ? 'Saving tee position...' : 'Getting tee position...');

    try {
      const point = livePoint ?? (await getCurrentGpsPoint());
      setStartPoint(point);
      setEndPoint(null);
      setStatus('Start saved. Walk to your disc, wait for good GPS accuracy, and press End.');
    } catch {
      setError('Could not get GPS location. Allow location permission and try outdoors.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  async function captureEnd() {
    if (!startPoint) {
      setError('Press Start first at the tee.');
      return;
    }

    setLoading(true);
    setError('');
    setStatus(livePoint ? 'Saving disc position...' : 'Getting disc position...');

    try {
      const point = livePoint ?? (await getCurrentGpsPoint());
      setEndPoint(point);
      setStatus('End saved. Review and save the throw.');
    } catch {
      setError('Could not get GPS location. Try again near the disc.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  function saveThrow() {
    if (!startPoint || !endPoint) {
      return;
    }

    onSave(createDistanceThrow(startPoint, endPoint, { discId, style, angle, wind, windDirection, notes }));
    setStartPoint(null);
    setEndPoint(null);
    setNotes('');
    setStatus('Distance throw saved.');
  }

  return (
    <>
      <section className="distance-panel" aria-label="GPS distance measurement">
        <div className="track-status">
          <div>
            <span>Current</span>
            <strong data-testid="measured-distance">
              {measuredDistance === null ? '-' : `${Math.round(measuredDistance)} m`}
            </strong>
          </div>
          <div>
            <span>Best</span>
            <strong>{bestThrow ? `${Math.round(bestThrow.distanceMeters)} m` : '-'}</strong>
          </div>
          <div>
            <span>Avg 5</span>
            <strong>{averageRecent === null ? '-' : `${Math.round(averageRecent)} m`}</strong>
          </div>
        </div>

        <article className="current-throw-card distance-measure-card">
          <h2>Measure throw</h2>
          <div className="gps-live" data-testid="live-gps">
            <div>
              <span>Live GPS accuracy</span>
              <strong data-testid="live-gps-accuracy">{gpsAccuracyText(livePoint)}</strong>
              <small>{livePoint ? 'Updates automatically while this screen is open' : 'Waiting for GPS signal'}</small>
            </div>
            <MapPin size={20} />
          </div>
          {liveError && <p className="import-error">{liveError}</p>}
          <div className="distance-actions">
            <button className="primary-action" type="button" onClick={captureStart} disabled={loading} data-testid="gps-start">
              <MapPin size={18} />
              Start
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={captureEnd}
              disabled={loading || !startPoint}
              data-testid="gps-end"
            >
              <Flag size={18} />
              End
            </button>
          </div>

          {status && (
            <p className="import-status" role="status">
              {status}
            </p>
          )}
          {error && (
            <p className="import-error" role="alert">
              {error}
            </p>
          )}

          <div className="gps-point-grid">
            <GpsPointSummary label="Start" point={startPoint} />
            <GpsPointSummary label="End" point={endPoint} />
          </div>

          <div className="current-detail-grid">
            <label className="detail-field wide-field">
              Disc
              <select value={discId} onChange={(event) => setDiscId(event.target.value)} data-testid="distance-disc">
                <option value="">No disc</option>
                {discs.map((disc) => (
                  <option key={disc.id} value={disc.id}>
                    {discSelectLabel(disc)}
                  </option>
                ))}
              </select>
            </label>
            <label className="detail-field">
              Style
              <select
                value={style}
                onChange={(event) => setStyle(event.target.value as ThrowStyle)}
                data-testid="distance-style"
              >
                {throwStyles.map((throwStyle) => (
                  <option key={throwStyle || 'none'} value={throwStyle}>
                    {throwStyle || 'No style'}
                  </option>
                ))}
              </select>
            </label>
            <label className="detail-field">
              Angle
              <select
                value={angle}
                onChange={(event) => setAngle(event.target.value as ThrowAngle)}
                data-testid="distance-angle"
              >
                {throwAngles.map((throwAngle) => (
                  <option key={throwAngle || 'none'} value={throwAngle}>
                    {throwAngle || 'No angle'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="session-meta distance-meta" aria-label="Distance throw conditions">
            <label>
              Wind direction
              <select value={windDirection} onChange={(event) => setWindDirection(event.target.value)}>
                {windDirections.map((direction) => (
                  <option key={direction || 'none'} value={direction}>
                    {direction || 'No direction'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Wind
              <select value={wind} onChange={(event) => setWind(event.target.value)}>
                {windStrengths.map((windStrength) => (
                  <option key={windStrength || 'none'} value={windStrength}>
                    {windStrength || 'No wind set'}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <label className="detail-field compact-notes">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              data-testid="distance-notes"
              placeholder="Line, run-up, field, wind..."
            />
          </label>

          <button className="primary-action" type="button" onClick={saveThrow} disabled={!startPoint || !endPoint} data-testid="save-distance-throw">
            <Save size={18} />
            Save throw
          </button>
        </article>

        {distanceThrows.length > 0 && (
          <section className="distance-history" aria-label="Measured throws">
            <div className="section-heading compact-heading">
              <h2>Measured throws</h2>
            </div>
            {distanceThrows.slice(0, 10).map((distanceThrow) => {
              const disc = discs.find((savedDisc) => savedDisc.id === distanceThrow.discId);

              return (
                <article className="distance-card" key={distanceThrow.id} data-testid="distance-card">
                  <div>
                    <h3>{Math.round(distanceThrow.distanceMeters)} m</h3>
                    <p>
                      {distanceThrow.date}
                      {disc ? ` - ${disc.name}` : ''}
                      {distanceThrow.style ? ` - ${distanceThrow.style}` : ''}
                      {distanceThrow.angle ? ` - ${distanceThrow.angle}` : ''}
                    </p>
                    {distanceThrow.notes && <span>{distanceThrow.notes}</span>}
                  </div>
                  <button
                    className="delete-action compact-delete"
                    type="button"
                    onClick={() => onDelete(distanceThrow.id)}
                    title="Delete measured throw"
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </>
  );
}

type GpsPointSummaryProps = {
  label: string;
  point: GpsPoint | null;
};

function GpsPointSummary({ label, point }: GpsPointSummaryProps) {
  return (
    <div className="gps-point">
      <span>{label}</span>
      <strong>{point ? 'Saved' : '-'}</strong>
      <small>{point?.accuracyMeters !== undefined ? `Accuracy ${gpsAccuracyText(point)}` : 'GPS accuracy'}</small>
    </div>
  );
}

type DiscsViewProps = {
  discs: Disc[];
  onAdd: (name: string, category: DiscCategory, metadata?: Partial<Disc>) => void;
  onDelete: (discId: string) => void;
};

function DiscsView({ discs, onAdd, onDelete }: DiscsViewProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DiscCategory>('putter');
  const [discSearch, setDiscSearch] = useState('');
  const [importedDiscs, setImportedDiscs] = useState<ImportedDisc[]>([]);
  const [discImportStatus, setDiscImportStatus] = useState('');
  const [discImportError, setDiscImportError] = useState('');
  const [loadingDiscs, setLoadingDiscs] = useState(false);

  function submitDisc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    onAdd(name, category);
    setName('');
    setCategory('putter');
  }

  async function searchDiscDatabase(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoadingDiscs(true);
    setDiscImportError('');
    setDiscImportStatus('Loading DiscIt discs...');

    try {
      const discsFromApi = await fetchDiscItDiscs(discSearch);
      setImportedDiscs(discsFromApi.slice(0, 30));
      setDiscImportStatus(
        discsFromApi.length > 0
          ? `Showing ${Math.min(30, discsFromApi.length)} disc database result${discsFromApi.length === 1 ? '' : 's'}.`
          : 'No discs found.'
      );
    } catch {
      setImportedDiscs([]);
      setDiscImportStatus('');
      setDiscImportError('Could not load DiscIt discs. Check connection and try again.');
    } finally {
      setLoadingDiscs(false);
    }
  }

  function importDisc(disc: ImportedDisc) {
    onAdd(importedDiscDisplayName(disc), disc.category, createDiscMetadataFromImport(disc));
    setDiscImportStatus(`${importedDiscDisplayName(disc)} added to your discs.`);
  }

  return (
    <section className="discs-panel" aria-label="Discs">
      <section className="disc-finder" aria-label="Find discs">
        <div className="section-heading compact-heading">
          <div>
            <h2>Find discs</h2>
            <p>{DISCIT_ATTRIBUTION}</p>
          </div>
        </div>

        <form className="disc-search-form" onSubmit={searchDiscDatabase}>
          <label>
            Search database
            <input
              value={discSearch}
              onChange={(event) => setDiscSearch(event.target.value)}
              data-testid="disc-search"
              placeholder="Aviar, Zone, Destroyer..."
            />
          </label>
          <button className="primary-action" type="submit" disabled={loadingDiscs} data-testid="search-disc-api">
            <Search size={18} />
            {loadingDiscs ? 'Loading...' : 'Search'}
          </button>
        </form>

        <button className="secondary-action" type="button" onClick={() => searchDiscDatabase()} disabled={loadingDiscs}>
          <Disc3 size={18} />
          Browse all discs
        </button>

        {discImportStatus && (
          <p className="import-status" role="status">
            {discImportStatus}
          </p>
        )}
        {discImportError && (
          <p className="import-error" role="alert">
            {discImportError}
          </p>
        )}

        {importedDiscs.length > 0 && (
          <section className="import-disc-list" aria-label="DiscIt discs">
            {importedDiscs.map((disc) => {
              const alreadySaved = isDiscAlreadyImported(discs, disc);

              return (
                <article className="import-disc-card" key={disc.sourceId} data-testid="import-disc-card">
                  {disc.imageUrl && <img src={disc.imageUrl} alt="" loading="lazy" />}
                  <div>
                    <h3>{importedDiscDisplayName(disc)}</h3>
                    <p>
                      {disc.category}
                      {disc.stability ? ` - ${disc.stability}` : ''}
                    </p>
                    {disc.speed !== undefined &&
                      disc.glide !== undefined &&
                      disc.turn !== undefined &&
                      disc.fade !== undefined && (
                        <span>
                          {disc.speed} / {disc.glide} / {disc.turn} / {disc.fade}
                        </span>
                      )}
                  </div>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => importDisc(disc)}
                    disabled={alreadySaved}
                    data-testid={`import-disc-${disc.sourceId}`}
                  >
                    <PlusCircle size={18} />
                    {alreadySaved ? 'Saved' : 'Add'}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </section>

      <form className="disc-form" onSubmit={submitDisc}>
        <div className="section-heading compact-heading">
          <h2>Manual disc</h2>
        </div>
        <label>
          Disc name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid="disc-name"
            placeholder="Name"
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as DiscCategory)}
            data-testid="disc-category"
          >
            {discCategories.map((discCategory) => (
              <option key={discCategory} value={discCategory}>
                {discCategory}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action" type="submit" data-testid="add-disc">
          <PlusCircle size={18} />
          Add disc
        </button>
      </form>

      {discs.length === 0 ? (
        <section className="empty-history">
          <Disc3 size={28} />
          <h2>No discs yet</h2>
        </section>
      ) : (
        <section className="disc-list" aria-label="Saved discs">
          {discs.map((disc) => (
            <article className="disc-card" key={disc.id} data-testid="disc-card">
              <div>
                <h2>{disc.name}</h2>
                <p>
                  {disc.category}
                  {disc.brand ? ` - ${disc.brand}` : ''}
                  {disc.stability ? ` - ${disc.stability}` : ''}
                </p>
                {disc.speed !== undefined &&
                  disc.glide !== undefined &&
                  disc.turn !== undefined &&
                  disc.fade !== undefined && (
                    <span>
                      {disc.speed} / {disc.glide} / {disc.turn} / {disc.fade}
                    </span>
                  )}
              </div>
              <button
                className="delete-action"
                type="button"
                onClick={() => onDelete(disc.id)}
                title={`Delete ${disc.name}`}
              >
                <Trash2 size={17} />
                Delete
              </button>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

export default App;
