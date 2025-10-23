const pool = require("../db");

async function createExamSet({ exam_id, code = 1 }) {
  const result = await pool.query(
    `INSERT INTO exam_sets (exam_id, code, created_at) 
     VALUES ($1, $2, NOW()) 
     RETURNING *`,
    [exam_id, code]
  );
  return result.rows[0];
}

async function getExamSetsByExam(exam_id) {
  const result = await pool.query(
    `SELECT es.*, COUNT(esq.question_id) as question_count
     FROM exam_sets es
     LEFT JOIN exam_set_questions esq ON es.id = esq.exam_set_id
     WHERE es.exam_id = $1
     GROUP BY es.id
     ORDER BY es.code`,
    [exam_id]
  );
  return result.rows;
}

async function getExamSetById(exam_set_id) {
  const result = await pool.query(
    `SELECT es.*, e.title as exam_title, s.name as subject_name
     FROM exam_sets es
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE es.id = $1`,
    [exam_set_id]
  );
  return result.rows[0] || null;
}

async function deleteExamSet(exam_set_id) {
  const result = await pool.query(
    `DELETE FROM exam_sets WHERE id = $1 RETURNING *`,
    [exam_set_id]
  );
  return result.rows[0] || null;
}

async function assignQuestionsToExamSet(exam_set_id, question_ids) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Xóa câu hỏi cũ
    await client.query("DELETE FROM exam_set_questions WHERE exam_set_id = $1", [exam_set_id]);
    
    // Thêm câu hỏi mới với order_index
    for (let i = 0; i < question_ids.length; i++) {
      await client.query(
        `INSERT INTO exam_set_questions (exam_set_id, question_id, order_index) 
         VALUES ($1, $2, $3)`,
        [exam_set_id, question_ids[i], i + 1]
      );
    }
    
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getExamSetQuestions(exam_set_id) {
  const result = await pool.query(
    `SELECT 
       q.*, 
       a.label, 
       a.content as answer_content, 
       a.is_correct,
       c.name as chapter_name,
       c.chapter_number
     FROM exam_set_questions esq
     JOIN questions q ON esq.question_id = q.id
     LEFT JOIN answers a ON q.id = a.question_id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     WHERE esq.exam_set_id = $1
     ORDER BY esq.order_index, a.label`,
    [exam_set_id]
  );
  return result.rows;
}

async function checkOriginalExamSetExists(exam_id) {
  const result = await pool.query(
    `SELECT id FROM exam_sets WHERE exam_id = $1 AND code = 1`,
    [exam_id]
  );
  return result.rows.length > 0;
}

async function getOriginalExamSetQuestions(exam_id) {
  const result = await pool.query(
    `SELECT q.*, c.name as chapter_name
     FROM exam_set_questions esq
     JOIN questions q ON esq.question_id = q.id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     JOIN exam_sets es ON esq.exam_set_id = es.id
     WHERE es.exam_id = $1 AND es.code = 1
     ORDER BY esq.order_index`,
    [exam_id]
  );
  return result.rows;
}

async function getMaxCodeByExam(exam_id) {
  const result = await pool.query(
    `SELECT COALESCE(MAX(code), 0) as max_code FROM exam_sets WHERE exam_id = $1`,
    [exam_id]
  );
  return result.rows[0].max_code;
}

async function createShuffledExamSets(exam_id, count, originalQuestions) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const maxCode = await getMaxCodeByExam(exam_id);
    const createdSets = [];
    
    for (let i = 1; i <= count; i++) {
      const newCode = maxCode + i;
      
      // Tạo exam_set mới
      const examSetResult = await client.query(
        `INSERT INTO exam_sets (exam_id, code, created_at) 
         VALUES ($1, $2, NOW()) RETURNING id`,
        [exam_id, newCode]
      );
      
      const examSetId = examSetResult.rows[0].id;
      
      // Trộn câu hỏi
      const shuffledQuestions = [...originalQuestions].sort(() => Math.random() - 0.5);
      
      // Thêm câu hỏi vào bộ đề
      for (let j = 0; j < shuffledQuestions.length; j++) {
        await client.query(
          `INSERT INTO exam_set_questions (exam_set_id, question_id, order_index) 
           VALUES ($1, $2, $3)`,
          [examSetId, shuffledQuestions[j].id, j + 1]
        );
      }
      
      createdSets.push({ id: examSetId, code: newCode });
    }
    
    await client.query("COMMIT");
    return createdSets;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createExamSet,
  getExamSetsByExam,
  getExamSetById,
  deleteExamSet,
  assignQuestionsToExamSet,
  getExamSetQuestions,
  checkOriginalExamSetExists,
  getOriginalExamSetQuestions,
  getMaxCodeByExam,
  createShuffledExamSets,
};
