import { useState } from 'react';
import { bestRoute } from '../../../engine/checkout';
import { dartLabel } from '../../../engine/rules';
import { ppr } from '../../../engine/stats';
import { analyzeVisitTotal } from '../../../engine/visitEntry';
import { currentLeg, x01Rules, type X01State } from '../../../engine/x01';
import { DartPad, VisitDarts } from '../../components/DartPad';
import { Keypad } from '../../components/Keypad';
import { Segmented } from '../../components/Controls';
import type { GameCtl } from '../../useGame';
import { Scoreboard } from './Scoreboard';

const dartsText = (n: number) => `${n} ${n === 1 ? 'dart' : 'darts'}`;

export function X01Play({ ctl, state: s }: { ctl: GameCtl; state: X01State }) {
  const { game, need } = ctl;
  const c = s.config;
  const rules = x01Rules(c);
  const [entry, setEntry] = useState(c.entry);
  const leg = currentLeg(s);
  const p = s.current;
  const humanTurn = need.k === 'throw';
  const botTurn = need.k === 'bot';
  const multiLeg = c.legsToWin > 1 || !!c.setsToWin || !!c.timedMinutes;

  const views = game.seats.map((_, seat) => {
    const vs = s.visits.filter((v) => v.seat === seat);
    const pts = vs.reduce((t, v) => t + v.total, 0);
    const darts = vs.reduce((t, v) => t + v.used, 0);
    const legsLabel = c.setsToWin
      ? `${s.setsWon[seat]} sets, ${s.legsWonInSet[seat]} legs`
      : multiLeg
        ? `${s.legsWonTotal[seat]} legs`
        : undefined;
    return {
      big: s.remaining[seat],
      digits: String(c.start).length,
      left: `PPR ${ppr(pts, darts).toFixed(1)}`,
      right: dartsText(vs.filter((v) => v.leg === leg.index).reduce((t, v) => t + v.used, 0)),
      legs: legsLabel,
    };
  });

  const dartsLeft = 3 - s.visitDarts.length;
  const route = s.isIn[p] ? bestRoute(s.remaining[p], dartsLeft, c.outMode, c.bull) : null;
  const last = s.visits[s.visits.length - 1];
  const lastText = last
    ? `${game.seats[last.seat].name}: ${last.bust ? 'bust' : last.checkout ? `checked out ${last.start}` : last.total}`
    : null;

  return (
    <>
      <Scoreboard seats={game.seats} current={p} views={views} done={s.phase === 'over'} />
      <div className="statusline">
        {multiLeg && <span className="chip">Leg {leg.index + 1}</span>}
        <span className="chip">{c.roundLimit ? `Round ${s.round} of ${c.roundLimit}` : `Round ${s.round}`}</span>
        {!s.isIn[p] && <span className="chip">Needs a {c.inMode} to start</span>}
        {route && (
          <span className="chip route" aria-label="Suggested finish">
            {route.map((d) => dartLabel(d, c.bull)).join('  ')}
          </span>
        )}
        {lastText && <span className="lastvisit">{lastText}</span>}
      </div>

      {botTurn && (
        <button className="panel" style={{ textAlign: 'left', border: '1px solid var(--line)' }} onClick={ctl.hurryBot}>
          <div className="row">
            <strong className="grow">{game.seats[p].name} is throwing</strong>
            <span className="muted small">Tap to skip</span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <VisitDarts darts={s.visitDarts} label={(d) => dartLabel(d as never, c.bull)} />
          </div>
        </button>
      )}

      {humanTurn && (
        <>
          {s.visitDarts.length === 0 ? (
            <Segmented
              label="Score entry"
              value={entry}
              options={[
                { value: 'total', label: 'Visit total' },
                { value: 'darts', label: 'Dart by dart' },
              ]}
              onChange={setEntry}
            />
          ) : (
            <div className="row">
              <VisitDarts darts={s.visitDarts} label={(d) => dartLabel(d as never, c.bull)} />
            </div>
          )}
          {entry === 'total' && s.visitDarts.length === 0 ? (
            <Keypad
              remaining={s.remaining[p]}
              analyze={(total, bust) => analyzeVisitTotal(s.remaining[p], s.isIn[p], total, rules, bust)}
              onSubmit={(v) => ctl.push({ t: 'visit', ...v })}
            />
          ) : (
            <DartPad bull={c.bull} onDart={(d) => ctl.push({ t: 'dart', d })} />
          )}
        </>
      )}
    </>
  );
}
