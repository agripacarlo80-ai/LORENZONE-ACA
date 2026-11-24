# Lorenzone Security Specification

## 1. Data Invariants
1. **PII Isolation**: User Gmail addresses reside exclusively in `/users/{userId}/private/info` and never in `/publicProfiles/{userId}`. Only the profile owner or a verified teacher/admin can read private info. Non-PII classroom `section` labels may be stored on `/publicProfiles/{userId}` to enable per-section classroom monitoring.
2. **Anti-Cheat Lockout Integrity**: When a student's `publicProfiles/{uid}` has `lockedOut == true`, the student cannot set `lockedOut` back to `false`. Only a teacher or admin can unlock the student and mark `antiCheatAlerts/{alertId}` as `status: 'allowed'`.
3. **Immutable Ownership & Timestamps**: `uid`, `studentId`, `teacherId`, and `createdAt` are immutable once created, and `createdAt` / `updatedAt` must equal `request.time`.
4. **Strict Field Allowlisting**: Every collection enforces exact `keys().hasAll(...)` and `keys().hasOnly(...)` on create, plus action-scoped `affectedKeys().hasOnly(...)` on update to block shadow field injection.
5. **Verified Google Sign-In**: All read/write operations require `request.auth != null && request.auth.token.email_verified == true`.
6. **Teacher vs. Admin Role Isolation**: Existing `teacher` accounts cannot claim or be promoted to `admin`; `config/accessCodes` maintains separate Teacher and Admin secret codes.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Profile Read**: Read `/publicProfiles/u1` without `request.auth`.
2. **Self-Unlock Bypass**: Student with `lockedOut: true` attempts `update` on `/publicProfiles/{uid}` setting `lockedOut: false`.
3. **PII Snooping**: Student `u2` attempts `get` on `/users/u1/private/info`.
4. **Shadow Field Injection on Profile**: User injects `{ isAdmin: true }` into `/publicProfiles/{uid}`.
5. **Identity Spoofing on ScoreRecord**: Student `u1` creates `/scoreRecords/r1` with `studentId: "u2"`.
6. **Student Creating QuizDeck**: Student attempts `create` on `/quizDecks/d1` when their profile role is `student`.
7. **ID Poisoning**: Write to `/quizDecks/` with a 200-character invalid ID containing spaces/symbols.
8. **Fake Timestamp**: Create `/scoreRecords/r1` with a client-backdated `createdAt` instead of `request.time`.
9. **Score Record Tampering**: Student attempts `update` or `delete` on an existing `/scoreRecords/r1`.
10. **Student Resolving AntiCheat Alert**: Student attempts `update` on `/antiCheatAlerts/a1` setting `status: "allowed"`.
11. **Unverified Email Bypass**: Request with `email_verified: false` tries to create `/publicProfiles/{uid}`.
12. **Cross-Teacher Deck Deletion**: Teacher `t2` attempts `delete` on `/quizDecks/d1` owned by `t1`.
