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
    <div className="mt-2 rounded-2xl bg-[#f6f7f9] p-3">
      {error ? (
        <p className="text-sm text-zinc-600">Error: {error}</p>
      ) : isSuccess ? (
        <p className="text-xs text-[var(--color-text-muted)]">操作已完成</p>
      ) : (
        <pre className="text-xs text-[var(--color-text-secondary)] overflow-x-auto">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}
