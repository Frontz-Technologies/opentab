export function getLastYearRange(today: Date): { start: Date; end: Date } {
  const y = today.getFullYear() - 1;
  return {
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31),
  };
}
