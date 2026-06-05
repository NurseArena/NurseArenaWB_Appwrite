# AGENTS.md — NurseArena / Sahara Academy

## Project Overview
Next.js 14 App Router + React 19 + TypeScript + Tailwind CSS 4.
Nursing exam prep platform for West Bengal students (JEPBN, JENPAS-UG, JENPAS-PG, ANM/GNM, JEMScN, JEMAS).

## Tech Stack
- **Framework**: Next.js 16 (App Router), TypeScript, React 19
- **Auth + DB**: Appwrite Cloud (`appwrite` SDK v16)
- **State**: Zustand (`useAuthStore`, `useExamStore`, `useQuizStore`)
- **UI**: Tailwind CSS 4, Framer Motion, Lucide icons
- **Language**: Bengali / English

## Key Architecture Decisions
- Appwrite session cookie: `a_session_<projectId>` — checked in middleware
- `targetExams` stored as JSON string in Appwrite (stringify/parse on read/write)
- Server-side auth uses `node-appwrite` SDK with API key
- Admin routes check `is_admin` boolean on profile document
- Quiz scoring supports Category I (1/-0.25) and Category II (2/0) with partial credit

## Appwrite Collections Required
Create these in Appwrite Cloud Console (all lowercase camelCase attribute names):

### `profiles` — User profiles
| Attribute | Type | Notes |
|-----------|------|-------|
| email | string | User email |
| displayName | string | Display name |
| photoURL | string | Avatar URL |
| phone | string | Phone number |
| targetExams | string | JSON string array |
| jemasSubCourse | string | Sub-course for JEMAS |
| currentStage | string | Student/Appeared/Working Nurse |
| institution | string | Institution name |
| district | string | District |
| totalMarksEarned | number | Default: 0 |
| totalQuestionsAttempted | number | Default: 0 |
| totalCorrect | number | Default: 0 |
| totalWrong | number | Default: 0 |
| totalSkipped | number | Default: 0 |
| bestMockScore | number | Default: 0 |
| rapidFireUnlockedTier | number | Default: 1 |
| streakDays | number | Default: 0 |
| profileCompletePct | number | Default: 0 |
| is_admin | boolean | Default: false |

### `questions` — Question bank
| Attribute | Type | Notes |
|-----------|------|-------|
| exam_code | string | Exam code |
| question | string | Question text |
| option_a/b/c/d | string | Options |
| correct | string | A/B/C/D |
| subject_name | string | Subject name |
| topic | string | Topic |
| difficulty | string | easy/medium/hard |
| explanation | string | Explanation |
| archived | boolean | Soft delete flag |
| is_pyq | boolean | Previous year question |
| pyq_year | number | PYQ year |

### `quiz_sessions` — Quiz attempt sessions
| Attribute | Type | Notes |
|-----------|------|-------|
| quizId | string | Quiz/mock-test/reference document ID |
| userId | string | User document ID |
| totalQuestions | number | Total questions |
| maxScore | number | Maximum possible score |
| status | string | active/submitted |
| startedAt | string | ISO datetime |
| submittedAt | string | ISO datetime |
| score | number | Score earned |
| correctCount | number | Correct answers |
| wrongCount | number | Wrong answers |
| attemptedCount | number | Answered count |
| type | string | `mock_test` / `quiz` / `topicwise` / `rapid_fire` / `pyq` |
| title | string | Human-readable title (e.g. "Mock Test 1", "PYQ 2024") |
| reference_id | string | The original document ID (mock_test_id, quiz_id, etc.) |

### `session_answers` — Per-question answers
| Attribute | Type | Notes |
|-----------|------|-------|
| sessionId | string | Session document ID |
| userId | string | User document ID |
| questionId | string | Question document ID |
| orderIndex | number | Question order |
| selectedOption | string | Selected option |
| isCorrect | boolean | Correctness |
| marksAwarded | number | Marks awarded |
| timeTakenMs | number | Response time |
| answeredAt | string | ISO datetime |

### `mock_test_questions` — Mock test questions (NOT pooled from question bank)
| Attribute | Type | Notes |
|-----------|------|-------|
| mock_test_id | string | Reference to mock_tests document ID |
| question | string | Question text |
| option_a | string | Option A |
| option_b | string | Option B |
| option_c | string | Option C |
| option_d | string | Option D |
| correct | string | A/B/C/D |
| explanation | string | Explanation |
| order_index | number | Question order |

### `attempts` — Granular per-question history
| Attribute | Type | Notes |
|-----------|------|-------|
| userId | string | User ID |
| questionId | string | Question document ID |
| subject_name | string | Subject name for per-subject analytics |
| selectedOption | string | Selected option label (A/B/C/D) |
| isCorrect | boolean | Whether the answer was correct |
| timeTakenMs | number | Response time in milliseconds |

### Other collections
- `quizzes` — Quiz definitions
- `quiz_questions` — Quiz-to-question mapping
### `leaderboard` — Cached rank data (all 3 period types)
| Attribute | Type | Notes |
|-----------|------|-------|
| userId | string | User ID |
| exam_id | string | Exam code |
| period_type | string | daily / weekly / all_time |
| displayName | string | Display name |
| photoURL | string | Avatar URL |
| marksEarned | number | Marks for the period |
| correct | number | Correct answers for the period |
| wrong | number | Wrong answers for the period |
| percentage | number | Accuracy percentage |
| rank | number | Rank position |
| period_start | string | ISO date for daily/weekly reset tracking |
- Document ID format: `${userId}_${examCode}_${periodType}`
- `notifications` — Push notifications
- `mock_test_events` — Scheduled mock tests
- `live_quiz_events` — Live quiz events
- `missions` / `user_missions` — Gamification
- `subjects` / `topics` — Exam hierarchy

## Known Issues & Fixes

### 1. Onboarding redirect check
`src/app/(auth)/onboarding/page.tsx` fetches profile from Appwrite on mount. If profile doesn't exist or targetExams is empty, onboarding flow runs. After completion, it upserts profile and redirects to `/dashboard`. This is correct.

### 2. Profile name showing "Student"
If profile fetch fails (e.g. collection/attribute mismatch), the Zustand store falls back to defaults. Ensure the `profiles` collection has the correct attributes matching `normalizeProfile` in `src/store/authStore.ts`.

### 3. Logout
`src/app/(main)/profile/page.tsx` calls `account.deleteSession('current')` then `useAuthStore.getState().setUser(null)`. This is correct.

### 4. Login redirect logic
`src/app/(auth)/login/page.tsx` checks `targetExams` from fresh DB fetch, not stale Zustand store, so no redirect loop.

### 5. targetExams stored as JSON string
`JSON.stringify([])` is used before writing to Appwrite and `JSON.parse()` on read. This is correct for Appwrite string attributes.

### 6. Admin auth check
API routes use `requireAuth` / `getCurrentUser` from cookie, then verify `is_admin` on the profile document.

### 7. Mock test questions stored in `mock_test_questions` collection
NOT in the `questions` collection. Admin uploads CSV via `/admin/mock-tests/upload` and questions go to `mock_test_questions` with `mock_test_id` reference. The user Facing mock test page at `/mock-test` fetches from `mock_tests` where `status='published'` matching the user's active exam.

### 8. No question repetition across modes
All quiz modes (quiz, PYQ, topic-wise practice, rapid fire) check the `attempts` collection for the user's previously attempted question IDs and exclude them from the pool. If insufficient unseen questions remain, it falls back to the full pool.

### 9. Scoring by mode
- **Mock test**: 1 mark per correct, 0 for wrong/skipped (total = 100 for 100 questions)
- **Quiz**: Configurable scoring profile (default Category I: +1/-0.25)
- **Rapid Fire**: Count of correct answers (no negative marking in display)
- **PYQ/Practice**: Count of correct answers out of 10

### 10. CSV format for mock test upload
```csv
question,option_a,option_b,option_c,option_d,correct,explanation
What is the normal pH of blood?,7.35,7.45,7.0,7.5,A,The normal pH range of blood is 7.35-7.45.
```
- `correct` must be A/B/C/D (case-insensitive)
- Must upload exactly 100 questions  
- `explanation` is optional

## Dev Commands
```bash
npm run dev       # start dev server (pnpm dev)
npm run build     # production build
npm run lint      # lint check
```

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| NEXT_PUBLIC_APPWRITE_ENDPOINT | Yes | Appwrite API endpoint |
| NEXT_PUBLIC_APPWRITE_PROJECT_ID | Yes | Appwrite project ID |
| NEXT_PUBLIC_APPWRITE_DATABASE_ID | Yes | Database ID (client) |
| APPWRITE_API_KEY | Yes | Server API key |
| APPWRITE_DATABASE_ID | Yes | Database ID (server) |

## File Map
```
src/
  app/
    (auth)/login/page.tsx         — Email login
    (auth)/register/page.tsx      — Email register
    (auth)/onboarding/page.tsx    — Onboarding wizard
    (main)/dashboard/page.tsx     — User dashboard
    (main)/subjects/page.tsx      — Topic-wise subject grid
    (main)/subjects/[subjectId]/  — Subject detail practice
    (main)/practice/page.tsx      — Multi-exam picker
    (main)/quiz/[quizId]/page.tsx — Active quiz session
    (main)/quiz/result/page.tsx   — Quiz results
    (main)/rapid-fire/page.tsx    — Rapid fire mode
    (main)/mock-test/page.tsx     — Mock tests list
    (main)/mock-test/[mockTestId]/ — Mock test taking (90 min, 100 marks, navigation, submit & review)
    (main)/mock-test/result/     — Mock test result with full answer review
    (main)/quiz/pyq/             — PYQ quiz (10 questions, filter attempted, instant reveal)
    (main)/quiz/practice/        — Topic-wise practice (10 questions, filter attempted, instant reveal)
    (main)/live-quiz/page.tsx     — Live quizzes
    (main)/leaderboard/page.tsx   — Rankings
    (main)/analytics/page.tsx     — Performance analytics
    (main)/pyq/page.tsx           — Previous year questions
    (main)/profile/page.tsx       — User profile
    (main)/exam-select/page.tsx   — Switch active exam
    admin/mock-tests/upload/      — Mock test CSV upload (100 questions, auto-numbered)
    admin/                        — Admin panel
    api/                          — API routes
    layout.tsx                    — Root layout
    middleware.ts                 — Session check
    page.tsx                      — Landing page
  components/
    layout/                       — Sidebar, Navbar, BottomNav
    ui/                           — Button, Card, Input, etc.
    quiz/                         — QuizCard, QuizTimer, etc.
    exam/                         — SubjectGrid, ExamBadge, etc.
    gamification/                 — Badges, XP display
    charts/                       — Analytics charts
    AuthProvider.tsx              — Auth state initializer
    ThemeProvider.tsx             — Dark/light theme
  hooks/
    useQuiz.ts                    — Quiz engine
    useXP.ts                      — XP and tier system
    useExam.ts                    — Exam switching
    useMockTest.ts                — Mock test fetching
    useLiveQuiz.ts                — Live quiz engine
    useMissions.ts                — Missions/gamification
    useStreak.ts                  — Streak tracking
    useLeaderboard.ts             — Rankings
    useXPTransactions.ts          — Marks transactions
  lib/
    appwrite/                     — Appwrite client/server/auth
    exam-config.ts                — Exam definitions
    xp.ts                         — XP and tier calculations
    scoring.ts                    — Scoring profile logic
    utils.ts                      — Utility functions
    validate-env.ts               — Env validation
  services/
    mockTestQuestions.ts          — Mock test question CRUD, auto-numbering
  store/                          — Zustand stores
  types/                          — TypeScript types
```
