import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Loader2 } from 'lucide-react';
import { readableError, toggleUpvote } from '../lib/api';
import { hasVoted, upvotesOf } from '../lib/format';
import { useAuth } from '../lib/authContext';
import { useToast } from '../lib/toastContext';

/**
 * "Me too" for a neighbour's report.
 *
 * The count is the number of distinct accounts that pressed it — the API tracks
 * voter ids, not a bare counter, so pressing twice removes your vote instead of
 * inflating the case. The admin queue ranks partly on this number, which is
 * exactly why it has to be one-per-account.
 *
 * The button state flips before the request lands. On failure it flips back and
 * says why; anything slower feels broken on a list you're scrolling.
 */
export default function UpvoteButton({ item, onChanged, size = 'md' }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Celebrates adding a vote, never removing one. Taking your backing off a
  // report should feel like a correction, not an achievement.
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(0);
  useEffect(() => () => clearTimeout(pulseTimer.current), []);

  const votes = upvotesOf(item);
  const mine = hasVoted(item, user?.id);
  const ownReport = !!user?.id && item?.author?.id === user.id;

  const press = async () => {
    if (!user) {
      toast.info('Sign in to upvote', 'Upvotes are one per account, so we need to know who you are.');
      return;
    }
    if (ownReport) {
      toast.info('That one is yours', "You can't upvote your own report — ask a neighbour to.");
      return;
    }

    const adding = !mine;
    setBusy(true);
    try {
      onChanged?.(await toggleUpvote(item.id, user.id));
      if (adding) {
        setPulse(true);
        clearTimeout(pulseTimer.current);
        pulseTimer.current = setTimeout(() => setPulse(false), 560);
      }
    } catch (err) {
      toast.error('Vote not recorded', readableError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`upvote${mine ? ' upvote-on' : ''}${size === 'sm' ? ' upvote-sm' : ''}${
        pulse ? ' upvote-pulse' : ''
      }`}
      onClick={press}
      disabled={busy}
      aria-pressed={mine}
      title={ownReport ? "You can't upvote your own report" : mine ? 'Remove your upvote' : 'I have this problem too'}
    >
      {busy ? (
        <Loader2 size={size === 'sm' ? 13 : 15} className="spin" aria-hidden="true" />
      ) : (
        <ChevronUp size={size === 'sm' ? 15 : 17} aria-hidden="true" />
      )}
      {/* Keyed on the value: React swaps the node when the tally changes, so
          the new number rolls in rather than blinking from 4 to 5 in place. */}
      <span className="tnum vote-count" key={votes}>
        {votes}
      </span>
      <span className="sr-only">
        {votes === 1 ? '1 person has' : `${votes} people have`} reported this too
      </span>
    </button>
  );
}
