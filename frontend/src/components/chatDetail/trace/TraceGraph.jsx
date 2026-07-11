/**
 * TraceGraph — React Flow knowledge-graph visualization.
 * Props: graph: { nodes[], edges[] }, fusion: { items[] }, query: string
 */
import { useMemo } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LEG_COLORS } from "./LegScores.jsx";

const truncate = (str, max = 28) =>
  str && str.length > max ? str.slice(0, max) + "…" : (str ?? "");

const QUERY_NODE_ID = "__query__";

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

  // Center of the canvas
  const CX = 400;
  const CY = 200;
  const RADIUS = 160;

  // Build React Flow nodes — always called (hooks rules: no early return before useMemo)
  const rfNodes = useMemo(() => {
    const nodes = [];

    // Central query node
    nodes.push({
      id: QUERY_NODE_ID,
      position: { x: CX - 70, y: CY - 18 },
      data: { label: truncate(query, 32) },
      style: {
        background: "#bb11ee",
        color: "#fff",
        border: "2px solid #bb11ee",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        padding: "6px 10px",
        maxWidth: 140,
        textAlign: "center",
        boxShadow: "0 0 12px rgba(187,17,238,0.4)",
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
        position: { x: pos.x - 60, y: pos.y - 18 },
        data: { label: truncate(gn.title ?? gn.label, 26) },
        style: {
          background: `${color}22`,
          color: "#f0edf5",
          border: `2px solid ${color}`,
          borderRadius: 10,
          fontSize: 10,
          padding: "5px 8px",
          maxWidth: 130,
          textAlign: "center",
          boxShadow: `0 0 8px ${color}${Math.round(glowAlpha * 255)
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

    // Query -> each graph node
    graphNodes.forEach((gn) => {
      const primaryLeg = getPrimaryLeg(gn, fusionItems);
      const color = legColor(primaryLeg);
      const fusedScore = gn.fusedScore ?? 0;
      const strokeWidth = Math.min(6, 1 + fusedScore * 8);

      edges.push({
        id: `q->${gn.id}`,
        source: QUERY_NODE_ID,
        target: String(gn.id),
        style: { stroke: color, strokeWidth },
        animated: false,
      });
    });

    // KG relationship edges from graph.edges
    graphEdges.forEach((ge, idx) => {
      edges.push({
        id: `kg-${idx}-${ge.from}-${ge.to}`,
        source: String(ge.from),
        target: String(ge.to),
        label: ge.type ?? "",
        style: { stroke: "#6b7280", strokeWidth: 1.5, strokeDasharray: "4 3" },
        labelStyle: { fill: "#a09aad", fontSize: 9 },
        labelBgStyle: { fill: "#24212a", fillOpacity: 0.8 },
        animated: false,
      });
    });

    return edges;
  }, [graphNodes, graphEdges, fusionItems]);

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
        style={{ height: 360 }}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#3a3444" gap={20} size={1} />
          <Controls
            style={{
              background: "#2d2838",
              border: "1px solid #3a3444",
              borderRadius: 8,
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1 py-1">
        {Object.entries(LEG_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] dark:text-textSecondary text-gray-600 capitalize">
              {name}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <svg width="18" height="6" viewBox="0 0 18 6">
            <line
              x1="0"
              y1="3"
              x2="18"
              y2="3"
              stroke="#6b7280"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </svg>
          <span className="text-[10px] dark:text-textSecondary text-gray-600">
            KG relationship
          </span>
        </div>
      </div>
    </div>
  );
};

export default TraceGraph;
