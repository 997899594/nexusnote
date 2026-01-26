import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString)

export const db = drizzle(client, { schema })

export * from './schema.js'
export * from './fsrs.js'

// Re-export common drizzle-orm operators for consistency
export { eq, ne, gt, gte, lt, lte, and, or, sql, inArray, notInArray } from 'drizzle-orm'
