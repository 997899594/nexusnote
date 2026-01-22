import { Module, Global, OnModuleInit } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as postgres from 'postgres'
import * as schema from '@nexusnote/db'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/nexusnote'

const client = postgres(DATABASE_URL)
export const db = drizzle(client, { schema })

// Initialize pgvector extension
async function initializeDatabase() {
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`
    console.log('[Database] pgvector extension ready')
  } catch (error: any) {
    // Ignore if already exists or no permission (non-superuser)
    if (!error.message?.includes('already exists')) {
      console.warn('[Database] Could not create vector extension:', error.message)
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE',
      useValue: db,
    },
  ],
  exports: ['DATABASE'],
})
export class DatabaseModule implements OnModuleInit {
  async onModuleInit() {
    await initializeDatabase()
  }
}
