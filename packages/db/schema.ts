import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  bigint,
  bigserial,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  preferences: jsonb("preferences").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export const records = pgTable("records", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  tags: text("tags").array().notNull(),
  data: jsonb("data").notNull(),
  version: integer("version").notNull(),
  companyId: uuid("company_id"),
  categoryId: uuid("category_id"),
  projectId: uuid("project_id"),
  reminderAt: timestamp("reminder_at", { withTimezone:true }),
  reminderRepeat: text("reminder_repeat").notNull().default("None"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
});
export const postings = pgTable("ledger_postings", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  transactionId: uuid("transaction_id").notNull(),
  accountId: uuid("account_id"),
  amount: bigint("amount", { mode: "bigint" }).notNull(),
});
