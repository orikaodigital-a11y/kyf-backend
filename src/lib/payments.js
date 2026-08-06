// Wallet helpers shared by every paid feature (Priority Connect, Post Boost,
// Opportunities, Featured Profile, Sponsored Ads, and wallet top-ups).
// Real top-ups go through Razorpay (see routes/wallet.js) and only call
// creditWallet after the payment signature is verified server-side.
const pool = require("../db");

async function getWallet(professorId) {
  const result = await pool.query("SELECT wallet_balance_paise FROM professors WHERE id = $1", [professorId]);
  if (result.rows.length === 0) throw new Error("Professor not found.");
  return Number(result.rows[0].wallet_balance_paise);
}

// Deducts amountPaise from the professor's wallet and logs a transaction, atomically.
// Throws (err.code === 'INSUFFICIENT_FUNDS') if the balance is too low.
async function chargeWallet(professorId, amountPaise, type, detail, status = "completed") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT wallet_balance_paise FROM professors WHERE id = $1 FOR UPDATE",
      [professorId]
    );
    if (result.rows.length === 0) throw new Error("Professor not found.");
    const balance = Number(result.rows[0].wallet_balance_paise);
    if (balance < amountPaise) {
      await client.query("ROLLBACK");
      const err = new Error("Insufficient wallet balance.");
      err.code = "INSUFFICIENT_FUNDS";
      throw err;
    }
    const newBalance = balance - amountPaise;
    await client.query("UPDATE professors SET wallet_balance_paise = $1 WHERE id = $2", [newBalance, professorId]);
    const txn = await client.query(
      `INSERT INTO transactions (professor_id, type, amount_paise, status, detail)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [professorId, type, amountPaise, status, detail || null]
    );
    await client.query("COMMIT");
    return { balance: newBalance, transaction: txn.rows[0] };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// Adds amountPaise to the professor's wallet and logs a transaction, atomically.
async function creditWallet(professorId, amountPaise, type, detail, razorpayPaymentId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE professors SET wallet_balance_paise = wallet_balance_paise + $1 WHERE id = $2 RETURNING wallet_balance_paise",
      [amountPaise, professorId]
    );
    const txn = await client.query(
      `INSERT INTO transactions (professor_id, type, amount_paise, status, detail, razorpay_payment_id)
       VALUES ($1, $2, $3, 'completed', $4, $5) RETURNING *`,
      [professorId, type, amountPaise, detail || null, razorpayPaymentId || null]
    );
    await client.query("COMMIT");
    return { balance: Number(result.rows[0].wallet_balance_paise), transaction: txn.rows[0] };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

// Marks a held transaction (e.g. a sponsored ad awaiting approval) as completed or refunded.
async function resolveHeldTransaction(transactionId, professorId, outcome) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txnResult = await client.query(
      "SELECT * FROM transactions WHERE id = $1 AND professor_id = $2 AND status = 'held' FOR UPDATE",
      [transactionId, professorId]
    );
    if (txnResult.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("Held transaction not found.");
    }
    const txn = txnResult.rows[0];
    if (outcome === "refunded") {
      await client.query(
        "UPDATE professors SET wallet_balance_paise = wallet_balance_paise + $1 WHERE id = $2",
        [txn.amount_paise, professorId]
      );
    }
    await client.query("UPDATE transactions SET status = $1 WHERE id = $2", [outcome, transactionId]);
    await client.query("COMMIT");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getWallet, chargeWallet, creditWallet, resolveHeldTransaction };
