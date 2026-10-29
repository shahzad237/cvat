# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

import asyncio
import re

from redis.asyncio import Redis

from .live import redis_kwargs, task_channel

STATS_SOCKET_PATH = re.compile(r"^/api/annotation_stats/tasks/(?P<task_id>\d+)/ws$")

# An import or a save of several jobs touches the task many times in a row:
# wait this long after a change and send one update for the whole burst
COALESCE_SECONDS = 0.3


def route_websockets(http_application):
    """
    Wraps CVAT's ASGI application. Django Channels is not installed, so the annotation
    counts socket is served here and every other request goes to Django unchanged.
    """

    async def application(scope, receive, send):
        if scope["type"] != "websocket":
            await http_application(scope, receive, send)
        elif match := STATS_SOCKET_PATH.match(scope["path"]):
            await _serve_stats_socket(
                http_application, scope, receive, send, int(match["task_id"])
            )
        else:
            await send({"type": "websocket.close"})

    return application


async def _fetch_stats(http_application, scope, task_id: int) -> tuple[int, bytes]:
    """
    Replays the socket request as GET /api/annotation_stats/tasks/<id> through Django,
    with the socket's own cookies and headers. Authentication, the OPA permission check
    and the counting are the same code as for the HTTP endpoint.
    """
    path = f"/api/annotation_stats/tasks/{task_id}"
    http_scope = {
        **scope,
        "type": "http",
        "method": "GET",
        "scheme": "https" if scope.get("scheme") == "wss" else "http",
        "path": path,
        "raw_path": path.encode(),
        # the body is sent as a text frame, so it must not be gzipped by GZipMiddleware
        "headers": [(name, value) for name, value in scope["headers"] if name != b"accept-encoding"],
    }
    http_scope.pop("subprotocols", None)

    request_sent = False

    async def receive():
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": b"", "more_body": False}
        # Django waits here for a client disconnect and cancels the wait once it has responded
        await asyncio.Event().wait()

    status = 500
    body = b""

    async def send(message):
        nonlocal status, body
        if message["type"] == "http.response.start":
            status = message["status"]
        elif message["type"] == "http.response.body":
            body += message.get("body", b"")

    await http_application(http_scope, receive, send)
    return status, body


async def _wait_for_disconnect(receive) -> None:
    while (await receive())["type"] != "websocket.disconnect":
        pass


async def _serve_stats_socket(http_application, scope, receive, send, task_id: int) -> None:
    if (await receive())["type"] != "websocket.connect":
        return

    status, body = await _fetch_stats(http_application, scope, task_id)
    if status != 200:
        # closing before accepting rejects the handshake with HTTP 403
        await send({"type": "websocket.close"})
        return

    await send({"type": "websocket.accept"})
    await send({"type": "websocket.send", "text": body.decode()})

    disconnected = asyncio.ensure_future(_wait_for_disconnect(receive))
    async with Redis(**redis_kwargs()) as connection, connection.pubsub() as pubsub:
        await pubsub.subscribe(task_channel(task_id))
        try:
            while True:
                changed = asyncio.ensure_future(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=None)
                )
                await asyncio.wait({changed, disconnected}, return_when=asyncio.FIRST_COMPLETED)
                if disconnected.done():
                    changed.cancel()
                    return
                if changed.result() is None:
                    continue

                await asyncio.sleep(COALESCE_SECONDS)
                while await pubsub.get_message(ignore_subscribe_messages=True, timeout=0):
                    pass

                status, body = await _fetch_stats(http_application, scope, task_id)
                if status != 200:
                    # access lost or task deleted while the socket was open
                    await send({"type": "websocket.close", "code": 4000 + status})
                    return
                await send({"type": "websocket.send", "text": body.decode()})
        finally:
            disconnected.cancel()
