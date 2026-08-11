/** Clarify distill／generate agent contracts (0.30). */

export interface ClarifyPendingPayload {
  id: string;
  kind: "prompt" | "aside";
  question: string | null;
  answer: string;
  related_nodes: string[];
  source_dream_run_id: string | null;
}

export interface ClarifyDistillContext {
  dream_run_id: string;
  timezone: string;
  memory_language: string;
  now: string;
  today: string;
  store_dir: string;
  draft_dir: string;
  report_path: string;
  pending: ClarifyPendingPayload[];
  /** Existing live＋draft node ids (hint). */
  existing_node_ids: string[];
}

export interface ClarifyDistillResult {
  /** Node ids whose draft main was created／updated. */
  distilled_node_ids: string[];
  /** Optional short narrative for ## Clarify distill. */
  narrative?: string;
}

export interface ClarifyGeneratePromptSpec {
  question: string;
  related_nodes?: string[];
}

export interface ClarifyGenerateContext {
  dream_run_id: string;
  timezone: string;
  memory_language: string;
  now: string;
  today: string;
  store_dir: string;
  /** Temp workdir only — no live memories writable. */
  work_dir: string;
  dream_narrative_excerpt: string;
  candidate_node_ids: string[];
  existing_asking_count: number;
  asking_cap: number;
  generate_min: number;
  generate_max: number;
}

export interface ClarifyGenerateResult {
  prompts: ClarifyGeneratePromptSpec[];
  /** Asking ids the agent wants pruned (optional; server may also prune by age). */
  prune_asking_ids?: string[];
}

export interface ClarifyDistillAgent {
  distill(ctx: ClarifyDistillContext): Promise<ClarifyDistillResult>;
}

export interface ClarifyGenerateAgent {
  generate(ctx: ClarifyGenerateContext): Promise<ClarifyGenerateResult>;
}
