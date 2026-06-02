# Course Sharing And Public Annotations

Date: 2026-05-30
Status: implemented

## Goal

Course sharing should feel like the same NexusNote course reader, not a separate public marketing
page. A learner who opens a shared link should read the course in the same calm learning surface,
with a reduced capability set until they save the course to their own library.

The product rule is:

> One course reader, two data contexts: private course instance and public publication snapshot.

## Current State

The private learning route stays owner-scoped:

- `/learn/[id]` requires an authenticated session before rendering.
- `getLearnPageSnapshotCached(userId, courseId)` reads only owned courses.
- The private projection mixes course content with personal progress and private section
  annotations.

That model stays intact. Publishing must not make the private course row public, because it
would blur content, progress, private notes, chat history, and future career-tree learning signals.

## Product Shape

### Author

From the private learning page, the author can publish a course link. The first release supports a
simple unlisted publication:

- `Publish` creates or refreshes a public snapshot from the current course content.
- `Copy link` copies `/c/[slug]`.
- `Revoke` disables the public link.

The author still reads and learns from the private `/learn/[courseId]` route. Publication management
is a lightweight capability on the same reader, not a separate destination.

Implemented files:

- `components/course-reader/CoursePublishControl.tsx`
- `app/api/courses/[id]/publication/route.ts`
- `lib/learning/course-sharing.ts`

### Visitor

Opening `/c/[slug]` renders the same course-reading layout with public capabilities:

- Read the course outline and sections.
- View public annotations.
- Add a public annotation after signing in.
- Save the course into their own learning library.
- Reopen the public link later and jump directly to the saved learning copy.

Visitor state is not the author's state. The public page never exposes private progress, private
annotations, private notes, private chat messages, or career-tree signals.

Implemented files:

- `app/c/[slug]/page.tsx`
- `components/course-reader/PublicCourseReader.tsx`
- `app/api/public/courses/[slug]/save/route.ts`

### Public Annotations

Public annotations are a discussion layer on top of an immutable publication snapshot. They are not
collaborative editing.

Rules:

- A public annotation belongs to a publication and one published section key.
- It stores a quote anchor so it can be rendered near selected text.
- The reader renders visible annotation anchors as inline text highlights.
- Moderation hides annotations without deleting history.
- Only authenticated users may write. Guests can read visible annotations.
- The write API rejects annotations whose `sectionKey` is not part of the current published
  snapshot.
- The author can hide or restore public annotations from the public reader.

## Architecture

```mermaid
flowchart LR
  Private["Private /learn/[courseId]"] --> Publish["Publish snapshot"]
  Publish --> Publication["course_publications"]
  Publish --> Snapshot["course_publication_snapshots"]
  Snapshot --> PublicReader["Public /c/[slug]"]
  PublicReader --> PublicAnnotations["course_public_annotations"]
  PublicReader --> PublicationSaves["course_publication_saves"]
  PublicReader --> CachedPublicData["cached public snapshot"]
  PublicReader --> ViewerProjection["uncached viewer capabilities"]
```

## Data Model

### course_publications

Canonical public entry for a course.

- `id`
- `sourceCourseId`
- `ownerUserId`
- `slug`
- `title`
- `description`
- `status`: `published | revoked`
- `allowAnnotations`
- `currentSnapshotId`
- `publishedAt`
- `revokedAt`
- `createdAt`
- `updatedAt`

### course_publication_snapshots

Immutable content snapshot for rendering a public course.

- `id`
- `publicationId`
- `sourceCourseId`
- `sourceOutlineVersionId`
- `snapshotHash`
- `contentJson`
- `createdAt`

`contentJson` stores public-safe course data:

- course metadata
- chapters and sections
- section markdown content
- research citations

It does not store personal progress, private annotations, notes, or chat.

### course_public_annotations

Public discussion notes anchored to a publication snapshot.

- `id`
- `publicationId`
- `snapshotId`
- `sectionKey`
- `userId`
- `anchor`
- `quotedText`
- `body`
- `status`: `visible | hidden`
- `createdAt`
- `updatedAt`

### course_publication_saves

Idempotency ledger for saving a public publication into a user's private learning library.

- `id`
- `publicationId`
- `snapshotId`
- `userId`
- `savedCourseId`
- `createdAt`
- `updatedAt`

`userId + publicationId` is unique. Repeated clicks and concurrent save requests return the same
saved course instead of creating duplicate private courses.

## Reader Projection

The public reader uses a public-safe projection in `lib/learning/course-sharing-types.ts`:

```ts
interface PublicCourseReaderProjection {
  publication: PublicCoursePublicationProjection;
  snapshotId: string;
  content: CoursePublicationSnapshotContent;
  annotations: PublicCourseAnnotationProjection[];
  savedCourseId: string | null;
  viewer: {
    userId: string | null;
    role: "owner" | "reader" | "guest";
  };
  capabilities: {
    canAnnotatePublicly: boolean;
    canModeratePublicAnnotations: boolean;
    canSaveToLibrary: boolean;
  };
}
```

Important implementation detail: the cached loader only returns public snapshot data. Viewer role
capabilities, save state, and owner-only moderation data are computed outside the `"use cache"`
function so one visitor's role or library state cannot leak to another visitor through the public
page cache.

## Routes

### Private APIs

- `POST /api/courses/[id]/publication`
  - Auth required.
  - Requires course ownership.
  - Creates or refreshes the public snapshot.
  - Returns `{ publicationId, slug, url, status }`.

- `GET /api/courses/[id]/publication`
  - Auth required.
  - Requires course ownership.
  - Returns current publication state so the publish control survives page refresh.

- `DELETE /api/courses/[id]/publication`
  - Auth required.
  - Requires course ownership.
  - Revokes the link.

### Public APIs

- `POST /api/public/courses/[slug]/annotations`
  - Auth required.
  - Requires publication to be published and annotations enabled.
  - Creates one visible public annotation.
  - Returns the created annotation projection so the client can update without a full reload.

- `PATCH /api/public/courses/[slug]/annotations/[annotationId]`
  - Auth required.
  - Requires publication ownership.
  - Updates annotation status to `visible` or `hidden`.
  - Revalidates the public publication cache immediately.

- `POST /api/public/courses/[slug]/save`
  - Auth required.
  - Copies the public snapshot into the viewer's own `courses`, outline, sections, and progress
    records.
  - Uses `course_publication_saves` plus a transaction-level advisory lock so repeated or concurrent
    saves return the same `/learn/[savedCourseId]`.

### Pages

- `/c/[slug]`
  - Public course reader.
  - Optional auth is allowed, but anonymous readers can still read.

## Caching

Publication snapshots are cache-friendly, but public annotations need read-after-write behavior.
The public loader uses tags:

- `course-publication:${slug}`
- `course-publication:${publicationId}`

Publishing, revoking, and creating public annotations revalidate those tags. Unlike background
profile/recent-course caches, public course tags use immediate expiration with `expire: 0`, because
readers should see a newly posted public annotation on the next page load.

The private learn cache stays user/course scoped.

## Security And Privacy

- Do not expose raw `courseId` as the public URL.
- Do not query private course data from `/c/[slug]`.
- Do not include private annotations, progress, notes, chat messages, user profile data, or
  career-tree data in snapshots.
- Public annotation body length is capped.
- Public annotation `sectionKey` must exist in the current publication snapshot.
- Hidden annotations remain unavailable to public readers.
- Owner moderation is separate from reader creation.
- Client components import public reader types from `lib/learning/course-sharing-types.ts` instead
  of importing the server-only service module.

## Acceptance Criteria

- An owner can publish a private course from `/learn/[id]`.
- Publishing returns a stable `/c/[slug]` link.
- The publish control can read the existing published link after page refresh.
- `/c/[slug]` renders without login.
- Public page shows course metadata, chapters, section content, citations, and visible public
  annotations.
- Public annotation quote anchors render as inline highlights in the current section.
- Logged-in users can add a public annotation on the public page.
- Public annotation creation updates the page without a full reload.
- Guests are prompted to sign in before writing annotations.
- Logged-in readers can save the public course into their own learning library.
- Repeated save clicks return the same saved course and do not duplicate private courses.
- Saved readers see an `进入我的学习库` affordance instead of another save action.
- Authors can hide and restore public annotations without deleting them.
- Hidden annotations remain visible only to the author moderation view.
- Owner can revoke the public link.
- Private progress and private annotations are not visible on the public page.

## Validation

Completed locally:

- `bunx biome check` on the course-sharing touched files.
- `bun run typecheck`.
- `bun run db:push`.
- `SKIP_ENV_VALIDATION=true bun run build`.
- `bun scripts/start-workers.ts` reached `QueueWorkersRuntime Ready`.
- Runtime API checks:
  - owner publication status for `/c/lBPUh55M` returned `published`;
  - anonymous `GET /c/lBPUh55M` returned `200`;
  - invalid public annotation section key returned `400 COURSE_PUBLICATION_SECTION_NOT_FOUND`;
  - valid public annotation returned `status: "visible"`;
  - owner hide returned `status: "hidden"`;
  - anonymous public page no longer included the hidden annotation body;
  - owner restore returned `status: "visible"`;
  - repeated save by `qa-reader@example.com` returned the same course id with
    `alreadySaved: false` then `alreadySaved: true`;
  - `course_publication_saves` had exactly one row for that reader/publication pair.
- Browser QA:
  - desktop public reader showed `进入我的学习库`, public annotations, and no horizontal overflow;
  - mobile `390x844` public reader showed the saved-library action, public annotation anchor chips,
    and no horizontal overflow.
