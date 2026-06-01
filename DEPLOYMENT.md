# Deployment Guide: NurseArena / Sahara Academy

## Architecture

- **Hosting**: Railway (Next.js 14 App Router)
- **Auth + Database**: Appwrite Cloud (no separate DB server needed)
- **File Upload**: Appwrite Cloud Storage (use Storage SDK)
- **Scheduling**: Railway Cron Jobs (for mock tests, streak resets)

---

## 1. Appwrite Cloud Setup

### 1.1 Create Project
1. Go to [Appwrite Console](https://cloud.appwrite.io) → **Create project**
2. Name: `nursearena` (or any name)
3. Note the **Project ID** from Settings → Keys

### 1.2 Add Platform
1. In your project → **Settings** → **Platforms**
2. **Add Web Platform**:
   - Name: `NurseArena Web`
   - Hostname: your Railway domain (e.g., `nursearena-production.up.railway.app`)
   - Add `localhost` for local dev: `localhost`
   - Add `*` for wildcard (optional)

### 1.3 Generate API Key
1. **Settings** → **API Keys** → **Create API Key**
2. Name: `NurseArena Server`
3. Scopes (grant ALL for simplicity, or restrict to needed resources):
   - `users.read`, `users.write`
   - `documents.read`, `documents.write`
   - `files.read`, `files.write`
   - `sessions.read`, `sessions.write`
   - `teams.read`, `teams.write` (if using teams)
4. Copy the generated API key — you will only see it once

### 1.4 Create the Database

1. **Database** → **Create Database**
   - Name: `nursearena`
   - ID: `nursearena` (reuse the ID everywhere)
2. Note: Appwrite database ID is case-sensitive

### 1.5 Create Collections

Create each collection below with its attributes. Set **Permission** to **"Anyone"** read/write for development (Appwrite RLS is not as granular as Supabase — the admin API key in server-side code handles auth; client-side security comes from the SDK session cookie).

All collections use the following system attributes automatically:
- `$id`, `$createdAt`, `$updatedAt` (auto-generated)
- `$permissions` (optional, set to `[]` for "Anyone" access)

> **Important column names**: Use **lowercase camelCase** for all attribute names (e.g. `exam_code`, `displayName`, `targetExams`).

#### `profiles`
| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `email` | string | Yes | User email |
| `displayName` | string | Yes | Display name |
| `photoURL` | string | No | Avatar URL |
| `phone` | string | No | Phone number |
| `targetExams` | string | No | **JSON string** (e.g. `'["JENPAS-UG","JEMAS"]'`) |
| `jemasSubCourse` | string | No | Sub-course for JEMAS |
| `currentStage` | string | No | Student/Tutor/etc |
| `institution` | string | No | Institution name |
| `district` | string | No | District |
| `totalMarksEarned` | number | No | Default: 0 |
| `totalQuestionsAttempted` | number | No | Default: 0 |
| `totalCorrect` | number | No | Default: 0 |
| `totalWrong` | number | No | Default: 0 |
| `totalSkipped` | number | No | Default: 0 |
| `bestMockScore` | number | No | Default: 0 |
| `rapidFireUnlockedTier` | number | No | Default: 1 |
| `streakDays` | number | No | Default: 0 |
| `profileCompletePct` | number | No | Default: 0 |
| `is_admin` | boolean | No | Default: false |

#### `questions`
| Attribute | Type | Required |
|-----------|------|----------|
| `exam_code` | string | Yes |
| `question` | string | Yes |
| `option_a` | string | Yes |
| `option_b` | string | Yes |
| `option_c` | string | Yes |
| `option_d` | string | Yes |
| `correct` | string | Yes (A/B/C/D) |
| `subject_name` | string | No |
| `topic` | string | No |
| `difficulty` | string | No (easy/medium/hard) |
| `explanation` | string | No |
| `archived` | boolean | No |
| `is_pyq` | boolean | No |
| `pyq_year` | number | No |

#### `quiz_sessions`
| Attribute | Type | Required |
|-----------|------|----------|
| `quizId` | string | Yes |
| `userId` | string | Yes |
| `totalQuestions` | number | Yes |
| `maxScore` | number | Yes |
| `status` | string | Yes (active/submitted) |
| `startedAt` | string | Yes (ISO date) |

#### `session_answers`
| Attribute | Type | Required |
|-----------|------|----------|
| `sessionId` | string | Yes |
| `userId` | string | Yes |
| `questionId` | string | Yes |
| `orderIndex` | number | Yes |
| `selectedOption` | string | No |
| `isCorrect` | boolean | Yes |
| `marksAwarded` | number | No |
| `timeTakenMs` | number | Yes |
| `answeredAt` | string | Yes (ISO date) |

#### `attempts`
| Attribute | Type | Required |
|-----------|------|----------|
| `userId` | string | Yes |
| `questionId` | string | Yes |
| `selectedOption` | string | No |
| `isCorrect` | boolean | Yes |
| `timeTakenMs` | number | Yes |

#### `quizzes`
| Attribute | Type | Required |
|-----------|------|----------|
| `exam_code` | string | Yes |
| `type` | string | Yes (mock/quiz/topicwise/rapid_fire/live/daily/pyq) |
| `title` | string | Yes |
| `question_count` | number | Yes |
| `duration_seconds` | number | No |

#### `quiz_questions`
| Attribute | Type | Required |
|-----------|------|----------|
| `quiz_id` | string | Yes |
| `question_id` | string | Yes |
| `order_index` | number | Yes |

#### `leaderboard`
| Attribute | Type | Required |
|-----------|------|----------|
| `userId` | string | Yes |
| `exam_id` | string | Yes |
| `period_type` | string | Yes (daily/weekly/all_time) |
| `marksEarned` | number | Yes |

#### `notifications`
| Attribute | Type | Required |
|-----------|------|----------|
| `title` | string | Yes |
| `message` | string | Yes |
| `type` | string | Yes (general/exam/quiz) |
| `targetAudience` | string | No (all/students/teachers) |
| `createdAt` | string | Yes (ISO date) |

#### `mock_test_events`
| Attribute | Type | Required |
|-----------|------|----------|
| `title` | string | Yes |
| `exam_id` | string | Yes |
| `exam_code` | string | Yes |
| `scheduled_at` | string | Yes (ISO date) |
| `duration_min` | number | Yes |
| `status` | string | Yes (scheduled/active/completed/cancelled) |

#### `live_quiz_events`
| Attribute | Type | Required |
|-----------|------|----------|
| `title` | string | Yes |
| `exam_id` | string | Yes |
| `exam_code` | string | Yes |
| `scheduled_at` | string | Yes (ISO date) |
| `duration_min` | number | Yes |
| `status` | string | Yes (scheduled/active/completed/cancelled) |

#### `subjects`
| Attribute | Type | Required |
|-----------|------|----------|
| `name` | string | Yes |
| `exam_code` | string | Yes |

#### `topics`
| Attribute | Type | Required |
|-----------|------|----------|
| `subjectId` | string | Yes |
| `name` | string | Yes |
| `orderIndex` | number | No |

#### `user_missions`
| Attribute | Type | Required |
|-----------|------|----------|
| `userId` | string | Yes |
| `missionId` | string | Yes |
| `progress` | number | Yes |
| `target` | number | Yes |
| `completed` | boolean | Yes |
| `claimed` | boolean | No |
| `type` | string | Yes (daily/weekly) |
| `createdAt` | string | Yes (ISO date) |

#### `missions`
| Attribute | Type | Required |
|-----------|------|----------|
| `title` | string | Yes |
| `description` | string | Yes |
| `type` | string | Yes (daily/weekly) |
| `target` | number | Yes |
| `reward` | number | Yes |

#### `xp_transactions` (or `marks_transactions`)
| Attribute | Type | Required |
|-----------|------|----------|
| `userId` | string | Yes |
| `amount` | number | Yes |
| `reason` | string | Yes |
| `type` | string | Yes (earned/spent) |
| `createdAt` | string | Yes (ISO date) |

#### `quiz_results`
| Attribute | Type | Required |
|-----------|------|----------|
| `userId` | string | Yes |
| `quizId` | string | Yes |
| `sessionId` | string | Yes |
| `score` | number | Yes |
| `total` | number | Yes |
| `timeTakenMs` | number | No |
| `exam_code` | string | No |
| `completedAt` | string | Yes (ISO date) |

---

## 2. Railway Deployment

### 2.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial migration: Supabase to Appwrite"
git remote add origin https://github.com/<your-org>/nursearena.git
git push -u origin main
```

### 2.2 Deploy on Railway
1. Go to [Railway Dashboard](https://railway.app/dashboard) → **New Project**
2. Select **Deploy from GitHub repo** → connect your repo
3. Railway auto-detects Next.js → sets build command to `npm run build`

### 2.3 Configure Environment Variables
In Railway dashboard → your project → **Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | `https://cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Your Appwrite project ID |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | `nursearena` |
| `APPWRITE_API_KEY` | Your server API key |
| `APPWRITE_DATABASE_ID` | `nursearena` |

Railway auto-sets `PORT` and `NODE_ENV=production`.

### 2.4 Update Appwrite Platform
After deployment, you'll get a Railway URL like `https://nursearena-production.up.railway.app`.

1. Go back to **Appwrite Console** → **Settings** → **Platforms**
2. Edit your Web platform → add the Railway URL as a hostname
3. If you added `*` wildcard earlier, this step is optional

---

## 3. Post-Deployment Verification

### 3.1 Auth Flow
1. Open your Railway URL
2. Create a new account → should redirect to **Onboarding**
3. Fill in exam selection, personal info → should redirect to **Dashboard**
4. Logout → click logout in profile page
5. Login again → should go directly to **Dashboard** (no onboarding loop)

### 3.2 Profile Load
1. Log in
2. Navigate to Profile page → should show your name, not "Student"
3. `is_admin` must be manually set to `true` in Appwrite Console for admin users

### 3.3 Admin Access
To make yourself admin:
1. Go to **Appwrite Console** → **Database** → `nursearena` → `profiles`
2. Find your document → edit `is_admin` to `true`
3. Access `/admin` on your Railway URL

### 3.4 Quiz Flow
1. As admin, create questions via admin panel (`/admin`)
2. Create a quiz with questions
3. Log in as a regular user → attempt the quiz
4. Submit answers → verify results show on dashboard

---

## 4. Railway Cron Jobs (Optional)

For scheduled tasks (streak resets, daily missions):

1. **Railway Dashboard** → your project → **Cron Jobs**
2. Create a cron job pointing to a Next.js API route:
   - Endpoint: `POST https://your-app.railway.app/api/cron/reset-streaks`
   - Schedule: `0 0 * * *` (daily midnight)
3. No auth needed if you firewall the cron endpoint

---

## 5. Troubleshooting

### "Missing environment variables" error
Ensure ALL env vars from step 2.3 are set in Railway.

### 401 Unauthorized on API routes
- The Appwrite session cookie (`a_session_<projectId>`) is set by the Appwrite SDK
- For server-side verification, the cookie is forwarded in the `Cookie` header
- Make sure your Web platform hostname in Appwrite matches your Railway URL

### 403 Forbidden on admin pages
- Check `is_admin` field in the `profiles` collection for your user document
- Must be boolean `true`, not string `"true"`

### "Collection not found" errors
- Verify collection names match exactly (case-sensitive): `profiles`, `questions`, etc.
- Verify all attributes are created (missing attributes cause silent failures)

### Build fails on Railway
1. Check build logs: `npm run build`
2. Common issues:
   - Missing `sharp` — add `"sharp": "^0.33"` to dependencies
   - Turbopack root — this config already has `turbopack: { root: process.cwd() }`
   - TypeScript errors — fix locally first, then push

### Appwrite SDK says "No user found"
- User is not logged in (session expired or never created)
- Check that `account.createEmailPasswordSession()` succeeded during login
- Check browser DevTools → Application → Cookies for `a_session_<projectId>` cookie

---

## 6. Development vs Production

| Aspect | Local Dev | Railway Prod |
|--------|-----------|--------------|
| URL | `http://localhost:3000` | `https://your-app.railway.app` |
| Start | `npm run dev` | `npm run start` (auto via Railway) |
| Appwrite Platform | Add `localhost` | Add Railway URL |
| Env vars | `.env.local` file | Railway Variables panel |
| Build | `npm run build` | Auto on push to main |
