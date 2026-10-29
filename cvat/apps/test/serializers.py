# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from rest_framework import serializers


class LabelCountSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    color = serializers.CharField()
    count = serializers.IntegerField()
    by_kind = serializers.DictField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Counts per shape type, 'track' and 'tag'. Only present with group_by=kind",
    )


class AnnotationStatsSerializer(serializers.Serializer):
    task_id = serializers.IntegerField()
    total = serializers.IntegerField()
    labels = LabelCountSerializer(many=True)
