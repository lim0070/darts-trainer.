import { useState } from 'react';
import { type Dart, makeDart } from '../../engine/darts';
import type { BullMode } from '../../engine/rules';

const NUMS = Array.from({ length: 20 }, (_, i) => i + 1);

/** One dart at a time: pick single/double/treble, then the number. */
export function DartPad({
  onDart,
  bull,
  disabled,
  numbers = NUMS,
  cricket = false,
}: {
  onDart: (d: Dart) => void;
  bull: BullMode;
  disabled?: boolean;
  numbers?: number[];
  cricket?: boolean;
}) {
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const tap = (n: number) => {
    onDart(makeDart(mult, n));
    setMult(1);
  };
  return (
    <div className="pad">
      <div className="mults" role="group" aria-label="Ring">
        <button className="mult s" aria-pressed={mult === 1} onClick={() => setMult(1)}>
          Single
        </button>
        <button className="mult d" aria-pressed={mult === 2} onClick={() => setMult(2)}>
          Double
        </button>
        <button className="mult t" aria-pressed={mult === 3} onClick={() => setMult(3)}>
          Treble
        </button>
      </div>
      <div className={`nums ${cricket ? 'cricket' : ''}`}>
        {numbers.map((n) => (
          <button key={n} className="key" disabled={disabled} onClick={() => tap(n)}>
            {n}
          </button>
        ))}
        {cricket && (
          <>
            <button
              className="key"
              disabled={disabled}
              onClick={() => {
                onDart(mult === 1 ? 'S25' : 'D25');
                setMult(1);
              }}
            >
              Bull
            </button>
          </>
        )}
      </div>
      <div className="bulls">
        {!cricket &&
          (bull === 'fat' ? (
            <button
              className="key"
              disabled={disabled}
              onClick={() => {
                onDart('D25');
                setMult(1);
              }}
            >
              Bull 50
            </button>
          ) : (
            <>
              <button
                className="key"
                disabled={disabled}
                onClick={() => {
                  onDart('S25');
                  setMult(1);
                }}
              >
                Bull 25
              </button>
              <button
                className="key"
                disabled={disabled}
                onClick={() => {
                  onDart('D25');
                  setMult(1);
                }}
              >
                Bull 50
              </button>
            </>
          ))}
        <button
          className="key warn"
          disabled={disabled}
          onClick={() => {
            onDart('M');
            setMult(1);
          }}
          style={cricket ? { gridColumn: '1 / -1' } : undefined}
        >
          Miss
        </button>
      </div>
    </div>
  );
}

/** The darts of the visit so far, with empty slots. */
export function VisitDarts({ darts, label }: { darts: string[]; label?: (d: string) => string }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`chip dart ${darts[i] ? '' : 'empty'}`}>
          {darts[i] ? (label ? label(darts[i]) : darts[i]) : `Dart ${i + 1}`}
        </span>
      ))}
    </>
  );
}
