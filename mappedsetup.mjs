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

async function createStringAttr(collectionId, key, size, required, def) {
  try {
    if (def !== undefined && def !== null) {
      await db.createStringAttribute(DATABASE_ID, collectionId, key, size, required, def);
    } else {
      await db.createStringAttribute(DATABASE_ID, collectionId, key, size, required);
    }
    console.log("  + " + key);
  } catch (e) {
    if (e.code === 409) console.log("  ~ " + key + " (exists)");
    else throw e;
  }
}

async function createIntegerAttr(collectionId, key, required, def) {
  try {
    if (def !== undefined && def !== null) {
      await db.createIntegerAttribute(DATABASE_ID, collectionId, key, required, undefined, undefined, def);
    } else {
      await db.createIntegerAttribute(DATABASE_ID, collectionId, key, required);
    }
    console.log("  + " + key);
  } catch (e) {
    if (e.code === 409) console.log("  ~ " + key + " (exists)");
    else throw e;
  }
}

async function createCollection(collectionId, name, attrs) {
  try {
    await db.createCollection(DATABASE_ID, collectionId, name, [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ]);
    console.log("  Created collection: " + name);
  } catch (e) {
    if (e.code === 409) console.log("  " + name + " already exists");
    else throw e;
  }

  await new Promise((r) => setTimeout(r, 1500));

  console.log("  Adding attributes...");
  for (const a of attrs) {
    if (a.type === "String") {
      await createStringAttr(collectionId, a.key, a.size, a.required ?? true, a.default);
    } else if (a.type === "Integer") {
      await createIntegerAttr(collectionId, a.key, a.required ?? true, a.default);
    }
  }
}

async function main() {
  console.log("Creating mapped question collections...\n");

  // 1. pyq_questions — dedicated PYQ question bank (9 attributes)
  await createCollection("pyq_questions", "pyq_questions", [
    { type: "String",  key: "exam_code",   size: 50,   required: true },
    { type: "String",  key: "question",     size: 5000, required: true },
    { type: "String",  key: "option_a",     size: 1000, required: true },
    { type: "String",  key: "option_b",     size: 1000, required: true },
    { type: "String",  key: "option_c",     size: 1000, required: true },
    { type: "String",  key: "option_d",     size: 1000, required: true },
    { type: "String",  key: "correct",      size: 5,    required: true },
    { type: "String",  key: "explanation",  size: 5000, required: false, default: "" },
    { type: "Integer", key: "pyq_year",     required: false },
  ]);

  console.log("\n");

  // 2. practice_questions — dedicated topic-wise practice bank (10 attributes)
  await createCollection("practice_questions", "practice_questions", [
    { type: "String",  key: "exam_code",     size: 50,   required: true },
    { type: "String",  key: "question",       size: 5000, required: true },
    { type: "String",  key: "option_a",       size: 1000, required: true },
    { type: "String",  key: "option_b",       size: 1000, required: true },
    { type: "String",  key: "option_c",       size: 1000, required: true },
    { type: "String",  key: "option_d",       size: 1000, required: true },
    { type: "String",  key: "correct",        size: 5,    required: true },
    { type: "String",  key: "subject_name",   size: 100,  required: false, default: "" },
    { type: "String",  key: "topic",          size: 100,  required: false, default: "" },
    { type: "String",  key: "explanation",    size: 5000, required: false, default: "" },
  ]);

  console.log("\n");

  // 3. rapid_fire_questions — dedicated rapid fire bank (8 attributes)
  await createCollection("rapid_fire_questions", "rapid_fire_questions", [
    { type: "String",  key: "exam_code",   size: 50,   required: true },
    { type: "String",  key: "question",     size: 5000, required: true },
    { type: "String",  key: "option_a",     size: 1000, required: true },
    { type: "String",  key: "option_b",     size: 1000, required: true },
    { type: "String",  key: "option_c",     size: 1000, required: true },
    { type: "String",  key: "option_d",     size: 1000, required: true },
    { type: "String",  key: "correct",      size: 5,    required: true },
    { type: "String",  key: "explanation",  size: 5000, required: false, default: "" },
  ]);

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
