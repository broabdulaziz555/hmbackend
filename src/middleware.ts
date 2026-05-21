import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
  }
}

// Authentication interceptor guarding administrative manipulation pathways
export const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Sizda bu amalni bajarish huquqi yo\'q! Tizimga qayta kiring.' });
};