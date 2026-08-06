// Sends push notifications through Expo's push service. Requires no
// credentials of our own for the send call itself - the Android FCM V1 key
// (uploaded via `eas credentials`) is what lets Expo actually deliver to
// devices, this just talks to Expo's HTTP API.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

// Returns { sent, errors } - sent only counts tickets Expo actually
// accepted (status: "ok"). A 200 HTTP response from Expo does NOT mean the
// messages were deliverable - each ticket in the body can independently
// report an error (stale/invalid token, DeviceNotRegistered, mismatched
// Firebase project, etc.), which a plain response.ok check silently hides.
async function sendExpoPushNotifications(tokens, title, body) {
  const validTokens = tokens.filter((t) => t && t.startsWith("ExponentPushToken"));
  let sent = 0;
  const errors = [];

  for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
    const chunk = validTokens.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({ to, title, body, sound: "default" }));
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      const result = await response.json().catch(() => null);
      const tickets = result?.data;
      if (!response.ok || !Array.isArray(tickets)) {
        errors.push(result?.errors?.[0]?.message || `Expo push request failed (HTTP ${response.status}).`);
        continue;
      }
      tickets.forEach((ticket, idx) => {
        if (ticket.status === "ok") {
          sent += 1;
        } else {
          errors.push(ticket.message || ticket.details?.error || "Unknown error");
        }
      });
    } catch (err) {
      errors.push(err.message);
    }
  }

  return { sent, errors };
}

module.exports = { sendExpoPushNotifications };
