import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'wouter';
import { statsFor } from '../../db/queries';
import { CATALOGUE, GROUPS } from '../../engine/drills/catalogue';
import { TopBar } from '../components/TopBar';
import { usePrefs } from '../hooks';

export function Training() {
  const prefs = usePrefs();
  const bests = useLiveQuery(async () => {
    if (!prefs.meId) return new Map<string, string>();
    const rows = await statsFor(prefs.meId);
    const out = new Map<string, string>();
    for (const e of CATALOGUE) {
      const vals = rows
        .filter((r) => r.entry === e.id)
        .map((r) => e.main.value(r.m))
        .filter((v): v is number => v !== null);
      if (!vals.length) continue;
      const best = e.main.better === 'high' ? Math.max(...vals) : Math.min(...vals);
      out.set(e.id, e.main.format(best));
    }
    return out;
  }, [prefs.meId]);

  return (
    <main className="screen">
      <TopBar title="Training" sub={`${CATALOGUE.length} drills`} back="/" />
      {GROUPS.map((g) => (
        <section key={g.id} className="section">
          <h2>
            {g.name}
            <span className="hint">{g.blurb}</span>
          </h2>
          <div className="list">
            {CATALOGUE.filter((e) => e.group === g.id).map((e) => (
              <Link key={e.id} href={`/new/${e.id}`} className="item">
                <span className="grow">
                  <span className="title">
                    {e.name}
                    {e.origin && <span className="tag">{e.origin}</span>}
                  </span>
                  <span className="desc" style={{ display: 'block' }}>
                    {e.blurb}
                  </span>
                </span>
                {bests?.get(e.id) && (
                  <span className="side">
                    <span className="big">{bests.get(e.id)}</span>
                    <span className="desc" style={{ display: 'block' }}>
                      best
                    </span>
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
