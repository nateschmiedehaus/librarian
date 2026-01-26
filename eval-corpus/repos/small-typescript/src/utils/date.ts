export const nowIso = (now: Date = new Date()): string => now.toISOString();

export const addDays = (base: Date, days: number): string => {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
};

export const isPast = (isoDate: string, now: Date): boolean => {
  return new Date(isoDate).getTime() < now.getTime();
};

export const diffDays = (fromIso: string, toIso: string): number => {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const diffMs = to - from;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};
