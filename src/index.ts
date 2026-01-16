import express from "express";
import {
  loadUser,
  requestLogger,
  errorHandler,
  attachAuditContext,
} from "./middlewares/auth";
import { companyRouter } from "./routers/company";
import { userRouter } from "./routers/user";
import { usersRouter } from "./routers/users";
import { accountRouter } from "./routers/account";
import { accountCategoryRouter } from "./routers/accountCategory";
import { journalEntryRouter } from "./routers/journalEntry";
import { ledgerRouter } from "./routers/ledger";
import { trialBalanceRouter } from "./routers/trialBalance";
import { auditLogRouter } from "./routers/auditLog";
import cors from "cors";

export const app = express();
app.use(express.json());
app.use(cors());
app.use(requestLogger);
app.use(loadUser);
app.use(attachAuditContext);

// routes
app.use("/companies", companyRouter);
app.use("/auth", userRouter);
app.use("/users", usersRouter);
app.use("/accounts", accountRouter);
app.use("/account-categories", accountCategoryRouter);
app.use("/journal-entries", journalEntryRouter);
app.use("/ledger", ledgerRouter);
app.use("/trial-balance", trialBalanceRouter);
app.use("/audit-logs", auditLogRouter);

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
