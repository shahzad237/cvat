# Objectives

## Machine

| | |
|---|---|
| CPU | 11th Gen Intel Core i5-1145G7 @ 2.60 GHz (4 cores, 8 threads) |
| RAM | 15.4 GB total, 7.45 GB given to Docker Desktop |
| OS | Windows 11 Pro 10.0.26200, Docker Desktop (WSL 2 backend), Docker Engine 29.8.2 |
| CVAT commit | `b36a49bd5cc7e5fe3fc36ecb6036659c8136b780` |

The backend runs the `cvat/server:dev` image with the working tree bind-mounted over `/opt/cvat/cvat`,
so the code measured is the code in this branch. The only dependency difference between that image
and this commit is `patool` 4.0.5 vs 4.1.0 (archive extraction, not used by this feature).

## MO-1 — endpoint response time

| Field | Entry |
|---|---|
| What is measured | Total time for `GET /api/annotation_stats/tasks/1` to return a complete 200 response. |
| How | `curl -s -o /dev/null -w '%{time_total}'` from the host, Basic auth as `admin`, one warm-up request discarded, then 5 timed requests. Command and raw output pasted below. |
| Target | Median of 5 runs at or below **100 ms**. |
| Conditions | Task 1: 5,000 images, 10 jobs, 41,866 shapes. Local Docker stack, no other request load, server already started. |
| Not included | The first request after a server restart; the browser render time of the chart; `group_by` requests (measured separately if time allows). |

Why 100 ms: the chart page makes one request and nothing else, and a task page in CVAT already makes
several calls of its own. 100 ms is about where a response stops feeling instant. Counting 41,866 rows
with a `GROUP BY` should fit inside it, but I have not measured it yet, and the database runs inside
a WSL 2 VM on a laptop, so it might not.

### Result

**First run, Basic auth, as written above: missed.** Median **347.3 ms**, spread 339.9–455.7 ms.

```
$ curl -s -o /dev/null -u admin:*** -w '%{http_code} %{time_total}\n' http://localhost:8080/api/annotation_stats/tasks/1   # warm-up + 5 runs
2026-10-29T14:14:46Z
warm-up: 200 0.363352
run 1: 200 0.339924
run 2: 200 0.371131
run 3: 200 0.344486
run 4: 200 0.347259
run 5: 200 0.455712
```

Where the time went (3 requests each, seconds):

```
about (no auth):            0.016224 0.013558 0.015260
users/self (Basic):         0.397531 0.321274 0.313074
stats task1 (Basic):        0.347320 0.351808 0.401861
users/self (Token):         0.039281 0.049551 0.037484
stats task1 (Token):        0.070222 0.056939 0.078872
stats task2 empty (Token):  0.045772 0.044712 0.038453
tasks/1 (Token):            0.048577 0.047741 0.045423
query ms: [24.8, 25.7, 29.0, 27.4, 29.3]        # count_annotations_per_label(task 1) in the Django shell
```

About 300 ms of every Basic-auth request is the password hash check, and it is the same for
CVAT's own `/api/users/self`. My endpoint is not the cause, and the page never pays it: the browser
sends a token or session cookie, not Basic auth. So the method was wrong for what MO-1 is meant to
measure. I changed it (noted in the Plan) and kept the target at 100 ms.

**Second run, token auth (what the page sends): met.** Median **64.9 ms**, spread 61.5–68.1 ms.

```
$ curl -s -o /dev/null -H 'Authorization: Token ***' -w '%{http_code} %{time_total}\n' http://localhost:8080/api/annotation_stats/tasks/1   # warm-up + 5 runs
2026-10-29T14:16:04Z
warm-up: 200 0.064641
run 1: 200 0.068056
run 2: 200 0.066904
run 3: 200 0.064862
run 4: 200 0.064371
run 5: 200 0.061470
```

Of those ~65 ms, ~15 ms is the stack itself (`/api/server/about` with no auth), ~25 ms the counting
query, and the rest token lookup and the OPA permission check, which every CVAT endpoint pays.

What I tried on the query, `EXPLAIN ANALYZE` of the shape count:

```
GroupAggregate  (actual time=17.557..21.738 rows=122 loops=1)
  ->  Sort  (actual time=17.526..18.762 rows=41866 loops=1)
        ->  Nested Loop  (actual time=0.087..10.259 rows=41866 loops=1)
              ->  Bitmap Heap Scan on engine_labeledshape s  (rows=4187 loops=10)
                    ->  Bitmap Index Scan on engine_labeledshape_job_id_b7694c3a
Execution Time: 22.068 ms
```

The `job_id` index is used; most of the time is sorting the 41,866 rows before grouping. Resolving
the task's job ids first and filtering `job_id__in` measured 13.6–17.1 ms against 19.1–22.6 ms for
the join (5 runs each, same results). I kept the single join query: 6 ms is under 10% of the
request, and the target is met without it.

**Re-run on the final code (commit `70aeef42d`), token auth: met.** Median **60.0 ms**, spread
58.4–63.7 ms. Measured again because a review after the runs above added a fourth query (interval
annotations, see the Plan), so the earlier numbers no longer came from the submitted code.

```
$ curl -s -o /dev/null -H 'Authorization: Token ***' -w '%{http_code} %{time_total}\n' http://localhost:8080/api/annotation_stats/tasks/1   # warm-up + 5 runs
2026-10-29T15:10:54Z
warm-up: 200 0.071761
run 1: 200 0.058375
run 2: 200 0.063659
run 3: 200 0.062422
run 4: 200 0.059868
run 5: 200 0.060012
```

The extra query is on an empty interval table for this image task, so it adds no measurable time;
the 5 ms difference to the earlier run is within the spread between runs.
