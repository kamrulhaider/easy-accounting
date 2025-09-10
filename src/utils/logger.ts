import pino from "pino";
import fs from "fs";
import path from "path";

const isProd = process.env.NODE_ENV === "production";
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    /* ignore */
  }
}

const fileDest = pino.destination({
  dest: path.join(logDir, "app.log"),
  mkdir: true,
  append: true,
  sync: false,
});

function buildLogger() {
  const level = process.env.LOG_LEVEL || "info";
  const redact: any = {
    paths: [
      "password",
      "*.password",
      "req.body.password",
      "body.password",
      "admin.password",
      "user.password",
    ],
    censor: "[REDACTED]",
  };
  if (!isProd) {
    const prettyTransport = pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        singleLine: false,
      },
    });
    return pino(
      { level, base: undefined, redact },
      pino.multistream([{ stream: prettyTransport }, { stream: fileDest }])
    );
  }
  return pino({ level, base: undefined, redact }, fileDest);
}

export const logger = buildLogger();
