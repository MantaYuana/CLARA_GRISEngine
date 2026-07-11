/**
 * graphContext.ts
 * Fetches real Neo4j relationships among a set of retrieved node ids so that
 * the Retrieval Trace Visualization can render actual graph edges.
 *
 * Usage:
 *   const edges = await fetchSubgraphEdges(trace.graph.nodes.map(n => n.id));
 *   trace.graph.edges = edges;
 */
import { getSession } from "../../config/neo4j";
import type { TraceGraphEdge } from "./retrievalTrace";

/**
 * Given a set of retrieved node ids, return the real Neo4j relationships
 * that exist between them (directed, deduped by DISTINCT).
 *
 * Returns [] immediately if nodeIds is empty so no DB round-trip is made.
 * Returns [] on any DB error so the trace degrades gracefully.
 */
export async function fetchSubgraphEdges(nodeIds: string[]): Promise<TraceGraphEdge[]> {
  if (nodeIds.length === 0) return [];

  const session = await getSession();
  try {
    // Directed match avoids producing both (a→b) and (b→a) for the same rel.
    const result = await session.run(
      `MATCH (a)-[r]->(b)
       WHERE a.id IN $ids AND b.id IN $ids
       RETURN DISTINCT a.id AS from, b.id AS to, type(r) AS type`,
      { ids: nodeIds },
    );

    return result.records.map((rec) => ({
      from: rec.get("from") as string,
      to: rec.get("to") as string,
      type: rec.get("type") as string,
    }));
  } catch {
    // Degrade gracefully: edges are decorative in the trace; missing them
    // does not break the retrieval result itself.
    return [];
  } finally {
    await session.close();
  }
}
