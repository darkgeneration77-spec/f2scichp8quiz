export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Teacher-Key"
    };
    if (request.method === "OPTIONS") return new Response(null,{headers:cors});
    try {
      if (url.pathname === "/api/submit-result" && request.method === "POST") return submitResult(request,env,cors);
      if (url.pathname === "/api/students" && request.method === "GET") return teacher(request,env,cors,()=>listStudents(env,cors));
      if (url.pathname === "/api/student-report" && request.method === "GET") return teacher(request,env,cors,()=>studentReport(url,env,cors));
      if (url.pathname === "/api/class-overview" && request.method === "GET") return teacher(request,env,cors,()=>classOverview(url,env,cors));
      return json({ok:false,error:"Not found"},404,cors);
    } catch (e) { return json({ok:false,error:e.message||"Server error"},500,cors); }
  }
};
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...headers}})}
async function teacher(request,env,cors,fn){const sent=request.headers.get("X-Teacher-Key")||"";if(!env.TEACHER_KEY||sent!==env.TEACHER_KEY)return json({ok:false,error:"Unauthorized"},401,cors);return fn()}
function mastery(p){if(p>=85)return"STRONG";if(p>=70)return"DEVELOPING";if(p>=50)return"WEAK";return"CRITICAL"}
async function submitResult(request,env,cors){
  const b=await request.json();
  for(const k of ["student_code","student_name","module_code","module_title","score","total_questions","percentage"]){if(b[k]===undefined||b[k]===null||b[k]==="")return json({ok:false,error:`Missing field: ${k}`},400,cors)}
  const code=String(b.student_code).trim(),name=String(b.student_name).trim(),cls=String(b.class_name||"").trim(),pct=Number(b.percentage);
  await env.DB.prepare(`INSERT INTO students(student_code,student_name,class_name,updated_at) VALUES(?1,?2,?3,CURRENT_TIMESTAMP) ON CONFLICT(student_code) DO UPDATE SET student_name=excluded.student_name,class_name=excluded.class_name,updated_at=CURRENT_TIMESTAMP`).bind(code,name,cls).run();
  const r=await env.DB.prepare(`INSERT INTO attempts(student_code,student_name,class_name,module_code,module_title,score,total_questions,percentage,mastery_status,correction_completed,correction_score) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`).bind(code,name,cls,String(b.module_code),String(b.module_title),Number(b.score),Number(b.total_questions),pct,mastery(pct),b.correction_completed?1:0,b.correction_score??null).run();
  const attemptId=r.meta.last_row_id,details=Array.isArray(b.question_results)?b.question_results:[];
  for(let i=0;i<details.length;i++){const q=details[i];await env.DB.prepare(`INSERT INTO question_results(attempt_id,student_code,module_code,question_id,topic,skill_type,question_text,student_answer,correct_answer,is_correct,explanation) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`).bind(attemptId,code,String(b.module_code),String(q.question_id??i+1),String(q.topic||""),String(q.skill_type||"concept"),String(q.question_text||""),String(q.student_answer??""),String(q.correct_answer||""),q.is_correct?1:0,String(q.explanation||"")).run()}
  return json({ok:true,attempt_id:attemptId,mastery_status:mastery(pct)},200,cors);
}
async function listStudents(env,cors){const {results}=await env.DB.prepare(`SELECT s.student_code,s.student_name,s.class_name,COUNT(a.id) total_attempts,MAX(a.attempted_at) last_activity FROM students s LEFT JOIN attempts a ON a.student_code=s.student_code GROUP BY s.student_code,s.student_name,s.class_name ORDER BY s.class_name,s.student_name`).all();return json({ok:true,students:results},200,cors)}
async function studentReport(url,env,cors){
  const code=url.searchParams.get("student_code");if(!code)return json({ok:false,error:"student_code required"},400,cors);
  const student=await env.DB.prepare(`SELECT student_code,student_name,class_name FROM students WHERE student_code=?1`).bind(code).first();if(!student)return json({ok:false,error:"Student not found"},404,cors);
  const {results:attempts}=await env.DB.prepare(`SELECT a.* FROM attempts a INNER JOIN (SELECT module_code,MAX(id) max_id FROM attempts WHERE student_code=?1 GROUP BY module_code) latest ON latest.max_id=a.id ORDER BY a.module_code`).bind(code).all();
  const {results:weakness}=await env.DB.prepare(`SELECT COALESCE(NULLIF(topic,''),'Uncategorised') topic,COALESCE(NULLIF(skill_type,''),'concept') skill_type,COUNT(*) total_questions,SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END) wrong_count,ROUND(100.0*SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END)/COUNT(*),1) accuracy FROM question_results WHERE student_code=?1 GROUP BY topic,skill_type ORDER BY accuracy ASC,total_questions DESC`).bind(code).all();
  const {results:wrong_questions}=await env.DB.prepare(`SELECT module_code,topic,skill_type,question_text,student_answer,correct_answer,explanation,created_at FROM question_results WHERE student_code=?1 AND is_correct=0 ORDER BY created_at DESC LIMIT 100`).bind(code).all();
  return json({ok:true,student,attempts,weakness,wrong_questions},200,cors);
}
async function classOverview(url,env,cors){
  const cls=url.searchParams.get("class_name")||"";
  const m=cls?await env.DB.prepare(`SELECT module_code,module_title,COUNT(*) attempts,ROUND(AVG(percentage),1) average_percentage,SUM(CASE WHEN percentage<80 THEN 1 ELSE 0 END) below_mastery FROM attempts WHERE class_name=?1 GROUP BY module_code,module_title ORDER BY module_code`).bind(cls).all():await env.DB.prepare(`SELECT module_code,module_title,COUNT(*) attempts,ROUND(AVG(percentage),1) average_percentage,SUM(CASE WHEN percentage<80 THEN 1 ELSE 0 END) below_mastery FROM attempts GROUP BY module_code,module_title ORDER BY module_code`).all();
  const w=cls?await env.DB.prepare(`SELECT COALESCE(NULLIF(qr.topic,''),'Uncategorised') topic,COALESCE(NULLIF(qr.skill_type,''),'concept') skill_type,COUNT(*) total_questions,SUM(CASE WHEN qr.is_correct=0 THEN 1 ELSE 0 END) wrong_count,ROUND(100.0*SUM(CASE WHEN qr.is_correct=1 THEN 1 ELSE 0 END)/COUNT(*),1) accuracy FROM question_results qr JOIN attempts a ON a.id=qr.attempt_id WHERE a.class_name=?1 GROUP BY topic,skill_type ORDER BY accuracy ASC,total_questions DESC LIMIT 30`).bind(cls).all():await env.DB.prepare(`SELECT COALESCE(NULLIF(topic,''),'Uncategorised') topic,COALESCE(NULLIF(skill_type,''),'concept') skill_type,COUNT(*) total_questions,SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END) wrong_count,ROUND(100.0*SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END)/COUNT(*),1) accuracy FROM question_results GROUP BY topic,skill_type ORDER BY accuracy ASC,total_questions DESC LIMIT 30`).all();
  return json({ok:true,class_name:cls||"ALL",modules:m.results,weak_areas:w.results},200,cors);
}