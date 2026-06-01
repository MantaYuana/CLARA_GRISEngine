/**
 * chatService.ts
 *
 * Centralized service to persist chat history across Drafter, Query,
 * and Contract Review endpoints.
 */
import { getSession } from "../../config/neo4j";
import { v4 as uuidv4 } from "uuid";

export type EndpointType = "drafter" | "query" | "contract";
export type ChatRole = "user" | "assistant" | "model";

export interface ChatMessage {
    role: ChatRole;
    content: string;
}

export interface StoredChatMessage extends ChatMessage {
    id: string;
    timestamp: string;
}

export interface SessionHistory {
    endpoint_type: EndpointType | null;
    history: StoredChatMessage[];
}

/**
 * Saves a new message to a ChatSession.
 * If the session doesn't exist, it creates it.
 */
export async function saveChatMessage(
    sessionId: string,
    userId: string,
    endpointType: EndpointType,
    role: ChatRole,
    content: string,
    documentId?: string | null,
): Promise<void> {
    const dbSession = await getSession();
    try {
        await dbSession.run(
            `
      // Ensure the ChatSession exists
      MERGE (cs:ChatSession { id: $sessionId })
      ON CREATE SET cs.user_id = $userId,
                    cs.endpoint_type = $endpointType,
                    cs.created_at = datetime()
      SET cs.document_id = COALESCE($documentId, cs.document_id),
          cs.updated_at = datetime()

      // Create the new message
      CREATE (cm:ChatMessage {
        id: $messageId,
        session_id: $sessionId,
        role: $role,
        content: $content,
        timestamp: datetime()
      })

      // Link them
      MERGE (cs)-[:HAS_MESSAGE]->(cm)
      `,
            {
                sessionId,
                userId,
                endpointType,
                documentId: documentId ?? null,
                messageId: uuidv4(),
                role,
                content,
            },
        );
    } catch (err) {
        console.warn("[chatService] Failed to save chat message:", err);
    } finally {
        await dbSession.close();
    }
}

/**
 * Retrieves the full chat history for a given session, ordered by timestamp.
 */
export async function getSessionHistory(
    sessionId: string,
): Promise<SessionHistory> {
    const dbSession = await getSession();
    try {
        const result = await dbSession.run(
            `
      MATCH (cs:ChatSession { id: $sessionId })
      OPTIONAL MATCH (cs)-[:HAS_MESSAGE]->(cm:ChatMessage)
      WITH cs, cm ORDER BY cm.timestamp ASC
      RETURN cs.endpoint_type AS endpoint_type, 
             collect({ 
                 id: cm.id, 
                 role: cm.role, 
                 content: cm.content, 
                 timestamp: toString(cm.timestamp) 
             }) AS history
      `,
            { sessionId },
        );

        if (result.records.length === 0) {
            return { endpoint_type: null, history: [] };
        }

        const record = result.records[0];
        const rawHistory = record.get("history") as any[];

        // Filter out null messages (produced by OPTIONAL MATCH if no messages exist)
        const history = rawHistory
            .filter((m) => m.id !== null)
            .map((m) => ({
                id: m.id,
                role: m.role as ChatRole,
                content: m.content,
                timestamp: m.timestamp,
            }));

        return {
            endpoint_type: record.get("endpoint_type") as EndpointType,
            history,
        };
    } catch (err) {
        console.warn("[chatService] Failed to fetch chat history:", err);
        return { endpoint_type: null, history: [] };
    } finally {
        await dbSession.close();
    }
}
