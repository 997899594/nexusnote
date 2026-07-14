# ADR: Use Reading Completion for Career Progression

## Status

Accepted on 2026-07-13.

## Context

NexusNote currently provides guided reading and course progress tracking but does not provide a
quiz or assessment system. The previous career aggregation mixed reading progress, course count,
and repeated evidence into a `masteryScore`, and could mark a node as mastered at 80% progress.
That did not match the selected product requirement that finishing the reading is sufficient.

## Decision

- Use reading completion as the only progression signal for the current product stage.
- Keep the persisted `mastered` state and `mastery_score` column for compatibility.
- Set `mastery_score` equal to reading progress with no course-count or repeated-evidence bonus.
- Enter the persisted `mastered` state only at 100% linked-content completion.
- Present the state to users as `已完成`, not as an assessment or certification claim.
- Increase the career-tree snapshot schema version so old projections are regenerated.

## Consequences

### Positive

- Product copy and progression calculations now share one deterministic rule.
- Users can understand exactly how progress advances.
- No quiz, scoring, or assessment subsystem is introduced prematurely.

### Negative

- Completion indicates content coverage, not demonstrated proficiency.
- Existing snapshots must be regenerated under schema version 3.

## Existing Data Transition

Before deploying the new workers, the platform should align current aggregate rows:

```sql
UPDATE career_user_skill_nodes
SET
  mastery_score = progress,
  state = CASE
    WHEN state = 'mastered' AND progress < 100 THEN 'in_progress'
    ELSE state
  END,
  updated_at = now();
```

Web and worker revisions should be deployed together so regenerated snapshots use the same rule.
