import { randomUUID, randomBytes } from "node:crypto";
import { database } from "../apps/api/src/db";
import { hashPassword, hashToken } from "../apps/api/src/auth";
import { z } from "zod";
const p = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_NAME: z.string().min(1),
    ADMIN_PASSWORD: z.string().min(12).max(200),
    DATABASE_URL: z.string().min(1),
  })
  .parse(process.env);
const { db, close } = database(p.DATABASE_URL);
try {
  const recovery = randomBytes(24).toString("hex");
  await db.transaction(async (tx) => {
    await tx.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const exists = (await tx.query("SELECT id FROM users")).rows;
    if (exists.length)
      throw new Error(
        "Admin already exists. Use account recovery; no automatic overwrite.",
      );
    await tx.query(
      "INSERT INTO users(id,email,name,password_hash,recovery_hash) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        p.ADMIN_EMAIL.toLowerCase(),
        p.ADMIN_NAME,
        await hashPassword(p.ADMIN_PASSWORD),
        hashToken(recovery),
      ],
    );
  });
  console.log(
    "Admin created. Save this one-time recovery code offline:\n" + recovery,
  );
} finally {
  await close();
}
