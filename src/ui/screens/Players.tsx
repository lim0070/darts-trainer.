import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addPlayer, setPrefs } from '../../db/repo';
import { db } from '../../db/schema';
import { TopBar } from '../components/TopBar';
import { usePrefs } from '../hooks';

export function Players() {
  const prefs = usePrefs();
  const players = useLiveQuery(() => db.players.toArray(), []);
  const counts = useLiveQuery(async () => {
    const map = new Map<string, number>();
    await db.games.each((g) => g.playerIds.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1)));
    return map;
  }, []);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const humans = (players ?? []).filter((p) => p.kind === 'human' && !p.archived);
  const bots = (players ?? []).filter((p) => p.kind === 'bot');

  return (
    <main className="screen">
      <TopBar title="Players" back="/" />
      <section className="section">
        <div className="list">
          {humans.map((p) => (
            <div key={p.id} className="item">
              <span style={{ width: 10, height: 10, borderRadius: 5, background: p.color, flex: 'none' }} />
              {editing === p.id ? (
                <form
                  className="row grow"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (draft.trim()) await db.players.update(p.id, { name: draft.trim() });
                    setEditing(null);
                  }}
                >
                  <input className="input grow" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Name" />
                  <button className="btn small" type="submit">
                    Save
                  </button>
                </form>
              ) : (
                <>
                  <span className="grow">
                    <span className="title">{p.name}</span>
                    <span className="desc" style={{ display: 'block' }}>
                      {p.id === prefs.meId ? 'You. Your stats and rating follow this player. ' : ''}
                      {counts?.get(p.id) ?? 0} games
                    </span>
                  </span>
                  {p.id !== prefs.meId && (
                    <button className="btn small ghost" onClick={() => setPrefs({ meId: p.id })}>
                      This is me
                    </button>
                  )}
                  <button
                    className="btn small ghost"
                    onClick={() => {
                      setEditing(p.id);
                      setDraft(p.name);
                    }}
                  >
                    Rename
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await addPlayer(name);
            setName('');
          }}
        >
          <input className="input grow" placeholder="Add a player" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn small" type="submit">
            Add
          </button>
        </form>
      </section>
      {bots.length > 0 && (
        <section className="section">
          <h2>Bots you've played</h2>
          <div className="list">
            {bots.map((b) => (
              <div key={b.id} className="item">
                <span className="grow title">{b.name}</span>
                <span className="side muted">{counts?.get(b.id) ?? 0} games</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
