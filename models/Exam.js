const pool = require("../db");
const ExamSet = require("./ExamSet");

// ===============================
// Exam Service - Inline Exports
// ===============================

exports.createExam = async ({ subject_id, title, duration, teacher_id }) => {
  const result = await pool.query(
    "INSERT INTO exams (subject_id, title, duration) VALUES ($1, $2, $3) RETURNING *",
    [subject_id, title, duration]
  );
  return result.rows[0];
};

exports.listExamsByTeacher = async (teacher_id) => {
  const result = await pool.query(
    `SELECT e.*, s.name AS subject_name
     FROM exams e
     JOIN subjects s ON e.subject_id = s.id
     WHERE s.teacher_id = $1
     ORDER BY e.id DESC`,
    [teacher_id]
  );
  return result.rows;
};

exports.getExamById = async (exam_id, teacher_id) => {
  const result = await pool.query(
    `SELECT e.*, s.name AS subject_name
     FROM exams e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.id = $1 AND s.teacher_id = $2`,
    [exam_id, teacher_id]
  );
  return result.rows[0] || null;
};

exports.getExamSetsByExam = async (exam_id) => {
  return await ExamSet.getExamSetsByExam(exam_id);
};

exports.updateExam = async ({ exam_id, teacher_id, title, duration }) => {
  const result = await pool.query(
    `UPDATE exams SET title = $1, duration = $2
     WHERE id = $3 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $4)
     RETURNING *`,
    [title, duration, exam_id, teacher_id]
  );
  return result.rows[0] || null;
};

exports.deleteExam = async (exam_id, teacher_id) => {
  const result = await pool.query(
    `DELETE FROM exams 
     WHERE id = $1 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $2)
     RETURNING *`,
    [exam_id, teacher_id]
  );
  return result.rows[0] || null;
};

exports.generateExamPreview = async ({ subject_id, total_questions, chapter_distribution, teacher_id }) => {
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

      const newQuestions = result.rows.filter(q => !usedQuestionIds.has(q.id));
      questions.push(...newQuestions);
      newQuestions.forEach(q => usedQuestionIds.add(q.id));
    }
  }

  // Nếu thiếu câu hỏi, bổ sung thêm từ các chương khác
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

    const newQuestions = additionalResult.rows.filter(q => !usedQuestionIds.has(q.id));
    questions.push(...newQuestions);
    newQuestions.forEach(q => usedQuestionIds.add(q.id));
  }

  // Trộn và cắt đúng số lượng yêu cầu
  const shuffledQuestions = questions.sort(() => Math.random() - 0.5);
  if (shuffledQuestions.length < total_questions) {
    console.warn(`⚠️ Warning: chỉ tìm được ${shuffledQuestions.length}/${total_questions} câu hỏi`);
  }

  return shuffledQuestions.slice(0, total_questions);
};

exports.assignQuestionsToExam = async (exam_id, question_ids) => {
  try {
    // Tạo exam_set mặc định (code = 1)
    const examSet = await ExamSet.createExamSet({ exam_id, code: 1 });

    // Gán câu hỏi vào exam_set
    await ExamSet.assignQuestionsToExamSet(examSet.id, question_ids);

    return examSet;
  } catch (err) {
    throw err;
  }
};
