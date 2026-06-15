export type WorkerHandle = {
  pause?: (doNotWaitActive?: boolean) => Promise<void>;
  close: (force?: boolean) => Promise<void>;
};

export type WorkerStarter = {
  name: string;
  start: () => WorkerHandle;
};

export type WorkerRuntimeWorker<WorkerId extends string = string> = {
  id: WorkerId;
  name: string;
};

export type WorkerRuntimeDefinition<WorkerId extends string = string> = {
  runtimeName: string;
  workers: readonly WorkerRuntimeWorker<WorkerId>[];
};
