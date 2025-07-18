// types/express/index.d.ts
import { Request } from "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string; // or ObjectId if you're using Mongoose types
  }
}
