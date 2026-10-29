// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import {
    Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { LabelCount } from './annotation-stats-api';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const BAR_HEIGHT_PX = 22;
const AXES_HEIGHT_PX = 60;

interface Props {
    labels: LabelCount[];
}

function AnnotationStatsChart({ labels }: Props): JSX.Element {
    const sorted = [...labels].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return (
        <div style={{ height: sorted.length * BAR_HEIGHT_PX + AXES_HEIGHT_PX }}>
            <Bar
                data={{
                    labels: sorted.map((label) => label.name),
                    datasets: [{
                        label: 'Annotations',
                        data: sorted.map((label) => label.count),
                        backgroundColor: sorted.map((label) => label.color),
                    }],
                }}
                options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    animation: false,
                    scales: { x: { beginAtZero: true } },
                }}
            />
        </div>
    );
}

export default React.memo(AnnotationStatsChart);
