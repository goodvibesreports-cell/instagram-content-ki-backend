export function scorePerformance({ views = 0, likes = 0, comments = 0, saves = 0 }) {
  if (!views) return 0;
  const engagement = (likes + comments * 2 + saves * 3) / views;
  return Math.min(100, Math.round(engagement * 1000));
}

