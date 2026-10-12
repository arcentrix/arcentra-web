import { get } from "../client";
import type { ListAgentsResponse } from "../agent/types";

/** A cancellable, read-only agent snapshot for Observe's independent scope. */
export async function listAgentHealth(
  pageNum: number,
  signal?: AbortSignal,
): Promise<ListAgentsResponse> {
  const result = await get<ListAgentsResponse>("/agent", {
    params: { pageNum, pageSize: 20 },
    signal,
    silence: true,
  });
  return {
    ...result,
    agents: Array.isArray(result.agents) ? result.agents : [],
  };
}
