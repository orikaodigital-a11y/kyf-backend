// Sends push notifications through Expo's push service. Requires no
// credentials of our own for the send call itself - the Android FCM V1 key
// (uploaded via `eas credentials`) is what lets Expo actually deliver to
// devices, this just talks to Expo's HTTP API.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

async function sendExpoPushNotifications(tokens, title, body) {
  const validTokens = tokens.filter((t) => t && t.startsWith("ExponentPushToken"));
  let sent = 0;

  for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
    const chunk = validTokens.slice(i, i + CHUNK_SIZE);
    const messages = chunk.map((to) => ({ to, title, body, sound: "default" }));
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (response.ok) sent += chunk.length;
  }

  return sent;
}

module.exports = { sendExpoPushNotifications };
