import { Request } from 'express';

export const readRouteParam = (req: Request, name: string): string | null => {
  const value = req.params[name];

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].trim() ? value[0] : null;
  }

  return typeof value === 'string' && value.trim() ? value : null;
};
