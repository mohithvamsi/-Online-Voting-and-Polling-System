# Verification before packaging

## Performed

- Installed all backend dependencies successfully.
- Reinstalled with npm ci using the included lockfile successfully.
- Ran npm test from the project root: 10 tests passed, 0 failed.
- Ran npm run check: all 12 authored JavaScript files passed Node syntax checks.
- Ran npm audit --omit=dev --audit-level=high: 0 known vulnerabilities reported at packaging time.
- Started Express and verified local HTTP health/static assets/security headers.
- Verified missing authentication blocks student, reporting and department routes.
- Verified backend configuration, database SQL and environment files are not statically served.
- Verified invalid JSON, invalid login input, oversized requests and missing endpoints return expected errors.
- Smoke-tested the guided launcher in a temporary copy using placeholder configuration: Express started and returned HTTP 200 from its health endpoint. No remote Supabase call was made.
- Checked archive contents and ZIP integrity after packaging.

## Not performed

- No live Supabase project was configured or contacted for database verification.
- SQL was not executed against PostgreSQL in this environment.
- End-to-end login, database CRUD, RLS policies and persistence need the manual checks in README.md using your own Supabase project.
- A browser smoke test was attempted but could not run because a browser executable was unavailable and its download failed. No claim of rendered/browser UI verification is made.
- The Windows batch launcher was not executed on Windows; the cross-platform Node launcher was tested on Linux.

## Required before demonstration

1. Run schema.sql once in a fresh Supabase project.
2. Create a confirmed Auth user and add it to admins using add-admin.sql.
3. Configure backend/.env using the guided launcher or manually.
4. Log in, add a fictional student, inspect it in Supabase, restart and confirm persistence.
5. Test duplicate roll/email rejection and a non-admin account being denied.
6. Test edit, delete, filters, pagination, mobile layout and session expiry.

The included .env contains placeholders only. No shared database, default password, privileged key or real student record is included.
