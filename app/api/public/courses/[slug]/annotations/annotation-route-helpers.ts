import { badRequest, notFound } from "@/lib/api";
import {
  revalidateCourseContentViews,
  revalidateCoursePublicationViews,
} from "@/lib/cache/domain-events";

interface CoursePublicationMutationResult {
  publication: {
    ownerUserId: string;
    sourceCourseId: string;
  };
}

export function revalidatePublicAnnotationMutation(
  slug: string,
  result: CoursePublicationMutationResult,
): void {
  revalidateCoursePublicationViews(slug);
  revalidateCourseContentViews(result.publication.ownerUserId, result.publication.sourceCourseId);
}

export function handlePublicAnnotationMutationError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  switch (error.message) {
    case "COURSE_PUBLICATION_NOT_FOUND":
    case "COURSE_PUBLICATION_FORBIDDEN":
      throw notFound("公开课程不存在", "COURSE_PUBLICATION_NOT_FOUND");
    case "COURSE_PUBLICATION_SECTION_NOT_FOUND":
      throw badRequest("批注小节不存在", "COURSE_PUBLICATION_SECTION_NOT_FOUND");
    case "COURSE_PUBLIC_ANNOTATION_NOT_FOUND":
      throw notFound("公共批注不存在", "COURSE_PUBLIC_ANNOTATION_NOT_FOUND");
    default:
      throw error;
  }
}
