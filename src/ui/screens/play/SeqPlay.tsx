import { type Dart, makeDart } from '../../../engine/darts';
import { atcHit, SEQUENCE_TARGETS, type SeqState, seqTarget } from '../../../engine/drills/sequence';
import { VisitDarts } from '../../components/DartPad';
import type { GameCtl } from '../../useGame';
import { Scoreboard } from './Scoreboard';

const dartText = (d: string) => (d === 'M' ? 'Miss' : d === 'S25' || d === 'D25' ? 'Bull' : d);

export function SeqPlay({ ctl, state: s }: { ctl: GameCtl; state: SeqState }) {
  const { game, need } = ctl;
  const c = s.config;
  const p = s.current;
  const done = s.phase === 'over';
  const target = seqTarget(s, p);
  const ring = c.kind === 'atc' ? c.ring : 'double';
  const label =
    target === 25
      ? ring === 'single'
        ? 'Bull'
        : 'Inner bull'
      : ring === 'double'
        ? `D${target}`
        : ring === 'treble'
          ? `T${target}`
          : String(target);

  const views = game.seats.map((_, i) => {
    const pl = s.players[i];
    return {
      big: c.kind === 'atc' ? pl.darts : pl.visits,
      digits: 3,
      left: `${Math.min(pl.idx, 21)} of 21`,
      right: c.kind === 'atc' ? (pl.darts === 1 ? 'dart' : 'darts') : pl.visits === 1 ? 'visit' : 'visits',
    };
  });

  const hitDart = (): Dart => {
    if (target === 25) return ring === 'single' ? 'S25' : 'D25';
    return makeDart(ring === 'single' ? 1 : ring === 'double' ? 2 : 3, target);
  };

  return (
    <>
      <Scoreboard seats={game.seats} current={p} views={views} done={done} />
      {!done && (
        <div className="big-target">
          <span>
            <span className="label">
              Target {Math.min(s.players[p].idx + 1, SEQUENCE_TARGETS.length)} of {SEQUENCE_TARGETS.length}
            </span>
            <div className="what">{label}</div>
          </span>
          {game.seats.length > 1 && <span className="label">{game.seats[p].name} to throw</span>}
        </div>
      )}
      {!done && need.k === 'throw' && c.kind === 'atc' && (
        <>
          <div className="row">
            <VisitDarts darts={s.visitDarts} label={dartText} />
          </div>
          <div className="pad targets">
            <button className="key hit" onClick={() => ctl.push({ t: 'dart', d: hitDart() })} disabled={!atcHit(hitDart(), target, ring)}>
              Hit<small>{label}</small>
            </button>
            <button className="key warn" onClick={() => ctl.push({ t: 'dart', d: 'M' })}>
              Miss
            </button>
          </div>
        </>
      )}
      {!done && need.k === 'throw' && c.kind === 'frustration' && (
        <>
          <p className="prose small">Score 80 or more with your first two darts, then throw the third at {label}.</p>
          <div className="pad targets">
            <button className="key warn" onClick={() => ctl.push({ t: 'res', v: 0 })}>
              Under 80<small>Third dart doesn't count</small>
            </button>
            <button className="key" onClick={() => ctl.push({ t: 'res', v: 1 })}>
              80+, missed<small>Stay on {label}</small>
            </button>
            <button className="key wide hit" onClick={() => ctl.push({ t: 'res', v: 2 })}>
              80+ and hit {label}
              <small>Move on</small>
            </button>
          </div>
        </>
      )}
    </>
  );
}
