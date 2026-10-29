// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, {
    useCallback, useEffect, useRef, useState,
} from 'react';
import { useParams } from 'react-router';
import { Row, Col } from 'antd/lib/grid';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';
import Result from 'antd/lib/result';
import Empty from 'antd/lib/empty';
import Button from 'antd/lib/button';
import Switch from 'antd/lib/switch';

import GoBackButton from 'components/common/go-back-button';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import AnnotationStatsChart from './annotation-stats-chart';
import { AnnotationStats, fetchAnnotationStats } from './annotation-stats-api';

function AnnotationStatsPage(): JSX.Element {
    const taskId = +useParams<{ tid: string }>().tid;
    const [byKind, setByKind] = useState(false);
    const [stats, setStats] = useState<AnnotationStats | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const lastRequestId = useRef(0);

    const load = useCallback(async (): Promise<void> => {
        // only the newest response is shown, older ones may arrive later and are dropped
        const requestId = ++lastRequestId.current;
        try {
            const response = await fetchAnnotationStats(taskId, byKind);
            if (requestId === lastRequestId.current) {
                setStats(response);
                setError(null);
            }
        } catch (requestError: unknown) {
            if (requestId === lastRequestId.current) {
                setStats(null);
                setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
            }
        }
    }, [taskId, byKind]);

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
        const statsByKind = stats.labels.some((label) => label.by_kind !== undefined);
        content = <AnnotationStatsChart labels={stats.labels} byKind={statsByKind} />;
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
                        <div className='cvat-annotation-stats-controls'>
                            <Switch
                                checked={byKind}
                                onChange={setByKind}
                                checkedChildren='Split by type'
                                unCheckedChildren='Split by type'
                            />
                            {stats && <Text type='secondary'>{`Total: ${stats.total}`}</Text>}
                        </div>
                    </div>
                    <div className='cvat-annotation-stats-content'>{content}</div>
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(AnnotationStatsPage);
