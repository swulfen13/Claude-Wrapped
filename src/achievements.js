'use strict';
// Archetypes and achievements are derived from the computed stats only.

const ARCHETYPES = {
  refactorer: { title: 'The Refactorer', blurb: 'Claude spent most of its time editing and writing your code.' },
  researcher: { title: 'The Researcher', blurb: 'Lots of reading, searching and digging before anything changed.' },
  commander: { title: 'The Commander', blurb: 'You kept Claude busy in the terminal, running command after command.' },
  delegator: { title: 'The Delegator', blurb: 'You sent subagents off to do the work in parallel.' },
  architect: { title: 'The Architect', blurb: 'You planned first and built second.' },
  explorer: { title: 'The Explorer', blurb: 'A bit of everything, no single habit dominates.' },
};

function archetype(stats) {
  const count = (names) => stats.tools.filter((t) => names.includes(t.name)).reduce((s, t) => s + t.count, 0);
  const total = stats.toolCalls || 0;
  if (!total) return { id: 'explorer', ...ARCHETYPES.explorer, share: 0 };
  const shares = {
    refactorer: count(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']) / total,
    researcher: count(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'LS']) / total,
    commander: count(['Bash', 'BashOutput', 'KillShell']) / total,
    delegator: ((stats.subagentCalls || 0) / total) * 6, // rare but telling, so weighted up
    architect: ((stats.planMode || 0) / Math.max(stats.totals.prompts, 1)) * 8,
  };
  const [id, share] = Object.entries(shares).sort((a, b) => b[1] - a[1])[0];
  const pick = share >= 0.42 ? id : 'explorer';
  return { id: pick, ...ARCHETYPES[pick], share: Math.min(share, 1) };
}

const fmt = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Each achievement: value(stats) and goal. Progress is value/goal, unlocked when value >= goal.
const ACHIEVEMENTS = [
  { id: 'million', icon: '🪙', title: 'First million', desc: 'Use 1M tokens', goal: 1e6, value: (s) => s.totals.tokens },
  { id: 'hundred-million', icon: '💰', title: 'Nine digits', desc: 'Use 100M tokens', goal: 1e8, value: (s) => s.totals.tokens },
  { id: 'billion', icon: '🏦', title: 'Billionaire', desc: 'Use 1B tokens', goal: 1e9, value: (s) => s.totals.tokens },
  { id: 'big-day', icon: '🌋', title: 'Eruption', desc: 'Use 50M tokens in a single day', goal: 5e7, value: (s) => (s.bestDay ? s.bestDay.tokens : 0) },
  { id: 'streak-7', icon: '🔥', title: 'On fire', desc: 'Code with Claude 7 days in a row', goal: 7, value: (s) => s.longestStreak },
  { id: 'streak-30', icon: '☄️', title: 'Unstoppable', desc: 'Code with Claude 30 days in a row', goal: 30, value: (s) => s.longestStreak },
  { id: 'three-am', icon: '🌙', title: '3 AM club', desc: 'Send a prompt between 2 and 5 AM', goal: 1, value: (s) => s.byHour[2] + s.byHour[3] + s.byHour[4] },
  { id: 'early', icon: '🌅', title: 'Sunrise shift', desc: 'Send 10 prompts between 5 and 7 AM', goal: 10, value: (s) => s.byHour[5] + s.byHour[6] },
  { id: 'weekend', icon: '🛋️', title: 'Weekend warrior', desc: 'Be active on 20 weekend days', goal: 20, value: (s) => s.weekendDays || 0 },
  { id: 'marathon', icon: '🏃', title: 'Marathon', desc: 'One session with 4 hours of active work', goal: 4, value: (s) => (s.longestSession ? s.longestSession.hours : 0) },
  { id: 'lines', icon: '📜', title: 'Novelist', desc: 'Have Claude write 10K lines', goal: 1e4, value: (s) => s.linesWritten },
  { id: 'polyglot', icon: '🗺️', title: 'Polyglot', desc: 'Edit files in 5 languages', goal: 5, value: (s) => s.languages.length },
  { id: 'model-hopper', icon: '🎛️', title: 'Model hopper', desc: 'Use 4 different models', goal: 4, value: (s) => s.models.length },
  { id: 'delegator', icon: '🤝', title: 'Team lead', desc: 'Send off 100 subagents', goal: 100, value: (s) => s.subagentCalls },
  { id: 'planner', icon: '🧭', title: 'Measure twice', desc: 'Make 25 plans in plan mode', goal: 25, value: (s) => s.planMode },
  { id: 'absolutely-right', icon: '💯', title: 'Absolutely right', desc: 'Hear "You\'re absolutely right" 100 times', goal: 100, value: (s) => s.absolutelyRight },
];

function achievements(stats) {
  return ACHIEVEMENTS.map((a) => {
    const v = Number(a.value(stats)) || 0;
    return {
      id: a.id,
      icon: a.icon,
      title: a.title,
      desc: a.desc,
      unlocked: v >= a.goal,
      progress: Math.min(v / a.goal, 1),
      value: v,
      goal: a.goal,
      label: a.goal >= 1000 ? `${fmt(Math.min(v, a.goal))} / ${fmt(a.goal)}` : `${Math.floor(Math.min(v, a.goal))} / ${a.goal}`,
    };
  });
}

module.exports = { archetype, achievements, ARCHETYPES, ACHIEVEMENTS };
