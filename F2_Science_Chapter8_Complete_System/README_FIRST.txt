F2 SCIENCE CHAPTER 8 COMPLETE SYSTEM

Folders:

1. standalone/
   Original Chapter 8 mastery HTML files:
   - 8.1A to 8.1D
   - 8.2A to 8.2H
   - Final Boss
   - Mastery Hub
   - Diagnostic Report
   - Mastery Certificate

2. connected-system/
   Cloudflare D1 connected version:
   - teacher-dashboard.html
   - worker.js
   - schema.sql
   - connected-games/
     * CONNECTED_MASTERY_HUB.html
     * student-setup.html
     * chapter8-performance.js
     * 8.1A to 8.2H connected games
     * Final Boss connected game

Recommended deployment:
- Upload connected-system/connected-games files to the same GitHub folder.
- Rename CONNECTED_MASTERY_HUB.html to index.html when publishing.
- Deploy worker.js to Cloudflare Workers.
- Create D1 database using schema.sql.
- Bind D1 as DB.
- Add TEACHER_KEY secret.
- Enter the Worker URL in student-setup.html.

IMPORTANT:
All connected game HTML files and chapter8-performance.js must remain in the SAME folder.
