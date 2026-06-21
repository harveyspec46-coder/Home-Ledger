require('dotenv').config();
const app = require('./api/index.js');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  if (!process.env.MONGODB_URI) {
    console.warn("WARNING: MONGODB_URI is not set in .env — requests will fail until it is.");
  }
});
