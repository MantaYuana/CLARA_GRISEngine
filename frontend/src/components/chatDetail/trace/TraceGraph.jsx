/**
 * TraceGraph — React Flow knowledge-graph visualization.
 * Props: graph: { nodes[], edges[] }, fusion: { items[] }, query: string
 */
import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LEG_COLORS } from "./LegScores.jsx";

const truncate = (str, max = 28) =>
  str && str.length > max ? str.slice(0, max) + "…" : (str ?? "");

const QUERY_NODE_ID = "__query__";

/** Custom node with native title tooltip showing full filename on hover */
function GraphNode({ data, style }) {
  return (
    <div
      style={{
        ...style,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: 110,
      }}
      title={data.fullLabel ?? data.label}
    >
      <Handle type="target" position={Position.Top} />
      {data.label}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

/** Compute (x, y) for node[i] out of total on a circle of radius r around cx,cy */
const radialPos = (i, total, cx, cy, r) => {
  if (total === 0) return { x: cx, y: cy };
  const angle = (2 * Math.PI * i) / total - Math.PI / 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
};

/**
 * Determine the primary leg for a graph node.
 * Strategy:
 *  1. Find this node in fusion.items[].contributions sorted by `weighted` desc.
 *  2. Take the leg with the highest weighted contribution.
 *  3. Fall back to node.foundBy[0] if nothing found in fusion data.
 */
const getPrimaryLeg = (graphNode, fusionItems) => {
  if (!graphNode) return null;

  const nodeId = graphNode.id;

  // Walk all fusion items to find contributions for this graph node
  let bestLeg = null;
  let bestWeight = -Infinity;

  for (const fi of fusionItems ?? []) {
    if (fi.id !== nodeId) continue;
    for (const contrib of fi.contributions ?? []) {
      if ((contrib.weighted ?? 0) > bestWeight) {
        bestWeight = contrib.weighted ?? 0;
        bestLeg = contrib.leg;
      }
    }
  }

  if (bestLeg) return bestLeg;

  // Fallback: first entry in foundBy
  return (graphNode.foundBy ?? [])[0] ?? null;
};

/** Map a leg name to its hex color */
const legColor = (legName) => LEG_COLORS[legName] ?? "#a09aad";

const TraceGraph = ({ graph, fusion, query }) => {
  const graphNodes = graph?.nodes ?? [];
  const graphEdges = graph?.edges ?? [];
  const fusionItems = fusion?.items ?? [];

  // Center of the canvas — larger radius for more spacing
  const CX = 400;
  const CY = 260;

  // Build React Flow nodes — always called (hooks rules: no early return before useMemo)
  const rfNodes = useMemo(() => {
    // Dynamic radius based on node count for consistent spacing
    const RADIUS = Math.max(200, Math.min(320, (graphNodes.length + 1) * 45));
    const nodes = [];

    // Central query node (no custom type — default handles top/bottom)
    nodes.push({
      id: QUERY_NODE_ID,
      position: { x: CX - 75, y: CY - 20 },
      data: { label: truncate(query, 32) },
      style: {
        background: "#bb11ee",
        color: "#fff",
        border: "2px solid #bb11ee",
        borderRadius: 14,
        fontSize: 11,
        fontWeight: 700,
        padding: "8px 14px",
        maxWidth: 160,
        textAlign: "center",
        boxShadow: "0 0 16px rgba(187,17,238,0.5)",
      },
    });

    // One node per graph node
    graphNodes.forEach((gn, idx) => {
      const pos = radialPos(idx, graphNodes.length, CX, CY, RADIUS);
      const primaryLeg = getPrimaryLeg(gn, fusionItems);
      const color = legColor(primaryLeg);

      // Fused score for opacity/glow
      const fusedScore = gn.fusedScore ?? 0;
      const glowAlpha = Math.min(0.6, 0.1 + fusedScore * 0.5);

      nodes.push({
        id: String(gn.id),
        type: "graphNode",
        position: { x: pos.x - 65, y: pos.y - 14 },
        data: {
          label: gn.source ?? gn.label,
          fullLabel: gn.source,
        },
        style: {
          background: `${color}18`,
          color: "#f0edf5",
          border: `1.5px solid ${color}`,
          borderRadius: 8,
          fontSize: 9,
          fontWeight: 600,
          padding: "5px 10px",
          maxWidth: 150,
          minWidth: 110,
          textAlign: "center",
          boxShadow: `0 0 10px ${color}${Math.round(glowAlpha * 255)
            .toString(16)
            .padStart(2, "0")}`,
        },
      });
    });

    return nodes;
  }, [graphNodes, fusionItems, query]);

  // Build React Flow edges
  const rfEdges = useMemo(() => {
    const edges = [];

    // Query -> each graph node — show the article/pasal label on the edge
    graphNodes.forEach((gn) => {
      const primaryLeg = getPrimaryLeg(gn, fusionItems);
      const color = legColor(primaryLeg);
      const fusedScore = gn.fusedScore ?? 0;
      const strokeWidth = Math.min(6, 1 + fusedScore * 8);
      const pasalLabel = truncate(gn.title ?? gn.label, 36);

      edges.push({
        id: `q->${gn.id}`,
        source: QUERY_NODE_ID,
        target: String(gn.id),
        label: pasalLabel,
        style: { stroke: color, strokeWidth },
        labelStyle: { fill: "#fff", fontSize: 9, fontWeight: 600 },
        labelBgStyle: { fill: "#1e1b24", fillOpacity: 0.85 },
        labelBgPadding: [4, 3],
        labelBgBorderRadius: 5,
        animated: false,
      });
    });

    // KG relationship edges from graph.edges — show pasal/context on the line
    graphEdges.forEach((ge, idx) => {
      edges.push({
        id: `kg-${idx}-${ge.from}-${ge.to}`,
        source: String(ge.from),
        target: String(ge.to),
        label: ge.context ?? ge.type ?? "",
        style: { stroke: "#6b7280", strokeWidth: 2, strokeDasharray: "6 4" },
        labelStyle: { fill: "#d1d0d6", fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: "#1e1b24", fillOpacity: 0.9 },
        labelBgPadding: [6, 4],
        labelBgBorderRadius: 6,
        animated: false,
      });
    });

    return edges;
  }, [graphNodes, graphEdges, fusionItems]);

  // Register custom node types (stable reference, never changes)
  const nodeTypes = useMemo(() => ({ graphNode: GraphNode }), []);

  // Guard placed AFTER all hooks
  if (!graph || (graphNodes.length === 0 && graphEdges.length === 0)) {
    return (
      <p className="text-xs dark:text-textSecondary/50 text-gray-400 italic py-2">
        No data for this stage
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Canvas */}
      <div
        className="w-full rounded-xl overflow-hidden border dark:border-border border-gray-200"
        style={{ height: 500, background: "#16131c" }}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ style: { strokeWidth: 2 }, labelStyle: { fontWeight: 600 } }}
        >
          <Background color="#2a2533" gap={24} size={1} />
          <Controls
            style={{
              background: "#1e1b24",
              border: "1px solid #3a3444",
              borderRadius: 8,
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1 py-1">
        {Object.entries(LEG_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[11px] dark:text-textSecondary text-gray-500 capitalize">
              {name}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <svg width="22" height="8" viewBox="0 0 22 8">
            <line
              x1="0"
              y1="4"
              x2="22"
              y2="4"
              stroke="#6b7280"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          </svg>
          <span className="text-[11px] dark:text-textSecondary text-gray-500">
            Hubungan pasal
          </span>
        </div>
      </div>
    </div>
  );
};

export default TraceGraph;
