# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.conf import settings
from redis import Redis

CHANGED = "changed"


def task_channel(task_id: int) -> str:
    return f"annotation_stats:task:{task_id}"


def redis_kwargs() -> dict:
    redis_settings = settings.REDIS_INMEM_SETTINGS
    return {
        "host": redis_settings["HOST"],
        "port": redis_settings["PORT"],
        "db": redis_settings["DB"],
        "password": redis_settings["PASSWORD"] or None,
    }


def publish_task_changed(task_id: int) -> None:
    # Redis pub/sub because annotations are written by several processes
    # (uvicorn workers, import workers), and every one of them must reach the open sockets
    with Redis(**redis_kwargs()) as connection:
        connection.publish(task_channel(task_id), CHANGED)
