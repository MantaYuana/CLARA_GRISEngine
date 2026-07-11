/**
 * symbolicRetrieval.ts
 * Traverses the Neo4j legal Knowledge Graph using Cypher relationship queries
 * to enforce legal logic that vector/keyword search cannot capture:
 *
 *  – Wanprestasi must be preceded by a Somasi requirement
 *  – PKWT renewal conditions
 *  – Article-to-article legal chaining (RELATED_TO depth 1–2)
 *  – Contextual precedent via CITES / AMENDED_BY relationships
 *
 * Returns results in the standard RetrievalResult format so hybridRetrieval
 * can merge them with dense + BM25 results via RRF.
 */
import { getSession } from "../../config/neo4j";
import type { RetrievalResult } from "./denseRetrieval";

// Individual symbolic queries 

/**
 * Checks whether "Wanprestasi" requires a prior "Somasi" step in the graph,
 * and returns the Somasi and Wanprestasi concept nodes as retrieval results.
 */
async function queryWanprestasiSomasi(): Promise<RetrievalResult[]> {
    const session = await getSession();
    try {
        const result = await session.run(`
      MATCH (w:LegalConcept { name: 'Wanprestasi' })-[:REQUIRES]->(s:LegalConcept)
      RETURN
        s.id            AS id,
        'LegalConcept'  AS label,
        s.name          AS title,
        COALESCE(s.description, s.content, '') AS content,
        0.95            AS score,
        COALESCE(s.law_id, 'KUHPerdata') AS source,
        s.law_id        AS law_id
      UNION
      MATCH (w:LegalConcept { name: 'Wanprestasi' })
      RETURN
        w.id            AS id,
        'LegalConcept'  AS label,
        w.name          AS title,
        COALESCE(w.description, w.content, '') AS content,
        0.9             AS score,
        COALESCE(w.law_id, 'KUHPerdata') AS source,
        w.law_id        AS law_id
    `);

        return result.records
            .filter((rec) => rec.get("id"))
            .map((rec) => ({
                id: rec.get("id") as string,
                label: "LegalConcept" as const,
                title: rec.get("title") as string,
                content: rec.get("content") as string,
                score: rec.get("score") as number,
                source: rec.get("source") as string,
                law_id: rec.get("law_id") as string | undefined,
            }));
    } finally {
        await session.close();
    }
}

/**
 * Returns PKWT-related concept nodes with their HAS_CONDITION targets
 * (renewal conditions, maximum duration rules, etc.).
 */
async function queryPkwtConditions(): Promise<RetrievalResult[]> {
    const session = await getSession();
    try {
        const result = await session.run(`
      MATCH (pkwt:LegalConcept { name: 'PKWT' })-[:HAS_CONDITION]->(cond)
      RETURN
        cond.id         AS id,
        'LegalConcept'  AS label,
        COALESCE(cond.name, cond.title) AS title,
        COALESCE(cond.description, cond.content, '') AS content,
        0.88            AS score,
        COALESCE(cond.law_id, 'UU-13-2003') AS source,
        cond.law_id     AS law_id
      UNION
      MATCH (pkwt:LegalConcept { name: 'PKWT' })
      RETURN
        pkwt.id         AS id,
        'LegalConcept'  AS label,
        pkwt.name       AS title,
        COALESCE(pkwt.description, pkwt.content, '') AS content,
        0.85            AS score,
        COALESCE(pkwt.law_id, 'UU-13-2003') AS source,
        pkwt.law_id     AS law_id
    `);

        return result.records
            .filter((rec) => rec.get("id"))
            .map((rec) => ({
                id: rec.get("id") as string,
                label: "LegalConcept" as const,
                title: rec.get("title") as string,
                content: rec.get("content") as string,
                score: rec.get("score") as number,
                source: rec.get("source") as string,
                law_id: rec.get("law_id") as string | undefined,
            }));
    } finally {
        await session.close();
    }
}

/**
 * Article-to-article legal chaining.
 * Finds articles RELATED_TO the most prominent article matching the keyword,
 * up to depth 2 to capture amendment chains and cross-references.
 */
async function queryArticleChain(
    keyword: string,
    topK: number,
): Promise<RetrievalResult[]> {
    const session = await getSession();
    try {
        const result = await session.run(
            `
      MATCH (a:Article)
      WHERE toLower(a.content) CONTAINS toLower($keyword)
         OR toLower(a.title)   CONTAINS toLower($keyword)
         OR toLower(COALESCE(a.number, '')) CONTAINS toLower($keyword)
      WITH a LIMIT 3
      MATCH (a)-[:RELATED_TO*1..2]->(b:Article)
      RETURN DISTINCT
        b.id            AS id,
        'Article'       AS label,
        COALESCE(b.number, b.title, b.id) AS title,
        COALESCE(b.content, '') AS content,
        0.80            AS score,
        COALESCE(b.law_id, 'Indonesia Law') AS source,
        b.law_id        AS law_id
      LIMIT $topK
      `,
            { keyword, topK },
        );

        return result.records
            .filter((rec) => rec.get("id"))
            .map((rec) => ({
                id: rec.get("id") as string,
                label: "Article" as const,
                title: rec.get("title") as string,
                content: rec.get("content") as string,
                score: rec.get("score") as number,
                source: rec.get("source") as string,
                law_id: rec.get("law_id") as string | undefined,
            }));
    } finally {
        await session.close();
    }
}

// Query intent detection 

interface SymbolicIntent {
    wanprestasi: boolean;
    pkwt: boolean;
    articleKeyword: string | null;
}

function detectIntent(query: string): SymbolicIntent {
    const q = query.toLowerCase();
    return {
        wanprestasi:
            q.includes("wanprestasi") ||
            q.includes("somasi") ||
            q.includes("cidera janji") ||
            q.includes("ingkar janji"),
        pkwt:
            q.includes("pkwt") ||
            q.includes("perjanjian kerja waktu tertentu") ||
            q.includes("kontrak kerja"),
        // Extract "Pasal NNN" references for article chaining
        articleKeyword: (() => {
            const m = q.match(/pasal\s+\d+/i);
            return m ? m[0] : null;
        })(),
    };
}

// Main export 

/**
 * Perform symbolic / graph-traversal retrieval based on the query's legal intent.
 * Falls back gracefully to an empty list if Neo4j has no relationship data yet.
 */
export async function symbolicSearch(
    query: string,
    topK = 5,
): Promise<RetrievalResult[]> {
    const intent = detectIntent(query);

    const promises: Promise<RetrievalResult[]>[] = [];

    if (intent.wanprestasi) {
        promises.push(queryWanprestasiSomasi().catch(() => []));
    }

    if (intent.pkwt) {
        promises.push(queryPkwtConditions().catch(() => []));
    }

    if (intent.articleKeyword) {
        promises.push(
            queryArticleChain(intent.articleKeyword, topK).catch(() => []),
        );
    }

    // If no intent detected, do a generic concept lookup by keyword
    if (promises.length === 0) {
        const session = await getSession();
        promises.push(
            session
                .run(
                    `
          MATCH (n)
          WHERE (n:LegalConcept OR n:Article)
            AND (toLower(n.name)    CONTAINS toLower($kw)
              OR toLower(n.content) CONTAINS toLower($kw))
          RETURN
            n.id           AS id,
            labels(n)[0]   AS label,
            COALESCE(n.name, n.number, n.id) AS title,
            COALESCE(n.content, n.description, '') AS content,
            0.70           AS score,
            COALESCE(n.law_id, 'Indonesia Law') AS source,
            n.law_id       AS law_id
          LIMIT $topK
          `,
                    { kw: query.slice(0, 60), topK },
                )
                .then((r) =>
                    r.records
                        .filter((rec) => rec.get("id"))
                        .map((rec) => ({
                            id: rec.get("id") as string,
                            label: rec.get("label") as RetrievalResult["label"],
                            title: rec.get("title") as string,
                            content: rec.get("content") as string,
                            score: rec.get("score") as number,
                            source: rec.get("source") as string,
                            law_id: rec.get("law_id") as string | undefined,
                        })),
                )
                .catch(() => [] as RetrievalResult[])
                .finally(() => session.close()),
        );
    }

    const allResults = (await Promise.all(promises)).flat();

    // Deduplicate by id, keep highest score
    const seen = new Map<string, RetrievalResult>();
    for (const r of allResults) {
        const existing = seen.get(r.id);
        if (!existing || r.score > existing.score) seen.set(r.id, r);
    }

    return [...seen.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}
