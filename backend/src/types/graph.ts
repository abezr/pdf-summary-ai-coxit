/**
 * Knowledge Graph Type Definitions
 */

export type NodeType = 'TEXT' | 'TABLE' | 'IMAGE' | 'SECTION';
export type EdgeType = 'HIERARCHY' | 'REFERENCE' | 'FOLLOWS' | 'SEMANTIC_SIMILAR';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  content: string;
  metadata: {
    page_number: number;
    bounding_box?: BoundingBox;
    previous_chunk_id?: string;
    section_id?: string;
    font_size?: number;
    font_name?: string;
  };
  embedding?: number[];
  edges: Edge[];
}

export interface Edge {
  target_node_id: string;
  relationship_type: EdgeType;
  weight: number; // 0.0-1.0
}

export interface TextNode extends GraphNode {
  type: 'TEXT';
}

export interface TableNode extends GraphNode {
  type: 'TABLE';
  metadata: GraphNode['metadata'] & {
    caption: string;
    headers: string[];
    rows: string[][];
  };
}

export interface ImageNode extends GraphNode {
  type: 'IMAGE';
  metadata: GraphNode['metadata'] & {
    caption: string;
    image_type: 'chart' | 'diagram' | 'photo' | 'screenshot';
    s3_url: string;
  };
}

export interface SectionNode extends GraphNode {
  type: 'SECTION';
  metadata: GraphNode['metadata'] & {
    level: number; // 1 = top-level, 2 = subsection, etc.
    title: string;
    children: string[]; // Child section IDs
  };
}

export interface SerializedGraph {
  version: '1.0';
  document_id: string;
  nodes: GraphNode[];
  metadata: {
    total_pages: number;
    creation_timestamp: string;
    parser_version: string;
    node_count: number;
    edge_count: number;
  };
}
