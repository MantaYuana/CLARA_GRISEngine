/**
 * userService.ts
 * Neo4j user management — upsert (create or update) a User node.
 */
import { getSession } from "../../config/neo4j";
import { v4 as uuidv4 } from "uuid";

export interface User {
    id: string;
    google_id: string;
    email: string;
    name: string;
}

/**
 * Upsert a user by their Google ID.
 * Creates the node if it doesn't exist, updates email/name on each login.
 */
export async function upsertUser(googleId: string, email: string, name: string): Promise<User> {
    const session = await getSession();
    try {
        const result = await session.run(
            `
      MERGE (u:User { google_id: $googleId })
      ON CREATE SET
        u.id         = $id,
        u.email      = $email,
        u.name       = $name,
        u.created_at = datetime()
      ON MATCH SET
        u.email      = $email,
        u.name       = $name,
        u.updated_at = datetime()
      RETURN u.id AS id, u.google_id AS google_id, u.email AS email, u.name AS name
      `,
            { googleId, id: uuidv4(), email, name },
        );
        const record = result.records[0];
        return {
            id: record.get("id") as string,
            google_id: record.get("google_id") as string,
            email: record.get("email") as string,
            name: record.get("name") as string,
        };
    } finally {
        await session.close();
    }
}
