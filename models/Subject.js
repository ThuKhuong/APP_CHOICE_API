const pool = require("../db");

// ===============================
// SUBJECTS
// ===============================

exports.createSubject = async ({ name, teacher_id }) => {
  const result = await pool.query(
    "INSERT INTO subjects (name, teacher_id) VALUES ($1, $2) RETURNING *",
    [name, teacher_id]
  );
  return result.rows[0];
};

exports.isSubjectNameExistForTeacher = async ({ name, teacher_id, exclude_id = null }) => {
  if (exclude_id) {
    const result = await pool.query(
      "SELECT 1 FROM subjects WHERE name = $1 AND teacher_id = $2 AND id <> $3",
      [name, teacher_id, exclude_id]
    );
    return result.rows.length > 0;
  }

  const result = await pool.query(
    "SELECT 1 FROM subjects WHERE name = $1 AND teacher_id = $2",
    [name, teacher_id]
  );
  return result.rows.length > 0;
};

exports.listSubjectsByTeacher = async (teacher_id) => {
  const result = await pool.query(
    "SELECT id, name FROM subjects WHERE teacher_id=$1 ORDER BY id ASC",
    [teacher_id]
  );
  return result.rows;
};

exports.updateSubject = async ({ id, teacher_id, name }) => {
  const result = await pool.query(
    "UPDATE subjects SET name=$1 WHERE id=$2 AND teacher_id=$3 RETURNING *",
    [name, id, teacher_id]
  );
  return result.rows[0] || null;
};

exports.deleteSubject = async ({ id, teacher_id }) => {
  const result = await pool.query(
    "DELETE FROM subjects WHERE id=$1 AND teacher_id=$2 RETURNING *",
    [id, teacher_id]
  );
  return result.rows[0] || null;
};

// ===============================
// CHAPTERS
// ===============================

exports.listChapters = async (subjectId, teacherId) => {
  const result = await pool.query(
    `SELECT c.* FROM chapters c
     JOIN subjects s ON c.subject_id = s.id
     WHERE c.subject_id = $1 AND s.teacher_id = $2
     ORDER BY c.id ASC`,
    [subjectId, teacherId]
  );
  return result.rows;
};

exports.createChapter = async (subjectId, teacherId, { name, chapter_number }) => {
  // Kiểm tra quyền sở hữu môn học
  const owns = await pool.query(
    "SELECT 1 FROM subjects WHERE id=$1 AND teacher_id=$2",
    [subjectId, teacherId]
  );
  if (owns.rows.length === 0) return null;

  const result = await pool.query(
    "INSERT INTO chapters (subject_id, name, chapter_number) VALUES ($1, $2, $3) RETURNING *",
    [subjectId, name, chapter_number]
  );
  return result.rows[0];
};

exports.updateChapter = async (chapterId, teacherId, { name, chapter_number }) => {
  const result = await pool.query(
    `UPDATE chapters SET name=$1, chapter_number=$2
     WHERE id=$3 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id=$4)
     RETURNING *`,
    [name, chapter_number, chapterId, teacherId]
  );
  return result.rows[0] || null;
};

exports.deleteChapter = async (chapterId, teacherId) => {
  const result = await pool.query(
    `DELETE FROM chapters 
     WHERE id=$1 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id=$2)
     RETURNING *`,
    [chapterId, teacherId]
  );
  return result.rows[0] || null;
};
