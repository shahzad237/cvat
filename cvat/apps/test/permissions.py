# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework.exceptions import PermissionDenied

from cvat.apps.engine.permissions import TaskPermission


class AnnotationStatsPermission:
    """
    Reading the annotation counts of a task is allowed to exactly the users who may view
    the task, so the check is delegated to the existing "view" rule of tasks.rego.
    """

    @classmethod
    def create(cls, request, view, obj, iam_context):
        if obj is None:
            raise PermissionDenied("Annotation statistics are only available for a single task")

        return [TaskPermission.create_scope_view(request, obj, iam_context)]
