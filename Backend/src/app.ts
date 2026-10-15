import type { ErrorRequestHandler } from "express";
import express from "express";
import { HttpError } from "./errors.js";
import { contactsRouter } from "./routes/contacts.js";
import { tagsRouter } from "./routes/tags.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ message: "CRM Contact API" });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/contacts", contactsRouter);
  app.use("/api/tags", tagsRouter);

  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
};
