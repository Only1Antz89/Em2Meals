import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type SqlValue = string | number | boolean | null;

export interface DatabaseStatement {
  sql: string;
  values: SqlValue[];
  bind(...values: SqlValue[]): DatabaseStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(...values: SqlValue[]): Promise<{ meta: { changes: number } }>;
}

export interface Database {
  prepare(sql: string): DatabaseStatement;
  batch(
    statements: DatabaseStatement[],
  ): Promise<Array<{ meta: { changes: number } }>>;
}

declare global {
  var __EM2_TEST_DB__: Database | undefined;
}

function postgresSql(sql: string) {
  let parameter = 0;
  let converted = sql.replace(/\?/g, () => `$${++parameter}`);
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(converted)) {
    converted = converted.replace(
      /^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i,
      "INSERT INTO ",
    );
    converted = `${converted.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  }
  return converted;
}

class NeonStatement implements DatabaseStatement {
  values: SqlValue[] = [];

  constructor(
    public sql: string,
    private readonly client: NeonQueryFunction<false, true>,
  ) {}

  bind(...values: SqlValue[]) {
    this.values = values;
    return this;
  }

  async first<T>() {
    const result = await this.client.query(postgresSql(this.sql), this.values);
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T>() {
    const result = await this.client.query(postgresSql(this.sql), this.values);
    return { results: result.rows as T[] };
  }

  async run(...values: SqlValue[]) {
    if (values.length) this.values = values;
    const result = await this.client.query(postgresSql(this.sql), this.values);
    return { meta: { changes: result.rowCount } };
  }
}

function createDatabase(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Connect a Neon Postgres resource to this Vercel project and pull its environment variables.",
    );
  }
  const client = neon(connectionString, { fullResults: true });
  return {
    prepare: (sql) => new NeonStatement(sql, client),
    async batch(statements) {
      const results = await client.transaction(
        (transaction) =>
          statements.map((statement) =>
            transaction.query(postgresSql(statement.sql), statement.values),
          ),
        { fullResults: true },
      );
      return results.map((result) => ({ meta: { changes: result.rowCount } }));
    },
  };
}

let database: Database | undefined;

export function getDb(): Database {
  if (globalThis.__EM2_TEST_DB__) return globalThis.__EM2_TEST_DB__;
  database ??= createDatabase();
  return database;
}
