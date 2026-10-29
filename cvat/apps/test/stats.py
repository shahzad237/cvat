# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from collections import Counter

from django.db.models import Count

from cvat.apps.engine.models import (
    JobType,
    LabeledImage,
    LabeledInterval,
    LabeledShape,
    LabeledTrack,
    Task,
)

TRACK = "track"
TAG = "tag"
INTERVAL = "interval"


def count_annotations_per_label(task: Task) -> list[dict]:
    """
    Counts the annotations of a task per label, split by kind: the shape type for shapes,
    "track" for tracks, "tag" for tags and "interval" for intervals (audio and time ranges).
    The counting is done by GROUP BY queries, so no annotation rows are loaded into Python.

    Only top-level objects are counted: skeleton points belong to their skeleton.
    Only annotation jobs are counted: ground truth and consensus replica jobs
    hold copies of objects that are already counted.
    """
    in_task = {"job__segment__task_id": task.id, "job__type": JobType.ANNOTATION}
    by_label: dict[int, Counter] = {}

    shapes = (
        LabeledShape.objects.filter(parent__isnull=True, **in_task)
        .values("label_id", "type")
        .annotate(count=Count("id"))
        .order_by()
    )
    for row in shapes:
        by_label.setdefault(row["label_id"], Counter())[row["type"]] += row["count"]

    for queryset, kind in (
        (LabeledTrack.objects.filter(parent__isnull=True, **in_task), TRACK),
        (LabeledImage.objects.filter(**in_task), TAG),
        (LabeledInterval.objects.filter(**in_task), INTERVAL),
    ):
        for row in queryset.values("label_id").annotate(count=Count("id")).order_by():
            by_label.setdefault(row["label_id"], Counter())[kind] += row["count"]

    return [
        {
            "id": label.id,
            "name": label.name,
            "color": label.color,
            "count": by_label.get(label.id, Counter()).total(),
            "by_kind": dict(by_label.get(label.id, Counter())),
        }
        for label in task.get_labels().order_by("id")
    ]
