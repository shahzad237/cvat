# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from functools import partial

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from cvat.apps.engine.models import Task

from .live import publish_task_changed


@receiver(post_save, sender=Task, dispatch_uid=__name__ + ".notify_task_changed")
def notify_task_changed(sender, instance: Task, **kwargs):
    # Every annotation write ends in Task.touch() (JobAnnotation._set_updated_date),
    # so this sees creates, updates, deletes and imports without changing the engine.
    # Published after commit, so a client that refetches sees the new rows;
    # robust=True logs a Redis failure instead of failing the user's save.
    transaction.on_commit(partial(publish_task_changed, instance.id), robust=True)
