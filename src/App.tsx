import { useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ClipboardList,
  Copy,
  Disc3,
  Download,
  History,
  Home,
  PlusCircle,
  RotateCcw,
  Save,
  Target,
  Trash2,
  Trophy,
  Undo2,
} from 'lucide-react';
import {
  approachDirections,
  applyThrowDefaults,
  aiHistoryExportFilename,
  calculateProgressStats,
  canApplyThrow,
  clampPlannedThrows,
  completedThrows,
  createDisc,
  createBlankSession,
  createAiHistoryExportText,
  currentThrow,
  currentThrowIndex,
  currentThrowNumber,
  defaultPuttResultForScore,
  defaultDistanceForType,
  discCategories,
  errorTypes,
  isSessionComplete,
  makeId,
  puttResultsForScore,
  readDraft,
  readStoredDiscs,
  readStoredSessions,
  releaseIssues,
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
  todayIsoDate,
  usesManualScore,
  usesProximityScore,
  windDirections,
  windStrengths,
  type Disc,
  type DiscCategory,
  type ErrorType,
  type SectionId,
  type ThrowResult,
  type TrainingSession,
} from './training';

type View = 'home' | 'new' | 'track' | 'history' | 'discs';

type SessionSetup = {
  trainingType: SectionId;
  distanceMeters: string;
  plannedThrows: number;
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
    plannedThrows: 10,
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

function App() {
  const initialDraft = readDraft();
  const [draft, setDraft] = useState<TrainingSession | null>(() => initialDraft);
  const [sessions, setSessions] = useState<TrainingSession[]>(() => readStoredSessions());
  const [discs, setDiscs] = useState<Disc[]>(() => readStoredDiscs());
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
        plannedThrows: setup.plannedThrows,
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
      ...draft,
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

  function addDisc(name: string, category: DiscCategory) {
    const nextDiscs = [...discs, createDisc(name, category)];
    setDiscs(nextDiscs);
    saveDiscs(nextDiscs);
  }

  function deleteDisc(discId: string) {
    const nextDiscs = discs.filter((disc) => disc.id !== discId);
    setDiscs(nextDiscs);
    saveDiscs(nextDiscs);
  }

  return (
    <main className={`app-shell ${activeView === 'track' ? 'tracking-shell' : ''}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Disc golf</p>
          <h1>{activeView === 'track' && draft ? sessionTitle(draft) : 'Training tracker'}</h1>
        </div>
        {draft ? (
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

      {activeView !== 'track' && (
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
        <button className={activeView === 'home' ? 'active' : ''} onClick={() => setActiveView('home')}>
          <Home size={18} />
          Menu
        </button>
        {draft && (
          <button className={activeView === 'track' ? 'active' : ''} onClick={() => setActiveView('track')}>
            <ClipboardList size={18} />
            Session
          </button>
        )}
        <button className={activeView === 'new' ? 'active' : ''} onClick={() => setActiveView('new')}>
          <PlusCircle size={18} />
          New
        </button>
        <button className={activeView === 'history' ? 'active' : ''} onClick={() => setActiveView('history')}>
          <History size={18} />
          History
        </button>
        <button className={activeView === 'discs' ? 'active' : ''} onClick={() => setActiveView('discs')}>
          <Disc3 size={18} />
          Discs
        </button>
      </nav>

      {activeView === 'home' && (
        <HomeView
          hasDraft={Boolean(draft)}
          onNew={() => setActiveView('new')}
          onContinue={() => setActiveView('track')}
          onHistory={() => setActiveView('history')}
          onDiscs={() => setActiveView('discs')}
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
          onDiscs={() => setActiveView('discs')}
        />
      )}

      {activeView === 'history' && <HistoryView sessions={sessions} discs={discs} onDelete={deleteSession} />}
      {activeView === 'discs' && <DiscsView discs={discs} onAdd={addDisc} onDelete={deleteDisc} />}
    </main>
  );
}

type HomeViewProps = {
  hasDraft: boolean;
  onNew: () => void;
  onContinue?: () => void;
  onHistory: () => void;
  onDiscs: () => void;
};

function HomeView({ hasDraft, onNew, onContinue, onHistory, onDiscs }: HomeViewProps) {
  return (
    <section className="main-menu" aria-label="Main menu">
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
      <button className="secondary-action menu-action" type="button" onClick={onHistory}>
        <History size={20} />
        History
      </button>
      <button className="secondary-action menu-action" type="button" onClick={onDiscs}>
        <Disc3 size={20} />
        Discs
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
              onChange={(event) => onSetupChange('plannedThrows', clampPlannedThrows(Number(event.target.value)))}
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
                    {disc.name} - {disc.category}
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

type DiscsViewProps = {
  discs: Disc[];
  onAdd: (name: string, category: DiscCategory) => void;
  onDelete: (discId: string) => void;
};

function DiscsView({ discs, onAdd, onDelete }: DiscsViewProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DiscCategory>('putter');

  function submitDisc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    onAdd(name, category);
    setName('');
    setCategory('putter');
  }

  return (
    <section className="discs-panel" aria-label="Discs">
      <form className="disc-form" onSubmit={submitDisc}>
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
                <p>{disc.category}</p>
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
