import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config as dotenvConfig } from "dotenv";
import { studyCards } from "./src/server/db/schema";

dotenvConfig();

const DATABASE_URL = process.env.DATABASE_URL!;

async function testDatabaseConnection() {
  console.log("🔍 Testing Database Connection...\n");
  console.log(`Database: ${DATABASE_URL.split('@')[1]?.split('?')[0]}\n`);

  const conn = postgres(DATABASE_URL);
  const db = drizzle(conn, { schema: { studyCards } });

  try {
    // Test 1: Check connection
    console.log("📡 Test 1: Checking database connection...");
    const result = await conn`SELECT current_database(), current_user, version()`;
    console.log(`✅ Connected to database: ${result[0]?.current_database}`);
    console.log(`   User: ${result[0]?.current_user}\n`);

    // Test 2: Check if table exists
    console.log("📋 Test 2: Checking if study_card table exists...");
    const tableCheck = await conn`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'varit_study_card'
      )
    `;
    const tableExists = tableCheck[0]?.exists;
    console.log(`✅ Table 'varit_study_card' exists: ${tableExists}\n`);

    if (!tableExists) {
      console.log("❌ Table does not exist! Run 'pnpm db:push' to create it.\n");
      await conn.end();
      process.exit(1);
    }

    // Test 3: Count records
    console.log("📊 Test 3: Counting records in study_card table...");
    const countResult = await db.select().from(studyCards);
    console.log(`✅ Found ${countResult.length} records in the database\n`);

    // Test 4: Show sample data
    if (countResult.length > 0) {
      console.log("📄 Sample data (first 3 records):");
      countResult.slice(0, 3).forEach((card, idx) => {
        console.log(`\n   ${idx + 1}. ID: ${card.id}`);
        console.log(`      Title: ${card.title}`);
        console.log(`      Category: ${card.category ?? 'N/A'}`);
        console.log(`      Completed: ${card.isCompleted}`);
        console.log(`      Created: ${card.createdAt.toISOString()}`);
      });
    } else {
      console.log("⚠️  No data found in the database.");
      console.log("   The table exists but is empty. You need to add some study cards.\n");
    }

    console.log("\n🎉 Database connection test completed!");
    
    await conn.end();
  } catch (error) {
    console.error("\n❌ Database test failed:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    }
    console.error("\n🔧 Troubleshooting:");
    console.error("   1. Verify DATABASE_URL is correct in .env");
    console.error("   2. Check database exists in Neon dashboard");
    console.error("   3. Ensure network connectivity to Neon");
    console.error("   4. Run 'pnpm db:push' to create tables");
    
    await conn.end();
    process.exit(1);
  }
}

testDatabaseConnection();
