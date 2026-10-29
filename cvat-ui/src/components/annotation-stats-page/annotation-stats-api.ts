// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { getCore } from 'cvat-core-wrapper';

const core = getCore();

export interface LabelCount {
    id: number;
    name: string;
    color: string;
    count: number;
}

export interface AnnotationStats {
    task_id: number;
    total: number;
    labels: LabelCount[];
}

export async function fetchAnnotationStats(taskId: number): Promise<AnnotationStats> {
    // core.server.request goes through cvat-core's Axios instance,
    // which already sends the user's credentials and the organization header
    const response = await core.server.request(
        `${core.config.backendAPI}/annotation_stats/tasks/${taskId}`,
        { method: 'GET' },
    ) as { data: AnnotationStats };
    return response.data;
}
