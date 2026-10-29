// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';

import React, {
    useCallback, useEffect, useRef, useState,
} from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { Row, Col } from 'antd/lib/grid';
import Title from 'antd/lib/typography/Title';
import Text from 'antd/lib/typography/Text';
import Result from 'antd/lib/result';
import Empty from 'antd/lib/empty';
import Button from 'antd/lib/button';
import Switch from 'antd/lib/switch';
import Badge from 'antd/lib/badge';
import Select from 'antd/lib/select';

import { ServerError, Task } from 'cvat-core-wrapper';
import GoBackButton from 'components/common/go-back-button';
import CVATLoadingSpinner from 'components/common/loading-spinner';
import { fetchTask } from 'utils/fetch';
import AnnotationStatsChart, { SortOrder } from './annotation-stats-chart';
import AnnotationStatsSummary from './annotation-stats-summary';
import { AnnotationStats, fetchAnnotationStats } from './annotation-stats-api';
import { SocketStatus, useAnnotationStatsSocket } from './use-annotation-stats-socket';

const SOCKET_BADGES: Record<SocketStatus, { status: 'success' | 'processing' | 'warning', text: string }> = {
    connecting: { status: 'processing', text: 'Connecting' },
    live: { status: 'success', text: 'Live' },
    reconnecting: { status: 'warning', text: 'Reconnecting' },
};

const SORT_OPTIONS: { value: SortOrder, label: string }[] = [
    { value: 'count', label: 'Most annotations first' },
    { value: 'name', label: 'Class name A–Z' },
];

function describeError(error: unknown): string {
    // a 4xx from the API carries a reason worth showing ("No Task matches the given query.");
    // a 5xx, a proxy error page or a network failure does not
    if (error instanceof ServerError && error.code >= 400 && error.code < 500) {
        return error.message;
    }
    const status = error instanceof ServerError && error.code ? ` (HTTP ${error.code})` : '';
    return `The server did not answer${status}. Check that CVAT is running, then retry.`;
}

function AnnotationStatsPage(): JSX.Element {
    const taskId = +useParams<{ tid: string }>().tid;
    const [task, setTask] = useState<Task | null>(null);
    const [byKind, setByKind] = useState(false);
    const [sortOrder, setSortOrder] = useState<SortOrder>('count');
    const [stats, setStats] = useState<AnnotationStats | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date>(new Date());
    const [error, setError] = useState<string | null>(null);
    const lastRequestId = useRef(0);

    const showStats = useCallback((newStats: AnnotationStats): void => {
        setStats(newStats);
        setUpdatedAt(new Date());
        setError(null);
    }, []);

    const load = useCallback(async (): Promise<void> => {
        // only the newest response is shown, older ones may arrive later and are dropped
        const requestId = ++lastRequestId.current;
        // clearing the error shows the spinner again, so a click on Retry is visible
        setError(null);
        try {
            const response = await fetchAnnotationStats(taskId, byKind);
            if (requestId === lastRequestId.current) {
                showStats(response);
            }
        } catch (requestError: unknown) {
            if (requestId === lastRequestId.current) {
                setStats(null);
                setError(describeError(requestError));
            }
        }
    }, [taskId, byKind]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        // only for the task name in the header; a missing task is reported by the counts request
        fetchTask(taskId).then(setTask).catch(() => setTask(null));
    }, [taskId]);

    const onSocketStats = useCallback((socketStats: AnnotationStats): void => {
        // a pushed update is newer than any request still in flight
        lastRequestId.current += 1;
        showStats(socketStats);
    }, []);
    const socketStatus = useAnnotationStatsSocket(taskId, byKind, onSocketStats);

    let content: JSX.Element;
    if (error) {
        content = (
            <Result
                className='cvat-annotation-stats-error'
                status='error'
                title='Could not load the annotation counts'
                subTitle={error}
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
        content = (
            <>
                <AnnotationStatsSummary stats={stats} updatedAt={updatedAt} />
                <div className='cvat-annotation-stats-toolbar'>
                    <Select
                        className='cvat-annotation-stats-sort'
                        value={sortOrder}
                        onChange={setSortOrder}
                        options={SORT_OPTIONS}
                    />
                    <Switch
                        checked={byKind}
                        onChange={setByKind}
                        checkedChildren='Split by type'
                        unCheckedChildren='Split by type'
                    />
                </div>
                <AnnotationStatsChart
                    labels={stats.labels}
                    total={stats.total}
                    byKind={statsByKind}
                    sortOrder={sortOrder}
                />
            </>
        );
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
                        <div>
                            <Title level={4} className='cvat-text-color'>Annotation counts</Title>
                            <Text type='secondary'>
                                <Link to={`/tasks/${taskId}`}>{task ? task.name : `Task #${taskId}`}</Link>
                                {task && ` · Task #${taskId}`}
                            </Text>
                        </div>
                        <Badge
                            className='cvat-annotation-stats-socket-status'
                            status={SOCKET_BADGES[socketStatus].status}
                            text={SOCKET_BADGES[socketStatus].text}
                        />
                    </div>
                    <div className='cvat-annotation-stats-content'>{content}</div>
                </Col>
            </Row>
        </div>
    );
}

export default React.memo(AnnotationStatsPage);
