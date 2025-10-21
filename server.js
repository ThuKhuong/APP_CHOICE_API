// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth"); // route login
const teacherRoutes = require("./routes/teacher"); // route cho GV
const studentRoutes = require("./routes/student"); // route cho SV
const proctorRoutes = require("./routes/proctor"); // route cho giám thị


const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/proctor", proctorRoutes);


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
