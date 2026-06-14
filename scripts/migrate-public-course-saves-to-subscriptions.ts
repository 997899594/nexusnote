import { closeDbConnection, db, sql } from "@/db";

async function hasLegacySaveTable() {
  const [row] = await db.execute(sql`
    select to_regclass('public.course_publication_saves') is not null as exists
  `);

  return Boolean((row as { exists?: boolean } | undefined)?.exists);
}

async function main() {
  await db.execute(sql`
    create table if not exists course_publication_subscriptions (
      id uuid primary key default gen_random_uuid(),
      publication_id uuid not null references course_publications(id) on delete cascade,
      user_id uuid not null references "user"(id) on delete cascade,
      last_seen_snapshot_id uuid references course_publication_snapshots(id) on delete set null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `);

  await db.execute(sql`
    create unique index if not exists course_publication_subscriptions_user_publication_unique_idx
      on course_publication_subscriptions(user_id, publication_id)
  `);

  await db.execute(sql`
    create index if not exists course_publication_subscriptions_publication_idx
      on course_publication_subscriptions(publication_id)
  `);

  await db.execute(sql`
    create index if not exists course_publication_subscriptions_user_idx
      on course_publication_subscriptions(user_id)
  `);

  await db.execute(sql`
    create table if not exists course_publication_progress (
      id uuid primary key default gen_random_uuid(),
      publication_id uuid not null references course_publications(id) on delete cascade,
      user_id uuid not null references "user"(id) on delete cascade,
      current_chapter integer not null default 0,
      completed_chapters jsonb not null default '[]'::jsonb,
      completed_sections jsonb not null default '[]'::jsonb,
      started_at timestamp,
      completed_at timestamp,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `);

  await db.execute(sql`
    create unique index if not exists course_publication_progress_user_publication_unique_idx
      on course_publication_progress(user_id, publication_id)
  `);

  await db.execute(sql`
    create index if not exists course_publication_progress_publication_idx
      on course_publication_progress(publication_id)
  `);

  await db.execute(sql`
    create index if not exists course_publication_progress_user_idx
      on course_publication_progress(user_id)
  `);

  if (await hasLegacySaveTable()) {
    await db.execute(sql`
      insert into course_publication_subscriptions (
        publication_id,
        user_id,
        last_seen_snapshot_id,
        created_at,
        updated_at
      )
      select
        publication_id,
        user_id,
        snapshot_id,
        created_at,
        updated_at
      from course_publication_saves
      on conflict (user_id, publication_id) do update set
        last_seen_snapshot_id = excluded.last_seen_snapshot_id,
        updated_at = greatest(
          course_publication_subscriptions.updated_at,
          excluded.updated_at
        )
    `);

    await db.execute(sql`
      insert into course_publication_progress (
        publication_id,
        user_id,
        current_chapter,
        completed_chapters,
        completed_sections,
        started_at,
        completed_at,
        created_at,
        updated_at
      )
      select
        saves.publication_id,
        saves.user_id,
        coalesce(progress.current_chapter, 0),
        coalesce(progress.completed_chapters, '[]'::jsonb),
        coalesce(progress.completed_sections, '[]'::jsonb),
        progress.started_at,
        progress.completed_at,
        coalesce(progress.created_at, saves.created_at),
        greatest(coalesce(progress.updated_at, saves.updated_at), saves.updated_at)
      from course_publication_saves saves
      left join course_progress progress on progress.course_id = saves.saved_course_id
      on conflict (user_id, publication_id) do update set
        current_chapter = excluded.current_chapter,
        completed_chapters = excluded.completed_chapters,
        completed_sections = excluded.completed_sections,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        updated_at = greatest(course_publication_progress.updated_at, excluded.updated_at)
    `);

    await db.execute(sql`
      delete from courses
      where id in (select saved_course_id from course_publication_saves)
    `);
  }

  await db.execute(sql`drop table if exists course_publication_saves`);

  console.log("Migrated public course saved copies to live subscriptions.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnection();
  });
