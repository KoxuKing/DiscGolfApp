import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  COURSES_KEY,
  COURSE_RUNS_KEY,
  DISCS_KEY,
  DISTANCE_THROWS_KEY,
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

function viewNav() {
  return within(screen.getByRole('navigation', { name: 'Views' }));
}

async function openTraining(user: ReturnType<typeof userEvent.setup>) {
  await user.click(viewNav().getByRole('button', { name: 'Training' }));
}

async function openNewSession(user: ReturnType<typeof userEvent.setup>) {
  await openTraining(user);
  await user.click(screen.getByTestId('new-session'));
}

describe('App', () => {
  it('starts on the main menu with a new session action', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Training tracker' })).toBeInTheDocument();
    expect(screen.getByTestId('session-count')).toHaveAccessibleName('Saved sessions 0');
    expect(viewNav().getByRole('button', { name: 'Training' })).toBeInTheDocument();
    expect(viewNav().queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    expect(viewNav().queryByRole('button', { name: 'History' })).not.toBeInTheDocument();
    expect(viewNav().queryByRole('button', { name: 'Distance' })).not.toBeInTheDocument();
    expect(screen.getByTestId('new-session')).toBeInTheDocument();
    expect(screen.getByTestId('max-distance')).toBeInTheDocument();
    expect(screen.queryByText('Putter approaches')).not.toBeInTheDocument();
    expect(screen.queryByText('Putting')).not.toBeInTheDocument();
    expect(screen.queryByTestId('current-throw-card')).not.toBeInTheDocument();
  });

  it('creates a custom putting session and applies throws one at a time', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId('new-session'));
    expect(within(screen.getByRole('group', { name: 'Training type' })).getAllByRole('button')[0]).toHaveTextContent(
      'Putting'
    );
    await user.click(screen.getByTestId('type-putting'));
    await user.clear(screen.getByTestId('setup-distance'));
    await user.type(screen.getByTestId('setup-distance'), '8');
    await user.clear(screen.getByTestId('setup-throws'));
    expect(screen.getByTestId('setup-throws')).toHaveDisplayValue('');
    await user.type(screen.getByTestId('setup-throws'), '3');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-06-28' } });
    await user.selectOptions(screen.getByLabelText('Wind direction'), 'Headwind');
    await user.selectOptions(screen.getByLabelText('Wind'), 'Medium');
    await user.click(screen.getByRole('button', { name: '5' }));
    await user.type(screen.getByLabelText('Notes'), 'Work on nose angle.');
    await user.click(screen.getByTestId('start-session'));

    expect(screen.getByRole('heading', { level: 1, name: 'Putting' })).toBeInTheDocument();
    expect(screen.getByTestId('current-progress')).toHaveAccessibleName('Completed throws 0 of 3, accuracy 0%');
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

    expect(screen.getByTestId('current-progress')).toHaveAccessibleName('Completed throws 1 of 3, accuracy 33%');
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await user.click(screen.getByTestId('save-session'));

    const card = screen.getByTestId('history-card');
    expect(within(card).getByRole('heading', { name: 'Putting' })).toBeInTheDocument();
    expect(card).toHaveTextContent('2026-06-28 - 8 m - 1 throw - Headwind - Medium wind - Fatigue 5 - 1/1 throws');
    expect(card).toHaveTextContent('Work on nose angle.');
    expect(screen.getByTestId('stat-last')).toHaveTextContent('100%');
    expect(screen.getByTestId('stat-best')).toHaveTextContent('100%');
    expect(screen.getByTestId('stat-average')).toHaveTextContent('100%');
    expect(screen.getByTestId('stat-error')).toHaveTextContent('left (1)');

    const savedSessions = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as TrainingSession[];
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0].plannedThrows).toBe(1);
    expect(savedSessions[0].sessionThrows).toHaveLength(1);
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

    await user.click(viewNav().getByRole('button', { name: 'Discs' }));
    await user.type(screen.getByTestId('disc-name'), 'Pure');
    await user.selectOptions(screen.getByTestId('disc-category'), 'mid-range');
    await user.click(screen.getByTestId('add-disc'));

    expect(screen.getByTestId('disc-card')).toHaveTextContent('Pure');
    expect(screen.getByTestId('disc-card')).toHaveTextContent('mid-range');

    const savedDiscs = JSON.parse(localStorage.getItem(DISCS_KEY) ?? '[]') as Array<{ id: string }>;
    expect(savedDiscs).toHaveLength(1);

    await openNewSession(user);
    await user.click(screen.getByTestId('type-approaches'));
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
    await openNewSession(user);
    fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '1' } });
    await user.click(screen.getByTestId('start-session'));

    expect(screen.getByTestId('current-disc')).toHaveValue('');
  });

  it('searches the disc database and imports a disc for throw selection', async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
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
          ]),
          { status: 200 }
        )
      )
    );

    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetcher });

    try {
      render(<App />);

      await user.click(viewNav().getByRole('button', { name: 'Discs' }));
      await user.type(screen.getByTestId('disc-search'), 'zone');
      await user.click(screen.getByTestId('search-disc-api'));

      const importCard = await screen.findByTestId('import-disc-card');
      expect(importCard).toHaveTextContent('Discraft Zone');
      expect(importCard).toHaveTextContent('putter - Overstable');
      expect(importCard).toHaveTextContent('4 / 3 / 0 / 3');

      await user.click(screen.getByTestId('import-disc-zone-id'));

      const savedDiscs = JSON.parse(localStorage.getItem(DISCS_KEY) ?? '[]');
      expect(savedDiscs).toHaveLength(1);
      expect(savedDiscs[0]).toMatchObject({
        name: 'Discraft Zone',
        category: 'putter',
        source: 'discit',
        sourceId: 'zone-id',
        brand: 'Discraft',
        speed: 4,
        glide: 3,
        turn: 0,
        fade: 3,
        stability: 'Overstable',
      });
      expect(savedDiscs[0].attribution).toContain('DiscIt');
      expect(screen.getByTestId('import-disc-zone-id')).toBeDisabled();
      expect(screen.getByTestId('disc-card')).toHaveTextContent('Discraft Zone');

      await openNewSession(user);
      fireEvent.change(screen.getByTestId('setup-throws'), { target: { value: '1' } });
      await user.click(screen.getByTestId('start-session'));

      expect(
        within(screen.getByTestId('current-disc')).getByRole('option', {
          name: 'Discraft Zone - putter 4/3/0/3',
        })
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
    }
  });

  it('measures a max distance throw with GPS and saves it locally', async () => {
    const user = userEvent.setup();
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const positions = [
      {
        coords: {
          latitude: 0,
          longitude: 0,
          accuracy: 4,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.parse('2026-06-28T12:00:00.000Z'),
      },
      {
        coords: {
          latitude: 0,
          longitude: 0.001,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.parse('2026-06-28T12:01:00.000Z'),
      },
    ] as GeolocationPosition[];
    let watchSuccess: PositionCallback | undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success(positions[0]);
    });
    const watchPosition = vi.fn((success: PositionCallback) => {
      watchSuccess = success;
      success(positions[0]);
      return 42;
    });
    const clearWatch = vi.fn();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition, watchPosition, clearWatch },
    });

    try {
      const { unmount } = render(<App />);

      await openTraining(user);
      await user.click(screen.getByTestId('max-distance'));

      expect(await screen.findByTestId('live-gps-accuracy')).toHaveTextContent('4 m');
      await user.click(screen.getByTestId('gps-start'));

      expect(await screen.findByRole('status')).toHaveTextContent('Start saved');
      expect(screen.getByText('Accuracy 4 m')).toBeInTheDocument();
      expect(screen.getByTestId('measured-distance')).toHaveTextContent('0 m');

      watchSuccess?.(positions[1]);
      await waitFor(() => expect(screen.getByTestId('live-gps-accuracy')).toHaveTextContent('5 m'));
      expect(screen.getByTestId('measured-distance')).toHaveTextContent('111 m');
      await user.click(screen.getByTestId('gps-end'));

      expect(await screen.findByRole('status')).toHaveTextContent('End saved');
      expect(screen.getByTestId('measured-distance')).toHaveTextContent('111 m');
      expect(screen.getByText('Accuracy 5 m')).toBeInTheDocument();

      await user.selectOptions(screen.getByTestId('distance-style'), 'forehand');
      await user.selectOptions(screen.getByTestId('distance-angle'), 'hyzer');
      await user.type(screen.getByTestId('distance-notes'), 'Max distance field.');
      await user.click(screen.getByTestId('save-distance-throw'));

      const savedThrows = JSON.parse(localStorage.getItem(DISTANCE_THROWS_KEY) ?? '[]');
      expect(savedThrows).toHaveLength(1);
      expect(savedThrows[0]).toMatchObject({
        style: 'forehand',
        angle: 'hyzer',
        notes: 'Max distance field.',
        start: { lat: 0, lon: 0, accuracyMeters: 4 },
        end: { lat: 0, lon: 0.001, accuracyMeters: 5 },
      });
      expect(savedThrows[0].distanceMeters).toBeCloseTo(111.2, 1);
      expect(screen.getByTestId('distance-card')).toHaveTextContent('111 m');
      expect(screen.getByTestId('distance-card')).toHaveTextContent('forehand');
      expect(screen.getByTestId('distance-card')).toHaveTextContent('hyzer');
      expect(getCurrentPosition).not.toHaveBeenCalled();
      unmount();
      expect(clearWatch).toHaveBeenCalledWith(42);
    } finally {
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      }
    }
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

    expect(screen.getByTestId('stat-last')).toHaveTextContent('5 m');
    expect(screen.getByTestId('stat-average')).toHaveTextContent('Avg dist');
    expect(screen.getByTestId('stat-average')).toHaveTextContent('5 m');

    await openTraining(user);
    await user.click(screen.getByRole('button', { name: 'History' }));

    const card = screen.getByTestId('history-card');
    expect(card).toHaveTextContent('Forehand');
    expect(card).toHaveTextContent('2026-06-10 - 55 m - 4 throws - Tailwind - Gusty wind - Fatigue 4 - 1/4 throws');
    expect(card).toHaveTextContent('5 m');
    expect(card).toHaveTextContent('Avg dist');
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

      await openTraining(user);
      await user.click(screen.getByRole('button', { name: 'History' }));
      await user.click(screen.getByTestId('copy-ai-export'));

      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toContain('"format": "disc-golf-training-history-v1"');
      expect(writeText.mock.calls[0][0]).toContain('"trainingType": "forehand"');
      expect(writeText.mock.calls[0][0]).toContain('"topParameter"');
      expect(writeText.mock.calls[0][0]).toContain('"releaseIssue": "griplock"');
      expect(writeText.mock.calls[0][0]).not.toContain('"maxScore"');
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
    await user.click(screen.getByTestId('type-approaches'));
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

    expect(screen.getByTestId('current-progress')).toHaveAccessibleName(
      'Completed throws 1 of 2, average distance 2.7 m'
    );
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

    expect(screen.getByTestId('current-progress')).toHaveAccessibleName(
      'Completed throws 0 of 2, average distance no throws'
    );
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

    expect(screen.getByTestId('current-progress')).toHaveAccessibleName(
      'Completed throws 1 of 1, average distance 5 m'
    );
    expect(screen.getByTestId('session-complete')).toHaveTextContent('Avg dist: 5 m');
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

  it('finds nearby DiscGolfAPI courses, imports an editable draft, and saves metadata', async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            courses: [
              {
                id: 'far',
                slug: 'far-course',
                name: 'Far Course',
                lat: 65,
                lon: 25,
                locality: 'Oulu',
                primary_layout: { holes: 9, length_meters: 900 },
              },
              {
                id: 'third',
                slug: 'third-course',
                name: 'Third Course',
                lat: 62,
                lon: 24,
                locality: 'Hameenkyro',
                primary_layout: { holes: 18, length_meters: 1800 },
              },
              {
                id: 'near',
                slug: 'near-course',
                name: 'Near Course',
                lat: 61.49,
                lon: 23.77,
                locality: 'Tampere',
                primary_layout: { holes: 3, par_total: 10, length_meters: 302 },
              },
              {
                id: 'second',
                slug: 'second-course',
                name: 'Second Course',
                lat: 61.6,
                lon: 23.8,
                locality: 'Ylojarvi',
                primary_layout: { holes: 9, length_meters: 900 },
              },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 61.5,
          longitude: 23.76,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });

    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetcher });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });

    try {
      render(<App />);

      await user.click(viewNav().getByRole('button', { name: 'Courses' }));
      await user.click(screen.getByTestId('find-nearby-courses'));

      const importCards = await screen.findAllByTestId('import-course-card');
      expect(importCards).toHaveLength(3);
      expect(importCards[0]).toHaveTextContent('Near Course');
      expect(importCards[0]).toHaveTextContent('Tampere');
      expect(importCards[0]).toHaveTextContent('3 holes');
      expect(importCards[0]).toHaveTextContent('Par 10');
      expect(importCards[1]).toHaveTextContent('Second Course');
      expect(importCards[2]).toHaveTextContent('Third Course');
      expect(screen.queryByText('Far Course')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('import-course-near'));

      expect(screen.getByTestId('course-name')).toHaveValue('Near Course');
      expect(screen.getByTestId('course-hole-count')).toHaveValue(3);
      expect(screen.getByTestId('course-hole-1-distance')).toHaveValue(101);
      expect(screen.getByTestId('course-hole-2-par')).toHaveValue(4);
      expect(screen.getByTestId('import-attribution')).toHaveTextContent('DiscGolfAPI');

      await user.click(screen.getByTestId('add-course'));

      const savedCourses = JSON.parse(localStorage.getItem(COURSES_KEY) ?? '[]');
      expect(savedCourses).toHaveLength(1);
      expect(savedCourses[0]).toMatchObject({
        name: 'Near Course',
        source: 'discgolfapi',
        sourceId: 'near',
        sourceSlug: 'near-course',
        locality: 'Tampere',
        lat: 61.49,
        lon: 23.77,
      });
      expect(savedCourses[0].holes.map((hole: { par: number }) => hole.par)).toEqual([3, 4, 3]);
      expect(savedCourses[0].holes.map((hole: { distanceMeters: number }) => hole.distanceMeters)).toEqual([
        101,
        101,
        100,
      ]);
      expect(savedCourses[0].attribution).toContain('DiscGolfAPI');
      expect(screen.getByTestId('import-course-near')).toBeDisabled();
      expect(screen.getByTestId('import-course-near')).toHaveTextContent('Saved');
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      }
    }
  });

  it('falls back to searchable Finland course list when GPS is denied', async () => {
    const user = userEvent.setup();
    const originalFetch = globalThis.fetch;
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            courses: [
              { id: 'oulu', name: 'Oulu Course', locality: 'Oulu' },
              { id: 'nokia', name: 'Nokia DiscGolfPark', locality: 'Nokia' },
            ],
          }),
          { status: 200 }
        )
      )
    );
    const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, message: 'Denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });

    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetcher });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });

    try {
      render(<App />);

      await user.click(viewNav().getByRole('button', { name: 'Courses' }));
      await user.click(screen.getByTestId('find-nearby-courses'));

      expect(await screen.findByRole('status')).toHaveTextContent('Showing Finnish courses');
      await user.type(screen.getByTestId('course-search'), 'Oulu');

      expect(screen.getByTestId('import-course-card')).toHaveTextContent('Oulu Course');
      expect(screen.queryByText('Nokia DiscGolfPark')).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
      if (originalGeolocation) {
        Object.defineProperty(navigator, 'geolocation', originalGeolocation);
      }
    }
  });

  it('creates a course, starts a multi-player course run, records throws, and saves it locally', async () => {
    const user = userEvent.setup();
    const disc = createDisc('Zone', 'putter');
    saveDiscs([disc]);

    render(<App />);

    await user.click(viewNav().getByRole('button', { name: 'Courses' }));
    await user.type(screen.getByTestId('course-name'), 'Local Park');
    await user.clear(screen.getByTestId('course-hole-count'));
    expect(screen.getByTestId('course-hole-count')).toHaveDisplayValue('');
    await user.type(screen.getByTestId('course-hole-count'), '2');
    await user.clear(screen.getByTestId('course-hole-1-par'));
    expect(screen.getByTestId('course-hole-1-par')).toHaveDisplayValue('');
    await user.type(screen.getByTestId('course-hole-1-par'), '3');
    await user.clear(screen.getByTestId('course-hole-1-distance'));
    expect(screen.getByTestId('course-hole-1-distance')).toHaveDisplayValue('');
    await user.type(screen.getByTestId('course-hole-1-distance'), '85');
    await user.clear(screen.getByTestId('course-hole-2-par'));
    await user.type(screen.getByTestId('course-hole-2-par'), '4');
    await user.clear(screen.getByTestId('course-hole-2-distance'));
    await user.type(screen.getByTestId('course-hole-2-distance'), '126');
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
