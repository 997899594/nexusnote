import { startCourseProductionWorker } from "@/lib/queue/course-production-worker";
import { startWorkerRuntime } from "./worker-runtime";

startWorkerRuntime("CourseProductionRuntime", [
  {
    name: "course-production",
    start: startCourseProductionWorker,
  },
]);
