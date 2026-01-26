const samples: number[] = [];

export function record(value: number): void {
  samples.push(value);
}

export function average(): number {
  if (samples.length === 0) {
    return 0;
  }
  const total = samples.reduce((sum, current) => sum + current, 0);
  return total / samples.length;
}
