import type {
  CoursePublicAnnotationAnchor,
  CoursePublicationSnapshotContent,
} from "@/db/schema/course-sharing";

export interface PublicCourseAnnotationProjection {
  id: string;
  sectionKey: string;
  quotedText: string;
  body: string;
  anchor: CoursePublicAnnotationAnchor;
  createdAt: string;
  author: {
    name: string | null;
    image: string | null;
  };
}

export interface PublicCourseReaderProjection {
  publication: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    allowAnnotations: boolean;
    publishedAt: string | null;
  };
  snapshotId: string;
  content: CoursePublicationSnapshotContent;
  annotations: PublicCourseAnnotationProjection[];
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
