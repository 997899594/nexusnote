import { EMBEDDING_DIMENSIONS } from "@/config/embedding";
import {
  and,
  closeDbConnection,
  courseOutlineNodes,
  coursePublicationSnapshots,
  courseSections,
  courses,
  db,
  eq,
  inArray,
  learningEnrollments,
  learningSectionCompletions,
  sql,
} from "@/db";
import type { CoursePublicationSnapshotContent } from "@/db/schema/course-sharing";
import { estimateReadingMinutes } from "@/lib/learning/course-duration";
import {
  buildChapterOutlineNodeKey,
  buildSectionOutlineNodeKey,
} from "@/lib/learning/outline-node-key";
import { EMBEDDING_SCHEMA_RELEASE, REQUIRED_SCHEMA_RELEASE } from "@/lib/release/schema-release";

interface SnapshotRow {
  [key: string]: unknown;
  id: string;
  source_outline_version_id: string;
  estimated_minutes: number | null;
  content_json: CoursePublicationSnapshotContent;
}

interface CourseDocumentRow {
  [key: string]: unknown;
  course_id: string;
  plain_text: string | null;
}

interface SemanticNodeRow {
  [key: string]: unknown;
  outline_version_id: string;
  node_key: string;
  semantic_id: string;
}

interface EmbeddingColumnTypes {
  [key: string]: unknown;
  evidence_embedding_type: string | null;
  tag_embedding_type: string | null;
}

async function ensureSchemaReleaseRegistry(): Promise<void> {
  await db.execute(sql`
    create table if not exists app_schema_releases (
      version text primary key,
      metadata jsonb not null default '{}'::jsonb,
      applied_at timestamp not null default now()
    )
  `);
}

async function hasSchemaRelease(version: string): Promise<boolean> {
  const [release] = await db.execute<{ version: string }>(sql`
    select version from app_schema_releases where version = ${version} limit 1
  `);
  return Boolean(release);
}

async function registerSchemaRelease(
  version: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await db.execute(sql`
    insert into app_schema_releases (version, metadata)
    values (${version}, ${JSON.stringify(metadata)}::jsonb)
    on conflict (version) do update set
      metadata = excluded.metadata,
      applied_at = now()
  `);
}

async function applyEmbeddingSchemaRelease(): Promise<void> {
  if (await hasSchemaRelease(EMBEDDING_SCHEMA_RELEASE)) {
    return;
  }
  if (EMBEDDING_DIMENSIONS !== 1536) {
    throw new Error("Update the embedding schema release before changing EMBEDDING_DIMENSIONS.");
  }

  const [columnTypes] = await db.execute<EmbeddingColumnTypes>(sql`
    select
      (
        select format_type(attribute.atttypid, attribute.atttypmod)
        from pg_attribute attribute
        where attribute.attrelid = 'knowledge_evidence_chunks'::regclass
          and attribute.attname = 'embedding'
          and not attribute.attisdropped
      ) as evidence_embedding_type,
      (
        select format_type(attribute.atttypid, attribute.atttypmod)
        from pg_attribute attribute
        where attribute.attrelid = 'tags'::regclass
          and attribute.attname = 'name_embedding'
          and not attribute.attisdropped
      ) as tag_embedding_type
  `);
  if (!columnTypes?.evidence_embedding_type || !columnTypes.tag_embedding_type) {
    throw new Error("Embedding columns must exist before applying the MRL schema release.");
  }

  await db.execute(sql`
    drop index concurrently if exists knowledge_evidence_chunks_embedding_hnsw_idx
  `);
  await db.execute(sql`
    drop index concurrently if exists tags_name_embedding_hnsw_idx
  `);

  if (columnTypes.evidence_embedding_type !== "vector(1536)") {
    await db.execute(sql`
      alter table knowledge_evidence_chunks
      alter column embedding type vector(1536)
      using subvector(embedding, 1, 1536)::vector(1536)
    `);
  }
  if (columnTypes.tag_embedding_type !== "vector(1536)") {
    await db.execute(sql`
      alter table tags
      alter column name_embedding type vector(1536)
      using subvector(name_embedding, 1, 1536)::vector(1536)
    `);
  }

  await db.execute(sql`
    create index concurrently knowledge_evidence_chunks_embedding_hnsw_idx
    on knowledge_evidence_chunks using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64)
  `);
  await db.execute(sql`
    create index concurrently tags_name_embedding_hnsw_idx
    on tags using hnsw (name_embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64)
  `);

  await registerSchemaRelease(EMBEDDING_SCHEMA_RELEASE, {
    dimensions: EMBEDDING_DIMENSIONS,
    model: "Qwen/Qwen3-Embedding-8B",
    operatorClass: "vector_cosine_ops",
  });
}

async function createLearningModel(): Promise<void> {
  await db.execute(sql`
    alter table course_outline_nodes add column if not exists semantic_id uuid;
    update course_outline_nodes set semantic_id = gen_random_uuid() where semantic_id is null;
    alter table course_outline_nodes alter column semantic_id set default gen_random_uuid();
    alter table course_outline_nodes alter column semantic_id set not null;
    create unique index if not exists course_outline_nodes_outline_semantic_unique_idx
      on course_outline_nodes(outline_version_id, semantic_id);

    alter table course_sections add column if not exists outline_version_id uuid;
    alter table course_sections add column if not exists outline_node_id uuid;
    update course_sections section
    set outline_version_id = version.id,
        outline_node_id = node.id
    from course_outline_versions version
    join course_outline_nodes node
      on node.outline_version_id = version.id
    where version.course_id = section.course_id
      and version.is_latest = true
      and node.node_key = section.outline_node_key
      and (section.outline_version_id is null or section.outline_node_id is null);

    do $$
    begin
      if exists (select 1 from course_sections where outline_version_id is null or outline_node_id is null) then
        raise exception 'Cannot map every course section to its active outline revision';
      end if;
    end $$;

    alter table course_sections alter column outline_version_id set not null;
    alter table course_sections alter column outline_node_id set not null;
    do $$
    begin
      if not exists (select 1 from pg_constraint where conname = 'course_sections_outline_version_id_course_outline_versions_id_f') then
        alter table course_sections add constraint course_sections_outline_version_id_course_outline_versions_id_fk
          foreign key (outline_version_id) references course_outline_versions(id) on delete cascade;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'course_sections_outline_node_id_course_outline_nodes_id_fk') then
        alter table course_sections add constraint course_sections_outline_node_id_course_outline_nodes_id_fk
          foreign key (outline_node_id) references course_outline_nodes(id) on delete cascade;
      end if;
    end $$;
    drop index if exists course_sections_course_outline_idx;
    create unique index if not exists course_sections_outline_node_unique_idx
      on course_sections(outline_node_id);
    create unique index if not exists course_sections_version_node_key_unique_idx
      on course_sections(outline_version_id, outline_node_key);

    create table if not exists learning_enrollments (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      source_type text not null,
      course_id uuid not null references courses(id) on delete cascade,
      outline_version_id uuid references course_outline_versions(id) on delete cascade,
      publication_id uuid references course_publications(id) on delete cascade,
      snapshot_id uuid references course_publication_snapshots(id) on delete cascade,
      started_at timestamp,
      completed_at timestamp,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now(),
      constraint learning_enrollments_source_shape_check check (
        (source_type = 'course_revision' and outline_version_id is not null and publication_id is null and snapshot_id is null)
        or
        (source_type = 'publication_snapshot' and outline_version_id is null and publication_id is not null and snapshot_id is not null)
      )
    );
    create unique index if not exists learning_enrollments_user_revision_unique_idx
      on learning_enrollments(user_id, outline_version_id);
    create unique index if not exists learning_enrollments_user_snapshot_unique_idx
      on learning_enrollments(user_id, snapshot_id);
    create index if not exists learning_enrollments_user_updated_idx
      on learning_enrollments(user_id, updated_at);
    create index if not exists learning_enrollments_course_idx on learning_enrollments(course_id);
    create index if not exists learning_enrollments_publication_idx
      on learning_enrollments(publication_id);

    create table if not exists learning_section_completions (
      id uuid primary key default gen_random_uuid(),
      enrollment_id uuid not null references learning_enrollments(id) on delete cascade,
      section_id uuid not null,
      completed_at timestamp not null default now()
    );
    create unique index if not exists learning_section_completions_enrollment_section_unique_idx
      on learning_section_completions(enrollment_id, section_id);
    create index if not exists learning_section_completions_enrollment_completed_idx
      on learning_section_completions(enrollment_id, completed_at);

    create table if not exists domain_outbox_events (
      id uuid primary key default gen_random_uuid(),
      topic text not null,
      aggregate_type text not null,
      aggregate_id uuid not null,
      payload jsonb not null,
      available_at timestamp not null default now(),
      processed_at timestamp,
      attempt_count integer not null default 0,
      last_error text,
      created_at timestamp not null default now()
    );
    create index if not exists domain_outbox_events_pending_idx
      on domain_outbox_events(processed_at, available_at);
    create index if not exists domain_outbox_events_aggregate_idx
      on domain_outbox_events(aggregate_type, aggregate_id);

    create table if not exists runtime_heartbeats (
      runtime_name text primary key,
      instance_id text not null,
      metadata jsonb not null default '{}'::jsonb,
      started_at timestamp not null default now(),
      last_seen_at timestamp not null default now()
    );

    alter table learning_activity_events add column if not exists enrollment_id uuid;
    do $$
    begin
      if not exists (select 1 from pg_constraint where conname = 'learning_activity_events_enrollment_id_learning_enrollments_id_') then
        alter table learning_activity_events add constraint learning_activity_events_enrollment_id_learning_enrollments_id_fk
          foreign key (enrollment_id) references learning_enrollments(id) on delete cascade;
      end if;
    end $$;
  `);
}

async function backfillLegacyProgress(): Promise<void> {
  await db.execute(sql`
    insert into learning_enrollments (
      user_id, source_type, course_id, outline_version_id,
      started_at, completed_at, created_at, updated_at
    )
    select
      progress.user_id,
      'course_revision',
      progress.course_id,
      version.id,
      progress.started_at,
      progress.completed_at,
      coalesce(progress.created_at, now()),
      coalesce(progress.updated_at, progress.created_at, now())
    from course_progress progress
    join course_outline_versions version
      on version.course_id = progress.course_id and version.is_latest = true
    on conflict (user_id, outline_version_id) do update set
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at;

    insert into learning_section_completions (enrollment_id, section_id, completed_at)
    select
      enrollment.id,
      node.semantic_id,
      coalesce(progress.updated_at, progress.started_at, progress.created_at, now())
    from course_progress progress
    join learning_enrollments enrollment
      on enrollment.user_id = progress.user_id
      and enrollment.course_id = progress.course_id
      and enrollment.source_type = 'course_revision'
    join course_outline_nodes node
      on node.outline_version_id = enrollment.outline_version_id
    cross join lateral jsonb_array_elements_text(progress.completed_sections) completed(node_key)
    where node.node_type = 'section' and node.node_key = completed.node_key
    on conflict (enrollment_id, section_id) do nothing;

    insert into learning_enrollments (
      user_id, source_type, course_id, publication_id, snapshot_id,
      started_at, completed_at, created_at, updated_at
    )
    select
      progress.user_id,
      'publication_snapshot',
      publication.source_course_id,
      publication.id,
      publication.current_snapshot_id,
      progress.started_at,
      progress.completed_at,
      progress.created_at,
      progress.updated_at
    from course_publication_progress progress
    join course_publications publication on publication.id = progress.publication_id
    where publication.current_snapshot_id is not null
    on conflict (user_id, snapshot_id) do update set
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at;

    insert into learning_section_completions (enrollment_id, section_id, completed_at)
    select
      enrollment.id,
      node.semantic_id,
      coalesce(progress.updated_at, progress.started_at, progress.created_at, now())
    from course_publication_progress progress
    join course_publications publication on publication.id = progress.publication_id
    join learning_enrollments enrollment
      on enrollment.user_id = progress.user_id
      and enrollment.snapshot_id = publication.current_snapshot_id
    join course_publication_snapshots snapshot on snapshot.id = enrollment.snapshot_id
    join course_outline_nodes node on node.outline_version_id = snapshot.source_outline_version_id
    cross join lateral jsonb_array_elements_text(progress.completed_sections) completed(node_key)
    where node.node_type = 'section' and node.node_key = completed.node_key
    on conflict (enrollment_id, section_id) do nothing;

    update learning_activity_events event
    set enrollment_id = enrollment.id
    from learning_enrollments enrollment
    where event.enrollment_id is null
      and enrollment.user_id = event.user_id
      and enrollment.course_id = event.course_id
      and enrollment.source_type = 'course_revision';

    update learning_activity_events event
    set section_node_id = node.semantic_id::text
    from learning_enrollments enrollment
    join course_outline_nodes node on node.outline_version_id = enrollment.outline_version_id
    where event.enrollment_id = enrollment.id
      and event.section_node_id = node.node_key
      and node.node_type = 'section';

    update learning_activity_events
    set idempotency_key = case
      when event_type = 'section_completed' then concat(event_type, ':', user_id, ':', enrollment_id, ':', section_node_id)
      when event_type = 'course_opened' then concat(event_type, ':', user_id, ':', enrollment_id, ':', id)
      else concat(event_type, ':', user_id, ':', enrollment_id)
    end
    where enrollment_id is not null;
  `);
}

async function rewritePublicationSnapshots(): Promise<void> {
  const [snapshots, nodes] = await Promise.all([
    db.execute<SnapshotRow>(sql`
      select
        snapshot.id,
        snapshot.source_outline_version_id,
        snapshot.content_json,
        course.estimated_minutes
      from course_publication_snapshots snapshot
      join courses course on course.id = snapshot.source_course_id
    `),
    db.execute<SemanticNodeRow>(sql`
      select outline_version_id, node_key, semantic_id::text from course_outline_nodes
    `),
  ]);
  const semanticIds = new Map(
    nodes.map((node) => [`${node.outline_version_id}:${node.node_key}`, node.semantic_id]),
  );

  for (const snapshot of snapshots) {
    const resolve = (nodeKey: string, current: string) =>
      semanticIds.get(`${snapshot.source_outline_version_id}:${nodeKey}`) ?? current;
    const content: CoursePublicationSnapshotContent = {
      ...snapshot.content_json,
      course: {
        ...snapshot.content_json.course,
        estimatedMinutes: snapshot.estimated_minutes,
      },
      outline: {
        chapters: snapshot.content_json.outline.chapters.map((chapter, chapterIndex) => ({
          ...chapter,
          nodeId: resolve(buildChapterOutlineNodeKey(chapterIndex), chapter.nodeId),
          sections: chapter.sections.map((section, sectionIndex) => ({
            ...section,
            nodeId: resolve(buildSectionOutlineNodeKey(chapterIndex, sectionIndex), section.nodeId),
          })),
        })),
      },
      sections: snapshot.content_json.sections.map((section) => ({
        ...section,
        nodeId: resolve(section.nodeId, section.nodeId),
      })),
    };
    await db.execute(sql`
      update course_publication_snapshots
      set content_json = ${JSON.stringify(content)}::jsonb
      where id = ${snapshot.id}
    `);
  }

  await db.execute(sql`
    update course_public_annotations annotation
    set section_key = node.semantic_id::text
    from course_publication_snapshots snapshot
    join course_outline_nodes node on node.outline_version_id = snapshot.source_outline_version_id
    where annotation.snapshot_id = snapshot.id
      and annotation.section_key = node.node_key
      and node.node_type = 'section';
  `);
}

async function recomputePersistedCourseDurations(): Promise<void> {
  const rows = await db.execute<CourseDocumentRow>(sql`
    select course.id as course_id, section.plain_text
    from courses course
    join course_outline_versions version
      on version.course_id = course.id and version.is_latest = true
    left join course_sections section on section.outline_version_id = version.id
    order by course.id, section.outline_node_key
  `);
  const documentsByCourse = new Map<string, string[]>();
  for (const row of rows) {
    const documents = documentsByCourse.get(row.course_id) ?? [];
    documents.push(row.plain_text ?? "");
    documentsByCourse.set(row.course_id, documents);
  }

  for (const [courseId, documents] of documentsByCourse) {
    await db
      .update(courses)
      .set({ estimatedMinutes: estimateReadingMinutes(documents) })
      .where(eq(courses.id, courseId));
  }
}

async function reconcileLearningCompletions(): Promise<void> {
  const enrollments = await db.select().from(learningEnrollments);

  for (const enrollment of enrollments) {
    let allSectionIds: string[] = [];
    let readableSectionIds: string[] = [];

    if (enrollment.sourceType === "course_revision" && enrollment.outlineVersionId) {
      const [nodes, documents] = await Promise.all([
        db
          .select({ sectionId: courseOutlineNodes.semanticId })
          .from(courseOutlineNodes)
          .where(
            and(
              eq(courseOutlineNodes.outlineVersionId, enrollment.outlineVersionId),
              eq(courseOutlineNodes.nodeType, "section"),
            ),
          ),
        db
          .select({ sectionId: courseOutlineNodes.semanticId })
          .from(courseSections)
          .innerJoin(courseOutlineNodes, eq(courseSections.outlineNodeId, courseOutlineNodes.id))
          .where(
            and(
              eq(courseSections.outlineVersionId, enrollment.outlineVersionId),
              sql`${courseSections.contentMarkdown} is not null`,
            ),
          ),
      ]);
      allSectionIds = nodes.map((node) => node.sectionId);
      readableSectionIds = documents.map((document) => document.sectionId);
    } else if (enrollment.snapshotId) {
      const [snapshot] = await db
        .select({ content: coursePublicationSnapshots.contentJson })
        .from(coursePublicationSnapshots)
        .where(eq(coursePublicationSnapshots.id, enrollment.snapshotId))
        .limit(1);
      allSectionIds = snapshot?.content.sections.map((section) => section.nodeId) ?? [];
      readableSectionIds =
        snapshot?.content.sections.flatMap((section) =>
          section.content ? [section.nodeId] : [],
        ) ?? [];
    }

    const completions = await db
      .select({
        id: learningSectionCompletions.id,
        sectionId: learningSectionCompletions.sectionId,
      })
      .from(learningSectionCompletions)
      .where(eq(learningSectionCompletions.enrollmentId, enrollment.id));
    const readableSet = new Set(readableSectionIds);
    const invalidCompletionIds = completions
      .filter((completion) => !readableSet.has(completion.sectionId))
      .map((completion) => completion.id);
    if (invalidCompletionIds.length > 0) {
      await db
        .delete(learningSectionCompletions)
        .where(inArray(learningSectionCompletions.id, invalidCompletionIds));
    }

    const validCompletedCount = completions.length - invalidCompletionIds.length;
    const isComplete = allSectionIds.length > 0 && validCompletedCount === allSectionIds.length;
    await db
      .update(learningEnrollments)
      .set({ completedAt: isComplete ? (enrollment.completedAt ?? enrollment.updatedAt) : null })
      .where(eq(learningEnrollments.id, enrollment.id));
  }
}

async function finalizeRelease(): Promise<void> {
  await db.execute(sql`
    drop table if exists course_progress cascade;
  `);
  await db.execute(sql`
    drop table if exists course_publication_progress cascade;
  `);
  await db.execute(sql`
    drop table if exists note_snapshots cascade;
  `);
  await registerSchemaRelease(REQUIRED_SCHEMA_RELEASE, {
    learningModel: 2,
    outbox: true,
    appliedBy: "db:push",
  });
}

async function main(): Promise<void> {
  await ensureSchemaReleaseRegistry();
  await applyEmbeddingSchemaRelease();

  if (await hasSchemaRelease(REQUIRED_SCHEMA_RELEASE)) {
    await recomputePersistedCourseDurations();
    await rewritePublicationSnapshots();
    await reconcileLearningCompletions();
    console.log(`Schema release already applied: ${REQUIRED_SCHEMA_RELEASE}`);
    return;
  }

  await createLearningModel();
  await backfillLegacyProgress();
  await recomputePersistedCourseDurations();
  await rewritePublicationSnapshots();
  await reconcileLearningCompletions();
  await finalizeRelease();
  console.log(`Applied schema release: ${REQUIRED_SCHEMA_RELEASE}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => closeDbConnection());
