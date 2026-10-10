<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Memory: Nurse account-creation feature (same mandate as doctors)
- Same rule as doctors: a NURSE can only be added with a password. `createNurseSchema` requires email + password (min 8, confirmPassword optional must match); `updateNurseSchema = nurseFieldsSchema.partial()` (no password fields).
- `nurse.service.createNurse` unconditionally creates a linked `User` (NURSE role, bcrypt, passwordChangedAt/passwordHistory), links nurse.userId, audits accountCreated + derived username; helpers usernameSeed/deriveUniqueUsername (local part, `nurse_` prefix when <3 chars).
- nurse.test.ts now 52 pass (mocks extended with role/user/userRole + auth.service mock; createNurseAccount describe). FULL backend suite: 422 pass; tsc clean.
- Frontend NurseModule.tsx: Add/Edit Nurse is a FULL-PAGE form (like doctors): `formMode` state + `NurseFormPage` component with "← Back to Nurses" button; no modal. Create requires email + password (min 8, must match); payload always sends password/confirmPassword on create; labels "Email *"/"Password * (creates login)"/"Confirm Password *"; hint "A login account is created for every nurse." Password fields shown only when !editing.
- tsc/eslint/build green. Backend running pid 27776 (restart after backend edits; no hot reload).
- Live verified: POST /nurses no-password → 400 VALIDATION_ERROR details.password "Required"; mismatch → 400; valid → 200 (userId 12) then re-POST → 409 email conflict; nurse login works, wrong password rejected. Test data (nurse id 1, user id 12) cleaned via temp tsx script.

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
