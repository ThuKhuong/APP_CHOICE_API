// db.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "multiple_choice",
  password: process.env.DB_PASSWORD || "",
  port: process.env.DB_PORT || 5432,
});

// test kết nối
pool
  .connect()
  .then((client) => {
    console.log("Kết nối PostgreSQL thành công!");
    client.release();
  })
  .catch((err) => {
    console.error("Lỗi kết nối DB:", err.message);
  });

module.exports = pool;
