import { Client, QueryResult } from "pg";

export async function dbQuery(
  client: Client,
  query: string,
): Promise<QueryResult> {
  // console.log(`Query: ${query}`);
  return await client.query(query);
}

export async function dbQueryWithValues(
  client: Client,
  query: string,
  values: any[] = [],
): Promise<QueryResult> {
  // console.log(`Query: ${query}, values: ${values.length}`);
  return await client.query(query, values);
}
