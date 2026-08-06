// Built lazily (not at module load) so a missing/misconfigured Razorpay key
// only breaks payment routes when they're actually called, instead of
// crashing the entire server on startup.
const Razorpay = require("razorpay");

let instance = null;

function getRazorpay() {
  if (!instance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set.");
    }
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
}

module.exports = { getRazorpay };
