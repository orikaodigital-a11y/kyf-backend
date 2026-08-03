// Wallet balance, top-ups, and transaction history.
// See src/lib/payments.js for the dummy-Razorpay notice.
const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getWallet, creditWallet, fakeRazorpayPaymentId } = require("../lib/payments");

const router = express.Router();

// POST /wallet/topup — Body: { amountPaise }
router.post("/topup", requireAuth, async (req, res) => {
  const amountPaise = Number(req.body.amountPaise);
  if (!amountPaise || amountPaise <= 0) {
    return res.status(400).json({ error: "Enter a valid amount." });
  }
  try {
    const { balance, transaction } = await creditWallet(
      req.professorId,
      amountPaise,
      "wallet_topup",
      "Added to wallet",
      fakeRazorpayPaymentId()
    );
    res.status(201).json({ balance, transaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong adding money to your wallet." });
  }
});

// GET /wallet/transactions — balance + full history, newest first.
router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE professor_id = $1 ORDER BY created_at DESC",
      [req.professorId]
    );
    const balance = await getWallet(req.professorId);
    res.json({ balance, transactions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong loading your wallet." });
  }
});

module.exports = router;
