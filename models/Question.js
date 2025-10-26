const pool = require("../db");

exports.createQuestion = async ({ subject_id, chapter_id, content, answers, teacher_id }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const questionResult = await client.query(
      `INSERT INTO questions (subject_id, chapter_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [subject_id, chapter_id, content]
    );
    const questionId = questionResult.rows[0].id;

    for (let i = 0; i < answers.length; i++) {
      const label = String.fromCharCode(65 + i);
      await client.query(
        `INSERT INTO answers (question_id, label, content, is_correct) VALUES ($1, $2, $3, $4)`,
        [questionId, label, answers[i].content, answers[i].is_correct || false]
      );
    }

    await client.query("COMMIT");
    return questionResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

exports.listQuestionsByTeacher = async (teacher_id) => {
  const result = await pool.query(
    `SELECT q.*, s.name AS subject_name, c.name AS chapter_name, c.id AS chapter_id,
            json_agg(
              json_build_object(
                'label', a.label,
                'content', a.content,
                'is_correct', a.is_correct
              ) ORDER BY a.label
            ) AS answers
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     LEFT JOIN answers a ON q.id = a.question_id
     WHERE s.teacher_id = $1
     GROUP BY q.id, s.name, c.name, c.id
     ORDER BY q.id DESC`,
    [teacher_id]
  );
  return result.rows;
};

exports.getQuestionsBySubject = async (subject_id, teacher_id) => {
  const result = await pool.query(
    `SELECT q.*, c.name AS chapter_name,
            json_agg(
              json_build_object(
                'label', a.label,
                'content', a.content,
                'is_correct', a.is_correct
              ) ORDER BY a.label
            ) AS answers
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     LEFT JOIN answers a ON q.id = a.question_id
     WHERE q.subject_id = $1 AND s.teacher_id = $2
     GROUP BY q.id, c.name
     ORDER BY q.id ASC`,
    [subject_id, teacher_id]
  );
  return result.rows;
};

exports.getQuestionsByChapter = async (chapter_id, teacher_id) => {
  const result = await pool.query(
    `SELECT q.*, c.name AS chapter_name, s.name AS subject_name,
            json_agg(
              json_build_object(
                'label', a.label,
                'content', a.content,
                'is_correct', a.is_correct
              ) ORDER BY a.label
            ) AS answers
     FROM questions q 
     JOIN chapters c ON q.chapter_id = c.id
     JOIN subjects s ON q.subject_id = s.id
     LEFT JOIN answers a ON q.id = a.question_id
     WHERE q.chapter_id = $1 AND s.teacher_id = $2
     GROUP BY q.id, c.name, s.name
     ORDER BY q.id ASC`,
    [chapter_id, teacher_id]
  );
  return result.rows;
};

exports.getQuestionById = async (question_id, teacher_id) => {
  const result = await pool.query(
    `SELECT q.*, s.name AS subject_name, c.name AS chapter_name,
            json_agg(
              json_build_object(
                'label', a.label,
                'content', a.content,
                'is_correct', a.is_correct
              ) ORDER BY a.label
            ) AS answers
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     LEFT JOIN answers a ON q.id = a.question_id
     WHERE q.id = $1 AND s.teacher_id = $2
     GROUP BY q.id, s.name, c.name`,
    [question_id, teacher_id]
  );
  return result.rows[0] || null;
};

exports.updateQuestion = async ({ question_id, teacher_id, content, answers }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("UPDATE questions SET content = $1 WHERE id = $2", [content, question_id]);
    await client.query("DELETE FROM answers WHERE question_id = $1", [question_id]);

    for (let i = 0; i < answers.length; i++) {
      const label = String.fromCharCode(65 + i);
      await client.query(
        `INSERT INTO answers (question_id, label, content, is_correct) VALUES ($1, $2, $3, $4)`,
        [question_id, label, answers[i].content, answers[i].is_correct || false]
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
};

exports.deleteQuestion = async (question_id, teacher_id) => {
  const result = await pool.query(
    `DELETE FROM questions 
     WHERE id = $1 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $2)
     RETURNING *`,
    [question_id, teacher_id]
  );
  return result.rows[0] || null;
};

exports.getQuestionStats = async (subject_id, teacher_id) => {
  const result = await pool.query(
    `SELECT 
       COUNT(*) as total_questions,
       COUNT(CASE WHEN chapter_id IS NOT NULL THEN 1 END) as questions_with_chapter,
       COUNT(CASE WHEN chapter_id IS NULL THEN 1 END) as questions_without_chapter
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     WHERE q.subject_id = $1 AND s.teacher_id = $2`,
    [subject_id, teacher_id]
  );
  return result.rows[0];
};
