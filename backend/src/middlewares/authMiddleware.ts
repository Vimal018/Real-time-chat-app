// authMiddleware.ts
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { IUser } from "../models/User";

// Rely on server.ts to load .env
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!; // Non-null assertion since validated in server.ts

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as { id: string };
    const user = await User.findById(decoded.id).select("-password");

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
  if (err instanceof Error) {
    console.error("Token verification error:", err.message);
  } else {
    console.error("Token verification error:", err);
  }

  return res.status(403).json({ message: "Token is invalid or expired" });
}
};