import { startCourseProductionWorker } from "@/lib/queue/course-production-worker";
import { startWorkerRuntime } from "@/lib/worker-runtime/runtime";

startWorkerRuntime("CourseProductionRuntime", [
  {
    name: "course-production",
    start: startCourseProductionWorker,
  },
]);
