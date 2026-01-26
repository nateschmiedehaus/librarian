export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

export function addSeconds(base: Date, seconds: number): string {
  const next = new Date(base.getTime() + seconds * 1000);
  return next.toISOString();
}
