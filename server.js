require("dotenv").config();

const app = require("./src/app");

const PORT = process.env.PORT || 3001;

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

// Fixed: Correctly binding keepAliveTimeout to the server instance
server.keepAliveTimeout = 65000; // must exceed OLS's 60s pcKeepAliveTimeout
server.headersTimeout = 66000;   // must exceed keepAliveTimeout