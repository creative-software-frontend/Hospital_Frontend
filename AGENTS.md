<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Memory: Doctor account-creation feature (mandatory)
- User directive: "without password doctor cant be add" → email + password are REQUIRED in `createDoctorSchema` (password min 8, confirmPassword optional but must match via superRefine). Service unconditionally creates a linked `User` (DOCTOR role, bcrypt via config.bcryptSaltRounds), sets passwordChangedAt/passwordHistory, links doctor.userId, audits accountCreated + auto-derived username (from email local part, unique-suffixed).
- Backend tests: doctor.test.ts 50 pass; codeGenerator.test.ts 8 pass (prisma mock extended with role/user/userRole + createMany + auth.service assertPasswordAcceptable mocked; createDoctor code tests pass email/password). FULL backend suite: 413 pass; tsc clean.
- Frontend DoctorModule.tsx: add form enforces email + password required (min 8, must match confirm) on create; payload ALWAYS sends password/confirmPassword on create; "Leave blank..." hint removed; labels "Email *", "Password * (creates login)", "Confirm Password *". Password fields shown only when !editing.
- tsc/eslint/build green (backend + frontend). Backend running pid 32192 (restart after backend edits; no hot reload).
- Live verified: POST /doctors without password → 400 VALIDATION_ERROR; mismatch → 400; valid → 200 with userId; doctor login works, wrong password rejected. Test data (doctor id 6, user id 11) cleaned via temp tsx script (UserSession model name, not "session").
- git status modified (5): app/doctors/DoctorModule.tsx, app/lib/api.ts, backend/src/__tests__/doctor.test.ts, backend/src/modules/doctors/doctor.service.ts, backend/src/modules/doctors/doctor.validation.ts.

## Memory: Doctor module prior work (all verified; committed by user)
- Add/Edit Doctor is a FULL-PAGE form (not a modal): `formMode` state + `DoctorFormPage` component with "← Back to Doctors"; DoctorProfileModal remains a read-only modal.
- Doctor module: commission fields, profile modal via GET /doctors/:id, activate/deactivate toggle, Registration No first in form. Verified tsc/eslint/build + live API.

## Memory: Misc prior work
- Audit Center dropdown navigation fix and P2 settings — done and committed by user.
- Admin creds: admin@hospital.com / 12345678. Only ONE branch (MAIN).
