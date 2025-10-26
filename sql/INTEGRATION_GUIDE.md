# TÍCH HỢP TRIGGERS & PROCEDURES

##  CÁC THAY ĐỔI ĐÃ THỰC HIỆN

### **1. Controllers - StudentController** 

#### **File:** `controllers/studentController.js`

**Thay đổi 1: Sử dụng `sp_start_exam_attempt` trong `startExam()`**
```javascript
// TRƯỚC
attempt = await Attempt.createAttempt({ session_id: session.id, student_id: studentId });

// SAU (dùng stored procedure)
const pool = require("../db");
const result = await pool.query(
  'SELECT * FROM sp_start_exam_attempt($1, $2)',
  [session.id, studentId]
);
attempt = result.rows[0];
```

**Thay đổi 2: Sử dụng `sp_submit_exam_and_calculate_score` trong `submitExam()`**
```javascript
// TRƯỚC
const attempt = await Attempt.submitAttempt(attempt_id, studentId);
// Không có logic tính điểm

// SAU (dùng stored procedure)
const attempt = await Attempt.submitAttempt(attempt_id, studentId);
const pool = require("../db");
const result = await pool.query(
  'SELECT sp_submit_exam_and_calculate_score($1) as score',
  [attempt_id]
);
const finalScore = result.rows[0].score;
```

---

### **2. Controllers - TeacherController** 

#### **File:** `controllers/teacherController.js`

**Thay đổi: Sử dụng trigger `trigger_auto_generate_access_code` trong `createSession()`**
```javascript
// TRƯỚC
const finalAccessCode = access_code ? access_code : Math.random().toString(36).substring(2, 8).toUpperCase();

// SAU (dùng trigger)
const finalAccessCode = access_code ? access_code : null; // Trigger sẽ tự động sinh
```

---

### **3. Controllers - ProctorController** 

#### **File:** `controllers/proctorController.js`

**Thay đổi: Sử dụng `sp_lock_attempt_for_violation` trong `lockAttempt()`**
```javascript
// TRƯỚC
const result = await ProctorAssignment.lockAttempt(attemptId, proctorId, reason);
// Không có logic tính điểm

// SAU (dùng stored procedure)
const result = await ProctorAssignment.lockAttempt(attemptId, proctorId, reason);
await pool.query(
  'SELECT sp_lock_attempt_for_violation($1, $2, $3)',
  [attemptId, violation_type, reason]
);
```

---

### **4. Models - Session.js** 

#### **File:** `models/Session.js`

**Thay đổi: Hỗ trợ trigger `trigger_auto_generate_access_code`**
```javascript
// TRƯỚC
const result = await pool.query(
  `INSERT INTO exam_sessions (exam_id, start_at, end_at, access_code)
   VALUES ($1, $2, $3, $4) RETURNING *`,
  [exam_id, start_at, end_at, access_code]
);

// SAU
const result = await pool.query(
  `INSERT INTO exam_sessions (exam_id, start_at, end_at, access_code)
   VALUES ($1, $2, $3, $4) RETURNING *`,
  [exam_id, start_at, end_at, access_code || null] // Cho trigger xử lý
);
```

---

### **5. Models - New File: Statistic.js** 

#### **File:** `models/Statistic.js` (NEW)

File mới chứa các function gọi stored procedures:
```javascript
async function getExamStatistics(sessionId) {
  const result = await pool.query(
    'SELECT * FROM sp_get_exam_statistics($1)',
    [sessionId]
  );
  return result.rows[0];
}

async function getStudentResultDetail(attemptId) {
  const result = await pool.query(
    'SELECT * FROM sp_get_student_result_detail($1)',
    [attemptId]
  );
  return result.rows;
}
```

---

## 📊 TÓM TẮT CÁC TRIGGERS VÀ PROCEDURES ĐÃ TÍCH HỢP

| # | Trigger/Procedure | Nơi sử dụng | Chức năng |
|---|-------------------|-------------|-----------|
| 1 | `sp_submit_exam_and_calculate_score` | `studentController.js` | Tự động tính điểm khi nộp bài |
| 2 | `sp_start_exam_attempt` | `studentController.js` | Tạo attempt và gán mã đề ngẫu nhiên |
| 3 | `trigger_auto_generate_access_code` | `teacherController.js` | Tự động sinh mã ca thi |
| 4 | `sp_lock_attempt_for_violation` | `proctorController.js` | Khóa bài thi và tính điểm vi phạm |
| 5 | `trigger_auto_update_submitted_at` | `Auto` | Tự động cập nhật timestamp và tính điểm |

---
## 📝 CÁCH HOẠT ĐỘNG

### **Flow 1: Sinh viên bắt đầu làm bài**

1. Sinh viên gọi API `/student/start`
2. Controller gọi `sp_start_exam_attempt`
3. Procedure:
   - Chọn ngẫu nhiên mã đề (ưu tiên mã đề ít dùng)
   - Tạo `attempts` mới với `status = 'in_progress'`
   - Trả về `attempt_id` và `exam_set_id`

### **Flow 2: Sinh viên nộp bài**

1. Sinh viên gọi API `/student/submit`
2. Controller gọi `Attempt.submitAttempt()` → Set `status = 'submitted'`
3. **Trigger `trigger_auto_update_submitted_at`**:
   - Tự động set `submitted_at = NOW()`
   - Gọi `sp_submit_exam_and_calculate_score()`
   - Tính điểm và cập nhật `attempts.score`
4. Controller trả về kết quả với điểm số

### **Flow 3: Tạo ca thi**

1. Giáo viên gọi API `/teacher/sessions` (POST)
2. Controller gọi `Session.createSession()` với `access_code = null`
3. **Trigger `trigger_auto_generate_access_code`**:
   - Nếu `access_code IS NULL` hoặc rỗng
   - Tự động sinh mã 6 ký tự: `UPPER(substring(md5(random()), 1, 6))`
4. Trả về ca thi với `access_code` đã sinh

### **Flow 4: Giám thị khóa bài thi**

1. Giám thị gọi API `/proctor/attempts/:attemptId/lock`
2. Controller kiểm tra quyền → gọi `ProctorAssignment.lockAttempt()`
3. Controller gọi `sp_lock_attempt_for_violation`:
   - Ghi log vi phạm vào `exam_violation_logs`
   - Set `status = 'locked'` và `submitted_at = NOW()`
   - Gọi `sp_submit_exam_and_calculate_score()` để tính điểm
4. Trả về kết quả với bài thi đã bị khóa

---

## 🔧 TROUBLESHOOTING

### **Lỗi: "function sp_submit_exam_and_calculate_score does not exist"**
```bash
# Chạy lại file SQL
psql -U postgres -d multiple_choice -f sql/database_triggers_and_procedures.sql
```

### **Lỗi: "trigger trigger_auto_generate_access_code does not exist"**
```bash
# Recreate trigger
psql -U postgres -d multiple_choice -c "
CREATE TRIGGER trigger_auto_generate_access_code
  BEFORE INSERT ON exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION fn_generate_access_code();
"
```

### **Lỗi: Permission denied**
```sql
-- Grant permissions
GRANT EXECUTE ON FUNCTION sp_submit_exam_and_calculate_score TO postgres;
GRANT EXECUTE ON FUNCTION sp_start_exam_attempt TO postgres;
GRANT EXECUTE ON FUNCTION sp_lock_attempt_for_violation TO postgres;
```
---

## 📚 TÀI LIỆU THAM KHẢO

- Chi tiết SQL: `sql/database_triggers_and_procedures.sql`
- Tổng quan: `database_triggers_and_procedures.md`
- Quick Start: `QUICK_START_TRIGGERS.md`


