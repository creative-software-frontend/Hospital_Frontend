import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { corsOrigins } from "./config";
import { config } from "./config";
import apiRoutes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin (no Origin header, e.g. curl) and allowlisted origins.
        if (!origin || corsOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    }),
  );

  // HTTP request logging
  if (config.env === "development") {
    app.use(morgan("dev"));
  } else {
    app.use(morgan("combined"));
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API routes
  app.use("/api", apiRoutes);

  // 404 for unknown routes
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}
