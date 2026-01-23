import { Module, Global, OnModuleInit } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as postgres from 'postgres'
import * as schema from '@nexusnote/db'
import { env } from '../config/env.config'

const client = postgres(env.DATABASE_URL)
export const db = drizzle(client, { schema })

// Initialize pgvector extension
async function initializeDatabase() {
  try {
    await client`CREATE EXTENSION IF NOT EXISTS vector`
    console.log('[Database] pgvector extension ready')
  } catch (error: unknown) {
    // Ignore if already exists or no permission (non-superuser)
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('already exists')) {
      console.warn('[Database] Could not create vector extension:', message)
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
