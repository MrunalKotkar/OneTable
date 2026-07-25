/**
 * Minimal XTrace HTTP client. Lives inside the memory feature so no
 * provider-specific response shape leaks out (see README boundary rule).
 *
 * Verified endpoints (production, 2026-07-25):
 *   POST   /v1/memories?wait=true   write  — conversational; XTrace LLM-extracts
 *                                            facts from `messages`, returns ids
 *   POST   /v1/memories/search      recall — scope by user_id; mode=retrieve
 *                                            returns ALL of that user's memories
 *   DELETE /v1/memories/{id}        delete — hard delete (204)
 *
 * Quirks baked in here so callers never re-learn them:
 *  - CloudFront returns a 403 HTML block page without a normal User-Agent.
 *  - Custom `metadata` is silently dropped; `group_ids` is ignored unless
 *    pre-registered. So we scope purely by `user_id`.
 *  - XTrace does NOT retire contradicted beliefs — `status` is unreliable, so
 *    the gateway (not this client) owns supersession.
 */

const BASE_URL =
  process.env.XTRACE_BASE_URL ?? "https://api.production.xtrace.ai";

interface CreatedMemory {
  id: string;
  type: string;
  text: string;
}

interface IngestResponse {
  result?: { memories_created?: CreatedMemory[] };
}

interface SearchMemory {
  id: string;
  type: string;
  text: string;
  details?: { status?: string; supersedes?: string | null };
}

interface SearchResponse {
  data?: SearchMemory[];
}

export interface XtraceFact {
  id: string;
  text: string;
  status: string;
  supersedes: string | null;
}

function apiKey(): string {
  const key = process.env.XTRACE_API_KEY;
  if (!key) {
    throw new Error(
      "XTRACE_API_KEY is not set. Add it to .env (see .env.example), " +
        "or run with MEMORY_PROVIDER=mock.",
    );
  }
  return key;
}

async function request(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey(),
      "content-type": "application/json",
      // Required: CloudFront blocks requests with no/blank User-Agent.
      "user-agent": "onetable/1.0",
      ...init.headers,
    },
  });
}

/**
 * Write one conversational turn and return the primary fact XTrace extracted.
 * Callers pass a sentence engineered to yield exactly one fact.
 */
export async function writeFact(
  userId: string,
  convId: string,
  content: string,
): Promise<{ id: string; text: string }> {
  const res = await request("/v1/memories?wait=true", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      conv_id: convId,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    throw new Error(`XTrace write failed (${res.status}): ${await res.text()}`);
  }
  const job = (await res.json()) as IngestResponse;
  const created = job.result?.memories_created ?? [];
  const fact = created.find((m) => m.type === "fact") ?? created[0];
  if (!fact) {
    throw new Error(`XTrace extracted no memory from: "${content}"`);
  }
  return { id: fact.id, text: fact.text };
}

/** Retrieve every fact-type memory for a diner (mode=retrieve returns all). */
export async function searchFacts(
  userId: string,
  query: string,
): Promise<XtraceFact[]> {
  const memories = await searchAll(userId, query);
  return memories
    .filter((m) => m.type === "fact")
    .map((m) => ({
      id: m.id,
      text: m.text,
      status: m.details?.status ?? "active",
      supersedes: m.details?.supersedes ?? null,
    }));
}

/** Every memory id (facts + episodes) for a user — used to wipe on reseed. */
export async function listAllMemoryIds(userId: string): Promise<string[]> {
  const memories = await searchAll(userId, RECALL_QUERY);
  return memories.map((m) => m.id);
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await request(`/v1/memories/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`XTrace delete failed (${res.status}): ${await res.text()}`);
  }
}

/** A broad query so `retrieve` surfaces all of a diner's belief facts. */
export const RECALL_QUERY = "dietary preferences allergies budget goals food";

async function searchAll(
  userId: string,
  query: string,
): Promise<SearchMemory[]> {
  const res = await request("/v1/memories/search", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, query, mode: "retrieve" }),
  });
  if (!res.ok) {
    throw new Error(`XTrace search failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as SearchResponse;
  return body.data ?? [];
}
