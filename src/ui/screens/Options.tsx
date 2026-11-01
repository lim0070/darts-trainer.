import { useState } from 'react';
import { Link } from 'wouter';
import { defaultRoundLimit, presetRules, type RulesPreset } from '../../engine/rules';
import type {
  AtcConfig,
  Bobs27Config,
  CricketConfig,
  Entry,
  FinishConfig,
  GameConfig,
  Ladder121Config,
  Safehouse,
  ScoringConfig,
  X01Config,
} from '../../engine/types';
import { Field, Segmented, Switch } from '../components/Controls';
import { triggerList } from '../format';

type Patch = (p: Partial<GameConfig>) => void;

const entryOpts: { value: Entry; label: string }[] = [
  { value: 'total', label: 'Visit total' },
  { value: 'darts', label: 'Dart by dart' },
];

function EntryField({ value, onChange }: { value: Entry; onChange: (e: Entry) => void }) {
  return (
    <Field label="Score entry" help="Visit total is fastest. Dart by dart gives hit stats.">
      <Segmented label="Score entry" value={value} options={entryOpts} onChange={onChange} />
    </Field>
  );
}

function X01Options({ c, set }: { c: X01Config; set: Patch }) {
  const [more, setMore] = useState(false);
  const applyPreset = (preset: RulesPreset) =>
    set({ preset, ...presetRules(preset), roundLimit: defaultRoundLimit(preset, c.start) } as Partial<X01Config>);
  return (
    <>
      <Field label="Start">
        <Segmented
          label="Start"
          value={c.start}
          options={[301, 501, 701, 901, 1101, 1501].map((v) => ({ value: v, label: String(v) }))}
          onChange={(start) =>
            set({
              start,
              roundLimit: c.roundLimit === null ? null : (defaultRoundLimit(c.preset, start) ?? c.roundLimit),
            } as Partial<X01Config>)
          }
        />
      </Field>
      <Field label="Rules" help={c.preset === 'soft' ? 'Soft-tip: open out, fat bull, round limit.' : 'Steel-tip: double out, 25/50 bull.'}>
        <Segmented
          label="Rules"
          value={c.preset}
          options={[
            { value: 'soft', label: 'Soft-tip' },
            { value: 'steel', label: 'Steel-tip' },
          ]}
          onChange={applyPreset}
        />
      </Field>
      {!c.timedMinutes && (
        <>
          <Field label={c.setsToWin ? 'Legs per set' : 'First to'} help="With one player this is the number of legs to play.">
            <Segmented
              label="Legs"
              value={c.legsToWin}
              options={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: `${v} ${v === 1 ? 'leg' : 'legs'}` }))}
              onChange={(legsToWin) => set({ legsToWin } as Partial<X01Config>)}
            />
          </Field>
        </>
      )}
      {c.timedMinutes !== null && (
        <Field label="Time">
          <Segmented
            label="Time"
            value={c.timedMinutes}
            options={[5, 10, 15, 20].map((v) => ({ value: v, label: `${v} min` }))}
            onChange={(timedMinutes) => set({ timedMinutes } as Partial<X01Config>)}
          />
        </Field>
      )}
      <button type="button" className="disclosure" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? 'Fewer rules' : 'More rules: in, out, bull, round limit, sets, entry'}
      </button>
      {more && (
        <>
          <Field label="In">
            <Segmented
              label="In"
              value={c.inMode}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'double', label: 'Double' },
                { value: 'master', label: 'Master' },
              ]}
              onChange={(inMode) => set({ inMode } as Partial<X01Config>)}
            />
          </Field>
          <Field label="Out">
            <Segmented
              label="Out"
              value={c.outMode}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'double', label: 'Double' },
                { value: 'master', label: 'Master' },
              ]}
              onChange={(outMode) => set({ outMode } as Partial<X01Config>)}
            />
          </Field>
          <Field label="Bull">
            <Segmented
              label="Bull"
              value={c.bull}
              options={[
                { value: 'fat', label: 'Fat bull (50)' },
                { value: 'separate', label: '25 / 50' },
              ]}
              onChange={(bull) => set({ bull } as Partial<X01Config>)}
            />
          </Field>
          {!c.timedMinutes && (
            <>
              <Field label="Round limit" help="When nobody finishes in time, a bull-off decides.">
                <Segmented
                  label="Round limit"
                  value={c.roundLimit ?? 0}
                  options={[0, 10, 15, 20].map((v) => ({ value: v, label: v ? String(v) : 'None' }))}
                  onChange={(v) => set({ roundLimit: v || null } as Partial<X01Config>)}
                />
              </Field>
              <Field label="Sets">
                <Segmented
                  label="Sets"
                  value={c.setsToWin ?? 0}
                  options={[0, 2, 3].map((v) => ({ value: v, label: v ? `First to ${v}` : 'No sets' }))}
                  onChange={(v) => set({ setsToWin: v || null } as Partial<X01Config>)}
                />
              </Field>
            </>
          )}
          <EntryField value={c.entry} onChange={(entry) => set({ entry } as Partial<X01Config>)} />
        </>
      )}
    </>
  );
}

function PunishOptions({ c, set }: { c: X01Config; set: Patch }) {
  const p = c.punish;
  return (
    <div className="panel">
      <Switch checked={p.on} onChange={(on) => set({ punish: { ...p, on } } as Partial<X01Config>)}>
        <strong>Punishments</strong>
        <span className="muted small" style={{ display: 'block' }}>
          {p.on ? `Random card for ${triggerList(p)}` : 'Off for this game'}
        </span>
      </Switch>
      <Link href="/punishments" className="disclosure">
        Change cards and triggers
      </Link>
    </div>
  );
}

function CricketOptions({ c, set }: { c: CricketConfig; set: Patch }) {
  return (
    <>
      <Field label="Game">
        <Segmented
          label="Game"
          value={c.variant}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'cutthroat', label: 'Cut-throat' },
          ]}
          onChange={(variant) => set({ variant } as Partial<CricketConfig>)}
        />
      </Field>
      <Field label="Round limit" help="Soft-tip cricket stops after 20 rounds; the higher score wins.">
        <Segmented
          label="Round limit"
          value={c.roundLimit ?? 0}
          options={[0, 15, 20, 25].map((v) => ({ value: v, label: v ? String(v) : 'None' }))}
          onChange={(v) => set({ roundLimit: v || null } as Partial<CricketConfig>)}
        />
      </Field>
      <Field label="First to">
        <Segmented
          label="Legs"
          value={c.legsToWin}
          options={[1, 2, 3].map((v) => ({ value: v, label: `${v} ${v === 1 ? 'leg' : 'legs'}` }))}
          onChange={(legsToWin) => set({ legsToWin } as Partial<CricketConfig>)}
        />
      </Field>
    </>
  );
}

const BULL_OPTS = [
  { value: 'fat' as const, label: 'Fat bull (50)' },
  { value: 'separate' as const, label: '25 / 50' },
];

const SAFEHOUSE: { value: Safehouse; label: string }[] = [
  { value: 'three', label: 'Finish in 3 darts' },
  { value: 'six', label: 'Finish in 6 darts' },
  { value: 'each', label: 'Every finish' },
  { value: 'row3', label: '3 in a row' },
  { value: 'row5', label: '5 in a row' },
  { value: 'start', label: 'None' },
];

const RANGES = [
  { value: '41-100', label: '41–100' },
  { value: '61-120', label: '61–120' },
  { value: '101-170', label: '101–170' },
  { value: '41-170', label: '41–170' },
];

/** Options for any game type, shared by game setup and the plan editor. */
export function Options({ entry, config, onChange }: { entry: string; config: GameConfig; onChange: (c: GameConfig) => void }) {
  const set: Patch = (p) => onChange({ ...config, ...p } as GameConfig);
  const c = config;
  switch (c.kind) {
    case 'x01':
      return (
        <>
          {entry === 'x01' && <PunishOptions c={c} set={set} />}
          <X01Options c={c} set={set} />
        </>
      );
    case 'cricket':
      return <CricketOptions c={c} set={set} />;
    case 'countup':
      return (
        <>
          <Field label="Bull">
            <Segmented label="Bull" value={c.bull} options={BULL_OPTS} onChange={(bull) => set({ bull })} />
          </Field>
          <EntryField value={c.entry} onChange={(entry) => set({ entry })} />
        </>
      );
    case 'scoring': {
      const s = c as ScoringConfig;
      if (entry === 'challenge') {
        return (
          <>
            <Field label="Target score per visit">
              <Segmented
                label="Target"
                value={s.threshold ?? 60}
                options={[45, 60, 81, 100, 140].map((v) => ({ value: v, label: String(v) }))}
                onChange={(threshold) => set({ threshold })}
              />
            </Field>
            <Field label="Visits">
              <Segmented
                label="Visits"
                value={s.darts / 3}
                options={[10, 20, 30].map((v) => ({ value: v, label: String(v) }))}
                onChange={(v) => set({ darts: v * 3 })}
              />
            </Field>
            <EntryField value={s.entry} onChange={(e) => set({ entry: e })} />
          </>
        );
      }
      return (
        <>
          {entry === 'hundred' && (
            <Field label="Target">
              <select className="input" value={String(s.target)} onChange={(e) => set({ target: Number(e.target.value) })}>
                {[...Array.from({ length: 20 }, (_, i) => 20 - i), 25].map((n) => (
                  <option key={n} value={n}>
                    {n === 25 ? 'Bull' : n}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Darts">
            <Segmented
              label="Darts"
              value={s.darts}
              options={(entry === 'bullseye' ? [30, 60, 90] : entry === 'hundred' ? [50, 100] : [30, 60, 99]).map((v) => ({
                value: v,
                label: String(v),
              }))}
              onChange={(darts) => set({ darts })}
            />
          </Field>
        </>
      );
    }
    case 'eagleseye':
      return (
        <Field label="Rounds">
          <Segmented
            label="Rounds"
            value={c.rounds}
            options={[8, 10].map((v) => ({ value: v, label: String(v) }))}
            onChange={(rounds) => set({ rounds })}
          />
        </Field>
      );
    case 'atc':
      return (
        <Field label="Ring" help="Doubles is also known as Doubles Around the World.">
          <Segmented
            label="Ring"
            value={(c as AtcConfig).ring}
            options={[
              { value: 'single', label: 'Any' },
              { value: 'double', label: 'Doubles' },
              { value: 'treble', label: 'Trebles' },
            ]}
            onChange={(ring) => set({ ring })}
          />
        </Field>
      );
    case 'bobs27': {
      const b = c as Bobs27Config;
      return (
        <>
          <Switch checked={b.bull} onChange={(bull) => set({ bull })}>
            Finish with a bull round
          </Switch>
          <Switch checked={b.continueBelowZero} onChange={(continueBelowZero) => set({ continueBelowZero })}>
            Keep playing below zero
          </Switch>
        </>
      );
    }
    case 'finish': {
      const f = c as FinishConfig;
      return (
        <>
          <Field label="Scores">
            <Segmented
              label="Scores"
              value={`${f.min}-${f.max}`}
              options={RANGES}
              onChange={(v) => {
                const [min, max] = v.split('-').map(Number);
                set({ min, max });
              }}
            />
          </Field>
          <Field label="Darts to finish">
            <Segmented
              label="Darts"
              value={f.darts}
              options={[3, 6, 9].map((v) => ({ value: v, label: String(v) }))}
              onChange={(darts) => set({ darts })}
            />
          </Field>
          <Field label="Out">
            <Segmented
              label="Out"
              value={f.outMode}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'double', label: 'Double' },
                { value: 'master', label: 'Master' },
              ]}
              onChange={(outMode) => set({ outMode })}
            />
          </Field>
          <Field label="Attempts">
            <Segmented
              label="Attempts"
              value={f.attempts ?? 0}
              options={[10, 20, 0].map((v) => ({ value: v, label: v ? String(v) : 'No limit' }))}
              onChange={(v) => set({ attempts: v || null })}
            />
          </Field>
          <EntryField value={f.entry} onChange={(e) => set({ entry: e })} />
        </>
      );
    }
    case 'ladder121': {
      const l = c as Ladder121Config;
      return (
        <>
          <Field label="Darts per target">
            <Segmented
              label="Darts"
              value={l.darts}
              options={[3, 6, 9, 12, 15].map((v) => ({ value: v, label: String(v) }))}
              onChange={(darts) => set({ darts })}
            />
          </Field>
          <Field label="Safehouse" help="When a finish protects your progress.">
            <Segmented label="Safehouse" value={l.safehouse} options={SAFEHOUSE} onChange={(safehouse) => set({ safehouse })} />
          </Field>
          <Field label="Go up by">
            <Segmented
              label="Step"
              value={l.step}
              options={[1, 2, 5].map((v) => ({ value: v, label: `+${v}` }))}
              onChange={(step) => set({ step })}
            />
          </Field>
          <Field label="Rounds">
            <Segmented
              label="Rounds"
              value={l.rounds ?? 0}
              options={[10, 20, 0].map((v) => ({ value: v, label: v ? String(v) : 'No limit' }))}
              onChange={(v) => set({ rounds: v || null })}
            />
          </Field>
          <EntryField value={l.entry} onChange={(e) => set({ entry: e })} />
        </>
      );
    }
    case 'catch40':
      return <EntryField value={c.entry} onChange={(e) => set({ entry: e })} />;
    case 'p170':
      return (
        <Field label="Attempts">
          <Segmented
            label="Attempts"
            value={c.attempts}
            options={[5, 10, 20].map((v) => ({ value: v, label: String(v) }))}
            onChange={(attempts) => set({ attempts })}
          />
        </Field>
      );
    case 'checklist':
      return (
        <>
          <Field label="Darts per finish">
            <Segmented
              label="Darts"
              value={c.darts}
              options={[3, 6].map((v) => ({ value: v, label: String(v) }))}
              onChange={(darts) => set({ darts })}
            />
          </Field>
          <Field label="Out">
            <Segmented
              label="Out"
              value={c.outMode}
              options={[
                { value: 'double', label: 'Double' },
                { value: 'master', label: 'Master' },
              ]}
              onChange={(outMode) => set({ outMode })}
            />
          </Field>
          <EntryField value={c.entry} onChange={(e) => set({ entry: e })} />
        </>
      );
    case 'halfit':
    case 'shootout':
      return (
        <Field label="Bull">
          <Segmented label="Bull" value={c.bull} options={BULL_OPTS} onChange={(bull) => set({ bull })} />
        </Field>
      );
    case 'shanghai':
      return (
        <Field label="Numbers">
          <Segmented
            label="Numbers"
            value={c.to}
            options={[
              { value: 7, label: '1 to 7' },
              { value: 20, label: '1 to 20' },
            ]}
            onChange={(to) => set({ to })}
          />
        </Field>
      );
    default:
      return null;
  }
}
