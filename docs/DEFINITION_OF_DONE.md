# Definition of Done

Written before starting. Each line gets a number, an output or a link when it is ticked.
A line without evidence counts as not done.

## Floor (items 1–4)

- [ ] Endpoint returns per-class counts for task 1 that match an independent count from the COCO JSON for every one of the 80 classes, and the total is 41,866.
- [ ] Classes with zero annotations are returned with 0, not left out.
- [ ] The page in the CVAT UI calls the endpoint and draws a bar chart of the counts.
- [ ] Empty case: a task with no annotations shows an empty-state message, not an empty chart.
- [ ] Error case: a failed request shows an error message with a retry button.

## Beyond the floor

- [ ] No login → 401. User `viewer` (no access to task 1) → 403. Owner → 200. Status codes pasted.
- [ ] MO-1 measured, 5 runs, raw output in `OBJECTIVES.md`, median and spread reported.
- [ ] MO-1 target met, or missed with the reason written down.
- [ ] `group_by=shape_type` returns counts per class and shape type, and their sum equals the plain counts.
- [ ] Chart updates without a page reload when an annotation is added or deleted in another tab.
- [ ] Page recovers after the WebSocket drops (server restart) and shows fresh counts afterwards.
- [ ] Decision record written at the end of `PLAN.md`.

## Hygiene

- [ ] Backend code only in `cvat/apps/test`, plus the minimum wiring in settings and urls.
- [ ] No dead code, no commented-out blocks, no stray files (`git status` clean, diff reviewed).
- [ ] Commits are small and each message says what changed and why.
- [ ] Everything not finished is listed below with the reason.

## Not finished

(Filled in at the end.)
