# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.apps import AppConfig


class TestConfig(AppConfig):
    name = "cvat.apps.test"
    verbose_name = "Annotation statistics"

    def ready(self) -> None:
        # Required to define signals in the application
        from . import signals  # pylint: disable=unused-import
