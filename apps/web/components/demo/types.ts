export interface Node {
  id: string;
  title: string;
  type: "chapter" | "concept";
  x: number;
  y: number;
  status: "pending" | "generating" | "ready";
  depth: number;
}
