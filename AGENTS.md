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
| quizId | string | Quiz document ID |
| userId | string | User document ID |
| totalQuestions | number | Total questions |
| maxScore | number | Maximum possible score |
| status | string | active/submitted |
| startedAt | string | ISO datetime |
| submittedAt | string | ISO datetime |
| score | number | Score earned |
| correctCount | number | Correct answers |
| wrongCount | number | Wrong answers |

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

### Other collections
- `attempts` — Granular per-question history
- `quizzes` — Quiz definitions
- `quiz_questions` — Quiz-to-question mapping
- `leaderboard` — Cached rank data
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
    (main)/mock-test/page.tsx     — Mock tests
    (main)/live-quiz/page.tsx     — Live quizzes
    (main)/leaderboard/page.tsx   — Rankings
    (main)/analytics/page.tsx     — Performance analytics
    (main)/pyq/page.tsx           — Previous year questions
    (main)/profile/page.tsx       — User profile
    (main)/exam-select/page.tsx   — Switch active exam
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
  services/                       — Data access layer
  store/                          — Zustand stores
  types/                          — TypeScript types
```
