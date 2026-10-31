import type { ReactNode } from 'react';
import type { Seat } from '../../../engine/types';
import { Led } from '../../components/Led';

export interface SeatView {
  big: number | string;
  digits?: number;
  left?: ReactNode;
  right?: ReactNode;
  legs?: ReactNode;
}

/** Player tiles with LED scores; the player to throw is lit. */
export function Scoreboard({ seats, current, views, done }: { seats: Seat[]; current: number; views: SeatView[]; done?: boolean }) {
  const n = Math.min(seats.length, 4);
  return (
    <section className={`board n${n}`} aria-label="Scoreboard">
      {seats.map((s, i) => {
        const v = views[i];
        const active = !done && i === current;
        return (
          <div key={i} className={`seat ${active ? 'active' : ''}`} aria-current={active ? 'true' : undefined}>
            <div className="who">
              <span>{s.name}</span>
              {v.legs !== undefined && <span className="legs">{v.legs}</span>}
            </div>
            <div className="score">
              <Led value={v.big} digits={v.digits} on={active || !!done} blue={!!s.bot} />
            </div>
            <div className="meta">
              <span>{v.left}</span>
              <span>{v.right}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
