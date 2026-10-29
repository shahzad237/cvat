// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import {
    Chart as ChartJS, BarElement, CategoryScale, LinearScale, Legend, Tooltip, ChartDataset, TooltipItem,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

import { LabelCount } from './annotation-stats-api';

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const BAR_HEIGHT_PX = 24;
const AXES_HEIGHT_PX = 70;
const VALUE_LABEL_SPACE_PX = 56;
const KIND_COLORS = ['#1677ff', '#fa8c16', '#52c41a', '#eb2f96', '#722ed1', '#13c2c2', '#faad14', '#8c8c8c'];

export type SortOrder = 'count' | 'name';

interface Props {
    labels: LabelCount[];
    total: number;
    byKind: boolean;
    sortOrder: SortOrder;
}

function kindDatasets(labels: LabelCount[]): ChartDataset<'bar'>[] {
    const kinds = [...new Set(labels.flatMap((label) => Object.keys(label.by_kind ?? {})))].sort();
    return kinds.map((kind, index) => ({
        label: kind,
        data: labels.map((label) => label.by_kind?.[kind] ?? 0),
        backgroundColor: KIND_COLORS[index % KIND_COLORS.length],
    }));
}

function AnnotationStatsChart({
    labels, total, byKind, sortOrder,
}: Props): JSX.Element {
    const sorted = [...labels].sort((a, b) => (
        sortOrder === 'name' ? a.name.localeCompare(b.name) : b.count - a.count || a.name.localeCompare(b.name)
    ));
    const datasets: ChartDataset<'bar'>[] = byKind ? kindDatasets(sorted) : [{
        label: 'Annotations',
        data: sorted.map((label) => label.count),
        backgroundColor: sorted.map((label) => label.color),
    }];
    const share = (value: number): string => `${((value / total) * 100).toFixed(1)}%`;

    return (
        <div style={{ height: sorted.length * BAR_HEIGHT_PX + AXES_HEIGHT_PX }}>
            <Bar
                data={{ labels: sorted.map((label) => label.name), datasets }}
                plugins={[ChartDataLabels]}
                options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    animation: false,
                    layout: { padding: { right: VALUE_LABEL_SPACE_PX } },
                    datasets: { bar: { borderRadius: 3, maxBarThickness: 18 } },
                    plugins: {
                        legend: { display: byKind, position: 'top' },
                        // the count at the end of each bar; in the split view the tooltip carries the parts
                        datalabels: {
                            display: !byKind,
                            anchor: 'end',
                            align: 'end',
                            color: '#595959',
                            formatter: (value: number) => value.toLocaleString(),
                        },
                        tooltip: {
                            callbacks: {
                                label: (item: TooltipItem<'bar'>) => (
                                    `${item.dataset.label}: ${item.parsed.x.toLocaleString()} (${share(item.parsed.x)})`
                                ),
                            },
                        },
                    },
                    scales: {
                        x: {
                            position: 'top',
                            beginAtZero: true,
                            stacked: true,
                            ticks: { callback: (value) => Number(value).toLocaleString() },
                        },
                        y: { stacked: true, grid: { display: false } },
                    },
                }}
            />
        </div>
    );
}

export default React.memo(AnnotationStatsChart);
