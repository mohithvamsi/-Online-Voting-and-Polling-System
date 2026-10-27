# Start here — Student Management System

All source files, SQL scripts, environment templates, lockfiles, tests and VS Code tasks are included. You do not need to copy code from the chat.

## What you must do once

A ZIP cannot contain a working connection to your own Supabase project unless you supply its configuration. There is no shared demo database or default administrator password.

1. Install **Node.js 24 LTS** from https://nodejs.org/ and **VS Code** from https://code.visualstudio.com/.
2. **Extract the ZIP completely.** Do not run it from inside the ZIP viewer.
3. In VS Code choose **File > Open Folder**, then select `student-management-system` (the folder containing this file and `package.json`).
4. Create a free Supabase project at https://supabase.com/ and wait for it to become ready.
5. In Supabase **SQL Editor**, paste the entire `database/schema.sql` file and click **Run**. Run it once in a new project. It creates the tables, five demo departments and access policies.
6. Open **Authentication > Users** and create an email/password user. Ensure it is confirmed. Remember your own password; there is no default password in the ZIP.
7. Copy that user's UUID. Open `database/add-admin.sql`, replace `REPLACE_WITH_AUTH_USER_UUID` with the copied UUID, and run the resulting SQL in Supabase. This gives that account administrator access.
8. Open **Terminal > New Terminal** in VS Code. Run the following command from the root project folder:

```powershell
npm start
```

9. On first launch, enter your Supabase **Project URL** and **publishable key** (`sb_publishable_...`) when prompted. Find these in Supabase's **Connect** dialog or API settings. The launcher saves them locally in `backend/.env`, installs dependencies from the included lockfile and opens the browser.
10. Log in with the email/password you created in step 6. Add a fictional student and verify it in Supabase Table Editor.

**Windows alternative:** double-click `start.bat` after completing the Supabase steps. It runs the same guided launcher. Keep its terminal open while using the app.

## Every launch after setup

Open the folder in VS Code and run `npm start`, or double-click `start.bat` on Windows. The launcher reuses your local configuration and installed dependencies. Internet is still required for Supabase.

## If prompts do not appear

Open `backend/.env` and replace these values manually:

```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Then run `npm start` again. Do not enter an `sb_secret_` key or a database password.

## Useful commands (project root)

```powershell
npm start
npm test
npm run check
```

- `npm start`: guided install/configuration and application launch.
- `npm test`: validation and local HTTP/middleware tests; run after dependencies are installed.
- `npm run check`: check all authored JavaScript for syntax errors.
- Stop the running app using **Ctrl+C**.

If PowerShell blocks `npm.ps1`, use `npm.cmd start` or switch the terminal to Command Prompt. If Node is not recognized, restart VS Code after installing Node.

Do not use Live Server or open `frontend/index.html` directly. The app runs at http://localhost:3000 through Express.

Read README.md for API details, security, testing, troubleshooting and GitHub upload instructions. Read VERIFICATION.md for the checks actually performed before packaging.
