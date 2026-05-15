export const readBoundedInteger = (
  value: unknown,
  {
    fallback,
    min,
    max,
  }: {
    fallback: number;
    min: number;
    max: number;
  },
): number => {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed >= min && parsed <= max) {
    return parsed;
  }

  return fallback;
};

export const readListLimit = (value: unknown): number =>
  readBoundedInteger(value, { fallback: 25, min: 1, max: 100 });
