import migrations from "node-pg-migrate";
import { Client } from "pg";

async function connect(callback: (client: Client) => Promise<void>) {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || ""),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  client.connect();

  if (!process.env.SKIP_MIGRATIONS) {
    await migrations({
      dbClient: client,
      migrationsTable: 'pgmigrations',
      dir: 'build/migrations',
      direction: 'up',
    });
  }

  await callback(client);

  client.end();
}

export default connect;
