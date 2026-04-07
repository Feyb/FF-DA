export function togglePositionFilter<T>(current: T[], position: T): T[] {
  const has = current.includes(position);
  if (has && current.length === 1) return current;
  return has ? current.filter((p) => p !== position) : [...current, position];
}
