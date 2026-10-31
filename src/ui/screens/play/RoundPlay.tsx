import type { ReactNode } from 'react';
import { useState } from 'react';
import { type Dart, makeDart } from '../../../engine/darts';
import { acceptsTotals, type RoundState, targetLabel } from '../../../engine/drills/roundGame';
import type { BullMode } from '../../../engine/rules';
import { isPossibleVisitTotal } from '../../../engine/tables';
import type { VisitAnalysis } from '../../../engine/visitEntry';
import { DartPad, VisitDarts } from '../../components/DartPad';
import { Keypad } from '../../components/Keypad';
import type { GameCtl } from '../../useGame';
import { Scoreboard } from './Scoreboard';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const dartText = (d: string) => (d === 'S25' ? 'Bull 25' : d === 'D25' ? 'Bull 50' : d === 'M' ? 'Miss' : d);

function hint(s: RoundState): string | null {
  const sp = s.rounds[s.roundIdx];
  const t = sp?.target;
  const pl = s.players[s.current];
  switch (s.config.kind) {
    case 'halfit':
      return 'Miss with all three darts and your score is cut in half.';
    case 'bobs27': {
      const v = t?.k === 'bull' ? 50 : t?.k === 'double' ? t.n * 2 : 0;
      return `Each hit adds ${v}. Miss all three and lose ${v}.`;
    }
    case 'shootout':
      return pl.opened.length >= 21
        ? 'Every area is open: the rest of your darts go at the bull for 21x.'
        : `Next new number scores ×${pl.opened.length + 1}. Already hit: ${
            pl.opened.length
              ? [...pl.opened]
                  .sort((a, b) => a - b)
                  .map((n) => (n === 25 ? 'Bull' : n))
                  .join(', ')
              : 'none'
          }.`;
    case 'shanghai':
      return 'Single, double and treble of the number in one visit is a Shanghai.';
    case 'jdc':
      return sp?.rule === 'jdcDouble'
        ? 'One dart. A hit is worth 50.'
        : sp?.rule === 'jdcBull'
          ? 'One dart at the bull. Inner bull is worth 100.'
          : 'Shanghai round: single, double and treble adds 100.';
    default:
      return null;
  }
}

function roundTitle(s: RoundState): string {
  const c = s.config;
  if (c.kind === 'jdc') {
    const i = s.roundIdx;
    return i < 6 ? `Part 1, round ${i + 1} of 6` : i < 27 ? `Part 2, dart ${i - 5} of 21` : `Part 3, round ${i - 26} of 6`;
  }
  if (c.kind === 'scoring') return `Visit ${s.roundIdx + 1} of ${s.rounds.length}`;
  return `Round ${s.roundIdx + 1} of ${s.rounds.length}`;
}

export function RoundPlay({ ctl, state: s }: { ctl: GameCtl; state: RoundState }) {
  const { game, need } = ctl;
  const [full, setFull] = useState(false);
  const sp = s.rounds[Math.min(s.roundIdx, s.rounds.length - 1)];
  const t = sp.target;
  const c = s.config;
  const bull: BullMode = 'bull' in c && typeof c.bull === 'string' ? c.bull : 'separate';
  const totals = acceptsTotals(c);
  const done = s.phase === 'over';
  const push = (d: Dart) => ctl.push({ t: 'dart', d });

  const views = game.seats.map((_, i) => ({
    big: s.players[i].score,
    digits: 4,
    left: s.players[i].eliminated ? 'Out' : plural(s.players[i].roundsPlayed, 'round'),
    right: plural(s.players[i].hits, 'hit'),
  }));

  const analyze = (total: number): VisitAnalysis =>
    isPossibleVisitTotal(total, bull)
      ? { ok: true, outcome: 'score', total, options: [{ used: 3, atFinish: [0] }] }
      : { ok: false, reason: `${total} can't be scored with three darts.` };

  let pad: ReactNode;
  if (totals) {
    pad = <Keypad analyze={analyze} allowBust={false} onSubmit={(v) => ctl.push({ t: 'visit', total: v.total })} />;
  } else if (full || t.k === 'any' || t.k === 'anyDouble' || t.k === 'anyTreble') {
    pad = (
      <>
        {full && (
          <button className="btn ghost small" onClick={() => setFull(false)}>
            Back to quick buttons
          </button>
        )}
        <DartPad
          bull={bull}
          onDart={(d) => {
            push(d);
            setFull(false);
          }}
        />
      </>
    );
  } else if (c.kind === 'bobs27' && t.k === 'double' && s.visitDarts.length === 0) {
    const d = makeDart(2, t.n);
    pad = (
      <div className="pad">
        <span className="muted small">How many darts hit {d}?</span>
        <div className="targets" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              className={`key ${n ? 'hit' : ''}`}
              onClick={() => ctl.pushMany(Array.from({ length: 3 }, (_, i) => ({ t: 'dart' as const, d: i < n ? d : ('M' as Dart) })))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (t.k === 'bull') {
    pad = (
      <div className="pad targets">
        <button className="key hit" onClick={() => push('D25')}>
          Inner bull<small>50</small>
        </button>
        <button className="key hit" onClick={() => push('S25')}>
          Outer bull
          <small>{bull === 'fat' && c.kind !== 'eagleseye' && c.kind !== 'bobs27' && c.kind !== 'cricketcountup' ? 50 : 25}</small>
        </button>
        <button className="key wide warn" onClick={() => push('M')}>
          Miss
        </button>
      </div>
    );
  } else if (t.k === 'double') {
    const d: Dart = t.n === 25 ? 'D25' : makeDart(2, t.n);
    pad = (
      <div className="pad targets">
        <button className="key hit" onClick={() => push(d)}>
          Hit<small>{targetLabel(t)}</small>
        </button>
        <button className="key warn" onClick={() => push('M')}>
          Miss
        </button>
        {t.n !== 25 && (
          <button className="key wide soft" onClick={() => setFull(true)}>
            Something else
          </button>
        )}
      </div>
    );
  } else {
    const n = t.n;
    pad = (
      <div className="pad targets">
        <button className="key hit" onClick={() => push(makeDart(3, n))}>
          Treble {n}
          <small>{3 * n}</small>
        </button>
        <button className="key hit" onClick={() => push(makeDart(2, n))}>
          Double {n}
          <small>{2 * n}</small>
        </button>
        <button className="key hit" onClick={() => push(makeDart(1, n))}>
          Single {n}
          <small>{n}</small>
        </button>
        <button className="key warn" onClick={() => push('M')}>
          Miss
        </button>
        <button className="key wide soft" onClick={() => setFull(true)}>
          Something else
        </button>
      </div>
    );
  }

  return (
    <>
      <Scoreboard seats={game.seats} current={s.current} views={views} done={done} />
      {!done && (
        <div className="big-target">
          <span>
            <span className="label">{roundTitle(s)}</span>
            <div className={`what ${t.k === 'anyDouble' || t.k === 'anyTreble' || t.k === 'any' ? 'small' : ''}`}>
              {t.k === 'any' ? 'Any number' : targetLabel(t)}
            </div>
          </span>
          {game.seats.length > 1 && <span className="label">{game.seats[s.current].name} to throw</span>}
        </div>
      )}
      {!done && hint(s) && <p className="prose small">{hint(s)}</p>}
      {!done && need.k === 'throw' && (
        <>
          {!totals && (
            <div className="row">
              <VisitDarts darts={s.visitDarts} label={dartText} />
            </div>
          )}
          {pad}
        </>
      )}
    </>
  );
}
