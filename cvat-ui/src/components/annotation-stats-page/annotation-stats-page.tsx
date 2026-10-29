// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Row, Col } from 'antd/lib/grid';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';
import Result from 'antd/lib/result';
import Empty from 'antd/lib/empty';
import Button from 'antd/lib/button';

import GoBackButton from 'components/common/go-back-button';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import AnnotationStatsChart from './annotation-stats-chart';
import { AnnotationStats, fetchAnnotationStats } from './annotation-stats-api';

function AnnotationStatsPage(): JSX.Element {
    const taskId = +useParams<{ tid: string }>().tid;
    const [stats, setStats] = useState<AnnotationStats | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const load = useCallback(async (): Promise<void> => {
        setError(null);
        try {
            setStats(await fetchAnnotationStats(taskId));
        } catch (requestError: unknown) {
            setStats(null);
            setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
        }
    }, [taskId]);

    useEffect(() => {
        load();
    }, [load]);

    let content: JSX.Element;
    if (error) {
        content = (
            <Result
                className='cvat-annotation-stats-error'
                status='error'
                title='Could not load the annotation counts'
                subTitle={error.message}
                extra={<Button type='primary' onClick={load}>Retry</Button>}
            />
        );
    } else if (!stats) {
        content = <CVATLoadingSpinner />;
    } else if (stats.total === 0) {
        content = (
            <Empty
                className='cvat-annotation-stats-empty'
                description='This task has no annotations yet'
            />
        );
    } else {
        content = <AnnotationStatsChart labels={stats.labels} />;
    }

    return (
        <div className='cvat-annotation-stats-page'>
            <Row justify='center'>
                <Col span={22} xl={18} xxl={14} className='cvat-task-top-bar'>
                    <GoBackButton />
                </Col>
            </Row>
            <Row justify='center' className='cvat-annotation-stats-inner-wrapper'>
                <Col span={22} xl={18} xxl={14} className='cvat-annotation-stats-inner'>
                    <div className='cvat-annotation-stats-header'>
                        <Title level={4} className='cvat-text-color'>
                            {`Annotations per class, task #${taskId}`}
                        </Title>
                        {stats && <Text type='secondary'>{`Total: ${stats.total}`}</Text>}
                    </div>
                    <div className='cvat-annotation-stats-content'>{content}</div>
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(AnnotationStatsPage);
