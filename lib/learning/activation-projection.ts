import { db, learningActivationProjections, sql } from "@/db";

interface ProjectionRollupRow extends Record<string, unknown> {
  generated_at: Date | null;
  started_at: Date | null;
  first_completed_at: Date | null;
  continued_at: Date | null;
  completed_at: Date | null;
  source_event_count: number;
  last_event_at: Date;
}

type LearningActivationProjectionExecutor = Pick<typeof db, "execute" | "insert">;

export async function refreshLearningActivationProjection(
  input: { userId: string; courseId: string },
  executor: LearningActivationProjectionExecutor = db,
): Promise<void> {
  const [rollup] = await executor.execute<ProjectionRollupRow>(sql`
    with course_events as (
      select *
      from learning_activity_events
      where user_id = ${input.userId}
        and course_id = ${input.courseId}
    ), milestone_base as (
      select
        min(occurred_at) filter (where event_type = 'course_generated') as generated_at,
        min(occurred_at) filter (where event_type = 'course_started') as started_at,
        min(occurred_at) filter (where event_type = 'section_completed') as first_completed_at,
        min(occurred_at) filter (where event_type = 'course_completed') as completed_at,
        count(*)::integer as source_event_count,
        max(occurred_at) as last_event_at
      from course_events
    )
    select
      milestone.generated_at,
      milestone.started_at,
      milestone.first_completed_at,
      min(event.occurred_at) filter (
        where event.event_type in ('course_opened', 'section_completed')
          and milestone.started_at is not null
          and event.occurred_at >= milestone.started_at + interval '7 days'
      ) as continued_at,
      milestone.completed_at,
      milestone.source_event_count,
      milestone.last_event_at
    from milestone_base as milestone
    left join course_events as event on true
    group by
      milestone.generated_at,
      milestone.started_at,
      milestone.first_completed_at,
      milestone.completed_at,
      milestone.source_event_count,
      milestone.last_event_at
  `);

  if (!rollup?.last_event_at) return;

  const values = {
    userId: input.userId,
    courseId: input.courseId,
    generatedAt: rollup.generated_at,
    startedAt: rollup.started_at,
    firstCompletedAt: rollup.first_completed_at,
    continuedAt: rollup.continued_at,
    completedAt: rollup.completed_at,
    sourceEventCount: rollup.source_event_count,
    lastEventAt: rollup.last_event_at,
    updatedAt: new Date(),
  };

  await executor
    .insert(learningActivationProjections)
    .values(values)
    .onConflictDoUpdate({
      target: [learningActivationProjections.userId, learningActivationProjections.courseId],
      set: values,
    });
}

export async function rebuildLearningActivationProjections(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(learningActivationProjections);
    await tx.execute(sql`
      insert into learning_activation_projections (
        user_id,
        course_id,
        generated_at,
        started_at,
        first_completed_at,
        continued_at,
        completed_at,
        source_event_count,
        last_event_at,
        updated_at
      )
      with milestone_base as (
        select
          user_id,
          course_id,
          min(occurred_at) filter (where event_type = 'course_generated') as generated_at,
          min(occurred_at) filter (where event_type = 'course_started') as started_at,
          min(occurred_at) filter (where event_type = 'section_completed') as first_completed_at,
          min(occurred_at) filter (where event_type = 'course_completed') as completed_at,
          count(*)::integer as source_event_count,
          max(occurred_at) as last_event_at
        from learning_activity_events
        group by user_id, course_id
      )
      select
        milestone.user_id,
        milestone.course_id,
        milestone.generated_at,
        milestone.started_at,
        milestone.first_completed_at,
        min(event.occurred_at) filter (
          where event.event_type in ('course_opened', 'section_completed')
            and milestone.started_at is not null
            and event.occurred_at >= milestone.started_at + interval '7 days'
        ),
        milestone.completed_at,
        milestone.source_event_count,
        milestone.last_event_at,
        now()
      from milestone_base as milestone
      join learning_activity_events as event
        on event.user_id = milestone.user_id
        and event.course_id = milestone.course_id
      group by
        milestone.user_id,
        milestone.course_id,
        milestone.generated_at,
        milestone.started_at,
        milestone.first_completed_at,
        milestone.completed_at,
        milestone.source_event_count,
        milestone.last_event_at
    `);
  });
}
