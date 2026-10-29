// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import {
    Chart as ChartJS, BarElement, CategoryScale, LinearScale, Legend, Tooltip, ChartDataset,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { LabelCount } from './annotation-stats-api';

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const BAR_HEIGHT_PX = 22;
const AXES_HEIGHT_PX = 60;
const KIND_COLORS = ['#1677ff', '#fa8c16', '#52c41a', '#eb2f96', '#722ed1', '#13c2c2', '#faad14', '#8c8c8c'];

interface Props {
    labels: LabelCount[];
    byKind: boolean;
}

function kindDatasets(labels: LabelCount[]): ChartDataset<'bar'>[] {
    const kinds = [...new Set(labels.flatMap((label) => Object.keys(label.by_kind ?? {})))].sort();
    return kinds.map((kind, index) => ({
        label: kind,
        data: labels.map((label) => label.by_kind?.[kind] ?? 0),
        backgroundColor: KIND_COLORS[index % KIND_COLORS.length],
    }));
}

function AnnotationStatsChart({ labels, byKind }: Props): JSX.Element {
    const sorted = [...labels].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const datasets: ChartDataset<'bar'>[] = byKind ? kindDatasets(sorted) : [{
        label: 'Annotations',
        data: sorted.map((label) => label.count),
        backgroundColor: sorted.map((label) => label.color),
    }];

    return (
        <div style={{ height: sorted.length * BAR_HEIGHT_PX + AXES_HEIGHT_PX }}>
            <Bar
                data={{ labels: sorted.map((label) => label.name), datasets }}
                options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: { legend: { display: byKind, position: 'top' } },
                    scales: { x: { beginAtZero: true, stacked: true }, y: { stacked: true } },
                }}
            />
        </div>
    );
}

export default React.memo(AnnotationStatsChart);
