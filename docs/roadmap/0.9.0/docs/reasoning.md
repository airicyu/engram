# 0.9.0 WHY

## Why the floor of three goes away

The 0.3.0 quota forced 3–5 questions whenever distill had work. Models filled the floor by packing two facts into one stem, or by asking extensions nobody needed. A person answers one clause; the skill then has no place to put the other clause, so that fact disappears. The mailbox count looked healthy and the memory did not.

A ceiling of five still stops a runaway session. Zero is a successful generate when the skill can say, in one sentence, that this distill opened nothing to ask. That sentence is stored so a later reader of the job can see the skip was intentional.

## Why the program does not classify gaps

Whether a day or a node is missing a fact is the same kind of judgment as diary prose. Putting it in TypeScript would freeze a taxonomy of “good questions” and drift from the skill. The program already owns step order: Session B runs after a non-empty distill, and the job fails on a file count above five or an empty skip reply. Those checks do not read the question.

The same split applies to absorb versus dismiss. The skill decides whether the answer is a fact. The program only checks that the pending file arrived in `history/` with exactly one of `absorbed_at` or `dismissed_because`.

## Why a partial answer closes the question

Re-asking the unanswered half keeps the original double question alive and trains the skill to split facts after the person already replied. The answered fact is written. The rest is not invented. The file leaves `pending/`. A later distill may ask a new single-fact question if a real gap is still visible in the chain or the node; it does not repeat the old stem in order to collect the missing clause.

## Why dismiss is frontmatter

“Say why it was discarded” has to survive on the history file. A short `dismissed_because` string is enough for a person and for the file check. A second prose section would invite the skill to write the diary it was told not to invent.

## Why GET no longer expires future-sight

The GET sweep deleted the item and appended a mechanical pending line. The zone file never recorded whether the commitment happened, moved, or was dropped, and an open intention looked like a missed appointment. Leaving that sweep in place would still remove the item before distill could rewrite it. The date check stays in the program so a cron distill runs with an empty pool. The three endings stay in the skill. A dated item with no evidence is rescheduled or left as a gap, not marked happened.

The sentence goes to a day file so the zone does not become a second diary. Creating that day file is allowed when the sentence has nowhere else to go.

## Why meta files are deleted whole

`node.meta.yaml` is not a Lite field. Copying its keys into frontmatter would create a second node schema. A mapping has nothing to keep, so `--yes` deletes it. A file that is not a mapping is left, because the script cannot see it as residual keys and must not drop unseen content.

## Rejected

- Keep the minimum of three and only tighten the one-fact wording. The floor is what produces filler.
- Leave unanswered pending files for a later distill. That is the bug: an answer sits in `pending/` across runs and never enters the chain.
- Have the server delete surplus asking files or synthesize a skip reason. Both hide a skill miss and put judgment in the program.
