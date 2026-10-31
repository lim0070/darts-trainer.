import { CRICKET_TARGETS, type CricketState } from '../../../engine/cricket';
import { DartPad, VisitDarts } from '../../components/DartPad';
import { Mark } from '../../components/Icons';
import type { GameCtl } from '../../useGame';

const label = (d: string) => (d === 'S25' ? 'Bull' : d === 'D25' ? 'D-Bull' : d === 'M' ? 'Miss' : d);

export function CricketPlay({ ctl, state: s }: { ctl: GameCtl; state: CricketState }) {
  const { game, need } = ctl;
  const seats = game.seats;
  const p = s.current;
  const done = s.phase === 'over';
  const dead = (i: number) => s.marks.every((m) => m[i] >= 3) && s.seats > 1;
  const mpr = (seat: number) => {
    const vs = s.visits.filter((v) => v.seat === seat);
    const darts = vs.reduce((t, v) => t + v.used, 0);
    return darts ? ((3 * vs.reduce((t, v) => t + (v.marks ?? 0), 0)) / darts).toFixed(2) : '0.00';
  };
  const two = seats.length === 2;
  const cols = two ? '1fr 64px 1fr' : `64px repeat(${seats.length}, 1fr)`;

  const markCell = (seat: number, i: number) => (
    <div key={`m${seat}-${i}`} className="cell" style={{ color: s.marks[seat][i] >= 3 ? 'var(--blue)' : 'var(--bone)' }}>
      <Mark n={s.marks[seat][i]} />
    </div>
  );
  const numCell = (i: number) => (
    <div key={`n${i}`} className={`cell num ${dead(i) ? 'dead' : ''}`}>
      {CRICKET_TARGETS[i] === 25 ? 'Bull' : CRICKET_TARGETS[i]}
    </div>
  );
  const head = (seat: number) => (
    <div key={`h${seat}`} className={`cell head ${!done && seat === p ? 'active' : ''}`}>
      {seats[seat].name}
      {s.config.legsToWin > 1 && ` (${s.legsWon[seat]})`}
    </div>
  );
  const pts = (seat: number) => (
    <div key={`p${seat}`} className="cell pts">
      {s.points[seat]}
    </div>
  );

  return (
    <>
      <section className="cgrid" style={{ gridTemplateColumns: cols }} aria-label="Cricket marks">
        {two ? (
          <>
            {head(0)}
            <div className="cell head" />
            {head(1)}
            {CRICKET_TARGETS.map((_, i) => [markCell(0, i), numCell(i), markCell(1, i)])}
            {pts(0)}
            <div className="cell num">Pts</div>
            {pts(1)}
          </>
        ) : (
          <>
            <div className="cell head" />
            {seats.map((_, seat) => head(seat))}
            {CRICKET_TARGETS.map((_, i) => [numCell(i), ...seats.map((__, seat) => markCell(seat, i))])}
            <div className="cell num">Pts</div>
            {seats.map((_, seat) => pts(seat))}
          </>
        )}
      </section>
      <div className="statusline">
        <span className="chip">{s.config.roundLimit ? `Round ${s.round} of ${s.config.roundLimit}` : `Round ${s.round}`}</span>
        {seats.map((seat, i) => (
          <span key={i} className="chip">
            {seats.length > 1 ? `${seat.name} ` : ''}MPR {mpr(i)}
          </span>
        ))}
      </div>
      {need.k === 'bot' && (
        <button className="panel" style={{ textAlign: 'left', border: '1px solid var(--line)' }} onClick={ctl.hurryBot}>
          <div className="row">
            <strong className="grow">{seats[p].name} is throwing</strong>
            <span className="muted small">Tap to skip</span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <VisitDarts darts={s.visitDarts} label={label} />
          </div>
        </button>
      )}
      {need.k === 'throw' && (
        <>
          <div className="row">
            <VisitDarts darts={s.visitDarts} label={label} />
          </div>
          <DartPad bull="separate" cricket numbers={[20, 19, 18, 17, 16, 15]} onDart={(d) => ctl.push({ t: 'dart', d })} />
        </>
      )}
    </>
  );
}
