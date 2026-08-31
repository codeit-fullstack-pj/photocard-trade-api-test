import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(): Promise<Response> {
  const file = path.resolve(process.cwd(), "..", "..", "openapi", "openapi.yaml");
  const yaml = await readFile(file, "utf8");
  return new Response(yaml, {
    headers: { "content-type": "application/yaml; charset=utf-8", "cache-control": "no-store" },
  });
}
