# NurseArena

**Battle Your Way to WB Nursing Success**

A comprehensive exam preparation platform for West Bengal nursing and allied health entrance examinations. Built with Next.js 16, Appwrite Cloud, and TypeScript.

## Supported Exams

| Exam | Description |
|------|-------------|
| **JENPAS (UG)** | B.Sc. Nursing, Allied Health Sciences & BHA |
| **ANM & GNM** | Auxiliary Nursing & Midwifery / General Nursing & Midwifery |
| **JEPBN 2026** | Post-Basic B.Sc. Nursing Entrance |
| **JEMScN 2026** | M.Sc. Nursing Entrance |
| **JEMAS (PG)** | MHA · MPH · M.Sc. MLT · MAN · M.Sc. MBT · M.Phil CP/PSW |

## Features

- **Topic-wise Practice** — Subject-wise MCQs with real exam marking schemes (Category I & II)
- **Weekly Mock Tests** — Auto-uploaded full-length mocks with negative marking
- **Rapid Fire Mode** — Speed rounds with 5 unlockable tiers (15s → 3s per question)
- **Leaderboards** — Marks-based ranking per exam
- **Performance Analytics** — Subject-wise breakdowns and trend tracking
- **Previous Year Questions** — PYQ bank with year filtering
- **Live Quizzes** — Real-time competitive quiz events
- **Gamification** — XP system, missions, streaks, tier unlocks
- **Dark/Light Theme** — Persistent theme toggle

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, Framer Motion, Lucide Icons |
| Auth + DB | Appwrite Cloud (SDK v16) |
| State | Zustand (persist middleware) |
| Forms | react-hook-form + Zod |
| Charts | Recharts |
| Package Manager | pnpm |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 11+
- Appwrite Cloud account (free tier)

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd nursearena

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Fill in .env.local
#    - Get your Appwrite endpoint + project ID from Appwrite Console → Settings → Keys
#    - Generate an API key with full access
#    - Create a database named "nursearena" in Appwrite Console

# 5. Start dev server
pnpm dev
```

### Appwrite Collections Setup

Create the following collections in your Appwrite database. Use **lowercase camelCase** for all attribute names.

See `DEPLOYMENT.md` for the full collection schema reference with all required attributes.

#### Required Collections

- `profiles` — User profiles (use user `$id` as document ID)
- `questions` — Question bank
- `quizzes` — Quiz definitions
- `quiz_questions` — Quiz-to-question mapping
- `quiz_sessions` — Active/submitted quiz attempts
- `session_answers` — Per-question answers within a session
- `attempts` — Granular per-question history
- `leaderboard` — Cached rank data (daily/weekly/all_time)
- `notifications` — Push notifications
- `mock_test_events` — Scheduled mock tests
- `live_quiz_events` — Live quiz events
- `missions` / `user_missions` — Gamification
- `subjects` / `topics` — Exam subject hierarchy

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Yes | Appwrite API endpoint (e.g. `https://cloud.appwrite.io/v1`) |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Yes | Appwrite project ID |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Yes | Database ID for client SDK |
| `APPWRITE_API_KEY` | Yes | Server API key (kept server-side) |
| `APPWRITE_DATABASE_ID` | Yes | Database ID for server SDK |

## Scripts

```bash
pnpm dev       # Start development server
pnpm build     # Production build
pnpm start     # Start production server
pnpm lint      # Run ESLint
```

## Architecture

```
src/
├── app/                   # Next.js App Router
│   ├── (auth)/            # Login, register, onboarding
│   ├── (main)/            # Dashboard, quiz, subjects, profile
│   ├── admin/             # Admin panel (questions, quizzes, users)
│   ├── api/               # Route handlers (server-side Appwrite)
│   ├── layout.tsx         # Root layout with theme + auth providers
│   ├── middleware.ts       # Session cookie check
│   └── page.tsx           # Landing page
├── components/            # Reusable UI components
│   ├── layout/            # Sidebar, Navbar, BottomNav
│   ├── ui/                # Button, Card, Input, Badge
│   ├── quiz/              # QuizCard, QuizTimer, QuizProgress
│   ├── exam/              # SubjectGrid, ExamBadge
│   └── gamification/      # SpeedSeekerBadge, XP display
├── hooks/                 # Custom React hooks
│   ├── useQuiz.ts         # Quiz engine (start, answer, submit)
│   ├── useXP.ts           # Marks → XP → tier system
│   ├── useExam.ts         # Active exam switching
│   └── ...
├── lib/                   # Utilities
│   ├── appwrite/          # Client, server, auth helpers
│   ├── exam-config.ts     # Exam definitions (subjects, marks)
│   ├── xp.ts              # Tier calculations, marks → XP
│   └── scoring.ts         # Scoring profile logic
├── services/              # Data access layer (Appwrite queries)
├── store/                 # Zustand stores
└── types/                 # TypeScript interfaces
```

## Scoring Rules

- **Category I**: +1 for correct, −0.25 for wrong, 0 for skipped
- **Category II**: +2 for fully correct (all correct options selected, no wrong ones), partial credit proportional to selected/correct ratio, 0 for wrong (no negative)

## Deployment

See `DEPLOYMENT.md` for the full Appwrite + Railway deployment guide.

## License

All Rights Reserved. © 2026 NurseArena. Developed by Aritra Banerjee & Arijit Dey.
