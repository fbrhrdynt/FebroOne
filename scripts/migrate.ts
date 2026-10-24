import { database } from "../apps/api/src/db";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
export async function migrate(db: any) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("packages/db/migrations"))
    .filter((s) => s.endsWith(".sql"))
    .sort()) {
    const source = await readFile("packages/db/migrations/" + name, "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    await db.transaction(async (tx: any) => {
      await tx.query("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
      const prior = (
        await tx.query("SELECT checksum FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows[0];
      if (prior) {
        if (prior.checksum !== checksum)
          throw new Error("Migration checksum mismatch: " + name);
        return;
      }
      await tx.query(source);
      await tx.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    });
  }
}
if (process.argv[1]?.endsWith("migrate.ts")) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const { db, close } = database(process.env.DATABASE_URL);
  try {
    await migrate(db);
    console.log("Migrations applied");
  } finally {
    await close();
  }
}
