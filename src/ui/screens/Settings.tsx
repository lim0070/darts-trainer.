import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { exportBackup, importBackup, parseBackup } from '../../db/backup';
import { setPrefs } from '../../db/repo';
import { db } from '../../db/schema';
import type { PunishRules } from '../../engine/types';
import { Field, Segmented, Switch } from '../components/Controls';
import { TopBar } from '../components/TopBar';
import { usePrefs } from '../hooks';

async function saveFile(name: string, text: string) {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Oche backup' });
      return;
    } catch {
      // Cancelled or not allowed: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Settings() {
  const prefs = usePrefs();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const games = useLiveQuery(() => db.games.count(), []);
  const p = prefs.punish;
  const setPunish = (patch: Partial<PunishRules>) => setPrefs({ punish: { ...p, ...patch } });

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  const stale = !prefs.lastBackupAt || Date.now() - prefs.lastBackupAt > 14 * 86_400_000;

  return (
    <main className="screen">
      <TopBar title="Settings" back="/" />

      <section className="section">
        <h2>Defaults for new games</h2>
        <Field label="Rules" help="Soft-tip: open out, fat bull, round limits. Steel-tip: double out, 25/50 bull.">
          <Segmented
            label="Rules"
            value={prefs.preset}
            options={[
              { value: 'soft', label: 'Soft-tip' },
              { value: 'steel', label: 'Steel-tip' },
            ]}
            onChange={(preset) => setPrefs({ preset })}
          />
        </Field>
        <Field label="Score entry">
          <Segmented
            label="Score entry"
            value={prefs.entry}
            options={[
              { value: 'total', label: 'Visit total' },
              { value: 'darts', label: 'Dart by dart' },
            ]}
            onChange={(entry) => setPrefs({ entry })}
          />
        </Field>
      </section>

      <section className="section">
        <h2>Punishments</h2>
        <p className="prose small">In 01 games a random card comes up when one of these happens. Only one card per visit.</p>
        <div className="panel">
          <Switch checked={p.on} onChange={(on) => setPunish({ on })}>
            On for new 01 games
          </Switch>
          <Switch checked={p.bust} onChange={(bust) => setPunish({ bust })}>
            After a bust
          </Switch>
          <Switch checked={p.missedCheckout} onChange={(missedCheckout) => setPunish({ missedCheckout })}>
            After missing a finish
          </Switch>
        </div>
        <Field label="Low-score visit" help="Only counts when you're too far out to finish.">
          <Segmented
            label="Low-score visit"
            value={p.lowScoreBelow ?? 0}
            options={[0, 20, 26, 30, 40].map((v) => ({ value: v, label: v ? `Under ${v}` : 'Off' }))}
            onChange={(v) => setPunish({ lowScoreBelow: v || null })}
          />
        </Field>
        <Field label="Surprise card" help="A random chance on any visit.">
          <Segmented
            label="Surprise"
            value={p.surprisePct}
            options={[0, 5, 10, 20].map((v) => ({ value: v, label: v ? `${v}%` : 'Off' }))}
            onChange={(surprisePct) => setPunish({ surprisePct })}
          />
        </Field>
        <Link href="/settings/cards" className="btn">
          Edit punishment cards
        </Link>
      </section>

      <section className="section">
        <h2>Your data</h2>
        <p className="prose small">
          Everything is saved on this device only ({games ?? 0} games). Back it up now and then.
          {persisted === false && ' This browser may clear it when space runs low.'}
          {persisted === true && ' The browser has agreed to keep it.'}
        </p>
        {stale && (
          <p className="prose small" style={{ color: 'var(--gold)' }}>
            {prefs.lastBackupAt ? 'Your last backup is over two weeks old.' : "You haven't made a backup yet."}
          </p>
        )}
        <button
          className="btn"
          onClick={async () => {
            const b = await exportBackup();
            const day = new Date().toISOString().slice(0, 10);
            await saveFile(`oche-backup-${day}.json`, JSON.stringify(b));
            await setPrefs({ lastBackupAt: Date.now() });
            setMessage('Backup saved.');
          }}
        >
          Save a backup
        </button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Restore from a backup
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const res = await importBackup(parseBackup(await f.text()));
                setMessage(`Restored ${res.games} games. Stats were rebuilt.`);
              } catch (err) {
                setMessage((err as Error).message);
              }
            }}
          />
        </label>
        {message && (
          <p className="prose small" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="section">
        <h2>Install on your phone</h2>
        <p className="prose small">
          iPhone: open this page in Safari, tap Share, then Add to Home Screen. Android: open the browser menu and choose Install app. The
          installed app works offline. On iPhone, Safari and the installed app keep separate data, so install first and play from the home
          screen icon.
        </p>
      </section>

      <section className="section">
        <h2>About</h2>
        <p className="prose small">
          Oche is a free darts practice and scoring app. The rating is an unofficial estimate based on DARTSLIVE's public rating table, not
          an official DARTSLIVE rating.
        </p>
      </section>
    </main>
  );
}
