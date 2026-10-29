// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { Row, Col } from 'antd/lib/grid';
import Card from 'antd/lib/card';
import Statistic from 'antd/lib/statistic';

import { AnnotationStats } from './annotation-stats-api';

interface Props {
    stats: AnnotationStats;
    updatedAt: Date;
}

function AnnotationStatsSummary({ stats, updatedAt }: Props): JSX.Element {
    const used = stats.labels.filter((label) => label.count > 0).length;
    const top = stats.labels.reduce((best, label) => (label.count > best.count ? label : best));
    const topShare = ((top.count / stats.total) * 100).toFixed(1);

    return (
        <Row gutter={[16, 16]} className='cvat-annotation-stats-summary'>
            <Col xs={12} xl={6}>
                <Card size='small'>
                    <Statistic title='Annotations' value={stats.total} />
                </Card>
            </Col>
            <Col xs={12} xl={6}>
                <Card size='small'>
                    <Statistic title='Classes with annotations' value={used} suffix={`/ ${stats.labels.length}`} />
                </Card>
            </Col>
            <Col xs={12} xl={6}>
                <Card size='small'>
                    <Statistic title='Most frequent class' value={top.name} suffix={`${topShare}%`} />
                </Card>
            </Col>
            <Col xs={12} xl={6}>
                <Card size='small'>
                    <Statistic title='Last updated' value={updatedAt.toLocaleTimeString()} />
                </Card>
            </Col>
        </Row>
    );
}

export default React.memo(AnnotationStatsSummary);
