// Runs the app against a real Postgres server for local and CI checks.
// Usage: NODE_OPTIONS="--import ./tests/postgres-preload.mjs" next start
// The unit tests use SQLite, which accepts some SQL that Postgres rejects
// (an ambiguous column once broke every enquiry in production), so the API
// smoke test and walkthrough also run against Postgres through this driver.
// Connection settings come from the standard PG* variables or
// EM2_TEST_POSTGRES_URL.
import pg from "pg";

const pool = new pg.Pool(
  process.env.EM2_TEST_POSTGRES_URL
    ? { connectionString: process.env.EM2_TEST_POSTGRES_URL }
    : {},
);

// Keep in step with postgresSql() in db/index.ts.
function postgresSql(sql) {
  let parameter = 0;
  let converted = sql.replace(/\?/g, () => `$${++parameter}`);
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(converted)) {
    converted = converted.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+/i, "INSERT INTO ");
    converted = `${converted.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  }
  return converted;
}

class Statement {
  constructor(sql) {
    this.sql = sql;
    this.values = [];
  }
  bind(...values) {
    this.values = values;
    return this;
  }
  async first() {
    const result = await pool.query(postgresSql(this.sql), this.values);
    return result.rows[0] ?? null;
  }
  async all() {
    const result = await pool.query(postgresSql(this.sql), this.values);
    return { results: result.rows };
  }
  async run(...values) {
    if (values.length) this.values = values;
    const result = await pool.query(postgresSql(this.sql), this.values);
    return { meta: { changes: result.rowCount } };
  }
}

globalThis.__EM2_TEST_DB__ = {
  prepare: (sql) => new Statement(sql),
  async batch(statements) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const results = [];
      for (const statement of statements) {
        const result = await client.query(postgresSql(statement.sql), statement.values);
        results.push({ meta: { changes: result.rowCount } });
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
