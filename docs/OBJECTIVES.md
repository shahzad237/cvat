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

(Filled in after measuring.)
