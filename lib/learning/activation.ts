import { db, sql } from "@/db";

export type LearningActivationStage =
  | "not_generated"
  | "generated"
  | "started"
  | "first_completion"
  | "continued"
  | "completed";

export interface LearningActivationJourney {
  stage: LearningActivationStage;
  courseId: string | null;
  courseTitle: string | null;
  generatedAt: Date | null;
  startedAt: Date | null;
  firstCompletedAt: Date | null;
  continuedAt: Date | null;
  completedAt: Date | null;
  href: string;
  actionLabel: string;
  actionDescription: string;
}

export interface LearningActivationFunnel extends Record<string, unknown> {
  cohortWeek: string;
  generated: number;
  started: number;
  firstCompleted: number;
  continuedAfterSevenDays: number;
  completed: number;
}

interface JourneyRow extends Record<string, unknown> {
  course_id: string;
  course_title: string;
  generated_at: Date;
  started_at: Date | null;
  first_completed_at: Date | null;
  continued_at: Date | null;
  completed_at: Date | null;
}

function getStage(row: JourneyRow): Exclude<LearningActivationStage, "not_generated"> {
  if (row.completed_at) return "completed";
  if (row.continued_at) return "continued";
  if (row.first_completed_at) return "first_completion";
  if (row.started_at) return "started";
  return "generated";
}

function getAction(
  stage: LearningActivationStage,
): Pick<LearningActivationJourney, "href" | "actionLabel" | "actionDescription"> {
  switch (stage) {
    case "not_generated":
      return {
        href: "/interview",
        actionLabel: "生成第一门课程",
        actionDescription: "从一个明确目标开始建立学习路径。",
      };
    case "generated":
      return {
        href: "",
        actionLabel: "开始第一篇",
        actionDescription: "课程已经准备好，完成第一次学习启动。",
      };
    case "started":
      return {
        href: "",
        actionLabel: "完成第一篇",
        actionDescription: "把第一次打开转化为一次真实完成。",
      };
    case "first_completion":
      return {
        href: "",
        actionLabel: "保持学习节奏",
        actionDescription: "继续推进，让学习跨过第一周。",
      };
    case "continued":
      return {
        href: "",
        actionLabel: "继续完成课程",
        actionDescription: "节奏已经形成，下一步是完成整门课程。",
      };
    case "completed":
      return {
        href: "/interview",
        actionLabel: "开启下一目标",
        actionDescription: "这门课程已经完成，可以建立下一条成长路径。",
      };
  }
}

export async function getUserLearningActivationJourney(
  userId: string,
): Promise<LearningActivationJourney> {
  const rows = await db.execute<JourneyRow>(sql`
    with generated_courses as (
      select
        event.user_id,
        event.course_id,
        min(event.occurred_at) as generated_at
      from learning_activity_events as event
      where event.user_id = ${userId}
        and event.event_type = 'course_generated'
      group by event.user_id, event.course_id
    ), journeys as (
      select
        generated.course_id,
        course.title as course_title,
        generated.generated_at,
        min(event.occurred_at) filter (where event.event_type = 'course_started') as started_at,
        min(event.occurred_at) filter (where event.event_type = 'section_completed')
          as first_completed_at,
        min(event.occurred_at) filter (
          where event.event_type in ('course_opened', 'section_completed')
            and event.occurred_at >= started.started_at + interval '7 days'
        ) as continued_at,
        min(event.occurred_at) filter (where event.event_type = 'course_completed')
          as completed_at
      from generated_courses as generated
      join courses as course on course.id = generated.course_id
      left join learning_activity_events as event
        on event.user_id = generated.user_id
        and event.course_id = generated.course_id
      left join lateral (
        select min(start_event.occurred_at) as started_at
        from learning_activity_events as start_event
        where start_event.user_id = generated.user_id
          and start_event.course_id = generated.course_id
          and start_event.event_type = 'course_started'
      ) as started on true
      group by generated.course_id, course.title, generated.generated_at, started.started_at
    )
    select *
    from journeys
    order by (completed_at is null) desc, generated_at desc
    limit 1
  `);
  const row = rows[0];
  if (!row) {
    const action = getAction("not_generated");
    return {
      stage: "not_generated",
      courseId: null,
      courseTitle: null,
      generatedAt: null,
      startedAt: null,
      firstCompletedAt: null,
      continuedAt: null,
      completedAt: null,
      ...action,
    };
  }

  const stage = getStage(row);
  const action = getAction(stage);
  return {
    stage,
    courseId: row.course_id,
    courseTitle: row.course_title,
    generatedAt: row.generated_at,
    startedAt: row.started_at,
    firstCompletedAt: row.first_completed_at,
    continuedAt: row.continued_at,
    completedAt: row.completed_at,
    ...action,
    href: action.href || `/learn/${row.course_id}`,
  };
}

export async function getLearningActivationFunnel(
  since: Date,
): Promise<LearningActivationFunnel[]> {
  return db.execute<LearningActivationFunnel>(sql`
    with generated_courses as (
      select
        event.user_id,
        event.course_id,
        min(event.occurred_at) as generated_at
      from learning_activity_events as event
      where event.event_type = 'course_generated'
        and event.occurred_at >= ${since}
      group by event.user_id, event.course_id
    ), journeys as (
      select
        generated.user_id,
        generated.course_id,
        generated.generated_at,
        min(event.occurred_at) filter (where event.event_type = 'course_started') as started_at,
        min(event.occurred_at) filter (where event.event_type = 'section_completed')
          as first_completed_at,
        min(event.occurred_at) filter (where event.event_type = 'course_completed')
          as completed_at
      from generated_courses as generated
      left join learning_activity_events as event
        on event.user_id = generated.user_id
        and event.course_id = generated.course_id
      group by generated.user_id, generated.course_id, generated.generated_at
    )
    select
      to_char(date_trunc('week', journey.generated_at), 'YYYY-MM-DD') as "cohortWeek",
      count(*)::integer as generated,
      count(*) filter (where journey.started_at is not null)::integer as started,
      count(*) filter (where journey.first_completed_at is not null)::integer as "firstCompleted",
      count(*) filter (
        where exists (
          select 1
          from learning_activity_events as continuation
          where continuation.user_id = journey.user_id
            and continuation.course_id = journey.course_id
            and continuation.event_type in ('course_opened', 'section_completed')
            and continuation.occurred_at >= journey.started_at + interval '7 days'
        )
      )::integer as "continuedAfterSevenDays",
      count(*) filter (where journey.completed_at is not null)::integer as completed
    from journeys as journey
    group by date_trunc('week', journey.generated_at)
    order by date_trunc('week', journey.generated_at) desc
  `);
}
