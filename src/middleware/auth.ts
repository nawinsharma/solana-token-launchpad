import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "../config";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload | string;
    if (!payload || typeof payload === "string" || typeof (payload as JwtPayload).userId !== "string") {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.userId = (payload as JwtPayload).userId as string;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
