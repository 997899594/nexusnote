/**
 * Course node types for visual graph representation
 */
export interface CourseNode {
  id: string
  title: string
  type: 'chapter' | 'concept'
  x: number
  y: number
  status: 'pending' | 'generating' | 'ready'
  depth: number
}
