# Public Course Live Subscriptions

## Status

Accepted.

## Context

The previous public-course "save" flow copied a published snapshot into a private `courses` row with
private outline nodes, sections, and progress. That made saved public courses stale by design: when
the owner updated and republished the public course, existing readers kept reading the old copied
course at `/learn/{savedCourseId}`.

This was a data-contract bug, not a cache bug.

## Decision

Public courses now use subscription semantics.

- Author content remains owned by `course_publications.current_snapshot_id`.
- Readers subscribe through `course_publication_subscriptions`.
- Reader progress is stored separately in `course_publication_progress`.
- The subscribed learning URL is `/c/{slug}/learn`.
- Published courses advance `course_publications.current_snapshot_id` automatically after owner
  course structure saves and section-content materialization complete.
- New code no longer writes copied public courses into `courses`, `course_outline_versions`,
  `course_outline_nodes`, `course_sections`, or `course_progress`.
- Existing copied-course data is migrated once by
  `scripts/migrate-public-course-saves-to-subscriptions.ts`, then `course_publication_saves` is
  dropped.

## Consequences

Subscribers always read the current published snapshot. When the owner updates the course outline or
finishes generating a section, the public snapshot pointer is refreshed in the same successful
server-side write path, so readers do not need to resubscribe or wait for a manual republish.

Personal progress stays private to each subscriber and does not mutate the author's course content.

Public-course live learning is read-only for course content. Private-course features that depend on
owned `course_sections` such as generation, private highlights, private notes, and course chat must
use their own public-learning contracts before being enabled for subscribed public courses.
