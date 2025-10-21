// db.js
const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres", // user DB của bạn
  host: "localhost", // thường là localhost
  database: "multiple_choice", // tên DB bạn tạo
  password: "", // mật khẩu
  port: 5432, // cổng mặc định PostgreSQL
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
