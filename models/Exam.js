const pool = require("../db");
const ExamSet = require("./ExamSet");

async function createExam({ subject_id, title, duration, teacher_id }) {
  const result = await pool.query(
    "INSERT INTO exams (subject_id, title, duration) VALUES ($1, $2, $3) RETURNING *",
    [subject_id, title, duration]
  );
  return result.rows[0];
}

async function listExamsByTeacher(teacher_id) {
  const result = await pool.query(
    `SELECT e.*, s.name AS subject_name
     FROM exams e
     JOIN subjects s ON e.subject_id = s.id
     WHERE s.teacher_id = $1
     ORDER BY e.id DESC`,
    [teacher_id]
  );
  return result.rows;
}

async function getExamById(exam_id, teacher_id) {
  const result = await pool.query(
    `SELECT e.*, s.name AS subject_name
     FROM exams e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.id = $1 AND s.teacher_id = $2`,
    [exam_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function getExamSetsByExam(exam_id) {
  return await ExamSet.getExamSetsByExam(exam_id);
}

async function updateExam({ exam_id, teacher_id, title, duration }) {
  const result = await pool.query(
    `UPDATE exams SET title = $1, duration = $2
     WHERE id = $3 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $4)
     RETURNING *`,
    [title, duration, exam_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function deleteExam(exam_id, teacher_id) {
  const result = await pool.query(
    `DELETE FROM exams 
     WHERE id = $1 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $2)
     RETURNING *`,
    [exam_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function generateExamPreview({ subject_id, total_questions, chapter_distribution, teacher_id }) {
  const questions = [];
  const usedQuestionIds = new Set();
    
  // Lấy câu hỏi theo từng chương theo tỉ lệ đã cấu hình
  for (const chapterConfig of chapter_distribution) {
    const { chapter_id, question_count } = chapterConfig;
    
    if (question_count > 0) {
      const result = await pool.query(
        `SELECT q.*, c.name AS chapter_name, c.chapter_number
         FROM questions q
         JOIN chapters c ON q.chapter_id = c.id
         JOIN subjects s ON q.subject_id = s.id
         WHERE q.chapter_id = $1 AND s.teacher_id = $2
         ORDER BY RANDOM()
         LIMIT $3`,
        [chapter_id, teacher_id, question_count]
      );
      
      // Lọc bỏ các câu hỏi đã được sử dụng
      const newQuestions = result.rows.filter(q => !usedQuestionIds.has(q.id));
      questions.push(...newQuestions);
      
      // Thêm vào danh sách đã sử dụng
      newQuestions.forEach(q => usedQuestionIds.add(q.id));
    }
  }
  
  // Nếu số câu hỏi lấy được ít hơn yêu cầu, lấy thêm từ các chương khác
  if (questions.length < total_questions) {
    const remainingCount = total_questions - questions.length;
    const usedIdsArray = Array.from(usedQuestionIds);
    
    const additionalResult = await pool.query(
      `SELECT q.*, c.name AS chapter_name, c.chapter_number
       FROM questions q
       JOIN chapters c ON q.chapter_id = c.id
       JOIN subjects s ON q.subject_id = s.id
       WHERE q.subject_id = $1 AND s.teacher_id = $2
       AND q.id NOT IN (${usedIdsArray.length > 0 ? usedIdsArray.join(',') : '0'})
       ORDER BY RANDOM()
       LIMIT $3`,
      [subject_id, teacher_id, remainingCount]
    );
    
    // Lọc bỏ các câu hỏi đã được sử dụng
    const newQuestions = additionalResult.rows.filter(q => !usedQuestionIds.has(q.id));
    questions.push(...newQuestions);
    
    // Thêm vào danh sách đã sử dụng
    newQuestions.forEach(q => usedQuestionIds.add(q.id));
  }
  
  // Shuffle lại danh sách câu hỏi
  const shuffledQuestions = questions.sort(() => Math.random() - 0.5);
    
  // Kiểm tra nếu không đủ câu hỏi
  if (shuffledQuestions.length < total_questions) {
    console.warn(`Warning: Only found ${shuffledQuestions.length} questions out of ${total_questions} requested`);
  }
  
  // Trả về đúng số câu hỏi yêu cầu
  return shuffledQuestions.slice(0, total_questions);
}

async function assignQuestionsToExam(exam_id, question_ids) {
  try {
    // Tạo exam_set mặc định với code = 1
    const examSet = await ExamSet.createExamSet({ exam_id, code: 1 });
    
    // Gán câu hỏi vào exam_set
    await ExamSet.assignQuestionsToExamSet(examSet.id, question_ids);
    
    return examSet;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  createExam,
  listExamsByTeacher,
  getExamById,
  getExamSetsByExam,
  updateExam,
  deleteExam,
  generateExamPreview,
  assignQuestionsToExam,
};
