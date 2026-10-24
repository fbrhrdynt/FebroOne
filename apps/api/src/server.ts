import { runPush } from "./push";
import { database } from "./db";
import { makeApp, runAutomation } from "./app";
const origin = process.env.APP_ORIGIN || "http://localhost:4173";
if (process.env.NODE_ENV === "production" && !origin.startsWith("https://"))
  throw new Error("APP_ORIGIN must use HTTPS in production");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const { db, close } = database(process.env.DATABASE_URL);
const app = await makeApp(db, {
  origin,
  secure: process.env.NODE_ENV === "production",
  storage: process.env.UPLOAD_DIR || ".data/uploads",
  ai: process.env.AI_API_KEY
    ? {
        url: process.env.AI_BASE_URL || "https://api.openai.com/v1",
        key: process.env.AI_API_KEY,
        model: process.env.AI_MODEL || "",
      }
    : undefined,
});
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT || 3470) });
let running = false;
const timer = setInterval(async () => {
  if (running) return;
  running = true;
  try {
    await runAutomation(db);
    await runPush(db);
  } catch {
    console.error("Scheduled rules failed; retry next minute");
  } finally {
    running = false;
  }
}, 60000);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    clearInterval(timer);
    await app.close();
    await close();
    process.exit(0);
  });
