# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from unittest import mock

from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APITestCase

from cvat.apps.engine.models import (
    Data,
    Job,
    JobType,
    Label,
    LabeledImage,
    LabeledInterval,
    LabeledShape,
    LabeledTrack,
    Segment,
    ShapeType,
    Task,
)
from cvat.apps.engine.tests.utils import ForceLogin
from cvat.apps.iam.models import User


class AnnotationStatsTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        user_group, _ = Group.objects.get_or_create(name="user")
        cls.owner = User.objects.create_user(username="owner", password="owner")
        cls.stranger = User.objects.create_user(username="stranger", password="stranger")
        for user in (cls.owner, cls.stranger):
            user.groups.add(user_group)

        data = Data.objects.create(size=10, image_quality=70, start_frame=0, stop_frame=9)
        cls.task = Task.objects.create(name="stats", owner=cls.owner, data=data, segment_size=10)
        cat, dog, _ = (
            Label.objects.create(task=cls.task, name=name) for name in ("cat", "dog", "bird")
        )

        job = Job.objects.create(
            segment=Segment.objects.create(task=cls.task, start_frame=0, stop_frame=9),
            type=JobType.ANNOTATION,
        )
        gt_job = Job.objects.create(
            segment=Segment.objects.create(task=cls.task, start_frame=0, stop_frame=9),
            type=JobType.GROUND_TRUTH,
        )

        def shape(db_job, label, shape_type, parent=None):
            return LabeledShape.objects.create(
                job=db_job,
                label=label,
                frame=0,
                type=shape_type,
                points=[0, 0, 1, 1],
                parent=parent,
            )

        shape(job, cat, ShapeType.POLYGON)
        shape(job, cat, ShapeType.POLYGON)
        skeleton = shape(job, cat, ShapeType.SKELETON)
        shape(job, cat, ShapeType.POINTS, parent=skeleton)  # element of a skeleton, not counted
        shape(gt_job, cat, ShapeType.RECTANGLE)  # ground truth copy, not counted
        LabeledTrack.objects.create(job=job, label=dog, frame=0)
        LabeledImage.objects.create(job=job, label=dog, frame=0)
        LabeledInterval.objects.create(job=job, label=dog, start=0, stop=5)

    def _get(self, user, task_id=None, **params):
        url = f"/api/annotation_stats/tasks/{task_id or self.task.id}"
        with ForceLogin(user, self.client):
            return self.client.get(url, params)

    def test_counts_per_label_include_labels_without_annotations(self):
        response = self._get(self.owner)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 6)
        self.assertEqual(
            {label["name"]: label["count"] for label in response.data["labels"]},
            {"cat": 3, "dog": 3, "bird": 0},
        )
        self.assertNotIn("by_kind", response.data["labels"][0])

    def test_group_by_kind_splits_shapes_tracks_tags_and_intervals(self):
        response = self._get(self.owner, group_by="kind")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {label["name"]: label["by_kind"] for label in response.data["labels"]},
            {
                "cat": {"polygon": 2, "skeleton": 1},
                "dog": {"track": 1, "tag": 1, "interval": 1},
                "bird": {},
            },
        )

    def test_unknown_group_by_is_rejected(self):
        self.assertEqual(
            self._get(self.owner, group_by="frame").status_code, status.HTTP_400_BAD_REQUEST
        )

    def test_request_without_login_is_refused(self):
        self.assertEqual(self._get(None).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_without_access_to_the_task_is_refused(self):
        self.assertEqual(self._get(self.stranger).status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_task_is_not_found(self):
        self.assertEqual(
            self._get(self.owner, task_id=999999).status_code, status.HTTP_404_NOT_FOUND
        )

    def test_task_change_is_published_after_commit(self):
        with mock.patch("cvat.apps.test.signals.publish_task_changed") as publish:
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                self.task.touch()
            publish.assert_not_called()

            for callback in callbacks:
                callback()
            publish.assert_called_once_with(self.task.id)
