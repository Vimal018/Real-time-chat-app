import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret";

export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as { id: string };
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token is invalid or expired" });
  }
};
