import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'wouter';
import { db } from '../../db/schema';
import { Segmented } from '../components/Controls';
import { TopBar } from '../components/TopBar';
import { dateLabel, gameTitle } from '../format';

type Filter = 'all' | 'x01' | 'cricket' | 'training';

export function History() {
  const [filter, setFilter] = useState<Filter>('all');
  const games = useLiveQuery(() => db.games.orderBy('createdAt').reverse().limit(300).toArray(), []);
  const shown = (games ?? []).filter((g) =>
    filter === 'all' ? true : filter === 'training' ? g.entry !== 'x01' && g.entry !== 'cricket' : g.entry === filter,
  );
  return (
    <main className="screen">
      <TopBar title="History" back="/" />
      <Segmented
        label="Show"
        value={filter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'x01', label: '01' },
          { value: 'cricket', label: 'Cricket' },
          { value: 'training', label: 'Training' },
        ]}
        onChange={setFilter}
      />
      {games && shown.length === 0 && <div className="empty">No games yet. Finished games and drills show up here.</div>}
      {shown.length > 0 && (
        <div className="list">
          {shown.map((g) => (
            <Link key={g.id} href={g.status === 'active' ? `/game/${g.id}` : `/history/${g.id}`} className="item">
              <span className="grow">
                <span className="title">
                  {gameTitle(g)}
                  {g.status === 'active' && <span className="tag red">In progress</span>}
                  {g.status === 'abandoned' && <span className="tag">Stopped</span>}
                </span>
                <span className="desc" style={{ display: 'block' }}>
                  {g.seats.map((s) => s.name).join(' vs ')}
                </span>
              </span>
              <span className="side">
                <span style={{ display: 'block', fontWeight: 700 }}>{g.resultLine ?? ''}</span>
                <span className="desc">{dateLabel(g.createdAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
