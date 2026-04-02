export function assertServerRuntime(moduleName: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`${moduleName} can only be imported on the server runtime.`);
  }
}
