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
    // Also fetch node labels (number/name/title) so we can build a human-readable context
    const result = await session.run(
      `MATCH (a)-[r]->(b)
       WHERE a.id IN $ids AND b.id IN $ids
       RETURN DISTINCT a.id AS from, b.id AS to, type(r) AS type,
              a.number AS fromNumber, b.number AS toNumber,
              a.name AS fromName, b.name AS toName,
              a.title AS fromTitle, b.title AS toTitle`,
      { ids: nodeIds },
    );

    return result.records.map((rec) => {
      const type = rec.get("type") as string;
      const fromNumber = rec.get("fromNumber") as string | null;
      const toNumber = rec.get("toNumber") as string | null;
      const fromName = rec.get("fromName") as string | null;
      const toName = rec.get("toName") as string | null;
      const fromTitle = rec.get("fromTitle") as string | null;
      const toTitle = rec.get("toTitle") as string | null;

      // Best label: number > name > title
      const toLabel = toNumber ?? toName ?? toTitle;
      const fromLabel = fromNumber ?? fromName ?? fromTitle;

      // Derive a human-readable context / article label
      let context: string | undefined;

      switch (type) {
        case "PART_OF":
          context = toLabel ?? undefined;
          break;
        case "GOVERNED_BY":
          context = toLabel ?? undefined;
          break;
        case "REQUIRES":
          context = toLabel ?? undefined;
          break;
        case "RELATED_TO":
          if (fromLabel && toLabel) {
            context = `${fromLabel} → ${toLabel}`;
          } else {
            context = toLabel ?? fromLabel ?? undefined;
          }
          break;
        case "HAS_CONDITION":
          context = toLabel ?? undefined;
          break;
        case "AMENDS":
          context = toLabel ?? undefined;
          break;
        default:
          context = toLabel ?? undefined;
      }

      return {
        from: rec.get("from") as string,
        to: rec.get("to") as string,
        type,
        context,
      };
    });
  } catch {
    // Degrade gracefully: edges are decorative in the trace; missing them
    // does not break the retrieval result itself.
    return [];
  } finally {
    await session.close();
  }
}
