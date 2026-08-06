// This is the file that actually starts the server. Run it with: npm run dev
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const adminAuthRoutes = require("./routes/adminAuth");
const adminRoutes = require("./routes/admin");
const pricingRoutes = require("./routes/pricing");
const contentRoutes = require("./routes/content");
const professorRoutes = require("./routes/professors");
const discoverRoutes = require("./routes/discover");
const matchesRoutes = require("./routes/matches");
const feedRoutes = require("./routes/feed");
const messagesRoutes = require("./routes/messages");
const walletRoutes = require("./routes/wallet");
const opportunitiesRoutes = require("./routes/opportunities");
const supportRoutes = require("./routes/support");
const reportsRoutes = require("./routes/reports");
const blocksRoutes = require("./routes/blocks");
const sponsoredAdsRoutes = require("./routes/sponsoredAds");
const verificationRequestsRoutes = require("./routes/verificationRequests");
const notificationsRoutes = require("./routes/notifications");
const bundleOffersRoutes = require("./routes/bundleOffers");

const app = express();
app.use(cors()); // lets the app (running on a different address) talk to this server
app.use(express.json()); // lets us read JSON sent from the app

// A simple route to check the server is alive — visit http://localhost:4000/health in a browser
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Know Your Faculty backend is running." });
});

app.use("/auth", authRoutes);
app.use("/admin/auth", adminAuthRoutes);
app.use("/admin", adminRoutes);
app.use("/pricing", pricingRoutes);
app.use("/content", contentRoutes);
app.use("/professors", professorRoutes);
app.use("/discover", discoverRoutes);
app.use("/matches", matchesRoutes);
app.use("/feed", feedRoutes);
app.use("/messages", messagesRoutes);
app.use("/wallet", walletRoutes);
app.use("/opportunities", opportunitiesRoutes);
app.use("/support", supportRoutes);
app.use("/reports", reportsRoutes);
app.use("/blocks", blocksRoutes);
app.use("/sponsored-ads", sponsoredAdsRoutes);
app.use("/verification-requests", verificationRequestsRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/bundle-offers", bundleOffersRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ KYF backend running at http://localhost:${PORT}`);
  console.log(`   Try it: http://localhost:${PORT}/health`);
});
