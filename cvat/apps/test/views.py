# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from cvat.apps.engine.models import Task
from cvat.apps.engine.types import ExtendedRequest

from .permissions import AnnotationStatsPermission
from .serializers import AnnotationStatsSerializer
from .stats import count_annotations_per_label

GROUP_BY_KIND = "kind"


@extend_schema(tags=["annotation_stats"])
class AnnotationStatsViewSet(viewsets.GenericViewSet):
    queryset = Task.objects.select_related("organization")
    filter_backends = []
    iam_supports_organization_params = False
    iam_permission_class = AnnotationStatsPermission

    @extend_schema(
        summary="Count the annotations of a task per label",
        parameters=[
            OpenApiParameter(
                "group_by",
                enum=[GROUP_BY_KIND],
                required=False,
                description="Also split each count by shape type, track and tag",
            ),
        ],
        responses=AnnotationStatsSerializer,
    )
    def retrieve(self, request: ExtendedRequest, pk: int):
        group_by = request.query_params.get("group_by")
        if group_by not in (None, GROUP_BY_KIND):
            raise ValidationError(f"Unsupported group_by value. Expected '{GROUP_BY_KIND}'")

        task = self.get_object()
        labels = count_annotations_per_label(task)
        if group_by is None:
            for label in labels:
                del label["by_kind"]

        return Response(
            AnnotationStatsSerializer(
                {
                    "task_id": task.id,
                    "total": sum(label["count"] for label in labels),
                    "labels": labels,
                }
            ).data
        )
