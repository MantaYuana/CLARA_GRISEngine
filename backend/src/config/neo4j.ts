import neo4j, { Driver, Session } from "neo4j-driver";
import { env } from "./env";

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(
      env.NEO4J_URI,
      neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        logging: neo4j.logging.console(env.NODE_ENV === "development" ? "warn" : "error"),
      },
    );
  }
  return driver;
}

export async function getSession(): Promise<Session> {
  return getDriver().session({ database: "neo4j" });
}

export async function verifyConnectivity(): Promise<void> {
  const d = getDriver();
  await d.verifyConnectivity();
  console.log("Neo4j connected:", env.NEO4J_URI);
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    console.log("Neo4j driver closed.");
  }
}

// for Graceful shutdown
process.on("SIGTERM", closeDriver);
process.on("SIGINT", closeDriver);
