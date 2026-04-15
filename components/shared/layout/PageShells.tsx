import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageFamilyShellProps {
  header: ReactNode;
  children: ReactNode;
  frameClassName?: string;
  shellClassName?: string;
  background?: ReactNode;
}

export function LandingPageShell({
  header,
  children,
  frameClassName,
  shellClassName,
  background,
}: PageFamilyShellProps) {
  return (
    <main className={cn("min-h-dvh bg-[var(--color-bg)]", shellClassName)}>
      {header}
      <div className="ui-page-shell relative overflow-hidden">
        {background}
        <div
          className={cn(
            "ui-page-frame ui-floating-header-offset relative ui-bottom-breathing-room",
            frameClassName,
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

export function WorkspacePageShell({
  header,
  children,
  frameClassName,
  shellClassName,
}: PageFamilyShellProps) {
  return (
    <main className={cn("ui-page-shell min-h-dvh", shellClassName)}>
      {header}
      <div
        className={cn(
          "ui-page-frame ui-floating-header-offset ui-bottom-breathing-room",
          frameClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}

export function LibraryAnalysisPageShell({
  header,
  children,
  frameClassName,
  shellClassName,
}: PageFamilyShellProps) {
  return (
    <main className={cn("ui-page-shell min-h-dvh", shellClassName)}>
      {header}
      <div
        className={cn(
          "ui-page-frame ui-floating-header-offset max-w-4xl ui-bottom-breathing-room",
          frameClassName,
        )}
      >
        {children}
      </div>
    </main>
  );
}
