import { cricketApply, cricketInit, cricketSeatStats, type CricketState } from './cricket';
import { checkoutApply, checkoutInit, summarizeCheckout, type CheckoutState } from './drills/checkoutDrills';
import { roundApply, roundInit, summarizeRound, type RoundState } from './drills/roundGame';
import { seqApply, seqInit, summarizeSeq, type SeqState } from './drills/sequence';
import { type StatRow, summarizeX01 } from './stats';
import type { GameConfig, GameEvent, Need, Seat } from './types';
import { x01Apply, x01Init, type X01State } from './x01';

export type AnyState = X01State | CricketState | RoundState | SeqState | CheckoutState;

const ROUND_KINDS = new Set(['countup', 'eagleseye', 'cricketcountup', 'halfit', 'shootout', 'shanghai', 'jdc', 'bobs27', 'scoring']);
const SEQ_KINDS = new Set(['atc', 'frustration']);

export function isRoundState(s: AnyState): s is RoundState {
  return ROUND_KINDS.has(s.kind);
}
export function isSeqState(s: AnyState): s is SeqState {
  return SEQ_KINDS.has(s.kind);
}
export function isCheckoutState(s: AnyState): s is CheckoutState {
  return s.kind === 'ladder121' || s.kind === 'finish' || s.kind === 'catch40' || s.kind === 'p170' || s.kind === 'checklist';
}

export function initState(config: GameConfig, seats: number): AnyState {
  switch (config.kind) {
    case 'x01':
      return x01Init(config, seats);
    case 'cricket':
      return cricketInit(config, seats);
    case 'atc':
    case 'frustration':
      return seqInit(config, seats);
    case 'ladder121':
    case 'finish':
    case 'catch40':
    case 'p170':
    case 'checklist':
      return checkoutInit(config);
    default:
      return roundInit(config, seats);
  }
}

export function applyEvent(s: AnyState, ev: GameEvent, idx: number): void {
  if (s.kind === 'x01') x01Apply(s, ev, idx);
  else if (s.kind === 'cricket') cricketApply(s, ev, idx);
  else if (isSeqState(s)) seqApply(s, ev, idx);
  else if (isCheckoutState(s)) checkoutApply(s, ev, idx);
  else roundApply(s, ev, idx);
}

/** Rebuild the state from scratch. Games are short, so this is cheap and keeps undo trivial. */
export function reduce(config: GameConfig, seats: number, events: readonly GameEvent[]): AnyState {
  const s = initState(config, seats);
  events.forEach((ev, i) => applyEvent(s, ev, i));
  return s;
}

export function getNeed(s: AnyState, seats: readonly Seat[]): Need {
  // A card drawn on the last visit still shows before the game-over summary.
  if (s.pendingPunish) return { k: 'punish', seat: s.pendingPunish.seat };
  if (s.phase === 'over') return { k: 'over' };
  if (s.phase === 'cork') return { k: 'cork' };
  if (isCheckoutState(s) && s.needTarget) return { k: 'target' };
  const seat = s.current;
  if (seats[seat]?.bot && (s.kind === 'x01' || s.kind === 'cricket')) return { k: 'bot', seat };
  return { k: 'throw', seat };
}

/**
 * Where to cut the event list for one undo: drop trailing app-made events, a finished
 * punishment card with its draw, and then the last thing the player entered.
 */
export function undoCut(events: readonly GameEvent[]): number {
  let cut = events.length;
  const dropAuto = () => {
    while (cut > 0 && events[cut - 1].auto) cut--;
  };
  dropAuto();
  if (cut > 0 && events[cut - 1].t === 'punishDone') {
    cut--;
    dropAuto();
  }
  if (cut > 0) cut--;
  return cut;
}

export function summarize(s: AnyState): StatRow[] {
  if (s.kind === 'x01') return summarizeX01(s);
  if (s.kind === 'cricket') {
    return Array.from({ length: s.seats }, (_, seat) => {
      const st = cricketSeatStats(s, seat);
      return {
        seat,
        won: s.winner === seat,
        m: {
          marks: st.marks,
          darts: st.darts,
          rounds: st.rounds,
          p80marks: st.p80marks,
          p80rounds: st.p80rounds,
          legs: s.legs.filter((l) => l.complete).length,
          legsWon: s.legs.filter((l) => l.winner === seat).length,
        },
      };
    });
  }
  if (isSeqState(s)) return summarizeSeq(s);
  if (isCheckoutState(s)) return summarizeCheckout(s);
  return summarizeRound(s);
}
