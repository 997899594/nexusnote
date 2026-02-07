import { db } from './packages/db/src/index';
import { courseProfiles, courseChapters } from './packages/db/src/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('--- Testing Port 5432 ---');
  try {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nexusnote";
    const profiles32 = await db.select().from(courseProfiles).where(eq(courseProfiles.id, 'dd070a18-5c21-4f4a-b318-9c19c8a21689'));
    console.log('Profiles (5432):', profiles32.length);
    const chapters32 = await db.select().from(courseChapters).where(eq(courseChapters.profileId, 'dd070a18-5c21-4f4a-b318-9c19c8a21689'));
    console.log('Chapters (5432):', chapters32.length);
  } catch (e) {
    console.log('Error 5432:', e.message);
  }

  console.log('\n--- Testing Port 5433 ---');
  try {
    // Force a new connection if possible, or just change env and hope drizzle re-connects (it might not if already connected)
    // For this script, we'll just run them separately or use a new db instance if needed.
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/nexusnote";
    // We might need to re-import or re-initialize db for the new env to take effect
    // But since this is a simple script, let's just try.
    const profiles33 = await db.select().from(courseProfiles).where(eq(courseProfiles.id, 'dd070a18-5c21-4f4a-b318-9c19c8a21689'));
    console.log('Profiles (5433):', profiles33.length);
    const chapters33 = await db.select().from(courseChapters).where(eq(courseChapters.profileId, 'dd070a18-5c21-4f4a-b318-9c19c8a21689'));
    console.log('Chapters (5433):', chapters33.length);
  } catch (e) {
    console.log('Error 5433:', e.message);
  }
}

main().catch(console.error);
