export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Teacher-Key"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname === "/api/submit-result" && request.method === "POST") {
        return await submitResult(request, env, corsHeaders);
      }

      if (url.pathname === "/api/students" && request.method === "GET") {
        return await requireTeacher(request, env, corsHeaders, () => listStudents(env, corsHeaders));
      }

      if (url.pathname === "/api/student-report" && request.method === "GET") {
        return await requireTeacher(request, env, corsHeaders, () => studentReport(url, env, corsHeaders));
      }

      if (url.pathname === "/api/class-overview" && request.method === "GET") {
        return await requireTeacher(request, env, corsHeaders, () => classOverview(url, env, corsHeaders));
      }

      return json({ ok: false, error: "Not found" }, 404, corsHeaders);
    } catch (err) {
      return json({ ok: false, error: err.message || "Server error" }, 500, corsHeaders);
    }
  }
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function requireTeacher(request, env, corsHeaders, fn) {
  const sent = request.headers.get("X-Teacher-Key") || "";
  const expected = env.TEACHER_KEY || "";
  if (!expected || sent !== expected) {
    return json({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
  }
  return await fn();
}

function masteryStatus(pct) {
  if (pct >= 85) return "STRONG";
  if (pct >= 70) return "DEVELOPING";
  if (pct >= 50) return "WEAK";
  return "CRITICAL";
}

async function submitResult(request, env, corsHeaders) {
  const body = await request.json();

  const required = [
    "student_code","student_name","module_code","module_title",
    "score","total_questions","percentage"
  ];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      return json({ ok:false, error:`Missing field: ${key}` }, 400, corsHeaders);
    }
  }

  const studentCode = String(body.student_code).trim();
  const studentName = String(body.student_name).trim();
  const className = String(body.class_name || "").trim();
  const pct = Number(body.percentage);
  const mastery = masteryStatus(pct);

  await env.DB.prepare(`
    INSERT INTO students (student_code, student_name, class_name, updated_at)
    VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
    ON CONFLICT(student_code) DO UPDATE SET
      student_name=excluded.student_name,
      class_name=excluded.class_name,
      updated_at=CURRENT_TIMESTAMP
  `).bind(studentCode, studentName, className).run();

  const attemptResult = await env.DB.prepare(`
    INSERT INTO attempts (
      student_code, student_name, class_name,
      module_code, module_title, score, total_questions,
      percentage, mastery_status, correction_completed, correction_score
    )
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
  `).bind(
    studentCode,
    studentName,
    className,
    String(body.module_code),
    String(body.module_title),
    Number(body.score),
    Number(body.total_questions),
    pct,
    mastery,
    body.correction_completed ? 1 : 0,
    body.correction_score ?? null
  ).run();

  const attemptId = attemptResult.meta.last_row_id;
  const details = Array.isArray(body.question_results) ? body.question_results : [];

  for (let i = 0; i < details.length; i++) {
    const q = details[i];
    await env.DB.prepare(`
      INSERT INTO question_results (
        attempt_id, student_code, module_code, question_id,
        topic, skill_type, question_text,
        student_answer, correct_answer, is_correct, explanation
      )
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
    `).bind(
      attemptId,
      studentCode,
      String(body.module_code),
      String(q.question_id ?? i + 1),
      String(q.topic || ""),
      String(q.skill_type || "concept"),
      String(q.question_text || ""),
      String(q.student_answer ?? ""),
      String(q.correct_answer || ""),
      q.is_correct ? 1 : 0,
      String(q.explanation || "")
    ).run();
  }

  return json({ ok:true, attempt_id:attemptId, mastery_status:mastery }, 200, corsHeaders);
}

async function listStudents(env, corsHeaders) {
  const { results } = await env.DB.prepare(`
    SELECT
      s.student_code,
      s.student_name,
      s.class_name,
      COUNT(a.id) AS total_attempts,
      MAX(a.attempted_at) AS last_activity
    FROM students s
    LEFT JOIN attempts a ON a.student_code = s.student_code
    GROUP BY s.student_code, s.student_name, s.class_name
    ORDER BY s.class_name, s.student_name
  `).all();

  return json({ ok:true, students:results }, 200, corsHeaders);
}

async function studentReport(url, env, corsHeaders) {
  const code = url.searchParams.get("student_code");
  if (!code) return json({ ok:false, error:"student_code required" }, 400, corsHeaders);

  const student = await env.DB.prepare(`
    SELECT student_code, student_name, class_name
    FROM students WHERE student_code=?1
  `).bind(code).first();

  if (!student) return json({ ok:false, error:"Student not found" }, 404, corsHeaders);

  const { results: attempts } = await env.DB.prepare(`
    SELECT a.*
    FROM attempts a
    INNER JOIN (
      SELECT module_code, MAX(id) AS max_id
      FROM attempts
      WHERE student_code=?1
      GROUP BY module_code
    ) latest ON latest.max_id=a.id
    ORDER BY a.module_code
  `).bind(code).all();

  const { results: weakness } = await env.DB.prepare(`
    SELECT
      COALESCE(NULLIF(topic,''),'Uncategorised') AS topic,
      COALESCE(NULLIF(skill_type,''),'concept') AS skill_type,
      COUNT(*) AS total_questions,
      SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END) AS wrong_count,
      ROUND(
        100.0 * SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) / COUNT(*),
        1
      ) AS accuracy
    FROM question_results
    WHERE student_code=?1
    GROUP BY topic, skill_type
    HAVING COUNT(*) >= 1
    ORDER BY accuracy ASC, total_questions DESC
  `).bind(code).all();

  const { results: wrongQuestions } = await env.DB.prepare(`
    SELECT
      qr.module_code, qr.topic, qr.skill_type,
      qr.question_text, qr.student_answer, qr.correct_answer,
      qr.explanation, qr.created_at
    FROM question_results qr
    INNER JOIN attempts a ON a.id=qr.attempt_id
    WHERE qr.student_code=?1 AND qr.is_correct=0
    ORDER BY qr.created_at DESC
    LIMIT 100
  `).bind(code).all();

  return json({
    ok:true,
    student,
    attempts,
    weakness,
    wrong_questions:wrongQuestions
  }, 200, corsHeaders);
}

async function classOverview(url, env, corsHeaders) {
  const className = url.searchParams.get("class_name") || "";

  const where = className ? "WHERE a.class_name=?1" : "";
  const stmt = env.DB.prepare(`
    SELECT
      a.module_code,
      a.module_title,
      COUNT(*) AS attempts,
      ROUND(AVG(a.percentage),1) AS average_percentage,
      SUM(CASE WHEN a.percentage < 80 THEN 1 ELSE 0 END) AS below_mastery
    FROM attempts a
    ${where}
    GROUP BY a.module_code, a.module_title
    ORDER BY a.module_code
  `);

  const result = className ? await stmt.bind(className).all() : await stmt.all();

  const weakStmt = env.DB.prepare(`
    SELECT
      COALESCE(NULLIF(qr.topic,''),'Uncategorised') AS topic,
      COALESCE(NULLIF(qr.skill_type,''),'concept') AS skill_type,
      COUNT(*) AS total_questions,
      SUM(CASE WHEN qr.is_correct=0 THEN 1 ELSE 0 END) AS wrong_count,
      ROUND(
        100.0 * SUM(CASE WHEN qr.is_correct=1 THEN 1 ELSE 0 END) / COUNT(*),
        1
      ) AS accuracy
    FROM question_results qr
    JOIN attempts a ON a.id=qr.attempt_id
    ${className ? "WHERE a.class_name=?1" : ""}
    GROUP BY topic, skill_type
    ORDER BY accuracy ASC, total_questions DESC
    LIMIT 30
  `);

  const weak = className ? await weakStmt.bind(className).all() : await weakStmt.all();

  return json({
    ok:true,
    class_name:className || "ALL",
    modules:result.results,
    weak_areas:weak.results
  }, 200, corsHeaders);
}
