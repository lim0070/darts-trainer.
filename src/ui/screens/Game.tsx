import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { createGame, deleteGame } from '../../db/repo';
import { db, type PlanRunRow } from '../../db/schema';
import { triggerReason } from '../../engine/punish/triggers';
import { isCheckoutState, isRoundState, isSeqState } from '../../engine/reduce';
import { CorkDialog } from '../components/CorkDialog';
import { Sheet } from '../components/Controls';
import { UndoIcon } from '../components/Icons';
import { PunishCard } from '../components/PunishCard';
import { TopBar } from '../components/TopBar';
import { gameTitle, wins } from '../format';
import { formatClock, useNow, useWakeLock } from '../hooks';
import { type GameCtl, useGame } from '../useGame';
import { CheckoutPlay } from './play/CheckoutPlay';
import { CricketPlay } from './play/CricketPlay';
import { RoundPlay } from './play/RoundPlay';
import { SeqPlay } from './play/SeqPlay';
import { seatSummary } from './play/summary';
import { X01Play } from './play/X01Play';

function stepLimitEnd(run: PlanRunRow | undefined): number | null {
  if (!run || run.stepStartedAt === null) return null;
  const step = run.plan.steps[run.stepIdx];
  return step && 'minutes' in step.limit ? run.stepStartedAt + step.limit.minutes * 60_000 : null;
}

function PlanBar({ run }: { run: PlanRunRow }) {
  const now = useNow();
  const end = stepLimitEnd(run);
  return (
    <div className="planbar">
      <span>
        {run.plan.name}, step {run.stepIdx + 1} of {run.plan.steps.length}
      </span>
      {end && <span className="time">{formatClock(end - now)}</span>}
    </div>
  );
}

function GameOver({ ctl, run }: { ctl: GameCtl; run?: PlanRunRow }) {
  const { game, state } = ctl;
  const [, navigate] = useLocation();
  const winner = state.winner !== null ? game.seats[state.winner]?.name : null;
  const again = async () => {
    const id = await createGame(game.entry, game.config, game.seats);
    navigate(`/game/${id}`, { replace: true });
  };
  return (
    <Sheet>
      <p className="winner-line">
        {winner
          ? wins(winner)
          : state.ended === 'timeUp'
            ? 'Time is up'
            : state.ended === 'stopped'
              ? 'Game stopped'
              : (game.resultLine ?? 'Finished')}
      </p>
      {game.seats.map((s, i) => (
        <div key={i} className="stack">
          {game.seats.length > 1 && <strong>{s.name}</strong>}
          <table className="table">
            <tbody>
              {seatSummary(game, state, i).map((l) => (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td>{l.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => ctl.undo()} disabled={!ctl.canUndo}>
        Undo the last throw
      </button>
      <div className="row">
        {run ? (
          <button className="btn primary grow" onClick={() => navigate(`/run/${run.id}`)}>
            Back to the plan
          </button>
        ) : (
          <>
            <button className="btn grow" onClick={() => navigate('/')}>
              Home
            </button>
            <button className="btn primary grow" onClick={again}>
              Play again
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function GameMenu({ ctl, onClose }: { ctl: GameCtl; onClose: () => void }) {
  const [, navigate] = useLocation();
  return (
    <Sheet onClose={onClose}>
      <h2>Leave the game?</h2>
      <button className="btn block" onClick={() => navigate('/')}>
        Leave and resume later
      </button>
      <button
        className="btn block"
        onClick={() => {
          ctl.end('stopped');
          onClose();
        }}
      >
        Stop now and keep the record
      </button>
      <button
        className="btn block ghost"
        style={{ color: '#ff8a80' }}
        onClick={async () => {
          await deleteGame(ctl.game.id);
          navigate('/', { replace: true });
        }}
      >
        Delete this game
      </button>
    </Sheet>
  );
}

export function GameScreen({ id }: { id: string }) {
  const runId = useLiveQuery(async () => (await db.games.get(id))?.planRunId ?? null, [id]);
  const run = useLiveQuery(async () => (runId ? await db.planRuns.get(runId) : undefined), [runId]);
  const ctl = useGame(id, { endAt: stepLimitEnd(run) });
  const [menu, setMenu] = useState(false);
  useWakeLock(!!ctl && ctl.state.phase !== 'over');

  if (ctl === undefined) return <main className="screen" />;
  if (ctl === null) {
    return (
      <main className="screen">
        <TopBar title="Game not found" />
        <p className="prose">It may have been deleted.</p>
      </main>
    );
  }
  const { game, state, need } = ctl;
  let body;
  if (state.kind === 'x01') body = <X01Play ctl={ctl} state={state} />;
  else if (state.kind === 'cricket') body = <CricketPlay ctl={ctl} state={state} />;
  else if (isRoundState(state)) body = <RoundPlay ctl={ctl} state={state} />;
  else if (isSeqState(state)) body = <SeqPlay ctl={ctl} state={state} />;
  else if (isCheckoutState(state)) body = <CheckoutPlay ctl={ctl} state={state} />;

  const pending = state.pendingPunish;
  const lastVisit = pending ? [...state.visits].reverse().find((v) => v.seat === pending.seat) : undefined;

  return (
    <main className="screen play">
      <TopBar
        title={gameTitle(game)}
        back={null}
        right={
          <>
            <button className="iconbtn" aria-label="Undo" disabled={!ctl.canUndo} onClick={() => ctl.undo()}>
              <UndoIcon />
            </button>
            <button className="iconbtn" onClick={() => (state.phase === 'over' ? history.back() : setMenu(true))}>
              {state.phase === 'over' ? 'Close' : 'Leave'}
            </button>
          </>
        }
      />
      {run && run.status === 'active' && <PlanBar run={run} />}
      {body}
      {need.k === 'punish' && pending && lastVisit && (
        <PunishCard
          key={ctl.events.length}
          card={pending.card}
          reason={triggerReason(pending.trigger, lastVisit)}
          who={game.seats[pending.seat].name}
          onResolve={ctl.resolvePunish}
        />
      )}
      {need.k === 'cork' && (
        <CorkDialog seats={game.seats} seed={game.seed} salt={ctl.events.length} onWinner={(winner) => ctl.push({ t: 'cork', winner })} />
      )}
      {state.phase === 'over' && need.k === 'over' && <GameOver ctl={ctl} run={run && run.status === 'active' ? run : undefined} />}
      {menu && <GameMenu ctl={ctl} onClose={() => setMenu(false)} />}
    </main>
  );
}
