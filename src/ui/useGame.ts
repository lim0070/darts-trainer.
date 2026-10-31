import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addPunishLog, finishGame, reopenGame, saveEvents, trimPunishLog } from '../db/repo';
import { db, type GameRow } from '../db/schema';
import { botDart01, botDartCricket } from '../engine/bot/strategy';
import type { CricketState } from '../engine/cricket';
import { finishTargets } from '../engine/drills/checkoutDrills';
import { drawCard } from '../engine/punish/draw';
import { detectTrigger } from '../engine/punish/triggers';
import { type AnyState, getNeed, reduce, undoCut } from '../engine/reduce';
import { pick, rngFor } from '../engine/rng';
import type { CheckoutDrillConfig, GameEvent, Need } from '../engine/types';
import { x01Rules, type X01State } from '../engine/x01';
import { resultLine } from './format';

type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'ts'> : never) : never;

const BOT_DELAY = 650;

export interface GameCtl {
  game: GameRow;
  state: AnyState;
  events: GameEvent[];
  need: Need;
  push: (ev: NewEvent) => void;
  pushMany: (evs: NewEvent[]) => void;
  undo: () => void;
  canUndo: boolean;
  resolvePunish: (outcome: 'done' | 'skipped') => void;
  hurryBot: () => void;
  end: (reason: 'timeUp' | 'stopped') => void;
}

/** Games that never end on their own get cut when their time is up. */
export function isOpenEnded(game: GameRow): boolean {
  const c = game.config;
  if (c.kind === 'x01') return !!c.timedMinutes;
  if (c.kind === 'ladder121') return c.rounds === null;
  if (c.kind === 'finish') return c.attempts === null;
  return false;
}

function botEvent(game: GameRow, s: AnyState, index: number): GameEvent | null {
  const seat = game.seats[s.current];
  if (!seat?.bot) return null;
  const rng = rngFor(game.seed, index);
  if (s.kind === 'x01') {
    const d = botDart01(s.remaining[s.current], s.isIn[s.current], 3 - s.visitDarts.length, x01Rules(s.config), seat.bot.sigma, rng);
    return { t: 'dart', d, auto: true, ts: Date.now() };
  }
  if (s.kind === 'cricket') {
    return { t: 'dart', d: botDartCricket(s as CricketState, s.current, seat.bot.sigma, rng), auto: true, ts: Date.now() };
  }
  return null;
}

export function useGame(id: string, opts: { endAt?: number | null } = {}): GameCtl | null | undefined {
  const game = useLiveQuery(async () => (await db.games.get(id)) ?? null, [id]);
  const pool = useLiveQuery(() => db.punishPool.toArray(), []);
  const [events, setEvents] = useState<GameEvent[] | null>(null);
  const eventsRef = useRef<GameEvent[]>([]);
  const finishing = useRef(false);
  const [hurry, setHurry] = useState(false);

  useEffect(() => {
    let alive = true;
    db.gameLogs.get(id).then((log) => {
      if (!alive) return;
      eventsRef.current = log?.events ?? [];
      setEvents(eventsRef.current);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const state = useMemo(
    () => (game && events ? reduce(game.config, game.seats.length, events) : null),
    [game?.id, game?.config, game?.seats.length, events], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const need = state && game ? getNeed(state, game.seats) : null;

  const commit = useCallback(
    async (next: GameEvent[]) => {
      if (!game) return;
      eventsRef.current = next;
      setEvents(next);
      await saveEvents(game.id, next);
      const s = reduce(game.config, game.seats.length, next);
      if (s.phase === 'over' && !finishing.current) {
        const fresh = await db.games.get(game.id);
        if (fresh && fresh.status === 'active') {
          finishing.current = true;
          await finishGame(fresh, s, resultLine(fresh, s));
        }
      }
    },
    [game],
  );

  /** Add the punishment draw after a human 01 visit when a trigger fires. */
  const withPunishment = useCallback(
    (next: GameEvent[]): GameEvent[] => {
      const c = game?.config;
      if (!game || !c || c.kind !== 'x01' || !c.punish.on || !pool) return next;
      const s = reduce(c, game.seats.length, next) as X01State;
      const lc = s.lastClosed;
      if (!lc || lc.eventIdx !== next.length - 1) return next;
      const v = s.visits[lc.visitIdx];
      if (game.seats[v.seat]?.bot) return next;
      const rng = rngFor(game.seed, next.length);
      const trigger = detectTrigger(v, c.punish, x01Rules(c), rng());
      if (!trigger) return next;
      const last = [...next].reverse().find((e) => e.t === 'punish');
      const card = drawCard(pool, last && last.t === 'punish' ? last.card.cardId : null, rng);
      if (!card) return next;
      return [...next, { t: 'punish', seat: v.seat, trigger, card, auto: true, ts: Date.now() }];
    },
    [game, pool],
  );

  const pushMany = useCallback(
    (evs: NewEvent[]) => {
      let next = eventsRef.current;
      for (const e of evs) {
        next = withPunishment([...next, { ...e, ts: Date.now() } as GameEvent]);
      }
      commit(next);
    },
    [commit, withPunishment],
  );

  const push = useCallback((ev: NewEvent) => pushMany([ev]), [pushMany]);

  const undo = useCallback(async () => {
    if (!game) return;
    const evs = eventsRef.current;
    const cut = undoCut(evs);
    if (cut >= evs.length) return;
    await trimPunishLog(game.id, cut);
    const fresh = await db.games.get(game.id);
    if (fresh && fresh.status !== 'active') await reopenGame(game.id);
    finishing.current = false;
    await commit(evs.slice(0, cut));
  }, [game, commit]);

  const resolvePunish = useCallback(
    async (outcome: 'done' | 'skipped') => {
      if (!game || !state?.pendingPunish) return;
      const p = state.pendingPunish;
      const idx = eventsRef.current.length;
      await addPunishLog({
        id: `${game.id}:${idx}`,
        gameId: game.id,
        playerId: game.seats[p.seat].playerId,
        eventIdx: idx,
        trigger: p.trigger,
        card: p.card,
        outcome,
        tallyKey: p.card.tallyKey,
        reps: p.card.reps,
        unit: p.card.unit,
        ts: Date.now(),
      });
      await commit([...eventsRef.current, { t: 'punishDone', outcome, ts: Date.now() }]);
    },
    [game, state, commit],
  );

  const end = useCallback(
    (reason: 'timeUp' | 'stopped') => {
      const evs = eventsRef.current;
      commit([...evs, { t: 'end', reason, auto: reason === 'timeUp' ? true : undefined, ts: Date.now() } as GameEvent]);
    },
    [commit],
  );

  // Bot turns: one dart at a time with a short pause so you can follow along.
  const needKey = need ? `${need.k}:${'seat' in need ? need.seat : ''}` : '';
  useEffect(() => {
    if (!game || need?.k !== 'bot') {
      if (hurry) setHurry(false);
      return;
    }
    const t = setTimeout(
      () => {
        const evs = eventsRef.current;
        const s = reduce(game.config, game.seats.length, evs);
        if (getNeed(s, game.seats).k !== 'bot') return;
        const ev = botEvent(game, s, evs.length);
        if (ev) commit([...evs, ev]);
      },
      hurry ? 60 : BOT_DELAY,
    );
    return () => clearTimeout(t);
  }, [needKey, events?.length, hurry, game, commit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Finish Trainer: pick the next random target.
  useEffect(() => {
    if (!game || need?.k !== 'target') return;
    const evs = eventsRef.current;
    const options = finishTargets(game.config as CheckoutDrillConfig);
    if (options.length === 0) return;
    const value = pick(rngFor(game.seed, evs.length), options);
    commit([...evs, { t: 'target', value, auto: true, ts: Date.now() }]);
  }, [needKey, events?.length, game, commit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timed games (Speed 501, open-ended drills in a plan): stop when the time is up.
  const deadline = useMemo(() => {
    if (!game) return null;
    if (opts.endAt && isOpenEnded(game)) return opts.endAt;
    if (game.config.kind === 'x01' && game.config.timedMinutes) return game.createdAt + game.config.timedMinutes * 60_000;
    return null;
  }, [game, opts.endAt]);
  useEffect(() => {
    if (!deadline || !state || state.phase === 'over') return;
    const ms = deadline - Date.now();
    const t = setTimeout(() => end('timeUp'), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [deadline, state?.phase, end]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game === undefined || events === null) return undefined;
  if (game === null || !state || !need) return null;
  return {
    game,
    state,
    events,
    need,
    push,
    pushMany,
    undo,
    canUndo: undoCut(events) < events.length,
    resolvePunish,
    hurryBot: () => setHurry(true),
    end,
  };
}
