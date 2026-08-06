// Wallet balance, top-ups, and transaction history.
const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getWallet, creditWallet } = require("../lib/payments");
const { getRazorpay } = require("../lib/razorpay");

const router = express.Router();

// POST /wallet/razorpay/order — Body: { amountPaise }
// Creates a Razorpay order for the app to open Checkout against.
router.post("/razorpay/order", requireAuth, async (req, res) => {
  const amountPaise = Number(req.body.amountPaise);
  if (!amountPaise || amountPaise <= 0) {
    return res.status(400).json({ error: "Enter a valid amount." });
  }
  try {
    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `wallet_${req.professorId}_${Date.now()}`,
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong starting that payment." });
  }
});

// POST /wallet/razorpay/verify — Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, amountPaise }
// Verifies the payment signature server-side before crediting the wallet -
// never trust the app's word alone that a payment succeeded.
router.post("/razorpay/verify", requireAuth, async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amountPaise } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !amountPaise) {
    return res.status(400).json({ error: "Missing payment details." });
  }
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ error: "Payment verification failed." });
  }

  try {
    const { balance, transaction } = await creditWallet(
      req.professorId,
      Number(amountPaise),
      "wallet_topup",
      "Added to wallet via Razorpay",
      razorpayPaymentId
    );
    res.status(201).json({ balance, transaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment verified but something went wrong crediting your wallet. Contact support with your payment ID: " + razorpayPaymentId });
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
