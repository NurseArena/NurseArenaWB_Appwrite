#!/usr/bin/env node
/**
 * Migration script to add `type`, `title`, and `reference_id` attributes
 * to the existing `quiz_sessions` collection.
 *
 * Usage:
 *   1. Ensure .env.local has NEXT_PUBLIC_APPWRITE_ENDPOINT,
 *      NEXT_PUBLIC_APPWRITE_PROJECT_ID, and APPWRITE_API_KEY set.
 *   2. Run: node migrate-quiz-sessions.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Client, Databases } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB_ID = process.env.APPWRITE_DATABASE_ID;
const COLLECTION = 'quiz_sessions';

const newAttributes = [
  { key: 'type', type: 'string', size: 30, required: false, default: undefined },
  { key: 'title', type: 'string', size: 255, required: false, default: undefined },
  { key: 'reference_id', type: 'string', size: 50, required: false, default: undefined },
];

async function main() {
  console.log(`Migrating collection: ${COLLECTION}\n`);

  for (const attr of newAttributes) {
    try {
      switch (attr.type) {
        case 'string':
          await databases.createStringAttribute(DB_ID, COLLECTION, attr.key, attr.size, attr.required);
          break;
        default:
          console.log(`  unknown type: ${attr.type}`);
          continue;
      }
      console.log(`  ✓ Created attribute: ${attr.key} (${attr.type})`);
    } catch (e) {
      if (e.message?.includes('already exists') || e.type === 'attribute_already_exists') {
        console.log(`  - Skip (already exists): ${attr.key}`);
      } else {
        console.error(`  ✗ Error creating ${attr.key}:`, e.message);
      }
    }
  }

  console.log('\nDone. The 3 new attributes are now available in the quiz_sessions collection.');
  console.log('  - type: string (mock_test | quiz | topicwise | rapid_fire | pyq)');
  console.log('  - title: string (human-readable title)');
  console.log('  - reference_id: string (original document ID)');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
