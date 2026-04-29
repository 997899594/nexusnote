export interface InterviewTimingEvent {
  stage: string;
  elapsedMs: number;
  metadata?: Record<string, unknown>;
}

export interface InterviewTimingSink {
  mark(stage: string, metadata?: Record<string, unknown>): void;
}

export interface InterviewTimingRecorder extends InterviewTimingSink {
  readonly events: InterviewTimingEvent[];
}

export function createInterviewTimingRecorder(
  startedAt: number = Date.now(),
): InterviewTimingRecorder {
  const events: InterviewTimingEvent[] = [];

  return {
    events,
    mark(stage, metadata) {
      events.push({
        stage,
        elapsedMs: Date.now() - startedAt,
        ...(metadata && { metadata }),
      });
    },
  };
}
