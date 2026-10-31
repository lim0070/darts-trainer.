import { useMemo, useState } from 'react';
import { corkThrow } from '../../engine/bot/throw';
import { rngFor } from '../../engine/rng';
import type { Seat } from '../../engine/types';
import { Sheet } from './Controls';

type Cork = 'inner' | 'outer' | 'miss';
const RANK: Record<Cork, number> = { inner: 2, outer: 1, miss: 0 };
const LABEL: Record<Cork, string> = { inner: 'Inner bull', outer: 'Outer bull', miss: 'Missed the bull' };

/** Round limit reached: everyone throws one dart at the bull, closest wins the leg. */
export function CorkDialog({
  seats,
  seed,
  salt,
  onWinner,
}: {
  seats: Seat[];
  seed: number;
  salt: number;
  onWinner: (seat: number) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<(Cork | null)[]>(() => seats.map(() => null));

  const botResults = useMemo(() => {
    const rng = rngFor(seed, salt * 97 + attempt);
    return seats.map((s) => (s.bot ? corkThrow(s.bot.sigma, rng).result : null));
  }, [seats, seed, salt, attempt]);

  const all = seats.map((s, i) => (s.bot ? botResults[i] : results[i]));
  const complete = all.every((r) => r !== null);
  const best = complete ? Math.max(...all.map((r) => RANK[r as Cork])) : -1;
  const leaders = complete ? all.flatMap((r, i) => (RANK[r as Cork] === best ? [i] : [])) : [];

  return (
    <Sheet>
      <h2>Round limit reached</h2>
      <p className="prose">Nobody finished, so it goes to the cork: one dart each at the bull, closest wins.</p>
      <div className="stack">
        {seats.map((s, i) => (
          <div key={s.playerId + i} className="panel stack">
            <strong>{s.name}</strong>
            {s.bot ? (
              <span className="muted">{LABEL[botResults[i] as Cork]}</span>
            ) : (
              <div className="seg">
                {(['inner', 'outer', 'miss'] as Cork[]).map((c) => (
                  <button key={c} aria-pressed={results[i] === c} onClick={() => setResults((r) => r.map((x, j) => (j === i ? c : x)))}>
                    {c === 'inner' ? 'Inner' : c === 'outer' ? 'Outer' : 'Miss'}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {complete && leaders.length === 1 && (
        <button className="btn primary block" onClick={() => onWinner(leaders[0])}>
          {seats[leaders[0]].name === 'You' ? 'You win' : `${seats[leaders[0]].name} wins`} the cork
        </button>
      )}
      {complete && leaders.length > 1 && (
        <button
          className="btn block"
          onClick={() => {
            setAttempt((a) => a + 1);
            setResults(seats.map(() => null));
          }}
        >
          Tie, throw again
        </button>
      )}
    </Sheet>
  );
}
