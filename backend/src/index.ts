import express from "express";
import { Pool } from "pg";
import type { HealthResponse } from "@sbg/shared";

const app = express();
const port = process.env.PORT ?? 3001;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const body: HealthResponse = { status: "ok", db: "ok" };
    res.json(body);
  } catch (err) {
    console.error("Health check DB query failed:", err);
    const body: HealthResponse = { status: "ok", db: "error" };
    res.status(503).json(body);
  }
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
