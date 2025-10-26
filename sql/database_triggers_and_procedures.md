# Database Triggers và Stored Procedures cho Hệ Thống Thi Trắc Nghiệm

## 📋 TÓM TẮT YÊU CẦU

Theo phân tích dự án, hệ thống cần:
- ✅ Quản lý người dùng với multi-role
- ✅ Theo dõi ca thi real-time
- ✅ Tự động chấm điểm khi nộp bài
- ✅ Log vi phạm tự động
- ✅ Tự động cập nhật trạng thái ca thi
- ✅ Tự động sinh mã ca thi
- ✅ Kiểm tra tính hợp lệ dữ liệu

---

## 🔥 DANH SÁCH TRIGGERS CẦN THIẾT NHẤT

### 1. ✅ **trigger_auto_update_session_status** 
**Mục đích:** Tự động cập nhật trạng thái ca thi dựa trên thời gian
```sql
-- Trigger này sẽ tự động chuyển ca thi từ 'scheduled' → 'open' khi đến giờ bắt đầu
-- và từ 'open' → 'closed' khi hết giờ
```

### 2. ✅ **trigger_validate_answer_before_insert**
**Mục đích:** Kiểm tra tối thiểu 1 đáp án đúng khi tạo câu hỏi
```sql
-- Trước khi thêm câu hỏi mới, trigger kiểm tra có ít nhất 1 đáp án đúng
```

### 3. ✅ **trigger_auto_score_on_submit**
**Mục đích:** Tự động chấm điểm khi thí sinh nộp bài
```sql
-- Khi submitted_at được cập nhật, tự động tính điểm và lưu vào attempts.score
```

### 4. ✅ **trigger_prevent_duplicate_assignment**
**Mục đích:** Ngăn phân công trùng giám thị cho cùng 1 ca thi
```sql
-- Đảm bảo mỗi giám thị chỉ được phân công 1 lần cho 1 ca thi
```

### 5. ✅ **trigger_log_violation_on_tab_out**
**Mục đích:** Tự động log khi phát hiện thí sinh vi phạm
```sql
-- Khi có sự kiện vi phạm (tab_out, time_exceeded), tự động ghi vào exam_violation_logs
```

### 6. ✅ **trigger_set_attempt_status_on_lock**
**Mục đích:** Tự động chuyển trạng thái bài thi khi bị khóa
```sql
-- Khi giám thị khóa bài thi, tự động set status = 'locked'
```

### 7. ✅ **trigger_auto_generate_access_code**
**Mục đích:** Tự động sinh mã truy cập khi tạo ca thi mới
```sql
-- Khi tạo exam_sessions mới, tự động tạo access_code ngẫu nhiên
```

### 8. ✅ **trigger_prevent_delete_exam_with_sessions**
**Mục đích:** Ngăn xóa đề thi đang có ca thi
```sql
-- Không cho phép xóa đề thi nếu đã có ca thi được tạo từ đề thi đó
```

---

## 🔧 DANH SÁCH STORED PROCEDURES CẦN THIẾT NHẤT

### 1. ✅ **sp_create_exam_with_shuffle** 
**Mục đích:** Tạo đề thi với trộn câu hỏi ngẫu nhiên theo tỉ lệ chương
```sql
-- Parameters: 
--   - subject_id
--   - title
--   - duration
--   - total_questions
--   - chapter_ratios (JSON)
-- Trả về: exam_id và list exam_set_ids
```

### 2. ✅ **sp_start_exam_attempt**
**Mục đích:** Khởi tạo bài làm và gán mã đề ngẫu nhiên
```sql
-- Parameters: session_id, student_id
-- Trả về: attempt_id và exam_set_id
```

### 3. ✅ **sp_submit_exam_and_calculate_score**
**Mục đích:** Nộp bài và tự động tính điểm
```sql
-- Parameters: attempt_id
-- Tính điểm dựa trên số câu đúng / tổng số câu
-- Trả về: score
```

### 4. ✅ **sp_get_exam_statistics**
**Mục đích:** Lấy thống kê cho ca thi (cho giám thị)
```sql
-- Parameters: session_id
-- Trả về: 
--   - Tổng số thí sinh
--   - Số thí sinh đã nộp
--   - Số vi phạm
```

### 5. ✅ **sp_get_student_result_detail**
**Mục đích:** Lấy chi tiết kết quả thi của sinh viên
```sql
-- Parameters: attempt_id
-- Trả về: 
--   - Danh sách câu hỏi và đáp án đã chọn
--   - Đáp án đúng
--   - Điểm từng câu
```

### 6. ✅ **sp_check_enough_questions_by_chapter**
**Mục đích:** Kiểm tra số lượng câu hỏi đủ cho tỉ lệ chương
```sql
-- Parameters: subject_id, chapter_ratios (JSON)
-- Trả về: TRUE/FALSE
```

### 7. ✅ **sp_lock_attempt_for_violation**
**Mục đích:** Khóa bài thi và chấm điểm dựa trên đáp án hiện tại
```sql
-- Parameters: attempt_id, violation_type, description
```

### 8. ✅ **sp_resolve_issue_report**
**Mục đích:** Xử lý báo cáo lỗi câu hỏi và cập nhật điểm
```sql
-- Parameters: issue_report_id, action ('disable', 'replace', 'edit')
```

---

## 📝 HƯỚNG DẪN CÀI ĐẶT

### **Bước 1: Tạo file SQL**
Tạo file `database_setup.sql` trong thư mục `APP_CHOICE_API/sql/`

### **Bước 2: Chạy các lệnh SQL**
Kết nối vào PostgreSQL và chạy:

```bash
psql -U postgres -d multiple_choice -f APP_CHOICE_API/sql/database_setup.sql
```

### **Bước 3: Kiểm tra**
Chạy các lệnh sau để verify:

```sql
-- Kiểm tra triggers đã tạo
SELECT trigger_name, event_object_table, action_timing, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_schema = 'public';

-- Kiểm tra functions/procedures đã tạo
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public';
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Backup database** trước khi chạy SQL
2. **Test triggers** trên môi trường development trước
3. **Monitor performance** sau khi thêm triggers/procedures
4. **Document** mọi trigger/procedure tạo thêm
5. **Permissions**: Đảm bảo user database có quyền CREATE TRIGGER và CREATE FUNCTION

---

## 🎯 TRIGGERS VÀ PROCEDURES ĐÃ SẴN CÓ

Theo phân tích yêu cầu, hệ thống hiện tại **CHƯA CÓ** triggers và stored procedures được implement.

## 📌 ƯU TIÊN THỰC HIỆN

### **Ưu tiên CAO:**
1. ✅ `trigger_auto_update_session_status` - Quan trọng cho logic ca thi
2. ✅ `sp_submit_exam_and_calculate_score` - Quan trọng cho chấm điểm
3. ✅ `sp_start_exam_attempt` - Quan trọng cho khởi tạo bài thi

### **Ưu tiên TRUNG BÌNH:**
4. ✅ `trigger_auto_generate_access_code` - Tiện lợi khi tạo ca thi
5. ✅ `trigger_prevent_duplicate_assignment` - Tránh lỗi logic

### **Ưu tiên THẤP:**
6. ✅ `sp_get_exam_statistics` - Tính năng bổ sung
7. ✅ Các triggers/procedures khác

