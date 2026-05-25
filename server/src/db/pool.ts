import pg from "pg";
import { getConfig } from "../config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: getConfig().databaseUrl
});

export type DbPool = Pick<pg.Pool, "query">;
