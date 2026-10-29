// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';
import { getCore } from 'cvat-core-wrapper';

import { AnnotationStats } from './annotation-stats-api';

const core = getCore();

const FIRST_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

export type SocketStatus = 'connecting' | 'live' | 'reconnecting';

function socketURL(taskId: number, byKind: boolean): string {
    const url = new URL(`${core.config.backendAPI}/annotation_stats/tasks/${taskId}/ws`, window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (byKind) {
        url.searchParams.set('group_by', 'kind');
    }
    return url.toString();
}

/**
 * Keeps a socket open that receives the task's counts whenever its annotations change.
 * The server sends the current counts on every (re)connect, so after a drop the page
 * is up to date again as soon as the socket is back, without a separate request.
 */
export function useAnnotationStatsSocket(
    taskId: number,
    byKind: boolean,
    onStats: (stats: AnnotationStats) => void,
): SocketStatus {
    const [status, setStatus] = useState<SocketStatus>('connecting');
    const onStatsRef = useRef(onStats);
    onStatsRef.current = onStats;

    useEffect(() => {
        let socket: WebSocket;
        let retryTimeout: number | undefined;
        let failedAttempts = 0;
        let stopped = false;

        const connect = (): void => {
            socket = new WebSocket(socketURL(taskId, byKind));
            socket.onopen = () => {
                failedAttempts = 0;
                setStatus('live');
            };
            socket.onmessage = (event: MessageEvent<string>) => {
                onStatsRef.current(JSON.parse(event.data));
            };
            socket.onclose = () => {
                if (stopped) {
                    return;
                }
                setStatus('reconnecting');
                // exponential backoff with jitter, so many open pages do not reconnect at the same moment
                const delay = Math.min(MAX_RETRY_DELAY_MS, FIRST_RETRY_DELAY_MS * 2 ** failedAttempts);
                failedAttempts += 1;
                retryTimeout = window.setTimeout(connect, delay / 2 + Math.random() * (delay / 2));
            };
        };

        const reconnectNow = (): void => {
            if (socket.readyState === WebSocket.CLOSED) {
                window.clearTimeout(retryTimeout);
                connect();
            }
        };

        connect();
        window.addEventListener('online', reconnectNow);
        return () => {
            stopped = true;
            window.clearTimeout(retryTimeout);
            window.removeEventListener('online', reconnectNow);
            socket.close();
        };
    }, [taskId, byKind]);

    return status;
}
