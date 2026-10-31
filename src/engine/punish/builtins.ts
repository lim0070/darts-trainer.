export interface PunishCard {
  id: string;
  /** Use {n} where the random number goes. */
  text: string;
  min: number;
  max: number;
  step: number;
  unit: 'reps' | 'seconds' | null;
  /** Groups Done cards into tallies, e.g. all push-up cards. */
  tallyKey: string | null;
  weight: number;
  enabled: boolean;
  builtin: boolean;
}

const card = (id: string, text: string, min: number, max: number, unit: PunishCard['unit'], step = 1): PunishCard => ({
  id,
  text,
  min,
  max,
  step,
  unit,
  tallyKey: unit ? id : null,
  weight: 1,
  enabled: true,
  builtin: true,
});

export const BUILTIN_CARDS: PunishCard[] = [
  card('pushups', '{n} push-ups', 5, 15, 'reps'),
  card('squats', '{n} squats', 10, 20, 'reps'),
  card('plank', 'Plank for {n} seconds', 20, 60, 'seconds', 5),
  card('burpees', '{n} burpees', 3, 8, 'reps'),
  card('lunges', '{n} lunges', 10, 20, 'reps', 2),
  card('jacks', '{n} jumping jacks', 15, 30, 'reps', 5),
  card('situps', '{n} sit-ups', 10, 20, 'reps'),
  card('wallsit', 'Wall sit for {n} seconds', 20, 45, 'seconds', 5),
  card('weakhand', 'Throw your next visit with your other hand', 0, 0, null),
  card('oneleg', 'Throw your next visit standing on one leg', 0, 0, null),
];

export const TALLY_LABELS: Record<string, string> = {
  pushups: 'Push-ups',
  squats: 'Squats',
  plank: 'Plank seconds',
  burpees: 'Burpees',
  lunges: 'Lunges',
  jacks: 'Jumping jacks',
  situps: 'Sit-ups',
  wallsit: 'Wall sit seconds',
};
