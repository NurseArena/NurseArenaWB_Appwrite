import 'dotenv/config';
import { Client, Databases, ID } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.APPWRITE_DATABASE_ID;

async function createCollection(name, attributes) {
  try {
    await databases.createCollection(DB_ID, ID.unique(), name);
    console.log(`  Created collection: ${name}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.type === 'collection_already_exists') {
      console.log(`  skip (exists): ${name}`);
      return;
    }
    throw e;
  }

  for (const attr of attributes) {
    try {
      await databases.createStringAttribute(DB_ID, name, attr.key, attr.size ?? 2048, attr.required ?? false);
      console.log(`    created ${attr.key}`);
    } catch (e) {
      if (e.message?.includes('already exists') || e.type === 'attribute_already_exists') {
        console.log(`    skip (exists): ${attr.key}`);
      } else {
        throw e;
      }
    }
  }
}

async function createCollectionWithTypes(name, attributes) {
  try {
    await databases.createCollection(DB_ID, ID.unique(), name);
    console.log(`  Created collection: ${name}`);
  } catch (e) {
    if (e.message?.includes('already exists') || e.type === 'collection_already_exists') {
      console.log(`  skip (exists): ${name}`);
      return;
    }
    throw e;
  }

  for (const attr of attributes) {
    try {
      const params = [DB_ID, name, attr.key];
      const opts = { required: attr.required ?? false, default: attr.default };

      switch (attr.type) {
        case 'string':
          await databases.createStringAttribute(...params, attr.size ?? 2048, attr.required ?? false, opts.default);
          break;
        case 'number':
          await databases.createFloatAttribute(...params, attr.required ?? false, undefined, undefined, opts.default);
          break;
        case 'boolean':
          await databases.createBooleanAttribute(...params, attr.required ?? false, opts.default === true);
          break;
        case 'integer':
          await databases.createIntegerAttribute(...params, attr.required ?? false, undefined, undefined, opts.default);
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

  // 1. profiles
  await createCollectionWithTypes('profiles', [
    { key: 'email', type: 'string', required: true },
    { key: 'displayName', type: 'string', required: true },
    { key: 'photoURL', type: 'string', required: false, default: null },
    { key: 'phone', type: 'string', required: false, default: '' },
    { key: 'targetExams', type: 'string', required: false, default: '[]' },
    { key: 'jemasSubCourse', type: 'string', required: false, default: '' },
    { key: 'currentStage', type: 'string', required: false, default: 'Student' },
    { key: 'institution', type: 'string', required: false, default: '' },
    { key: 'district', type: 'string', required: false, default: '' },
    { key: 'totalMarksEarned', type: 'number', required: false, default: 0 },
    { key: 'totalQuestionsAttempted', type: 'number', required: false, default: 0 },
    { key: 'totalCorrect', type: 'number', required: false, default: 0 },
    { key: 'totalWrong', type: 'number', required: false, default: 0 },
    { key: 'totalSkipped', type: 'number', required: false, default: 0 },
    { key: 'bestMockScore', type: 'number', required: false, default: 0 },
    { key: 'rapidFireUnlockedTier', type: 'number', required: false, default: 1 },
    { key: 'streakDays', type: 'number', required: false, default: 0 },
    { key: 'lastLoginAt', type: 'string', required: false, default: null },
    { key: 'profileCompletePct', type: 'number', required: false, default: 0 },
    { key: 'is_admin', type: 'boolean', required: false, default: false },
  ]);

  // 2. questions
  await createCollectionWithTypes('questions', [
    { key: 'exam_code', type: 'string', required: true },
    { key: 'question', type: 'string', required: true, size: 4096 },
    { key: 'option_a', type: 'string', required: true },
    { key: 'option_b', type: 'string', required: true },
    { key: 'option_c', type: 'string', required: true },
    { key: 'option_d', type: 'string', required: true },
    { key: 'correct', type: 'string', required: true },
    { key: 'subject_name', type: 'string', required: false, default: '' },
    { key: 'subject_id', type: 'string', required: false, default: null },
    { key: 'topic', type: 'string', required: false, default: '' },
    { key: 'topic_id', type: 'string', required: false, default: null },
    { key: 'difficulty', type: 'string', required: false, default: 'medium' },
    { key: 'explanation', type: 'string', required: false, default: '', size: 4096 },
    { key: 'archived', type: 'boolean', required: false, default: false },
    { key: 'is_pyq', type: 'boolean', required: false, default: false },
    { key: 'pyq_year', type: 'integer', required: false, default: null },
    { key: 'content_hash', type: 'string', required: false },
    { key: 'quiz_pool_status', type: 'string', required: false, default: 'available' },
  ]);

  // 3. quizzes
  await createCollectionWithTypes('quizzes', [
    { key: 'exam_code', type: 'string', required: true },
    { key: 'title', type: 'string', required: true },
    { key: 'type', type: 'string', required: true },
    { key: 'question_count', type: 'integer', required: true },
    { key: 'duration_seconds', type: 'integer', required: false },
    { key: 'per_question_seconds', type: 'integer', required: false, default: null },
    { key: 'scoring_profile_id', type: 'string', required: false, default: null },
    { key: 'is_active', type: 'boolean', required: false, default: true },
    { key: 'live_at', type: 'string', required: false, default: null },
    { key: 'live_status', type: 'string', required: false, default: null },
    { key: 'subject_name', type: 'string', required: false },
    { key: 'marks_correct', type: 'number', required: false },
    { key: 'marks_wrong', type: 'number', required: false },
  ]);

  // 4. quiz_questions
  await createCollectionWithTypes('quiz_questions', [
    { key: 'quiz_id', type: 'string', required: true },
    { key: 'question_id', type: 'string', required: true },
    { key: 'order_index', type: 'integer', required: true },
  ]);

  // 5. quiz_sessions
  await createCollectionWithTypes('quiz_sessions', [
    { key: 'userId', type: 'string', required: true },
    { key: 'quizId', type: 'string', required: true },
    { key: 'startedAt', type: 'string', required: true },
    { key: 'totalQuestions', type: 'integer', required: true },
    { key: 'maxScore', type: 'number', required: true },
    { key: 'status', type: 'string', required: true },
    { key: 'submittedAt', type: 'string', required: false },
    { key: 'score', type: 'number', required: false },
    { key: 'correctCount', type: 'integer', required: false },
    { key: 'wrongCount', type: 'integer', required: false },
    { key: 'attemptedCount', type: 'integer', required: false },
    { key: 'totalSkipped', type: 'integer', required: false },
    { key: 'negativePenalty', type: 'number', required: false },
    { key: 'percentage', type: 'number', required: false },
    { key: 'totalMarks', type: 'number', required: false },
    { key: 'attemptNumber', type: 'integer', required: false },
    { key: 'examCode', type: 'string', required: false },
    { key: 'isLiveAttempt', type: 'boolean', required: false, default: false },
  ]);

  // 6. session_answers
  await createCollectionWithTypes('session_answers', [
    { key: 'sessionId', type: 'string', required: true },
    { key: 'userId', type: 'string', required: true },
    { key: 'questionId', type: 'string', required: true },
    { key: 'orderIndex', type: 'integer', required: true },
    { key: 'selectedOption', type: 'string', required: false },
    { key: 'isCorrect', type: 'boolean', required: true },
    { key: 'marksAwarded', type: 'number', required: false },
    { key: 'timeTakenMs', type: 'integer', required: true },
    { key: 'answeredAt', type: 'string', required: true },
  ]);

  // 7. attempts
  await createCollectionWithTypes('attempts', [
    { key: 'userId', type: 'string', required: true },
    { key: 'questionId', type: 'string', required: true },
    { key: 'selectedOption', type: 'string', required: false },
    { key: 'isCorrect', type: 'boolean', required: true },
    { key: 'timeTakenMs', type: 'integer', required: true },
  ]);

  // 8. leaderboard
  await createCollectionWithTypes('leaderboard', [
    { key: 'userId', type: 'string', required: true },
    { key: 'exam_id', type: 'string', required: true },
    { key: 'period_type', type: 'string', required: true },
    { key: 'marksEarned', type: 'number', required: true },
    { key: 'rank', type: 'integer', required: true },
    { key: 'percentage', type: 'number', required: false },
    { key: 'displayName', type: 'string', required: false },
    { key: 'photoURL', type: 'string', required: false },
    { key: 'wrong', type: 'integer', required: false },
    { key: 'correctCount', type: 'integer', required: false },
  ]);

  // 9. notifications
  await createCollectionWithTypes('notifications', [
    { key: 'title', type: 'string', required: true },
    { key: 'body', type: 'string', required: true },
    { key: 'type', type: 'string', required: true },
    { key: 'targetExams', type: 'string', required: true },
    { key: 'readBy', type: 'string', required: true },
  ]);

  // 10. mock_tests
  await createCollectionWithTypes('mock_tests', [
    { key: 'exam_code', type: 'string', required: true },
    { key: 'title', type: 'string', required: true },
    { key: 'serial_number', type: 'integer', required: true },
    { key: 'duration_seconds', type: 'integer', required: true },
    { key: 'status', type: 'string', required: true, default: 'draft' },
    { key: 'published_at', type: 'string', required: false },
  ]);

  // 11. mock_test_events
  await createCollectionWithTypes('mock_test_events', [
    { key: 'exam_code', type: 'string', required: true },
    { key: 'scheduled_at', type: 'string', required: true },
    { key: 'duration_min', type: 'integer', required: true },
    { key: 'max_participants', type: 'integer', required: false },
    { key: 'week_number', type: 'integer', required: false },
    { key: 'year', type: 'integer', required: false },
  ]);

  // 12. live_quiz_events
  await createCollectionWithTypes('live_quiz_events', [
    { key: 'exam_code', type: 'string', required: true },
    { key: 'starts_at', type: 'string', required: true },
    { key: 'timezone', type: 'string', required: true },
    { key: 'duration_min', type: 'integer', required: true },
    { key: 'status', type: 'string', required: true, default: 'scheduled' },
    { key: 'current_q_index', type: 'integer', required: false, default: 0 },
    { key: 'questionSetId', type: 'string', required: false },
  ]);

  // 13. quiz_results
  await createCollectionWithTypes('quiz_results', [
    { key: 'quizEventId', type: 'string', required: true },
    { key: 'userId', type: 'string', required: true },
    { key: 'score', type: 'number', required: true, default: 0 },
    { key: 'marksEarned', type: 'number', required: true, default: 0 },
    { key: 'correctCount', type: 'integer', required: true, default: 0 },
    { key: 'totalLatencyMs', type: 'integer', required: true, default: 0 },
    { key: 'joinedAtIndex', type: 'integer', required: true, default: 0 },
    { key: 'disconnectionFlag', type: 'boolean', required: true, default: false },
  ]);

  // 14. quiz_answers
  await createCollectionWithTypes('quiz_answers', [
    { key: 'quizEventId', type: 'string', required: true },
    { key: 'userId', type: 'string', required: true },
    { key: 'questionIndex', type: 'integer', required: true },
    { key: 'selectedOption', type: 'string', required: false },
    { key: 'isCorrect', type: 'boolean', required: false },
  ]);

  // 15. missions
  await createCollectionWithTypes('missions', [
    { key: 'examCode', type: 'string', required: false },
    { key: 'title', type: 'string', required: true },
    { key: 'description', type: 'string', required: false },
    { key: 'xpReward', type: 'integer', required: true },
    { key: 'type', type: 'string', required: true },
    { key: 'target', type: 'integer', required: true },
    { key: 'is_daily', type: 'boolean', required: false },
  ]);

  // 16. user_missions
  await createCollectionWithTypes('user_missions', [
    { key: 'userId', type: 'string', required: true },
    { key: 'missionId', type: 'string', required: true },
    { key: 'progress', type: 'integer', required: true },
    { key: 'completed', type: 'boolean', required: true },
    { key: 'assignedDate', type: 'string', required: true },
  ]);

  // 17. subjects
  await createCollectionWithTypes('subjects', [
    { key: 'name', type: 'string', required: true },
    { key: 'exam_code', type: 'string', required: false },
  ]);

  // 18. topics
  await createCollectionWithTypes('topics', [
    { key: 'subject_id', type: 'string', required: true },
    { key: 'name', type: 'string', required: true },
  ]);

  console.log('\nAll done.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
