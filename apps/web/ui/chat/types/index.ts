export interface Command {
  id: string;
  label: string;
  icon: React.ElementType;
  modeLabel: string;
  modeIcon: React.ElementType;
  targetPath: string;
  getQueryParams: (input: string) => Record<string, string>;
}
