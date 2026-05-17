/**
 * cl_one_backend — Cerfttan Discount QR API
 * Project : 13_cerfttan_leather
 *
 * Install : npm install express cors pg dotenv
 * Run     : node cerfttan-backend-server.js
 */

require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ─── Database (cl_one_db) ─────────────────────────────────────
const pool = new Pool({
  host:     process.env.PG_HOST     || "localhost",
  port:     process.env.PG_PORT     || 5432,
  database: process.env.PG_DB      || "_13_cerfttan_leather",
  user:     process.env.PG_USER     || "postgres",
  password: process.env.PG_PASSWORD || "",
});

// ─── Health check ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "cl_one_backend", project: "13_cerfttan_leather" });
});

// ─── POST /api/discount-redemption ────────────────────────────
/**
 * Body:
 *  {
 *    name           : string        — customer's name
 *    mobile         : string        — 10-digit mobile number
 *    discountPercent: number        — 5 | 10 | 15 | 20
 *    choice         : "discount" | "free_card_holder"
 *    scannedAt      : ISO-8601 string (client timestamp of QR scan)
 *  }
 */
app.post("/api/discount-redemption", async (req, res) => {
  const { name, mobile, discountPercent, choice, scannedAt } = req.body;

  // ── Validation ──────────────────────────────────────────────
  const validChoices = ["discount", "free_card_holder"];
  const validPercents = [5, 10, 15, 20];

  if (!name || !mobile || !discountPercent || !choice) {
    return res.status(400).json({ error: "Missing required fields: name, mobile, discountPercent, choice" });
  }
  if (!validPercents.includes(Number(discountPercent))) {
    return res.status(400).json({ error: `discountPercent must be one of ${validPercents.join(", ")}` });
  }
  if (!validChoices.includes(choice)) {
    return res.status(400).json({ error: `choice must be one of ${validChoices.join(", ")}` });
  }
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ error: "mobile must be a valid 10-digit Indian mobile number" });
  }

  // ── Insert ──────────────────────────────────────────────────
  try {
    const result = await pool.query(
      `INSERT INTO _13_cl_one_discount_redemptions
         (name, mobile, discount_percent, choice, scanned_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        name.trim(),
        mobile.trim(),
        Number(discountPercent),
        choice,
        scannedAt ? new Date(scannedAt) : new Date(),
      ]
    );

    const row = result.rows[0];
    return res.status(201).json({
      success: true,
      id:         row.id,
      createdAt:  row.created_at,
      message:    "Redemption recorded successfully",
    });
  } catch (err) {
    console.error("[cl_one_backend] DB error:", err.message);
    return res.status(500).json({ error: "Database error. Please try again." });
  }
});

// ─── GET /api/redemptions  (admin listing, optional) ──────────
app.get("/api/redemptions", async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  try {
    const result = await pool.query(
      `SELECT id, name, mobile, discount_percent, choice, scanned_at, created_at
         FROM _13_cl_one_discount_redemptions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [Number(limit), Number(offset)]
    );
    return res.json({ data: result.rows, count: result.rows.length });
  } catch (err) {
    console.error("[cl_one_backend] DB error:", err.message);
    return res.status(500).json({ error: "Database error." });
  }
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n✅  cl_one_backend running on http://localhost:${PORT}`);
  console.log(`   DB : ${process.env.PG_DB || "_13_cerfttan_leather"}`);
});
