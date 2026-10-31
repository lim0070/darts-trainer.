import { bestRoute } from '../../../engine/checkout';
import { type CheckoutState, currentAttempt, dartLimit, drillRules } from '../../../engine/drills/checkoutDrills';
import { dartLabel } from '../../../engine/rules';
import { analyzeVisitTotal } from '../../../engine/visitEntry';
import { DartPad, VisitDarts } from '../../components/DartPad';
import { Keypad } from '../../components/Keypad';
import { Led } from '../../components/Led';
import type { GameCtl } from '../../useGame';

export function CheckoutPlay({ ctl, state: s }: { ctl: GameCtl; state: CheckoutState }) {
  const { need } = ctl;
  const c = s.config;
  const rules = drillRules(c);
  const a = currentAttempt(s);
  const done = s.phase === 'over';
  const limit = dartLimit(c);
  const finished = s.attempts.filter((x) => x.success !== null);
  const ok = finished.filter((x) => x.success).length;
  const total =
    c.kind === 'ladder121'
      ? c.rounds
      : c.kind === 'finish'
        ? c.attempts
        : c.kind === 'catch40'
          ? 40
          : c.kind === 'p170'
            ? c.attempts
            : c.targets.length;
  const route = a && !done ? bestRoute(s.remaining, Math.min(3 - s.visitDarts.length, limit - a.darts), rules.outMode, rules.bull) : null;

  return (
    <>
      <section className="board n1">
        <div className="seat active">
          <div className="who">
            <span>{done ? 'Finished' : `Attempt ${s.attempts.length}${total ? ` of ${total}` : ''}`}</span>
            <span className="legs">
              {c.kind === 'catch40' ? `${finished.reduce((t, x) => t + x.points, 0)} pts` : `${ok}/${finished.length}`}
            </span>
          </div>
          <div className="score">
            <Led value={done ? ok : s.remaining} digits={3} on />
          </div>
          <div className="meta">
            <span>{a && !done ? `Target ${a.target}` : ''}</span>
            <span>{a && !done ? `Dart ${Math.min(a.darts + s.visitDarts.length + 1, limit)} of ${limit}` : ''}</span>
          </div>
        </div>
      </section>
      <div className="statusline">
        {c.kind === 'ladder121' && (
          <>
            <span className="chip">{s.ladder.safe ? `Safehouse ${s.ladder.safe}` : 'No safehouse yet'}</span>
            {s.ladder.best > 0 && <span className="chip">Best {s.ladder.best}</span>}
            <span className="chip">Streak {s.ladder.streak}</span>
          </>
        )}
        <span className="chip">{rules.outMode === 'open' ? 'Open out' : rules.outMode === 'double' ? 'Double out' : 'Master out'}</span>
        {route && (
          <span className="chip route" aria-label="Suggested finish">
            {route.map((d) => dartLabel(d, rules.bull)).join('  ')}
          </span>
        )}
      </div>
      {!done && need.k === 'throw' && a && (
        <>
          {c.entry === 'darts' || s.visitDarts.length > 0 ? (
            <>
              <div className="row">
                <VisitDarts darts={s.visitDarts} label={(d) => dartLabel(d as never, rules.bull)} />
              </div>
              <DartPad bull={rules.bull} onDart={(d) => ctl.push({ t: 'dart', d })} />
            </>
          ) : (
            <Keypad
              remaining={s.remaining}
              analyze={(t, bust) => analyzeVisitTotal(s.remaining, true, t, rules, bust)}
              onSubmit={(v) => ctl.push({ t: 'visit', ...v })}
            />
          )}
        </>
      )}
    </>
  );
}
