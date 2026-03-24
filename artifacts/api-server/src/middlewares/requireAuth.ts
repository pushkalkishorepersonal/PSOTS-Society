import type { Request, Response, NextFunction } from "express";
import { verifyJwt, type JwtPayload } from "../lib/jwt";

export type Role = "resident" | "committee" | "admin";

const ROLE_LEVELS: Record<Role, number> = {
  resident: 1,
  committee: 2,
  admin: 3,
};

// Augment Express Request with authenticated user
declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
  }
}

export function requireAuth(minRole: Role = "resident") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required. Please log in first." });
      return;
    }

    const token = header.slice(7);
    try {
      const payload = verifyJwt(token);
      const userLevel = ROLE_LEVELS[payload.role] ?? 0;
      if (userLevel < ROLE_LEVELS[minRole]) {
        res.status(403).json({ error: "You don't have permission to perform this action." });
        return;
      }
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    }
  };
}
