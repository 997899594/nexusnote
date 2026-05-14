import type { ResearchWorkerResult, ResearchWorkerTask } from "./contracts";

export type ResearchWorkerTransportKind = "local" | "remote_a2a";

export interface A2AResearchWorkerRequest {
  task: ResearchWorkerTask;
  userPrompt: string;
}

export interface A2AResearchWorkerResponse {
  result: ResearchWorkerResult;
}

export interface ResearchWorkerProvider {
  kind: ResearchWorkerTransportKind;
  runTask(input: { userPrompt: string; task: ResearchWorkerTask }): Promise<ResearchWorkerResult>;
}
