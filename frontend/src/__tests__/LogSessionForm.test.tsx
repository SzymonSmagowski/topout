/**
 * LogSessionForm — validation + happy-path mutation call.
 *
 * The form has inline validation on submit (not HTML5 required attributes
 * for most fields). We test:
 *   1. Submitting with no gym name → shows "Pick or type a gym." error
 *   2. Submitting a future date → shows "Date cannot be in the future." error
 *   3. Valid payload → calls createSession mutation with the expected shape
 *
 * Note: the form always renders with at least one attempt by default, so the
 * "no attempts" validation branch is unreachable in normal interaction; we test
 * the gym-missing branch instead.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));

const mockCreateSession = vi.fn();
const mockEnsureGym = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

// convex/values — ConvexError used in the error handler.
vi.mock('convex/values', () => ({
  ConvexError: class ConvexError extends Error {
    data: unknown;
    constructor(data: unknown) {
      super(String(data));
      this.data = data;
    }
  },
}));

import { LogSessionForm } from '../components/LogSessionForm';

describe('LogSessionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: queries return empty lists (GymCombobox).
    mockUseQuery.mockReturnValue([]);
    // useMutation returns the right mock depending on which mutation key is requested.
    mockUseMutation.mockImplementation((mutationKey: string) => {
      if (mutationKey === 'gyms:ensureByName') return mockEnsureGym;
      if (mutationKey === 'sessions:createSession') return mockCreateSession;
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unit LogSessionForm empty gym — shows "Pick or type a gym." validation error', async () => {
    const { container } = render(<LogSessionForm />);

    // Bypass HTML5 constraint validation by dispatching submit on the form
    // directly; that calls onSubmit regardless of `required` attributes.
    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Pick or type a gym.');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('unit LogSessionForm future date — shows "Date cannot be in the future." error', async () => {
    const { container } = render(<LogSessionForm />);

    // Set the date to a future date.
    const dateInput = screen.getByLabelText(/date/i);
    fireEvent.change(dateInput, { target: { value: '2099-12-31' } });

    // Set a gym name so we get past the gym-name guard.
    const gymInput = screen.getByPlaceholderText(/type to search or create/i);
    fireEvent.change(gymInput, { target: { value: 'Test Gym' } });

    // Submit via fireEvent to bypass HTML5 constraint validation in jsdom.
    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Date cannot be in the future.',
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('unit LogSessionForm valid payload — calls createSession with correct shape', async () => {
    const fakeSessionId = 'session-abc-123';
    mockCreateSession.mockResolvedValue({ sessionId: fakeSessionId });
    // ensureGym is not called when gymId is already set, but in this test the
    // user types a new gym name so gymId is null and ensureGym IS called.
    mockEnsureGym.mockResolvedValue({ gymId: 'gym-999' });

    render(<LogSessionForm />);

    // Fill in gym name.
    const gymInput = screen.getByPlaceholderText(/type to search or create/i);
    await userEvent.type(gymInput, 'Boulder Cave');

    // Effort slider is already at 7; attempts list has one default V3 Send.
    const submitBtn = screen.getByRole('button', { name: /log session/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockEnsureGym).toHaveBeenCalledWith({ name: 'Boulder Cave' });
    });

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          gymId: 'gym-999',
          perceivedEffort: 7,
          attempts: expect.arrayContaining([
            expect.objectContaining({ grade: 'V3', outcome: 'send', attemptCount: 1 }),
          ]),
        }),
      );
    });
  });
});
