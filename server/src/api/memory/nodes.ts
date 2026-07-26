/** GET /memories/nodes — node index; GET /memories/nodes/{node_id} — node detail. */

import {
  getNodeDetail,
  isValidNodeId,
  listNodesIndex,
} from "../../memory/browse";

export async function handleNodesIndex() {
  return listNodesIndex();
}

export async function handleNodeDetail(nodeId: string) {
  if (!isValidNodeId(nodeId)) {
    return { error: "invalid_node_id" as const };
  }
  return getNodeDetail(nodeId);
}
