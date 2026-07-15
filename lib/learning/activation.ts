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
    select
      projection.course_id,
      course.title as course_title,
      projection.generated_at,
      projection.started_at,
      projection.first_completed_at,
      projection.continued_at,
      projection.completed_at
    from learning_activation_projections as projection
    join courses as course on course.id = projection.course_id
    where projection.user_id = ${userId}
      and projection.generated_at is not null
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
    select
      to_char(date_trunc('week', projection.generated_at), 'YYYY-MM-DD') as "cohortWeek",
      count(*)::integer as generated,
      count(*) filter (where projection.started_at is not null)::integer as started,
      count(*) filter (where projection.first_completed_at is not null)::integer
        as "firstCompleted",
      count(*) filter (where projection.continued_at is not null)::integer
        as "continuedAfterSevenDays",
      count(*) filter (where projection.completed_at is not null)::integer as completed
    from learning_activation_projections as projection
    where projection.generated_at >= ${since}
    group by date_trunc('week', projection.generated_at)
    order by date_trunc('week', projection.generated_at) desc
  `);
}
