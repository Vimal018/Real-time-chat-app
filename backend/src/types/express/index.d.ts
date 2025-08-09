import { IUser } from "../../models/User";
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
  body: any;
  params: any;
  headers: any;
}
