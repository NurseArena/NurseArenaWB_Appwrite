import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases, ID, Permission, Role } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.APPWRITE_DATABASE_ID;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createCollectionWithTypes(name, attributes, permissions) {
  let isNew = false;
  try {
    const perms = permissions ?? [
      Permission.create(Role.any()),
      Permission.read(Role.any()),
    ];
    await databases.createCollection(DB_ID, name, name, perms);
    console.log(`  Created collection: ${name}`);
    isNew = true;
  } catch (e) {
    if (e.message?.includes('already exists') || e.type === 'collection_already_exists') {
      console.log(`  skip (exists): ${name}`);
    } else {
      throw e;
    }
  }

  if (isNew) await sleep(1500);

  for (const attr of attributes) {
    try {
      const required = attr.required ?? false;
      const hasDefault = attr.default !== undefined;

      switch (attr.type) {
        case 'string':
          if (hasDefault) {
            await databases.createStringAttribute(DB_ID, name, attr.key, attr.size ?? 255, required, attr.default);
          } else {
            await databases.createStringAttribute(DB_ID, name, attr.key, attr.size ?? 255, required);
          }
          break;
        case 'number':
          if (hasDefault) {
            await databases.createFloatAttribute(DB_ID, name, attr.key, required, undefined, undefined, attr.default);
          } else {
            await databases.createFloatAttribute(DB_ID, name, attr.key, required);
          }
          break;
        case 'boolean':
          if (hasDefault) {
            await databases.createBooleanAttribute(DB_ID, name, attr.key, required, attr.default);
          } else {
            await databases.createBooleanAttribute(DB_ID, name, attr.key, required);
          }
          break;
        case 'integer':
          if (hasDefault) {
            await databases.createIntegerAttribute(DB_ID, name, attr.key, required, undefined, undefined, attr.default);
          } else {
            await databases.createIntegerAttribute(DB_ID, name, attr.key, required);
          }
          break;
        default:
          console.log(`    unknown type ${attr.type}: ${attr.key}`);
          continue;
      }
      console.log(`    created ${attr.key} (${attr.type})`);
    } catch (e) {
      if (e.message?.includes('already exists') || e.type === 'attribute_already_exists') {
        console.log(`    skip (exists): ${attr.key}`);
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  console.log('Creating collections...\n');

  // 1. profiles — 20 attributes, use size 255 mostly, 2048 only for URLs
  await createCollectionWithTypes('profiles', [
    { key: 'email', type: 'string', required: true, size: 255 },
    { key: 'displayName', type: 'string', required: true, size: 255 },
    { key: 'photoURL', type: 'string', required: false, default: null, size: 2048 },
    { key: 'phone', type: 'string', required: false, default: '', size: 20 },
    { key: 'targetExams', type: 'string', required: false, default: '[]', size: 500 },
    { key: 'jemasSubCourse', type: 'string', required: false, default: '', size: 50 },
    { key: 'currentStage', type: 'string', required: false, default: 'Student', size: 50 },
    { key: 'institution', type: 'string', required: false, default: '', size: 255 },
    { key: 'district', type: 'string', required: false, default: '', size: 100 },
    { key: 'totalMarksEarned', type: 'number', required: false, default: 0 },
    { key: 'totalQuestionsAttempted', type: 'number', required: false, default: 0 },
    { key: 'totalCorrect', type: 'number', required: false, default: 0 },
    { key: 'totalWrong', type: 'number', required: false, default: 0 },
    { key: 'totalSkipped', type: 'number', required: false, default: 0 },
    { key: 'bestMockScore', type: 'number', required: false, default: 0 },
    { key: 'rapidFireUnlockedTier', type: 'number', required: false, default: 1 },
    { key: 'streakDays', type: 'number', required: false, default: 0 },
    { key: 'lastLoginAt', type: 'string', required: false, default: null, size: 50 },
    { key: 'profileCompletePct', type: 'number', required: false, default: 0 },
    { key: 'is_admin', type: 'boolean', required: false, default: false },
  ]);

  // 2. questions — 18 attributes
  await createCollectionWithTypes('questions', [
    { key: 'exam_code', type: 'string', required: true, size: 50 },
    { key: 'question', type: 'string', required: true, size: 2048 },
    { key: 'option_a', type: 'string', required: true, size: 1024 },
    { key: 'option_b', type: 'string', required: true, size: 1024 },
    { key: 'option_c', type: 'string', required: true, size: 1024 },
    { key: 'option_d', type: 'string', required: true, size: 1024 },
    { key: 'correct', type: 'string', required: true, size: 10 },
    { key: 'subject_name', type: 'string', required: false, default: '', size: 100 },
    { key: 'subject_id', type: 'string', required: false, default: null, size: 50 },
    { key: 'topic', type: 'string', required: false, default: '', size: 100 },
    { key: 'topic_id', type: 'string', required: false, default: null, size: 50 },
    { key: 'difficulty', type: 'string', required: false, default: 'medium', size: 20 },
    { key: 'explanation', type: 'string', required: false, default: '', size: 2048 },
    { key: 'archived', type: 'boolean', required: false, default: false },
    { key: 'is_pyq', type: 'boolean', required: false, default: false },
    { key: 'pyq_year', type: 'integer', required: false, default: null },
    { key: 'content_hash', type: 'string', required: false, size: 64 },
    { key: 'quiz_pool_status', type: 'string', required: false, default: 'available', size: 20 },
  ]);

  // 3. quizzes
  await createCollectionWithTypes('quizzes', [
    { key: 'exam_code', type: 'string', required: true, size: 50 },
    { key: 'title', type: 'string', required: true, size: 255 },
    { key: 'type', type: 'string', required: true, size: 50 },
    { key: 'question_count', type: 'integer', required: true },
    { key: 'duration_seconds', type: 'integer', required: false },
    { key: 'per_question_seconds', type: 'integer', required: false, default: null },
    { key: 'scoring_profile_id', type: 'string', required: false, default: null, size: 50 },
    { key: 'is_active', type: 'boolean', required: false, default: true },
    { key: 'live_at', type: 'string', required: false, default: null, size: 50 },
    { key: 'live_status', type: 'string', required: false, default: null, size: 20 },
    { key: 'subject_name', type: 'string', required: false, size: 100 },
    { key: 'marks_correct', type: 'number', required: false },
    { key: 'marks_wrong', type: 'number', required: false },
  ]);

  // 4. quiz_questions
  await createCollectionWithTypes('quiz_questions', [
    { key: 'quiz_id', type: 'string', required: true, size: 50 },
    { key: 'question_id', type: 'string', required: true, size: 50 },
    { key: 'order_index', type: 'integer', required: true },
  ]);

  // 5. quiz_sessions
  await createCollectionWithTypes('quiz_sessions', [
    { key: 'userId', type: 'string', required: true, size: 50 },
    { key: 'quizId', type: 'string', required: true, size: 50 },
    { key: 'startedAt', type: 'string', required: true, size: 50 },
    { key: 'totalQuestions', type: 'integer', required: true },
    { key: 'maxScore', type: 'number', required: true },
    { key: 'status', type: 'string', required: true, size: 20 },
    { key: 'submittedAt', type: 'string', required: false, size: 50 },
    { key: 'score', type: 'number', required: false },
    { key: 'correctCount', type: 'integer', required: false },
    { key: 'wrongCount', type: 'integer', required: false },
    { key: 'attemptedCount', type: 'integer', required: false },
    { key: 'totalSkipped', type: 'integer', required: false },
    { key: 'negativePenalty', type: 'number', required: false },
    { key: 'percentage', type: 'number', required: false },
    { key: 'totalMarks', type: 'number', required: false },
    { key: 'attemptNumber', type: 'integer', required: false },
    { key: 'examCode', type: 'string', required: false, size: 50 },
    { key: 'isLiveAttempt', type: 'boolean', required: false, default: false },
    { key: 'type', type: 'string', required: false, size: 30 },
    { key: 'title', type: 'string', required: false, size: 255 },
    { key: 'reference_id', type: 'string', required: false, size: 50 },
  ]);

  // 6. session_answers
  await createCollectionWithTypes('session_answers', [
    { key: 'sessionId', type: 'string', required: true, size: 50 },
    { key: 'userId', type: 'string', required: true, size: 50 },
    { key: 'questionId', type: 'string', required: true, size: 50 },
    { key: 'orderIndex', type: 'integer', required: true },
    { key: 'selectedOption', type: 'string', required: false, size: 10 },
    { key: 'isCorrect', type: 'boolean', required: true },
    { key: 'marksAwarded', type: 'number', required: false },
    { key: 'timeTakenMs', type: 'integer', required: true },
    { key: 'answeredAt', type: 'string', required: true, size: 50 },
  ]);

  // 7. attempts
  await createCollectionWithTypes('attempts', [
    { key: 'userId', type: 'string', required: true, size: 50 },
    { key: 'questionId', type: 'string', required: true, size: 50 },
    { key: 'selectedOption', type: 'string', required: false, size: 10 },
    { key: 'isCorrect', type: 'boolean', required: true },
    { key: 'timeTakenMs', type: 'integer', required: true },
  ]);

  // 8. leaderboard
  await createCollectionWithTypes('leaderboard', [
    { key: 'userId', type: 'string', required: true, size: 50 },
    { key: 'exam_id', type: 'string', required: true, size: 50 },
    { key: 'period_type', type: 'string', required: true, size: 20 },
    { key: 'marksEarned', type: 'number', required: true },
    { key: 'rank', type: 'integer', required: true },
    { key: 'percentage', type: 'number', required: false },
    { key: 'displayName', type: 'string', required: false, size: 255 },
    { key: 'photoURL', type: 'string', required: false, size: 2048 },
    { key: 'wrong', type: 'integer', required: false },
    { key: 'correctCount', type: 'integer', required: false },
  ]);

  // 9. notifications
  await createCollectionWithTypes('notifications', [
    { key: 'title', type: 'string', required: true, size: 255 },
    { key: 'body', type: 'string', required: true, size: 2048 },
    { key: 'type', type: 'string', required: true, size: 20 },
    { key: 'targetExams', type: 'string', required: true, size: 500 },
    { key: 'readBy', type: 'string', required: true, size: 2000 },
  ]);

  // 10. mock_tests
  await createCollectionWithTypes('mock_tests', [
    { key: 'exam_code', type: 'string', required: true, size: 50 },
    { key: 'title', type: 'string', required: true, size: 255 },
    { key: 'serial_number', type: 'integer', required: true },
    { key: 'duration_seconds', type: 'integer', required: true },
    { key: 'status', type: 'string', required: false, default: 'draft', size: 20 },
    { key: 'published_at', type: 'string', required: false, size: 50 },
  ]);

  // 11. mock_test_events
  await createCollectionWithTypes('mock_test_events', [
    { key: 'exam_code', type: 'string', required: true, size: 50 },
    { key: 'scheduled_at', type: 'string', required: true, size: 50 },
    { key: 'duration_min', type: 'integer', required: true },
    { key: 'max_participants', type: 'integer', required: false },
    { key: 'week_number', type: 'integer', required: false },
    { key: 'year', type: 'integer', required: false },
  ]);

  // 12. live_quiz_events
  await createCollectionWithTypes('live_quiz_events', [
    { key: 'exam_code', type: 'string', required: true, size: 50 },
    { key: 'starts_at', type: 'string', required: true, size: 50 },
    { key: 'timezone', type: 'string', required: true, size: 50 },
    { key: 'duration_min', type: 'integer', required: true },
    { key: 'status', type: 'string', required: false, default: 'scheduled', size: 20 },
    { key: 'current_q_index', type: 'integer', required: false, default: 0 },
    { key: 'questionSetId', type: 'string', required: false, size: 50 },
  ]);

  // 13. quiz_results
  await createCollectionWithTypes('quiz_results', [
    { key: 'quizEventId', type: 'string', required: true, size: 50 },
    { key: 'userId', type: 'string', required: true, size: 50 },
    { key: 'score', type: 'number', required: false, default: 0 },
    { key: 'marksEarned', type: 'number', required: false, default: 0 },
    { key: 'correctCount', type: 'integer', required: false, default: 0 },
    { key: 'totalLatencyMs', type: 'integer', required: false, default: 0 },
    { key: 'joinedAtIndex', type: 'integer', required: false, default: 0 },
    { key: 'disconnectionFlag', type: 'boolean', required: false, default: false },
  ]);

  // 14. quiz_answers
  await createCollectionWithTypes('quiz_answers', [
    { key: 'quizEventId', type: 'string', required: true, size: 50 },
    { key: 'userId', type: 'string', required: true, size: 50 },
    { key: 'questionIndex', type: 'integer', required: true },
    { key: 'selectedOption', type: 'string', required: false, size: 10 },
    { key: 'isCorrect', type: 'boolean', required: false },
  ]);

  // 15. missions
  await createCollectionWithTypes('missions', [
    { key: 'examCode', type: 'string', required: false, size: 50 },
    { key: 'title', type: 'string', required: true, size: 255 },
    { key: 'description', type: 'string', required: false, size: 2048 },
    { key: 'xpReward', type: 'integer', required: true },
    { key: 'type', type: 'string', required: true, size: 50 },
    { key: 'target', type: 'integer', required: true },
    { key: 'is_daily', type: 'boolean', required: false },
  ]);

  // 16. user_missions
  await createCollectionWithTypes('user_missions', [
    { key: 'userId', type: 'string', required: true, size: 50 },
    { key: 'missionId', type: 'string', required: true, size: 50 },
    { key: 'progress', type: 'integer', required: true },
    { key: 'completed', type: 'boolean', required: true },
    { key: 'assignedDate', type: 'string', required: true, size: 20 },
  ]);

  // 17. subjects
  await createCollectionWithTypes('subjects', [
    { key: 'name', type: 'string', required: true, size: 100 },
    { key: 'exam_code', type: 'string', required: false, size: 50 },
  ]);

  // 18. topics
  await createCollectionWithTypes('topics', [
    { key: 'subject_id', type: 'string', required: true, size: 50 },
    { key: 'name', type: 'string', required: true, size: 100 },
  ]);

  // ── Indexes for leaderboard ──────────────────────────────────────────
  console.log('\nCreating indexes for leaderboard...');
  for (const idx of [
    {
      key: 'exam_period_marks_desc',
      type: 'key',
      attributes: ['exam_id', 'period_type', 'marksEarned'],
      orders: ['ASC', 'ASC', 'DESC'],
    },
    {
      key: 'exam_period',
      type: 'key',
      attributes: ['exam_id', 'period_type'],
      orders: ['ASC', 'ASC'],
    },
  ]) {
    try {
      await databases.createIndex(DB_ID, 'leaderboard', idx.key, idx.type, idx.attributes, idx.orders);
      console.log(`  Created index: ${idx.key}`);
    } catch (e) {
      if (e.message?.includes('already exists') || e.type === 'index_already_exists') {
        console.log(`  skip (exists): ${idx.key}`);
      } else {
        throw e;
      }
    }
  }

  // ── Seed a sample leaderboard entry for testing ──────────────────────
  console.log('\nSeeding sample leaderboard entry...');
  const sampleUserId = 'seed_demo_user';
  const sampleDocId = `${sampleUserId}_JEPBN_all_time`;
  try {
    await databases.getDocument(DB_ID, 'leaderboard', sampleDocId);
    console.log('  skip (already seeded)');
  } catch {
    await databases.createDocument(DB_ID, 'leaderboard', sampleDocId, {
      userId: sampleUserId,
      exam_id: 'JEPBN',
      period_type: 'all_time',
      displayName: 'Demo User',
      photoURL: '',
      marksEarned: 85.5,
      percentage: 85.5,
      wrong: 8,
      rank: 1,
    });
    console.log('  Created demo leaderboard entry');
  }

  console.log('\nAll done.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
