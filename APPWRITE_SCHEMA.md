# Appwrite Schema Reference — NurseArena

> Create all collections in Appwrite Cloud Console using **lowercase camelCase** for attribute names.
> Document IDs use the user `$id` for `profiles`; all others use `ID.unique()`.
> Every attribute listed below has been verified against actual `createDocument`/`updateDocument`/`listDocuments` calls in the codebase.

---

## 1. `profiles` — User Profiles

Use the Appwrite user `$id` as the document ID.

| Attribute | Type | Required | Default | Written By | Notes |
|-----------|------|----------|---------|------------|-------|
| `email` | string | Yes | — | register, login, callback | User email |
| `displayName` | string | Yes | — | register, login, callback, onboarding | Display name |
| `photoURL` | string | No | `null` | onboarding only | Avatar URL |
| `phone` | string | No | `""` | _never written_ | Declared in schema, read in types |
| `targetExams` | string | No | `"[]"` | register, login, callback, onboarding, exam-select | **JSON string** array (e.g. `'["JENPAS_UG_P1","JEPBN"]'`) |
| `jemasSubCourse` | string | No | `""` | onboarding only | Sub-course for JEMAS |
| `currentStage` | string | No | `"Student"` | onboarding only | One of: `Student`, `Appeared`, `Working Nurse` |
| `institution` | string | No | `""` | onboarding only | Institution name |
| `district` | string | No | `""` | onboarding only | West Bengal district |
| `totalMarksEarned` | number | No | `0` | register, login, callback, useQuiz, xpTransactions, admin users | Cumulative marks |
| `totalQuestionsAttempted` | number | No | `0` | register, login, callback, useQuiz, admin users | Total questions attempted |
| `totalCorrect` | number | No | `0` | register, login, callback, useQuiz, admin users | Total correct answers |
| `totalWrong` | number | No | `0` | register, login, callback, useQuiz, admin users | Total wrong answers |
| `totalSkipped` | number | No | `0` | register, login, callback, useQuiz | Total skipped questions |
| `bestMockScore` | number | No | `0` | _never written_ | Declared in schema |
| `rapidFireUnlockedTier` | number | No | `1` | register, login, callback, admin users | Highest unlocked Rapid Fire tier |
| `streakDays` | number | No | `0` | register, login, callback, checkAndUpdateStreak | Consecutive login days |
| `lastLoginAt` | string | No | `null` | checkAndUpdateStreak | ISO datetime of last login |
| `profileCompletePct` | number | No | `0` | register, login, callback, onboarding | Profile completion percentage |
| `is_admin` | boolean | No | `false` | _never written_ | Read by API routes, login page, manageUser |

---

## 2. `questions` — Question Bank

| Attribute | Type | Required | Default | Written By | Notes |
|-----------|------|----------|---------|------------|-------|
| `exam_code` | string | Yes | — | AdminQuestionUpload, API questions route | Target exam code |
| `question` | string | Yes | — | AdminQuestionUpload, API questions route | Question body text |
| `option_a` | string | Yes | — | AdminQuestionUpload, API questions route | Option A |
| `option_b` | string | Yes | — | AdminQuestionUpload, API questions route | Option B |
| `option_c` | string | Yes | — | AdminQuestionUpload, API questions route | Option C |
| `option_d` | string | Yes | — | AdminQuestionUpload, API questions route | Option D |
| `correct` | string | Yes | — | AdminQuestionUpload, API questions route | `A`, `B`, `C`, or `D` |
| `subject_name` | string | No | `""` | API questions route only | Subject name (used for filtering) |
| `subject_id` | string | No | `null` | AdminQuestionUpload only | Reference to subject document ID (alternative to subject_name) |
| `topic` | string | No | `""` | API questions route | Topic name |
| `topic_id` | string | No | `null` | admin topics page (merge) | Reference to topic document ID |
| `difficulty` | string | No | `"medium"` | AdminQuestionUpload, API questions route | `easy`, `medium`, or `hard` |
| `explanation` | string | No | `""` | AdminQuestionUpload, API questions route | Answer explanation |
| `archived` | boolean | No | `false` | AdminQuestionUpload, API questions route (soft delete) | Soft delete flag |
| `is_pyq` | boolean | No | `false` | AdminQuestionUpload, API questions route | Previous year question flag |
| `pyq_year` | number | No | `null` | AdminQuestionUpload, API questions route | PYQ exam year |
| `content_hash` | string | No | — | _not directly written_ (computed by CSV import) | MD5 hash for duplicate detection |
| `quiz_pool_status` | string | No | `"available"` | admin quizzes page only | `available`, `reserved`, or `used` |

**⚠ Known codebase inconsistency:** `subject_id` vs `subject_name` — `AdminQuestionUpload.tsx` writes `subject_id` but `fetchQuestions` filters by `subject_name`. Both attributes may exist on documents, but queries by `subject_name` will miss documents that only set `subject_id`.

---

## 3. `quizzes` — Quiz Definitions

| Attribute | Type | Required | Default | Written By | Notes |
|-----------|------|----------|---------|------------|-------|
| `exam_code` | string | Yes | — | admin quizzes page, API quizzes route | Target exam code |
| `title` | string | Yes | — | admin quizzes page, API quizzes route | Quiz title |
| `type` | string | Yes | — | admin quizzes page, API quizzes route | `mock`, `quiz`, `topicwise`, `rapid_fire`, `live`, `daily`, or `pyq` |
| `question_count` | number | Yes | — | admin quizzes page, API quizzes route | Number of questions |
| `duration_seconds` | number | No | — | admin quizzes page, API quizzes route | Total quiz duration |
| `per_question_seconds` | number | No | `null` | admin quizzes page | Per-question timer (rapid fire) |
| `scoring_profile_id` | string | No | `null` | admin quizzes page | Reference to scoring profile |
| `is_active` | boolean | No | `true` | admin quizzes page | Whether quiz is active |
| `live_at` | string | No | `null` | admin quizzes page | ISO datetime for scheduled live quiz |
| `live_status` | string | No | `null` | admin quizzes page | `scheduled`, `live`, `closed` |
| `subject_name` | string | No | — | _not written by code_ | Filter by subject (read from static quiz definitions) |
| `marks_correct` | number | No | — | _not written by code_ | Custom marks for correct answer (read from static definitions) |
| `marks_wrong` | number | No | — | _not written by code_ | Custom penalty for wrong answer (read from static definitions) |

---

## 4. `quiz_questions` — Quiz ↔ Question Mapping

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `quiz_id` | string | Yes | admin quizzes page | Reference to quiz document |
| `question_id` | string | Yes | admin quizzes page | Reference to question document |
| `order_index` | number | Yes | admin quizzes page | Display order (0-based) |

---

## 5. `quiz_sessions` — Quiz Attempt Sessions

| Attribute | Type | Required | Default | Written By | Notes |
|-----------|------|----------|---------|------------|-------|
| `userId` | string | Yes | — | useQuiz, API start route, saveQuizAttempt | User document ID |
| `quizId` | string | Yes | — | useQuiz, API start route, saveQuizAttempt | Quiz document ID |
| `startedAt` | string | Yes | — | useQuiz, API start route, saveQuizAttempt | ISO datetime |
| `totalQuestions` | number | Yes | — | useQuiz, API start route | Total questions in session |
| `maxScore` | number | Yes | — | useQuiz, API start route | Maximum possible score |
| `status` | string | Yes | — | useQuiz, API start route | `active` or `submitted` |
| `submittedAt` | string | No | — | useQuiz only | ISO datetime of submission |
| `score` | number | No | — | useQuiz, saveQuizAttempt | Score earned |
| `correctCount` | number | No | — | useQuiz, saveQuizAttempt | Correct answers count |
| `wrongCount` | number | No | — | useQuiz, saveQuizAttempt | Wrong answers count |
| `attemptedCount` | number | No | — | useQuiz only | Total attempted (correct + wrong) |
| `totalSkipped` | number | No | — | saveQuizAttempt only | Skipped count |
| `negativePenalty` | number | No | — | saveQuizAttempt only | Total negative penalty |
| `percentage` | number | No | — | saveQuizAttempt only | Score percentage |
| `totalMarks` | number | No | — | saveQuizAttempt only | Raw marks total |
| `attemptNumber` | number | No | — | saveQuizAttempt only | Attempt number |
| `examCode` | string | No | — | saveQuizAttempt only | Exam code |
| `isLiveAttempt` | boolean | No | `false` | saveQuizAttempt only | Live quiz flag |
| `categoryIAttempts` | object | No | — | saveQuizAttempt only | **Plain object** `{"correct":N,"wrong":N,"skip":N}` (Appwrite stores as nested object) |
| `categoryIIAttempts` | object | No | — | saveQuizAttempt only | **Plain object** `{"correct":N,"wrong":N,"partial":N,"skip":N}` (nested object) |
| `subjectBreakdown` | object | No | — | saveQuizAttempt only | **Plain object** of per-subject stats (nested object) |

**⚠ Note:** `saveQuizAttempt` (in `src/services/attempts.ts`) is **defined but never called** anywhere in the codebase. These extra fields are never actually persisted at runtime. Use `useQuiz.ts` writes (`active`/`submitted`) are the only active code path.

---

## 6. `session_answers` — Per-Question Answers (within a session)

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `sessionId` | string | Yes | useQuiz, API submit route | Reference to quiz session |
| `userId` | string | Yes | API submit route only | User document ID (missing from useQuiz writes) |
| `questionId` | string | Yes | useQuiz, API submit route | Question document ID |
| `orderIndex` | number | Yes | useQuiz, API submit route | Question order (0-based) |
| `selectedOption` | string | No | useQuiz, API submit route | Selected answer (A/B/C/D or comma-separated for multi) |
| `isCorrect` | boolean | Yes | useQuiz, API submit route | Correctness flag |
| `marksAwarded` | number | No | useQuiz, API submit route | Marks awarded |
| `timeTakenMs` | number | Yes | useQuiz, API submit route | Response time in ms |
| `answeredAt` | string | Yes | useQuiz, API submit route | ISO datetime |

---

## 7. `attempts` — Granular Per-Question History

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `userId` | string | Yes | useQuiz, API submit route, mockTests, logAttempt | User document ID |
| `questionId` | string | Yes | useQuiz, API submit route, mockTests, logAttempt | Question document ID |
| `selectedOption` | string | No | useQuiz, API submit route, mockTests, logAttempt | Selected answer |
| `isCorrect` | boolean | Yes | useQuiz, API submit route, mockTests, logAttempt | Correctness flag |
| `timeTakenMs` | number | Yes | useQuiz, API submit route, mockTests, logAttempt | Response time in ms |

---

## 8. `leaderboard` — Cached Rankings

Use document ID pattern: `${userId}_${examId}_${period}`

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `userId` | string | Yes | _external/serverless_ | User document ID |
| `exam_id` | string | Yes | _external/serverless_ | Exam code |
| `period_type` | string | Yes | _external/serverless_ | `daily`, `weekly`, or `all_time` |
| `marksEarned` | number | Yes | _external/serverless_ | Total marks earned |
| `rank` | number | Yes | _external/serverless_ | Computed rank |
| `percentage` | number | No | _external/serverless_ | Score percentage |
| `displayName` | string | No | _external/serverless_ | User display name |
| `photoURL` | string | No | _external/serverless_ | Avatar URL |
| `wrong` | number | No | _external/serverless_ | Wrong answers count |
| `correctCount` | number | No | _external/serverless_ | Correct answers count |

**⚠ Note:** No code in this repo writes to `leaderboard`. It is read-only via `listDocuments`. Leaderboard data is assumed to be populated by an external process (e.g., Appwrite Function).

---

## 9. `notifications` — Push Notifications

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `title` | string | Yes | admin notifications page | Notification title |
| `body` | string | Yes | admin notifications page | Notification body text |
| `type` | string | Yes | admin notifications page | `mock_test`, `result`, or `announcement` |
| `targetExams` | string | Yes | admin notifications page | **JSON string** array of exam codes (or `["all"]`) |
| `readBy` | string | Yes | admin notifications page, Navbar | **JSON string** array of user IDs who have read it |

---

## 10. `mock_tests` — Mock Test Definitions

| Attribute | Type | Required | Default | Written By | Notes |
|-----------|------|----------|---------|------------|-------|
| `exam_code` | string | Yes | — | admin mock-tests page | Target exam code |
| `title` | string | Yes | — | admin mock-tests page | Mock test title |
| `serial_number` | number | Yes | — | admin mock-tests page | Sequential number per exam |
| `duration_seconds` | number | Yes | — | admin mock-tests page | Duration in seconds |
| `status` | string | Yes | `"draft"` | admin mock-tests page | `draft`, `published`, or `archived` |
| `published_at` | string | No | — | admin mock-tests page | ISO datetime when published |

---

## 11. `mock_test_events` — Scheduled Mock Test Events

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `exam_code` | string | Yes | AdminScheduler | Target exam code |
| `scheduled_at` | string | Yes | AdminScheduler | ISO datetime |
| `duration_min` | number | Yes | AdminScheduler | Duration in minutes |
| `max_participants` | number | No | AdminScheduler | Max participants limit |
| `week_number` | number | No | AdminScheduler | Week number of the year |
| `year` | number | No | AdminScheduler | Calendar year |

**⚠ CRITICAL inconsistency:** Written with `exam_code` (AdminScheduler) but **queried by `exam_id`** (mockTests.ts, useMockTest.ts). These are different attribute names — queries will always return empty results. Fix either the write or the read to use the same attribute name.

---

## 12. `live_quiz_events` — Live Quiz Events

| Attribute | Type | Required | Default | Written By | Notes |
|-----------|------|----------|---------|------------|-------|
| `exam_code` | string | Yes | — | AdminScheduler | Target exam code |
| `starts_at` | string | Yes | — | AdminScheduler | ISO datetime of start |
| `timezone` | string | Yes | — | AdminScheduler | IANA timezone (e.g. `Asia/Kolkata`) |
| `duration_min` | number | Yes | — | AdminScheduler | Duration in minutes |
| `status` | string | Yes | `"scheduled"` | AdminScheduler | `scheduled`, `live`, `ended`, or `cancelled` |
| `current_q_index` | number | No | `0` | _not written by code_ | Current question index (read by useLiveQuiz) |
| `questionSetId` | string | No | — | _not written by code_ | Reference to quiz for questions (read by liveQuiz.ts) |

**⚠ CRITICAL inconsistency 1:** Written with `exam_code` (AdminScheduler) but **queried by `exam_id`** (liveQuiz.ts, useLiveQuiz.ts). Same bug as `mock_test_events`.

**⚠ CRITICAL inconsistency 2:** `questionSetId` attribute name mismatch between type definition (`question_set_id` in `types/user.ts`) and runtime read (`questionSetId` in `liveQuiz.ts`). Also, this field is never written by AdminScheduler, so it will always be `undefined`.

---

## 13. `quiz_results` — Live Quiz Results

| Attribute | Type | Required | Default | Written By | Notes |
|-----------|------|----------|---------|------------|-------|
| `quizEventId` | string | Yes | — | liveQuiz.ts, useLiveQuiz | Reference to live quiz event |
| `userId` | string | Yes | — | liveQuiz.ts, useLiveQuiz | User document ID |
| `score` | number | Yes | `0` | liveQuiz.ts only | Marks earned (used by liveQuiz.ts service) |
| `marksEarned` | number | Yes | `0` | useLiveQuiz hook only | Marks earned (used by useLiveQuiz hook) |
| `correctCount` | number | Yes | `0` | liveQuiz.ts, useLiveQuiz | Correct answers count |
| `totalLatencyMs` | number | Yes | `0` | liveQuiz.ts only | Total response latency |
| `joinedAtIndex` | number | Yes | `0` | liveQuiz.ts, useLiveQuiz | Question index when joined |
| `disconnectionFlag` | boolean | Yes | `false` | liveQuiz.ts, useLiveQuiz | Disconnection flag |

**⚠ CRITICAL inconsistency:** `score` vs `marksEarned` — `liveQuiz.ts` writes and queries by `score`, but `useLiveQuiz.ts` writes and queries by `marksEarned`. These are **different attribute names** in the same collection. Data written by one code path will not be found by the other.

---

## 14. `quiz_answers` — Live Quiz Answers

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `quizEventId` | string | Yes | useLiveQuiz | Reference to live quiz event |
| `userId` | string | Yes | useLiveQuiz | User document ID |
| `questionIndex` | number | Yes | useLiveQuiz | Question index (0-based) |
| `selectedOption` | string | No | useLiveQuiz | Selected answer |
| `isCorrect` | boolean | No | useLiveQuiz | Correctness flag |

**⚠ Note:** `liveQuiz.ts` also defines a `submitQuizAnswer` function that writes using the `QuizAnswer` type attributes (`quiz_event_id`, `user_id`, `question_index`, `selected_option`, `is_correct`, `latency_ms` — snake_case). This function is **not called** by any page/hook at runtime. The only active code path is `useLiveQuiz.ts` which uses camelCase.

---

## 15. `missions` — Mission Definitions

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `examCode` | string | No | _no writes in codebase_ | Filter by exam (`null` = all) |
| `title` | string | Yes | _no writes in codebase_ | Mission title |
| `description` | string | No | _no writes in codebase_ | Mission description |
| `xpReward` | number | Yes | _no writes in codebase_ | XP reward on completion |
| `type` | string | Yes | _no writes in codebase_ | Condition type (read as `condition_type` by useMissions) |
| `target` | number | Yes | _no writes in codebase_ | Target value to reach (read as `condition_value` by useMissions) |
| `is_daily` | boolean | No | _no writes in codebase_ | Whether this is a daily mission |

**⚠ Note:** No code in this repo writes to `missions`. It is read-only (populated externally). The hook `useMissions.ts` maps `type` → `condition_type` and `target` → `condition_value` at runtime.

---

## 16. `user_missions` — User Mission Progress

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `userId` | string | Yes | useMissions | User document ID |
| `missionId` | string | Yes | useMissions | Mission document ID |
| `progress` | number | Yes | useMissions | Current progress toward target |
| `completed` | boolean | Yes | useMissions | Whether mission is completed |
| `assignedDate` | string | Yes | useMissions | Date assigned (YYYY-MM-DD) |

---

## 17. `subjects` — Exam Subjects

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `name` | string | Yes | _no writes in codebase_ | Subject name |
| `exam_code` | string | No | _no writes in codebase_ | Filter by exam |

---

## 18. `topics` — Subject Topics

| Attribute | Type | Required | Written By | Notes |
|-----------|------|----------|------------|-------|
| `subject_id` | string | Yes | admin topics page | Reference to subject document |
| `name` | string | Yes | admin topics page | Topic name |

---

## Codebase Inconsistencies Found During Audit

The following bugs affect runtime behavior and should be addressed:

| # | Collection | Problem | Impact |
|---|-----------|---------|--------|
| 1 | `mock_test_events` | AdminScheduler writes `exam_code`, but services/hooks query by `exam_id` | **Scheduled mock tests never appear for users** |
| 2 | `live_quiz_events` | AdminScheduler writes `exam_code`, but services/hooks query by `exam_id` | **Scheduled live quizzes never appear for users** |
| 3 | `quiz_results` | `liveQuiz.ts` writes/queries `score`; `useLiveQuiz.ts` writes/queries `marksEarned` | **Leaderboard data split across two attributes** |
| 4 | `quiz_results` / `quiz_answers` | TypeScript types use snake_case (`quiz_event_id`), runtime code uses camelCase (`quizEventId`) | Type-safe but works at runtime |
| 5 | `questions` | `AdminQuestionUpload` writes `subject_id`; `fetchQuestions` filters by `subject_name` | Subject-filtered queries miss bulk-uploaded questions |
| 6 | `questions` | `admin/topics/page.tsx` writes `topic_id` to questions, but schema has `topic` | Two attributes for the same concept |
| 7 | `quiz_sessions` | `saveQuizAttempt` (unused) writes many extra attributes; active code path writes minimal set | Dead code — no runtime impact |
| 8 | `leaderboard` | Leaderboard page does not filter by `period_type`; services vs API use different sort orders | Page may show stale/wrong rankings |

---

## Setup Checklist

1. **Create project** in Appwrite Cloud Console
2. **Add Web platform** (Settings → Platforms) for your domain + `localhost`
3. **Generate API Key** (Settings → API Keys) with full access
4. **Create Database** named with your `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
5. **Create each collection** above with lowercase camelCase attributes
6. Set **collection permissions** to `[]` (Anyone) — client auth is handled by session cookies and server API key
7. Set `is_admin` to `true` manually in the `profiles` collection for admin users
8. Copy `.env.example` → `.env.local` and fill in your credentials
9. **Fix the critical inconsistencies** listed above before deploying
