import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  COURSES_KEY,
  COURSE_RUNS_KEY,
  DISCS_KEY,
  DRAFT_KEY,
  STORAGE_KEY,
  createBlankSession,
  createDisc,
  readStoredSessions,
  saveDiscs,
  saveSessions,
  type CourseRun,
  type ErrorType,
  type TrainingSession,
} from './training';

function setAppliedThrow(session: TrainingSession, score: number, error: ErrorType = '') {
  if (session.trainingType === 'putting') {
    session.sessionThrows[0] = { ...session.sessionThrows[0], score, error, completed: true };
    return;
  }

  session.sessionThrows[0] = {
    ...session.sessionThrows[0],
    error,
    completed: true,
    approachDistanceMeters: score > 0 ? '5' : '10',
    approachDirection: 'right',
    releaseIssue: 'griplock',
  };
}

describe('App', () => {
  it('starts on the main menu with a new session action', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Training tracker' })).toBeInTheDocument();
    expect(screen.getByTestId('session-count')).toHaveAccessibleName('Saved sessions 0');
    expect(screen.getByTestId('new-session')).toBeInTheDocument();
    expect(screen.getByText('Putter approaches')).toBeInTheDocument();
    expect(screen.getByText('Putting')).toBeInTheDocument();
    expect(screen.queryByTestId('current-throw-card')).not.toBeInTheDocument();
  });

  it('creates a custom putting session and applies throws one at a time', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('new-session'));
    await user.click(screen.getByTestId('type-putting'));
    await user.clear(screen.getByTestId('setup-distance'));
    await user.type(screen.getByTestId('setup-distance'), '8');
    fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-06-28' } });
    await user.selectOptions(screen.getByLabelText('Wind direction'), 'Headwind');
    await user.selectOptions(screen.getByLabelText('Wind'), 'Medium');
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.type(screen.getByLabelText('Notes'), 'Work on nose angle.');
    await user.click(screen.getByTestId('start-session'));

    expect(screen.getByRole('heading', { level: 1, name: 'Putting' })).toBeInTheDocument();
    expect(screen.getByTestId('current-score')).toHaveAccessibleName('Current score 0 out of 3, accuracy 0%');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('8 m - 3 throws - Headwind - Medium wind - Fatigue 5')).toBeInTheDocument();
    expect(screen.getAllByTestId('current-throw-card')).toHaveLength(1);
    expect(screen.getByTestId('current-putt-result')).toBeDisabled();

    await user.click(screen.getByTestId('current-score-1'));
    expect(screen.getByTestId('current-putt-result')).toHaveValue('chains middle');
    expect(
      within(screen.getByTestId('current-putt-result')).queryByRole('option', { name: 'miss left' })
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('current-putt-result'), 'chains left');
    await user.selectOptions(screen.getByTestId('current-error'), 'left');
    await user.click(screen.getByTestId('apply-throw'));

    expect(screen.getByTestId('current-score')).toHaveAccessibleName('Current score 1 out of 3, accuracy 33%');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await user.click(screen.getByTestId('save-session'));

    const card = screen.getByTestId('history-card');
    expect(within(card).getByRole('heading', { name: 'Putting' })).toBeInTheDocument();
    expect(card).toHaveTextContent('2026-06-28 - 8 m - 3 throws - Headwind - Medium wind - Fatigue 5 - 1/3 throws');
    expect(card).toHaveTextContent('Work on nose angle.');
    expect(screen.getByTestId('stat-last')).toHaveTextContent('1/3');
    expect(screen.getByTestId('stat-best')).toHaveTextContent('1/3');
    expect(screen.getByTestId('stat-average')).toHaveTextContent('33%');
    expect(screen.getByTestId('stat-error')).toHaveTextContent('left (1)');

    const savedSessions = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as TrainingSession[];
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0].sessionThrows[0]).toMatchObject({
      completed: true,
      puttResult: 'chains left',
      error: 'left',
    });
  });

  it('shows only miss result options when a putt is missed', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('new-session'));
    await user.click(screen.getByTestId('type-putting'));
    fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '1' } });
    await user.click(screen.getByTestId('start-session'));
    await user.click(screen.getByTestId('current-score-0'));

    const puttResultSelect = screen.getByTestId('current-putt-result');
    expect(puttResultSelect).toHaveValue('miss left');
    expect(within(puttResultSelect).queryByRole('option', { name: 'chains middle' })).not.toBeInTheDocument();
    expect(within(puttResultSelect).getByRole('option', { name: 'miss right' })).toBeInTheDocument();

    await user.click(screen.getByTestId('apply-throw'));

    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as TrainingSession;
    expect(draft.sessionThrows[0]).toMatchObject({
      completed: true,
      score: 0,
      puttResult: 'miss left',
    });
  });

  it('adds discs and carries the selected disc to the next throw only within the same session', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Discs' }));
    await user.type(screen.getByTestId('disc-name'), 'Pure');
    await user.selectOptions(screen.getByTestId('disc-category'), 'mid-range');
    await user.click(screen.getByTestId('add-disc'));

    expect(screen.getByTestId('disc-card')).toHaveTextContent('Pure');
    expect(screen.getByTestId('disc-card')).toHaveTextContent('mid-range');

    const savedDiscs = JSON.parse(localStorage.getItem(DISCS_KEY) ?? '[]') as Array<{ id: string }>;
    expect(savedDiscs).toHaveLength(1);

    await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '2' } });
    await user.click(screen.getByTestId('start-session'));

    const discOption = within(screen.getByTestId('current-disc')).getByRole('option', {
      name: 'Pure - mid-range',
    }) as HTMLOptionElement;

    expect(screen.getByTestId('current-disc')).toHaveValue('');

    await user.selectOptions(screen.getByTestId('current-disc'), discOption.value);
    await user.click(screen.getByTestId('apply-throw'));

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByTestId('current-disc')).toHaveValue(discOption.value);

    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as TrainingSession;
    expect(draft.sessionThrows[0].discId).toBe(discOption.value);
    expect(draft.sessionThrows[1].discId).toBe(discOption.value);

    await user.click(screen.getByTestId('save-session'));
    await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '1' } });
    await user.click(screen.getByTestId('start-session'));

    expect(screen.getByTestId('current-disc')).toHaveValue('');
  });

  it('loads saved custom sessions from localStorage and deletes them from history', async () => {
    const user = userEvent.setup();
    const session = createBlankSession('forehand', { distanceMeters: '55', plannedThrows: 4 });
    session.date = '2026-06-10';
    session.windDirection = 'Tailwind';
    session.wind = 'Gusty';
    session.fatigue = 4;
    setAppliedThrow(session, 1, 'right');
    saveSessions([session]);

    render(<App />);

    expect(screen.getByTestId('stat-last')).toHaveTextContent('1/4');
    expect(screen.getByTestId('stat-average')).toHaveTextContent('Avg dist');
    expect(screen.getByTestId('stat-average')).toHaveTextContent('5 m');

    await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'History' }));

    const card = screen.getByTestId('history-card');
    expect(card).toHaveTextContent('Forehand');
    expect(card).toHaveTextContent('2026-06-10 - 55 m - 4 throws - Tailwind - Gusty wind - Fatigue 4 - 1/4 throws');
    expect(card).toHaveTextContent('Avg 5 m');
    expect(card).toHaveTextContent('Top parameter: Release griplock (1)');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('heading', { name: 'No sessions yet' })).toBeInTheDocument();
    expect(readStoredSessions()).toEqual([]);
  });

  it('exports saved history for AI analysis', async () => {
    const user = userEvent.setup();
    const session = createBlankSession('forehand', { distanceMeters: '55', plannedThrows: 4 });
    session.date = '2026-06-10';
    setAppliedThrow(session, 1, 'right');
    saveSessions([session]);

    const writeText = vi.fn((_text: string) => Promise.resolve());
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:disc-golf-history');
    const revokeObjectURL = vi.fn((_url: string) => undefined);
    const clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const originalClipboard = navigator.clipboard;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    try {
      render(<App />);

      await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'History' }));
      await user.click(screen.getByTestId('copy-ai-export'));

      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toContain('"format": "disc-golf-training-history-v1"');
      expect(writeText.mock.calls[0][0]).toContain('"trainingType": "forehand"');
      expect(writeText.mock.calls[0][0]).toContain('"topParameter"');
      expect(writeText.mock.calls[0][0]).toContain('"releaseIssue": "griplock"');
      expect(await screen.findByRole('status')).toHaveTextContent('Copied for AI');

      await user.click(screen.getByTestId('download-ai-export'));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickAnchor).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:disc-golf-history');

      const exportedBlob = createObjectURL.mock.calls[0][0] as Blob;
      expect(exportedBlob).toBeInstanceOf(Blob);
      expect(exportedBlob.type).toBe('application/json');
      expect(screen.getByRole('status')).toHaveTextContent('Exported JSON');
    } finally {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
      clickAnchor.mockRestore();
    }
  });

  it('records approach details without rendering a full throw list', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('new-session'));
    fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '2' } });
    await user.click(screen.getByTestId('start-session'));

    expect(screen.queryAllByTestId('throw-row')).toHaveLength(0);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('Avg dist')).toBeInTheDocument();
    expect(screen.getByTestId('current-approach-distance')).toHaveValue('5');
    expect(screen.getByTestId('current-approach-direction')).toHaveValue('front');
    expect(screen.queryByTestId('current-score-2')).not.toBeInTheDocument();

    await user.clear(screen.getByTestId('current-approach-distance'));
    await user.type(screen.getByTestId('current-approach-distance'), '2.7');
    await user.selectOptions(screen.getByTestId('current-approach-direction'), 'back');
    await user.selectOptions(screen.getByTestId('current-release'), 'griplock');
    await user.click(screen.getByTestId('apply-throw'));

    expect(screen.getByTestId('current-score')).toHaveAccessibleName('Current score 2 out of 4, average distance 2.7 m');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as TrainingSession;
    expect(draft.sessionThrows[0]).toMatchObject({
      completed: true,
      approachDistanceMeters: '2.7',
      approachDirection: 'back',
      releaseIssue: 'griplock',
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByTestId('current-score')).toHaveAccessibleName('Current score 0 out of 4, average distance no throws');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('uses default proximity values when distance is emptied', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('new-session'));
    await user.click(screen.getByTestId('type-forehand'));
    fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '1' } });
    await user.click(screen.getByTestId('start-session'));

    expect(screen.getByTestId('current-approach-distance')).toHaveValue('5');
    expect(screen.getByTestId('current-approach-direction')).toHaveValue('front');
    expect(screen.getByTestId('current-release')).toBeInTheDocument();

    await user.clear(screen.getByTestId('current-approach-distance'));
    await user.selectOptions(screen.getByTestId('current-release'), 'griplock');
    await user.click(screen.getByTestId('apply-throw'));

    expect(screen.getByTestId('current-score')).toHaveAccessibleName('Current score 1 out of 1, average distance 5 m');
    expect(screen.getByTestId('session-complete')).toHaveTextContent('Top parameter: Release griplock (1)');

    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') as TrainingSession;
    expect(draft.sessionThrows[0]).toMatchObject({
      completed: true,
      approachDistanceMeters: '5',
      approachDirection: 'front',
      releaseIssue: 'griplock',
      score: 1,
    });
  });

  it('creates a course, starts a multi-player course run, records throws, and saves it locally', async () => {
    const user = userEvent.setup();
    const disc = createDisc('Zone', 'putter');
    saveDiscs([disc]);

    render(<App />);

    await user.click(within(screen.getByRole('navigation', { name: 'Views' })).getByRole('button', { name: 'Courses' }));
    await user.type(screen.getByTestId('course-name'), 'Local Park');
    fireEvent.change(screen.getByTestId('course-hole-count'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('course-hole-1-par'), { target: { value: '3' } });
    fireEvent.change(screen.getByTestId('course-hole-1-distance'), { target: { value: '85' } });
    fireEvent.change(screen.getByTestId('course-hole-2-par'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('course-hole-2-distance'), { target: { value: '126' } });
    await user.click(screen.getByTestId('add-course'));

    expect(JSON.parse(localStorage.getItem(COURSES_KEY) ?? '[]')).toHaveLength(1);
    expect(screen.getByTestId('course-card')).toHaveTextContent('Local Park');
    expect(screen.getByTestId('course-card')).toHaveTextContent('2 holes - Par 7 - 211 m');

    await user.click(screen.getByTestId('start-course'));
    await user.clear(screen.getByTestId('course-player-0'));
    await user.type(screen.getByTestId('course-player-0'), 'Alex');
    await user.click(screen.getByTestId('add-player'));
    await user.clear(screen.getByTestId('course-player-1'));
    await user.type(screen.getByTestId('course-player-1'), 'Sam');
    await user.click(screen.getByTestId('start-course-run'));

    expect(screen.getByRole('heading', { level: 1, name: 'Local Park' })).toBeInTheDocument();
    expect(screen.getByTestId('course-run-status')).toHaveAccessibleName('Course run hole 1 of 2');
    expect(screen.getByTestId('course-run-current-hole')).toHaveTextContent('Hole 1 - Alex');

    await user.selectOptions(screen.getByTestId('course-run-disc'), disc.id);
    await user.selectOptions(screen.getByTestId('course-run-style'), 'backhand');
    await user.selectOptions(screen.getByTestId('course-run-angle'), 'hyzer');
    await user.type(screen.getByTestId('course-run-throw-notes'), 'Safe gap');
    await user.click(screen.getByTestId('add-course-throw'));
    await user.type(screen.getByTestId('course-run-hole-notes'), 'Circle putt.');

    expect(screen.getByText(/Throws on this hole:/)).toHaveTextContent('1');
    expect(screen.getByText(/Last:/)).toHaveTextContent('backhand, hyzer - Safe gap');

    await user.click(screen.getByTestId('course-run-next'));

    expect(screen.getByTestId('course-run-current-hole')).toHaveTextContent('Hole 1 - Sam');

    await user.selectOptions(screen.getByTestId('course-run-style'), 'forehand');
    await user.selectOptions(screen.getByTestId('course-run-angle'), 'flat');
    await user.click(screen.getByTestId('add-course-throw'));
    await user.click(screen.getByTestId('course-run-next'));

    expect(screen.getByTestId('course-run-current-hole')).toHaveTextContent('Hole 2 - Alex');

    await user.click(screen.getByTestId('save-course-run'));

    const savedRuns = JSON.parse(localStorage.getItem(COURSE_RUNS_KEY) ?? '[]') as CourseRun[];
    expect(savedRuns).toHaveLength(1);
    expect(savedRuns[0]).toMatchObject({
      courseName: 'Local Park',
      status: 'saved',
      players: [{ name: 'Alex' }, { name: 'Sam' }],
    });
    expect(savedRuns[0].holes[0].players[savedRuns[0].players[0].id].throws[0]).toMatchObject({
      discId: disc.id,
      style: 'backhand',
      angle: 'hyzer',
      notes: 'Safe gap',
    });
    expect(savedRuns[0].holes[0].players[savedRuns[0].players[0].id].notes).toBe('Circle putt.');
    expect(screen.getByTestId('course-run-card')).toHaveTextContent('Local Park');
    expect(screen.getByTestId('course-run-card')).toHaveTextContent('Alex: 1 throws, 1/2 holes, -2');
    expect(screen.getByTestId('course-run-card')).toHaveTextContent('Sam: 1 throws, 1/2 holes, -2');
  });
});
