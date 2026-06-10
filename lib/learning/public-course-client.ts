import type { TextAnchor } from "@/lib/learning/text-anchors";

type PublicAnnotationStatus = "visible" | "hidden";

export interface PublicAnnotationMutationResult<TAnnotation> {
  annotation?: Partial<TAnnotation>;
}

export interface CreatePublicAnnotationParams {
  publicationSlug: string;
  sectionKey: string;
  quotedText: string;
  anchor: TextAnchor;
  body: string;
}

export interface UpdatePublicAnnotationStatusParams {
  publicationSlug: string;
  annotationId: string;
  status: PublicAnnotationStatus;
}

export interface SavePublicCourseResult {
  courseId?: string;
  learnUrl: string;
  alreadySaved?: boolean;
}

function publicCourseApiPath(publicationSlug: string, path = ""): string {
  return `/api/public/courses/${encodeURIComponent(publicationSlug)}${path}`;
}

async function readJsonResponse<T>(response: Response, errorMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export async function savePublicCourseToLibrary(params: {
  publicationSlug: string;
}): Promise<SavePublicCourseResult> {
  const payload = await readJsonResponse<Partial<SavePublicCourseResult>>(
    await fetch(publicCourseApiPath(params.publicationSlug, "/save"), { method: "POST" }),
    "Failed to save public course.",
  );

  if (!payload.learnUrl) {
    throw new Error("Missing saved course URL.");
  }

  return {
    learnUrl: payload.learnUrl,
    courseId: payload.courseId,
    alreadySaved: payload.alreadySaved,
  };
}

export async function createPublicAnnotation<TAnnotation>(
  params: CreatePublicAnnotationParams,
): Promise<PublicAnnotationMutationResult<TAnnotation>> {
  return readJsonResponse<PublicAnnotationMutationResult<TAnnotation>>(
    await fetch(publicCourseApiPath(params.publicationSlug, "/annotations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionKey: params.sectionKey,
        quotedText: params.quotedText,
        anchor: params.anchor,
        body: params.body,
      }),
    }),
    "Failed to create public annotation.",
  );
}

export async function updatePublicAnnotationStatus<TAnnotation extends { id: string }>(
  params: UpdatePublicAnnotationStatusParams,
): Promise<PublicAnnotationMutationResult<TAnnotation>> {
  return readJsonResponse<PublicAnnotationMutationResult<TAnnotation>>(
    await fetch(
      publicCourseApiPath(params.publicationSlug, `/annotations/${params.annotationId}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: params.status }),
      },
    ),
    "Failed to update public annotation.",
  );
}

export function mergePublicAnnotationMutation<
  TAnnotation extends { id: string; status: PublicAnnotationStatus },
>(
  current: TAnnotation,
  result: PublicAnnotationMutationResult<TAnnotation>,
  fallbackStatus: PublicAnnotationStatus,
): TAnnotation {
  return {
    ...current,
    ...result.annotation,
    status: result.annotation?.status ?? fallbackStatus,
  };
}

export interface ToggleLikeResult {
  liked: boolean;
}

export interface SubmitUrgeResult {
  urged: boolean;
}

export async function togglePublicCourseLike(params: {
  publicationSlug: string;
}): Promise<ToggleLikeResult> {
  return readJsonResponse<ToggleLikeResult>(
    await fetch(publicCourseApiPath(params.publicationSlug, "/like"), { method: "POST" }),
    "Failed to toggle like.",
  );
}

export async function submitPublicCourseUrge(params: {
  publicationSlug: string;
}): Promise<SubmitUrgeResult> {
  return readJsonResponse<SubmitUrgeResult>(
    await fetch(publicCourseApiPath(params.publicationSlug, "/urge"), { method: "POST" }),
    "Failed to submit urge.",
  );
}

