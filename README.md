# Form 2 Science Chapter 8 Mastery System

Connected quiz system for **KSSM Form 2 Science Chapter 8: Force and Motion**.

## Student modules

- 8.1A Types of Force
- 8.1B Magnitude, Direction & Point of Application
- 8.1C Measuring Force
- 8.1D Action & Reaction Forces
- 8.2A Effects of Force
- 8.2B Buoyant Force & Density
- 8.2C Lever
- 8.2D Moment of Force
- 8.2E Pressure
- 8.2F Gas Pressure
- 8.2G Atmospheric Pressure
- 8.2H Liquid Pressure
- FINAL Chapter 8 mixed mastery test

Questions are in English. Answer explanations use detailed Chinese with important English science keywords preserved.

## Main files

- `index.html` — student mastery hub
- `student-setup.html` — saves Student ID, name, class and Worker API URL
- `chapter8-performance.js` — uploads attempts and queues results if temporarily offline
- `8.1A.html`, `8.1B.html`, `8.1C.html` — standalone connected modules
- `module.html` + `data/*.js` — reusable connected engine for remaining modules and Final Boss
- `teacher-dashboard.html` — teacher analytics dashboard
- `cloudflare/schema.sql` — Cloudflare D1 database schema
- `cloudflare/worker.js` — Worker API

## Cloudflare setup

1. Create a D1 database, for example `chapter8-results`.
2. Run `cloudflare/schema.sql` in the D1 SQL console.
3. Create a Cloudflare Worker and paste `cloudflare/worker.js`.
4. Add a D1 binding named exactly `DB`.
5. Add a Worker secret/environment variable named `TEACHER_KEY`.
6. Deploy the Worker and copy its URL.
7. Open `student-setup.html` on each student device and save the Worker URL, Student ID, name and class.
8. Open `teacher-dashboard.html` on the teacher device and enter the Worker URL and the same `TEACHER_KEY`.

## Data recorded

Each completed attempt can save Student ID, student name, class, module, score, percentage, question-by-question answers, correct answers, topic, skill type and explanation.

The Teacher Dashboard uses those records to identify strong and weak topics and recommend focused remediation.

## Mastery guide

- 85–100%: Strong
- 70–84%: Developing
- 50–69%: Weak
- 0–49%: Critical
