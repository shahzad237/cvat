# Definition of Done

Written before starting (commit `d92ff3a86`). Each line gets a number, an output or a link when it
is ticked. A line without evidence counts as not done. The API, socket and test outputs below were
re-run on commit `70aeef42d` (2026-10-29 15:11 UTC), the last backend change; the page checks were
re-done on the final UI (commit `da6b92bcd`, checked 15:41–15:43 UTC). Machine as described in `OBJECTIVES.md`.

## Floor (items 1–4)

- [x] Endpoint returns per-class counts for task 1 that match an independent count from the COCO JSON for every one of the 80 classes, and the total is 41,866.
  The reference count counts one CVAT shape per polygon part and one per crowd mask, which is how
  CVAT's COCO importer stores them.
  ```
  classes compared: 80, expected total 41866, got total 41866
  mismatches: none
    person       expected  12451 got 12451
    car          expected   2315 got 2315
    chair        expected   2141 got 2141
    book         expected   1184 got 1184
    bottle       expected   1085 got 1085
  ```
- [x] Classes with zero annotations are returned with 0, not left out.
  Task 2 (one image, no annotations): `{"task_id":2,"total":0,"labels":[{"id":81,"name":"person","color":"#c06060","count":0},{"id":82,"name":"car","color":"#2080c0","count":0}]}`,
  and test `test_counts_per_label_include_labels_without_annotations` ("bird": 0).
- [x] The page in the CVAT UI calls the endpoint and draws a bar chart of the counts.
  `/tasks/1/annotation-stats`, linked from the task's Actions menu as "Annotation counts":
  header "Annotation counts · COCO val2017 · Task #1", cards "Annotations 41,866",
  "Classes with annotations 80 / 80", "Most frequent class person 29.7%", "Last updated", then
  80 horizontal bars in label colours with the count at the end of each bar, sortable by count or
  name. Shown in the recording.
- [x] Empty case: a task with no annotations shows an empty-state message, not an empty chart.
  `/tasks/2/annotation-stats` shows "Empty task · Task #2" and "This task has no annotations yet",
  with no cards and no chart.
- [x] Error case: a failed request shows an error message with a retry button.
  `/tasks/999/annotation-stats` shows "Could not load the annotation counts", the server's message
  "No Task matches the given query." and a Retry button. With `cvat_server` stopped, a request
  shows "The server did not answer. Check that CVAT is running, then retry."; after
  `docker start cvat_server`, Retry shows the spinner and then the chart (41,866).

## Beyond the floor

- [x] No login → 401. User `viewer` (no access to task 1) → 403. Owner → 200. Status codes pasted.
  ```
  owner          200
  no-login       401
  viewer         403
  unknown-task   404
  bad-group_by   400
  ```
  Same rules for the socket: `no login: rejected, HTTP 403` / `viewer: rejected, HTTP 403`.
- [x] MO-1 measured, 5 runs, raw output in `OBJECTIVES.md`, median and spread reported.
  Basic auth: median 347.3 ms (339.9–455.7). Token auth: median 64.9 ms (61.5–68.1).
  Token auth on the final code: median 60.0 ms (58.4–63.7).
- [x] MO-1 target met, or missed with the reason written down.
  Missed with Basic auth (password hashing, ~300 ms on every CVAT endpoint), met with token auth,
  which is what the page uses. Reason and breakdown in `OBJECTIVES.md`.
- [x] `group_by=shape_type` returns counts per class and shape type, and their sum equals the plain counts.
  Shipped as `group_by=kind`, because tracks and tags have no shape type (Plan, change at 19:00).
  `by kind: {'mask': 446, 'polygon': 41420} | sum 41866 == total 41866 True`.
  The "Split by type" switch stacks each bar by kind.
- [x] Chart updates without a page reload when an annotation is added or deleted in another tab.
  Script against the socket while creating and deleting a rectangle through the annotations API:
  ```
  admin: accepted, initial total=41866 person=12451
  after create: pushed in 1.05s, total=41867 person=12452
  after delete: pushed in 1.15s, total=41866 person=12451
  ```
  In the browser the "Annotations" card went from 41,866 to 41,867 and "Last updated" from
  8:41:52 PM to 8:41:54 PM, with no reload.
- [x] Page recovers after the WebSocket drops (server restart) and shows fresh counts afterwards.
  `docker stop cvat_server` → badge "Reconnecting", cards and chart kept (41,867). Shape deleted
  directly in the database while the server was down (no change event sent) →
  `docker start cvat_server` → badge "Live", 41,866 and "Last updated 8:43:06 PM" without a
  reload, because the server sends current counts on connect.
- [x] Decision record written at the end of `PLAN.md`.

## Hygiene

- [x] Backend code only in `cvat/apps/test`, plus the minimum wiring in settings and urls.
  Outside the app: `cvat/settings/base.py` (+1), `cvat/urls.py` (+3), `cvat/asgi.py` (+7).
  UI: `cvat-ui/src/components/annotation-stats-page/` (new), `cvat-app.tsx` (+2),
  `tasks-page/actions-menu-items.tsx` (+6), `webpack.config.js` (+1, dev proxy `ws: true`).
- [x] No dead code, no commented-out blocks, no stray files (`git status` clean, diff reviewed).
  `git status --porcelain` empty. Python formatted with the repository's black 26 / isort 7,
  `eslint` clean on the UI files, `tsc --noEmit -p cvat-ui/tsconfig.json` exits 0 with no errors
  (run with the dev server stopped; with both running it ran out of memory). Setup and measurement
  scripts were kept outside the repository.
- [x] Commits are small and each message says what changed and why.
  16 commits on `dev-test01`, plan first: `git log --oneline b36a49bd5..dev-test01`.
- [x] Everything not finished is listed below with the reason.

Automated tests, 7 of 7 passing:

```
test_counts_per_label_include_labels_without_annotations ... ok
test_group_by_kind_splits_shapes_tracks_tags_and_intervals ... ok
test_request_without_login_is_refused ... ok
test_task_change_is_published_after_commit ... ok
test_unknown_group_by_is_rejected ... ok
test_unknown_task_is_not_found ... ok
test_user_without_access_to_the_task_is_refused ... ok
Ran 7 tests in 0.177s
OK
```

Removing the ground truth filter from `stats.py` makes two of them fail (`7 != 6`), and so does
removing the interval query (`5 != 6`), so they check the behaviour.

## Not finished

- **The page is not in the production UI image.** It runs from the webpack dev server on port 3000
  (proxying the API on 8080). Rebuilding `cvat/ui` from source was not tried: the Docker VM already
  restarted once under memory pressure on this 16 GB laptop.
- **Tests do not run through CVAT's own test runner.** The production server image has no
  `django_extensions`, `silk` or `fakeredis`, and no pip. I ran them with Django's
  `DiscoverRunner` and a throwaway settings file inside the container (command in the PR
  description). They are not wired into CVAT's CI.
- **`cvat/schema.yml` was not regenerated.** `manage.py spectacular` reports 0 errors for the new
  endpoint, but the checked-in schema does not list it, and CVAT's CI would flag that.
- **No browser test for the page.** The empty, error, live and reconnect states were checked by
  hand in Chrome; there is no Cypress test.
- **The UI calls the endpoint through `core.server.request`**, not a typed cvat-core method, so
  there is no plugin hook and the response type is a cast.
- **MO-1 covers task 1 only.** `group_by=kind` and larger tasks were not measured.
