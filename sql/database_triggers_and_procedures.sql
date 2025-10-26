-- ===============================================
-- DATABASE TRIGGERS VÀ STORED PROCEDURES
-- Cho hệ thống thi trắc nghiệm
-- ===============================================

-- ===============================================
-- PART 1: STORED PROCEDURES
-- ===============================================

-- 1. sp_submit_exam_and_calculate_score
-- Tự động tính điểm khi nộp bài
CREATE OR REPLACE FUNCTION sp_submit_exam_and_calculate_score(p_attempt_id INT)
RETURNS NUMERIC AS $$
DECLARE
  v_total_questions INT;
  v_correct_answers INT := 0;
  v_score NUMERIC;
BEGIN
  -- Đếm tổng số câu hỏi trong exam_set
  SELECT COUNT(*) INTO v_total_questions
  FROM exam_set_questions esq
  JOIN attempts a ON esq.exam_set_id = a.exam_set_id
  WHERE a.id = p_attempt_id;
  
  -- Đếm số câu trả lời đúng
  SELECT COUNT(*) INTO v_correct_answers
  FROM attempt_answers aa
  JOIN answers ans ON aa.answer_id = ans.id
  WHERE aa.attempt_id = p_attempt_id AND ans.is_correct = true;
  
  -- Tính điểm (thang điểm 10)
  IF v_total_questions > 0 THEN
    v_score := ROUND((v_correct_answers::NUMERIC / v_total_questions) * 10, 2);
  ELSE
    v_score := 0;
  END IF;
  
  -- Cập nhật điểm vào attempts
  UPDATE attempts 
  SET score = v_score, 
      submitted_at = NOW(),
      status = 'submitted'
  WHERE id = p_attempt_id;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql;


-- ===============================================
-- 2. sp_start_exam_attempt
-- Tạo bài làm và gán mã đề ngẫu nhiên
CREATE OR REPLACE FUNCTION sp_start_exam_attempt(
  p_session_id INT,
  p_student_id INT
)
RETURNS TABLE(attempt_id INT, exam_set_id INT) AS $$
DECLARE
  v_exam_id INT;
  v_assigned_set_id INT;
  v_new_attempt_id INT;
BEGIN
  -- Lấy exam_id từ session
  SELECT exam_id INTO v_exam_id
  FROM exam_sessions
  WHERE id = p_session_id;
  
  -- Chọn ngẫu nhiên 1 mã đề ít được sử dụng nhất
  WITH set_usage AS (
    SELECT es.id, COUNT(a.id) as usage_count
    FROM exam_sets es
    LEFT JOIN attempts a ON es.id = a.exam_set_id AND a.session_id = p_session_id
    WHERE es.exam_id = v_exam_id
    GROUP BY es.id
    ORDER BY usage_count ASC, RANDOM()
  )
  SELECT id INTO v_assigned_set_id
  FROM set_usage
  LIMIT 1;
  
  -- Tạo attempt mới
  INSERT INTO attempts (session_id, exam_set_id, student_id, started_at, status)
  VALUES (p_session_id, v_assigned_set_id, p_student_id, NOW(), 'in_progress')
  RETURNING id INTO v_new_attempt_id;
  
  RETURN QUERY SELECT v_new_attempt_id, v_assigned_set_id;
END;
$$ LANGUAGE plpgsql;


-- ===============================================
-- 3. sp_lock_attempt_for_violation
-- Khóa bài thi do vi phạm
CREATE OR REPLACE FUNCTION sp_lock_attempt_for_violation(
  p_attempt_id INT,
  p_violation_type VARCHAR,
  p_description TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Ghi log vi phạm
  INSERT INTO exam_violation_logs (attempt_id, type, description)
  VALUES (p_attempt_id, p_violation_type, p_description);
  
  -- Khóa bài thi
  UPDATE attempts 
  SET status = 'locked', 
      submitted_at = NOW()
  WHERE id = p_attempt_id;
  
  -- Tính điểm dựa trên câu đã trả lời
  PERFORM sp_submit_exam_and_calculate_score(p_attempt_id);
END;
$$ LANGUAGE plpgsql;


-- ===============================================
-- 4. sp_get_exam_statistics
-- Lấy thống kê ca thi
CREATE OR REPLACE FUNCTION sp_get_exam_statistics(p_session_id INT)
RETURNS TABLE(
  total_students BIGINT,
  submitted_count BIGINT,
  in_progress_count BIGINT,
  locked_count BIGINT,
  violations_count BIGINT,
  avg_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT a.id) as total_students,
    COUNT(DISTINCT CASE WHEN a.status = 'submitted' THEN a.id END) as submitted_count,
    COUNT(DISTINCT CASE WHEN a.status = 'in_progress' THEN a.id END) as in_progress_count,
    COUNT(DISTINCT CASE WHEN a.status = 'locked' THEN a.id END) as locked_count,
    (SELECT COUNT(*) 
     FROM exam_violation_logs 
     WHERE attempt_id IN (SELECT id FROM attempts WHERE session_id = p_session_id)) as violations_count,
    ROUND(AVG(a.score), 2) as avg_score
  FROM attempts a
  WHERE a.session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;


-- ===============================================
-- 5. sp_get_student_result_detail
-- Lấy chi tiết kết quả thi
CREATE OR REPLACE FUNCTION sp_get_student_result_detail(p_attempt_id INT)
RETURNS TABLE(
  question_id INT,
  question_content TEXT,
  student_answer TEXT,
  correct_answer TEXT,
  is_correct BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id as question_id,
    q.content as question_content,
    COALESCE(ans_student.content, 'Chưa trả lời') as student_answer,
    ans_correct.content as correct_answer,
    COALESCE((SELECT is_correct FROM answers WHERE id = aa.answer_id), false) as is_correct
  FROM exam_set_questions esq
  JOIN attempts a ON esq.exam_set_id = a.exam_set_id
  JOIN questions q ON esq.question_id = q.id
  LEFT JOIN attempt_answers aa ON q.id = aa.question_id AND aa.attempt_id = p_attempt_id
  LEFT JOIN answers ans_student ON aa.answer_id = ans_student.id
  LEFT JOIN answers ans_correct ON q.id = ans_correct.question_id AND ans_correct.is_correct = true
  WHERE a.id = p_attempt_id
  ORDER BY esq.order_index;
END;
$$ LANGUAGE plpgsql;


-- ===============================================
-- PART 2: TRIGGERS
-- ===============================================

-- 1. trigger_auto_generate_access_code
-- Tự động sinh mã truy cập khi tạo ca thi mới
CREATE OR REPLACE FUNCTION fn_generate_access_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.access_code IS NULL OR NEW.access_code = '' THEN
    NEW.access_code := UPPER(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_access_code
  BEFORE INSERT ON exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION fn_generate_access_code();


-- 2. trigger_prevent_duplicate_assignment
-- Ngăn phân công trùng giám thị
CREATE OR REPLACE FUNCTION fn_prevent_duplicate_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM proctor_assignments 
    WHERE session_id = NEW.session_id 
    AND proctor_id = NEW.proctor_id
  ) THEN
    RAISE EXCEPTION 'Giám thị đã được phân công cho ca thi này';
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_duplicate_assignment
  BEFORE INSERT ON proctor_assignments
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_duplicate_assignment();


-- 3. trigger_validate_exam_set_questions
-- Đảm bảo mỗi câu hỏi có ít nhất 1 đáp án đúng
CREATE OR REPLACE FUNCTION fn_validate_exam_set_questions()
RETURNS TRIGGER AS $$
DECLARE
  v_correct_count INT;
BEGIN
  SELECT COUNT(*) INTO v_correct_count
  FROM answers
  WHERE question_id = NEW.question_id AND is_correct = true;
  
  IF v_correct_count = 0 THEN
    RAISE EXCEPTION 'Câu hỏi phải có ít nhất 1 đáp án đúng';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_exam_set_questions
  AFTER INSERT ON exam_set_questions
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_exam_set_questions();


-- 4. trigger_auto_update_submitted_at
-- Tự động cập nhật submitted_at khi status chuyển thành 'submitted' hoặc 'locked'
CREATE OR REPLACE FUNCTION fn_auto_update_submitted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('submitted', 'locked') AND OLD.status != NEW.status THEN
    IF NEW.submitted_at IS NULL THEN
      NEW.submitted_at := NOW();
    END IF;
    
    -- Tự động tính điểm
    PERFORM sp_submit_exam_and_calculate_score(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_update_submitted_at
  BEFORE UPDATE ON attempts
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 1)
  EXECUTE FUNCTION fn_auto_update_submitted_at();


-- 5. trigger_log_attempt_answers_updated_at
-- Tự động cập nhật updated_at khi thay đổi câu trả lời
CREATE OR REPLACE FUNCTION fn_update_attempt_answer_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_attempt_answers_updated_at
  BEFORE INSERT OR UPDATE ON attempt_answers
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_attempt_answer_timestamp();


-- ===============================================
-- PART 3: HELPER FUNCTIONS
-- ===============================================

-- Kiểm tra xem có đủ câu hỏi cho tỉ lệ chương không
CREATE OR REPLACE FUNCTION fn_check_enough_questions(
  p_subject_id INT,
  p_total_questions INT,
  p_chapter_ratios JSON
)
RETURNS BOOLEAN AS $$
DECLARE
  chapter_item JSON;
  chapter_id_val INT;
  required_count INT;
  available_count INT;
BEGIN
  FOR chapter_item IN SELECT * FROM json_array_elements(p_chapter_ratios)
  LOOP
    chapter_id_val := (chapter_item->>'chapter_id')::INT;
    required_count := ((chapter_item->>'ratio')::NUMERIC * p_total_questions)::INT;
    
    SELECT COUNT(*) INTO available_count
    FROM questions
    WHERE subject_id = p_subject_id 
    AND (chapter_id IS NULL OR chapter_id = chapter_id_val);
    
    IF available_count < required_count THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ===============================================
-- DROP CÁC TRIGGERS / FUNCTIONS CŨ (nếu cần làm mới)
-- ===============================================
-- DROP TRIGGER IF EXISTS trigger_auto_generate_access_code ON exam_sessions;
-- DROP FUNCTION IF EXISTS fn_generate_access_code();
-- DROP TRIGGER IF EXISTS trigger_auto_update_submitted_at ON attempts;
-- DROP FUNCTION IF EXISTS fn_auto_update_submitted_at();
-- DROP TRIGGER IF EXISTS trigger_validate_exam_set_questions ON exam_set_questions;
-- DROP FUNCTION IF EXISTS fn_validate_exam_set_questions();
-- DROP TRIGGER IF EXISTS trigger_log_attempt_answers_updated_at ON attempt_answers;
-- DROP FUNCTION IF EXISTS fn_update_attempt_answer_timestamp();

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation 
-- FROM information_schema.triggers 
-- WHERE event_object_schema = 'public';
--
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public'
-- ORDER BY routine_name;
