import type { AuthUser } from "./auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Authenticated user identity (attached by requireAuth). */
      user?: AuthUser;
      /** Parsed/validated query object (attached by the validation middleware). */
      validatedQuery?: unknown;
    }
  }
}

export {};
