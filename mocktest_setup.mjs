import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config({ path: ".env.local" });

import { Client, Databases, Permission, Role } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;

async function createAttr(type, collectionId, ...args) {
  try {
    await db[`create${type}Attribute`](DATABASE_ID, collectionId, ...args);
    console.log(`  ✓ created ${args[0]}`);
  } catch (e) {
    if (e.code === 409) console.log(`  – skip ${args[0]} (already exists)`);
    else throw e;
  }
}

async function main() {
  const COLLECTION_ID = "mock_test_questions";

  // Create collection
  try {
    await db.createCollection(DATABASE_ID, COLLECTION_ID, "mock_test_questions", [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ]);
    console.log("\n✓ Created collection: mock_test_questions");
  } catch (e) {
    if (e.code === 409) console.log("\n– Skipping collection: mock_test_questions (already exists)");
    else throw e;
  }

  // Wait for collection to be ready
  await new Promise((r) => setTimeout(r, 1000));

  console.log("\nAdding attributes...");
  await createAttr("String",  COLLECTION_ID, "mock_test_id",  50,   true);
  await createAttr("String",  COLLECTION_ID, "question",      5000, true);
  await createAttr("String",  COLLECTION_ID, "option_a",      1000, true);
  await createAttr("String",  COLLECTION_ID, "option_b",      1000, true);
  await createAttr("String",  COLLECTION_ID, "option_c",      1000, true);
  await createAttr("String",  COLLECTION_ID, "option_d",      1000, true);
  await createAttr("String",  COLLECTION_ID, "correct",       5,    true);
  await createAttr("String",  COLLECTION_ID, "explanation",   5000, false, "");
  await createAttr("Integer", COLLECTION_ID, "order_index",   true);

  console.log("\n✅ All done.");
}

main().catch(console.error);
