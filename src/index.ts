import express from "express";
import { loadUser, requestLogger, errorHandler } from "./middlewares/auth";
import { companyRouter } from "./routers/company";
import { userRouter } from "./routers/user";

export const app = express();
app.use(express.json());
app.use(requestLogger);
app.use(loadUser);

// routes
app.use("/companies", companyRouter);
app.use("/auth", userRouter);

// Lightweight health endpoint (no heavy DB query)
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});
app.get("/", (_req, res) => res.send("Easy-Accouting is running"));
// Error handler (after routes)
app.use(errorHandler);

if (require.main === module) {
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () =>
    console.log(`Server running on http://localhost:${port}`)
  );
}
