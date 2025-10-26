const Attempt = require("../models/Attempt");
const Session = require("../models/Session");

exports.startExam = async function(req, res) {
  const { access_code } = req.body;
  const studentId = req.user.id;

  try {
    // Tìm session
    const session = await Session.getSessionByAccessCode(access_code);
    if (!session) {
      return res.status(404).json({ message: "Không tìm thấy ca thi" });
    }

    // Kiểm tra thời gian thi
    const now = new Date();
    const startAt = new Date(session.start_at);
    const endAt = new Date(session.end_at);
    
    if (now < startAt) {
      return res.status(403).json({ message: "Chưa đến giờ làm bài" });
    }
    if (now > endAt) {
      return res.status(403).json({ message: "Ca thi đã kết thúc" });
    }

    // Kiểm tra xem sinh viên đã có attempt chưa
    let attempt = await Attempt.getAttemptBySessionAndStudent(session.id, studentId);
    
    if (!attempt) {
      // Sử dụng Stored Procedure để tạo attempt và gán mã đề ngẫu nhiên
      const pool = require("../db");
      const result = await pool.query(
        'SELECT * FROM sp_start_exam_attempt($1, $2)',
        [session.id, studentId]
      );
      attempt = result.rows[0];
    } else if (attempt.submitted_at) {
      return res.status(403).json({ message: "Bạn đã nộp bài, không thể vào lại ca thi này." });
    }

    res.json({
      message: "Bắt đầu làm bài thành công",
      attempt: {
        id: attempt.id,
        status: attempt.status,
        started_at: attempt.started_at,
        session: {
          id: session.id,
          exam_title: session.exam_title,
          duration: session.duration,
          end_at: session.end_at
        }
      }
    });
  } catch (err) {
    console.error("Lỗi bắt đầu làm bài:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.saveAnswer = async function(req, res) {
  const { attempt_id, question_id, chosen_choice } = req.body;
  const studentId = req.user.id;

  try {
    const answer = await Attempt.saveAnswer({
      attempt_id,
      question_id,
      chosen_choice,
      student_id: studentId
    });

    if (!answer) {
      return res.status(404).json({ message: "Không tìm thấy bài thi" });
    }

    res.json({ message: "Lưu đáp án thành công", answer });
  } catch (err) {
    console.error("Lỗi lưu đáp án:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.removeAnswer = async function(req, res) {
  const { attempt_id, question_id } = req.body;
  const studentId = req.user.id;

  try {
    const result = await Attempt.removeAnswer({
      attempt_id,
      question_id,
      student_id: studentId
    });

    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy đáp án" });
    }

    res.json({ message: "Xóa đáp án thành công" });
  } catch (err) {
    console.error("Lỗi xóa đáp án:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.submitExam = async function(req, res) {
  const { attempt_id } = req.body;
  const studentId = req.user.id;

  try {
    const attempt = await Attempt.submitAttempt(attempt_id, studentId);
    
    if (!attempt) {
      return res.status(404).json({ message: "Không tìm thấy bài thi" });
    }

    // Sử dụng Stored Procedure để tính điểm tự động
    // Trigger sẽ tự động gọi sp_submit_exam_and_calculate_score khi UPDATE status
    const pool = require("../db");
    const result = await pool.query(
      'SELECT sp_submit_exam_and_calculate_score($1) as score',
      [attempt_id]
    );
    
    const finalScore = result.rows[0].score;

    res.json({
      message: "Nộp bài thành công",
      attempt: {
        id: attempt.id,
        status: attempt.status,
        submitted_at: attempt.submitted_at,
        score: finalScore
      }
    });
  } catch (err) {
    console.error("Lỗi nộp bài:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getAttemptDetails = async function(req, res) {
  const { id } = req.params;
  const studentId = req.user.id;

  try {
    const attempt = await Attempt.getAttemptDetails(id, studentId);
    
    if (!attempt) {
      return res.status(404).json({ message: "Không tìm thấy bài thi" });
    }

    res.json(attempt);
  } catch (err) {
    console.error("Lỗi lấy chi tiết bài thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getStudentHistory = async function(req, res) {
  const studentId = req.user.id;

  try {
    const history = await Attempt.getStudentHistory(studentId);
    res.json({ attempts: history });
  } catch (err) {
    console.error("Lỗi lấy lịch sử thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};
