/** GET /memories/nodes — node index; GET /memories/nodes/graph; GET /memories/nodes/{node_id}. */

import {
  getNodeDetail,
  isValidNodeId,
  listNodesIndex,
} from "../../memory/browse";
import { listNodesGraph } from "../../memory/node-graph";

export async function handleNodesIndex() {
  return listNodesIndex();
}

export async function handleNodesGraph() {
  return listNodesGraph();
}

export async function handleNodeDetail(nodeId: string) {
  if (!isValidNodeId(nodeId)) {
    return { error: "invalid_node_id" as const };
  }
  return getNodeDetail(nodeId);
}
