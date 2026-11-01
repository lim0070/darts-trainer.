import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { useUpdateReady } from './hooks';
import { GameScreen } from './screens/Game';
import { GameDetail } from './screens/GameDetail';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { PlanEditor } from './screens/PlanEditor';
import { PlanRun } from './screens/PlanRun';
import { Plans } from './screens/Plans';
import { Players } from './screens/Players';
import { Punishments } from './screens/Punishments';
import { Settings } from './screens/Settings';
import { Setup } from './screens/Setup';
import { Stats } from './screens/Stats';
import { Training } from './screens/Training';

function UpdateToast() {
  const update = useUpdateReady();
  if (!update) return null;
  return (
    <div className="toast" role="status">
      A new version is ready
      <button onClick={update}>Reload</button>
    </div>
  );
}

export function App() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/new/:entry">{(p) => <Setup key={p.entry} entry={p.entry} />}</Route>
        <Route path="/train" component={Training} />
        <Route path="/game/:id">{(p) => <GameScreen key={p.id} id={p.id} />}</Route>
        <Route path="/history" component={History} />
        <Route path="/history/:id">{(p) => <GameDetail key={p.id} id={p.id} />}</Route>
        <Route path="/stats" component={Stats} />
        <Route path="/players" component={Players} />
        <Route path="/plans" component={Plans} />
        <Route path="/plans/:id">{(p) => <PlanEditor key={p.id} id={p.id} />}</Route>
        <Route path="/run/:id">{(p) => <PlanRun key={p.id} id={p.id} />}</Route>
        <Route path="/settings" component={Settings} />
        <Route path="/punishments" component={Punishments} />
        <Route path="/settings/cards" component={Punishments} />
        <Route component={Home} />
      </Switch>
      <UpdateToast />
    </Router>
  );
}
