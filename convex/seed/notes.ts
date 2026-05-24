/**
 * Curated note + templated-summary pools for the deterministic seed.
 *
 * Drawn by the seed's PRNG — 40% of attempts get a note, every seeded session
 * gets one templated summary so the dashboard never shows a "pending" banner
 * on fresh seed data.
 */
export const ATTEMPT_NOTE_POOL: readonly string[] = [
  'feet kept popping on the slab',
  'stuck at the crux move; need more hip flexibility',
  'campussed the top — felt strong',
  'flagged left foot, made the next hold easy',
  'rest day energy, body felt heavy',
  'tried a heel-toe cam, didn’t pay off',
  'new beta from a partner unlocked it',
  'pumped halfway, need more endurance volume',
  'eyes-closed visualisation between burns helped',
  'left hand gaston felt sketchy without chalk',
  'morning session — fingers cold, took a long warm-up',
  'sticky rubber on these shoes, big upgrade',
  'second go was cleaner than the first',
  'tried matching on the sloper, slipped',
  'screamed at the top, but it counts',
  'rest between burns shorter than usual; pumped fast',
  'felt the move in my forearms for an hour after',
  'made the throw, didn’t stick',
  'twisted out of the crux, ended in compression',
  'tried with both hands open vs. half-crimp; open won',
  'wall was set fresh this morning; everything felt new',
  'forgot to chalk before the dyno — slipped on the catch',
  'top-out felt safe today, no nerves',
  'project from last week finally went',
  'fell off the lip; need to commit harder',
  'no music in the gym — focus was easier',
  'climbed with a partner; tried their beta',
  'feet swap saved energy at the start',
  'matched on a one-pad crimp; finger drag was real',
  'hip turn at move four made everything else click',
];

export const SUMMARY_TEMPLATE_POOL: readonly string[] = [
  'Tidy volume day — your lower-grade flashes were quick and your mid-grade attempts looked focused. Worth pushing one tier higher next session.',
  'Strong send-rate run on your current grade; the stretch attempts didn\'t go but the falls were higher than last week. Trend is up.',
  'Quiet session, mostly mileage on warm-ups. Use the next day to take one big swing at a project — the rest looks deserved.',
  'A clean send at your current top grade plus consistent mid-grade work. Nice to see the projects getting closer to the top hold.',
  'You spent most of the session at one grade — good baseline reinforcement. Mix in a stretch attempt next time to keep the ceiling moving.',
  'Big effort day — perceived effort high and matching attempts at stretch grade. Recovery before the next push.',
  'Returned to a problem that had been a wall and unlocked it. The kind of session where the dashboard starts to look like progress.',
  'High volume but lower send rate than your 30-day baseline. Worth checking whether you\'re onsighting too tired.',
  'A confident send-pyramid: clean flashes at warm-up grades, a tidy redpoint at your current tier, and a near-miss above. Solid shape.',
  'Stretch attempts almost went. Two more sessions on the same problems and you should see the breakthrough.',
];
