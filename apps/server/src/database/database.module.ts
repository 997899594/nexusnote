import { Module, Global } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as postgres from 'postgres'
import * as schema from '@nexusnote/db'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/nexusnote'

const client = postgres(DATABASE_URL)
export const db = drizzle(client, { schema })

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
export class DatabaseModule {}
