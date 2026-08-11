# Chapter 8 Student Performance System

Files:
1. `schema.sql` — Cloudflare D1 database tables.
2. `worker.js` — Cloudflare Worker API.
3. `teacher-dashboard.html` — Teacher analytics dashboard.
4. `student-result-sender-snippet.html` — code to insert into the existing Chapter 8 games.

## Cloudflare setup

1. Create a D1 database, for example `chapter8-results`.
2. Run `schema.sql` in the D1 console.
3. Create a Worker and paste `worker.js`.
4. Add a D1 binding:
   - Variable name: `DB`
   - Database: your Chapter 8 D1 database
5. Add a Worker secret / environment variable:
   - `TEACHER_KEY`
   - Set this to a private password only the teacher knows.
6. Deploy the Worker.
7. Put the Worker URL into:
   - `teacher-dashboard.html`
   - each student game via the result sender snippet.
8. Upload `teacher-dashboard.html` to your Pages site or open it locally.

## Data sent by each game

Each completed attempt should send:
- student_code
- student_name
- class_name
- module_code
- module_title
- score
- total_questions
- percentage
- correction_completed
- correction_score
- question_results[]

Each question result can include:
- question_id
- topic
- skill_type
- question_text
- student_answer
- correct_answer
- is_correct
- explanation

This is what allows the dashboard to diagnose whether a student is weak in:
- concept recognition
- diagram interpretation
- calculation
- application
- scientific reasoning

## Mastery guide

- 85–100%: Strong
- 70–84%: Developing
- 50–69%: Weak
- 0–49%: Critical

The teacher dashboard uses these stored results to identify weak areas and recommend focused remediation.
