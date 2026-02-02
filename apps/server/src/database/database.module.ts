import { Module, Global, OnModuleInit } from '@nestjs/common'
import { db, sql } from '@nexusnote/db'

// Re-export db for use in other modules
export { db }

// Initialize pgvector extension
async function initializeDatabase() {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`)
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
