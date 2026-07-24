// This is the file that actually starts the server. Run it with: npm run dev
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const professorRoutes = require("./routes/professors");
const discoverRoutes = require("./routes/discover");
const matchesRoutes = require("./routes/matches");
const feedRoutes = require("./routes/feed");

const app = express();
app.use(cors()); // lets the app (running on a different address) talk to this server
app.use(express.json()); // lets us read JSON sent from the app

// A simple route to check the server is alive — visit http://localhost:4000/health in a browser
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Know Your Faculty backend is running." });
});

app.use("/auth", authRoutes);
app.use("/professors", professorRoutes);
app.use("/discover", discoverRoutes);
app.use("/matches", matchesRoutes);
app.use("/feed", feedRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ KYF backend running at http://localhost:${PORT}`);
  console.log(`   Try it: http://localhost:${PORT}/health`);
});
