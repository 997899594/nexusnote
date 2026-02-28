/**
 * GenericToolResult - 默认工具结果展示
 *
 * 当没有特定组件时使用，展示原始 JSON 数据
 */

interface GenericToolResultProps {
  output: unknown;
}

export function GenericToolResult({ output }: GenericToolResultProps) {
  if (!output) {
    return null;
  }

  const isSuccess =
    typeof output === "object" &&
    output !== null &&
    "success" in output &&
    (output as { success: boolean }).success;

  const error =
    typeof output === "object" && output !== null && "error" in output
      ? (output as { error: string }).error
      : null;

  return (
    <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
      {error ? (
        <p className="text-sm text-red-500">Error: {error}</p>
      ) : isSuccess ? (
        <p className="text-xs text-zinc-500">操作已完成</p>
      ) : (
        <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}
