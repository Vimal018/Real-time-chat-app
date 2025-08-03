import { IUser } from "../../models/User"; // adjust this import path
import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}