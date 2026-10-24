import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
export type DB = {
  query: (
    sql: string,
    params?: any[],
  ) => Promise<{ rows: any[]; rowCount?: number | null }>;
  transaction: <T>(fn: (db: DB) => Promise<T>) => Promise<T>;
};
function querySql(text: string, params: any[] = []) {
  const parts: any[] = [];
  let at = 0;
  for (const match of text.matchAll(/\$(\d+)/g)) {
    parts.push(sql.raw(text.slice(at, match.index)));
    // Bind arrays as one PostgreSQL parameter; SQL interpolation expands them.
    parts.push(sql.param(params[Number(match[1]) - 1]));
    at = match.index! + match[0].length;
  }
  parts.push(sql.raw(text.slice(at)));
  return sql.join(parts, sql.raw(""));
}
export function database(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  const orm = drizzle(pool);
  function adapter(executor: any): DB {
    return {
      query: async (q, p) => executor.execute(querySql(q, p)),
      transaction: async (fn) =>
        executor.transaction((tx: any) => fn(adapter(tx))),
    };
  }
  return { db: adapter(orm), orm, close: () => pool.end() };
}
