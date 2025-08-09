// middlewares/authMiddleware.ts or types/index.d.ts
import { Request } from "express";
import { IUser } from "../models/User"; // adjust path

export interface AuthenticatedRequest<
  P = Record<string, any>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: IUser;
}
