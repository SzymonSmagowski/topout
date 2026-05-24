/**
 * SummaryBanner — discriminated SummaryState union rendering.
 *
 * The component branch-dispatches on `state.kind` (pending | ok | err).
 * This is one of the learning-project discriminated-union showcases.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';

import { SummaryBanner, type SummaryState, summaryStateFrom } from '../components/SummaryBanner';

describe('SummaryBanner', () => {
  it('unit SummaryBanner pending — renders aria-busy status with loading skeleton', () => {
    const state: SummaryState = { kind: 'pending' };
    render(<SummaryBanner state={state} />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent(/generating coach summary/i);
  });

  it('unit SummaryBanner ok — renders summary text', () => {
    const state: SummaryState = {
      kind: 'ok',
      text: 'Good session — you flashed three V4s and stuck the V6 project.',
    };
    render(<SummaryBanner state={state} />);

    expect(
      screen.getByText('Good session — you flashed three V4s and stuck the V6 project.'),
    ).toBeInTheDocument();

    // Coach summary eyebrow label is present.
    expect(screen.getByText(/coach summary/i)).toBeInTheDocument();
  });

  it('unit SummaryBanner err — renders error message and retry button', async () => {
    const state: SummaryState = { kind: 'err', message: 'Sidecar timeout.' };
    const onRetry = vi.fn();
    render(<SummaryBanner state={state} onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // The alert container holds the heading, error message, and retry button.
    // Use within-element text queries rather than toHaveTextContent for precision.
    // The heading uses a right single quotation mark (U+2019) not a straight apostrophe.
    expect(screen.getByText(/generate summary/i)).toBeInTheDocument();
    expect(screen.getByText('Sidecar timeout.')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('unit SummaryBanner err without onRetry — no retry button rendered', () => {
    const state: SummaryState = { kind: 'err', message: 'Some error.' };
    render(<SummaryBanner state={state} />);

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('unit SummaryBanner err retrying — retry button shows "Retrying…" and is disabled', () => {
    const state: SummaryState = { kind: 'err', message: 'Timeout.' };
    render(<SummaryBanner state={state} onRetry={vi.fn()} retrying />);

    const btn = screen.getByRole('button', { name: /retrying/i });
    expect(btn).toBeDisabled();
  });
});

describe('summaryStateFrom', () => {
  it('unit summaryStateFrom pending row — returns { kind: "pending" }', () => {
    const result = summaryStateFrom({
      summary: null,
      summaryStatus: 'pending',
      summaryError: null,
    });
    expect(result).toEqual({ kind: 'pending' });
  });

  it('unit summaryStateFrom ok row — returns { kind: "ok", text }', () => {
    const result = summaryStateFrom({
      summary: 'Nice work.',
      summaryStatus: 'ok',
      summaryError: null,
    });
    expect(result).toEqual({ kind: 'ok', text: 'Nice work.' });
  });

  it('unit summaryStateFrom err row — returns { kind: "err", message }', () => {
    const result = summaryStateFrom({
      summary: null,
      summaryStatus: 'err',
      summaryError: 'Sidecar unreachable.',
    });
    expect(result).toEqual({ kind: 'err', message: 'Sidecar unreachable.' });
  });

  it('unit summaryStateFrom ok with null summary — falls back to empty string', () => {
    const result = summaryStateFrom({
      summary: null,
      summaryStatus: 'ok',
      summaryError: null,
    });
    expect(result).toEqual({ kind: 'ok', text: '' });
  });

  it('unit summaryStateFrom err with null error — falls back to default message', () => {
    const result = summaryStateFrom({
      summary: null,
      summaryStatus: 'err',
      summaryError: null,
    });
    expect(result).toEqual({ kind: 'err', message: 'Summary generation failed.' });
  });
});
