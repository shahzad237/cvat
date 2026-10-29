# Plan — Annotation counts per class

Clock started 2026-10-29 18:48 PKT (13:48 UTC). Deadline 02:48 PKT (21:48 UTC).
Setup (fork, `docker compose up`, COCO import) was done before the clock started, as Section 2 allows.

## Starting point

- CVAT commit `b36a49bd5cc7e5fe3fc36ecb6036659c8136b780` (develop, release 2.81.0), branch `dev-test01`.
- Sample data: task 1 "COCO val2017", **all 5,000 images**, 10 jobs of 500 frames,
  `instances_val2017.json` imported as COCO 1.0.
- Known answer to check against: CVAT holds **41,866 shapes** for this task, not the 36,781 COCO
  annotations. COCO objects drawn as several polygon parts are split into one CVAT polygon per part
  (41,420 polygon parts) and crowd annotations become masks (446). Verified by a SQL count and by
  counting parts in the JSON. The endpoint must reproduce these numbers per class.

## What I read before planning

- A shape's class is `Annotation.label` (FK to `Label`, field `name`) in `cvat/apps/engine/models.py`.
  `LabeledShape`, `LabeledTrack` and `LabeledImage` (tags) all inherit it. Task → `Segment` → `Job`
  → annotation → `Label.name`.
- Access control: every DRF view declares `iam_permission_class`; `PolicyEnforcer` asks OPA.
  `TaskPermission.create_scope_view(request, task)` is already reused by `consensus` and `lambda_manager`.
- The UI already ships `chart.js` + `react-chartjs-2`, so no new dependency for the graph.
- The server runs under uvicorn (`cvat.asgi:application`). Django Channels is **not** installed and
  pip is removed from the image, which matters for item 8.

## Order of work and time budget (8 h)

| # | Step | Budget |
|---|------|--------|
| 0 | This plan, Objectives and Definition of Done, committed before any code | 0:25 |
| 1 | Django app `test` (`cvat/apps/test`): `GET /api/annotation_stats/tasks/<id>` returning counts per label, aggregated in the database (`GROUP BY label`), shapes + tracks + tags, top-level only (skeleton elements excluded), annotation jobs only (ground-truth jobs would double count) | 1:15 |
| 5 | Permission class that reuses the task "view" rule; show 401 without login and 403 for user `viewer` | 0:30 |
| 2–3 | UI page `/tasks/:tid/annotation-stats`, bar chart with Chart.js, link from the task page | 1:15 |
| 4 | Empty state (no annotations) and error state (failed request, with retry) | 0:30 |
| 6 | Measure MO-1, 5 runs, raw output in `docs/OBJECTIVES.md`; optimise only if missed | 0:45 |
| 7 | `?group_by=shape_type` (bars split into rectangle / polygon / mask / …) | 0:30 |
| 8–9 | Live update over WebSocket, reconnect with backoff and refetch on reconnect | 1:30 |
| 10 | Decision record (below), final DoD ticks, PR inside my fork | 0:30 |
| — | Buffer; recording the Loom happens after this | 0:30 |

Items 1–4 are the floor. Item 8 is not started until item 4 works.

## Why group by shape type (item 7)

It answers the first question anyone asks when the chart shows 41,866 against COCO's 36,781:
the extra shapes are polygon parts and crowd masks. A per-job filter was the alternative; it is
less useful on a dataset where every job has the same distribution.

## Decided to skip

- Project-level and organisation-wide statistics (task only, as the brief asks).
- Counting a track once per frame. A track counts as one annotation.
- Caching the counts. Only if MO-1 is missed and the database query cannot be made fast enough.
- Cypress end-to-end tests. Backend checked with requests against the known task instead.

## Changes to this plan

- 19:00 — Item 7 is `group_by=kind`, not `shape_type`: tracks and tags have no shape type of their
  own, so the split is shape type for shapes plus "track" and "tag".
- 19:15 — MO-1 measurement method changed from Basic auth to token auth after the first run missed
  the target. Basic auth hashes the password on every request (~300 ms, same on CVAT's own
  endpoints); the page never uses it. Target unchanged, both runs kept in `OBJECTIVES.md`.
- 19:15 — Items 1–5 took about 25 minutes, not 3 hours: the reading done before planning
  (models, permission classes, existing chart dependency) meant no false starts.
- 19:40 — The Docker VM restarted once while the webpack dev server (2.4 GB) and Docker (7.5 GB)
  were both running, and Windows port forwarding to Traefik stopped until `docker restart traefik`.
  No data lost. ESLint also ran out of memory twice while both were running; it passed on a retry the first time
  and with the dev server stopped the second time.
- 19:45 — Added Django API tests (`cvat/apps/test/tests`), not in the original plan. Items 1–9 were
  done with most of the time left, and tests are cheaper evidence than more manual checks.
  Cypress stays skipped.
- 20:00 — Reviewed the whole diff again before recording and found three problems, each fixed in
  its own commit:
  1. `LabeledInterval` (audio and time ranges) is a fourth `Annotation` model and was not counted.
     COCO has none, so the 41,866 check could not show it. Now counted as kind "interval", with a test.
  2. With the server stopped, Traefik answers `/api` with the UI's HTML, cvat-core fails on it,
     and the error state printed the whole HTML page. Now 4xx shows the server's reason and
     anything else a short "the server did not answer" message.
  3. Retry did not visibly do anything until the response came back. It now shows the spinner.
  MO-1 was measured again on the final code, since the first fix added a query.

## Decision record

**Took:** live updates through a ~120-line ASGI router in `cvat/apps/test/websocket.py`, wired in
`cvat/asgi.py`. A `post_save` receiver on `Task` (every annotation write ends in `Task.touch()`)
publishes to Redis after commit. The socket handshake is authorised by replaying it as
`GET /api/annotation_stats/tasks/<id>` through Django, so login, the OPA rule and the counting
are one code path for HTTP and WebSocket.

**Rejected:** Django Channels (`AsyncJsonWebsocketConsumer` + `channels_redis` group layer), the
usual answer for WebSockets in Django.

**Why:** Channels is not installed and pip is removed from the server image. Adding it means a
requirements change and a server image rebuild (ffmpeg compiles from source, 30+ min on this
laptop, and every reviewer pays it too). It also brings its own auth stack
(`AuthMiddlewareStack`, session only) that would have to be kept in step with DRF + OPA by hand.

**What rejecting it cost:**
- I wrote the connect / receive / disconnect loop and the Redis subscription myself. Channels
  gives these tested; mine is tested by one end-to-end script, not by unit tests.
- One Redis connection per open socket, where Channels shares one per process. Fine for a stats
  page; not for thousands of viewers.
- Each burst of changes re-runs the full GET (OPA call + count queries, ~60 ms) once per open socket
  instead of once per task.
- A core file, `cvat/asgi.py`, changed (7 added lines) instead of the change staying inside my app.
- A refused handshake is a bare 403, so the page cannot tell "no access" from "server down" and
  keeps retrying with backoff up to 30 s.
