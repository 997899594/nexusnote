import type { LucideProps } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  icon: React.FC<LucideProps>;
  modeLabel: string;
  modeIcon: React.FC<LucideProps>;
  targetPath: string;
  getQueryParams: (input: string) => Record<string, string>;
}
