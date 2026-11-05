'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type OfflineRoutePoint = [number, number];
export type OfflineRouteCoordinate = [number, number, number];
type OfflineRouteProfile = 'foot' | 'bike';
type WorkerResponse =
  | { id: number; type: 'status'; available: boolean; downloadedAt: number | null }
  | {
    id: number;
    type: 'download-progress';
    progress: number | null;
    attempt?: number;
    maxAttempts?: number;
  }
  | { id: number; type: 'downloaded'; downloadedAt: number }
  | { id: number; type: 'route'; coordinates: OfflineRoutePoint[] }
  | { id: number; type: 'error'; error: string };
type PendingRequest = {
  type: 'download' | 'route';
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export default function useOfflineRouting() {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Map<number, PendingRequest>());
  const downloadInFlightRef = useRef(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadAttempt, setDownloadAttempt] = useState(1);
  const [maxDownloadAttempts, setMaxDownloadAttempts] = useState(3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pendingRequests = pendingRef.current;
    const worker = new Worker(new URL('../utils/offlineRouting.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'status') {
        setIsAvailable(message.available);
        setIsChecking(false);
        return;
      }
      if (message.type === 'download-progress') {
        setIsDownloading(true);
        setDownloadProgress(message.progress);
        if (message.attempt !== undefined) setDownloadAttempt(message.attempt);
        if (message.maxAttempts !== undefined) setMaxDownloadAttempts(message.maxAttempts);
        return;
      }
      if (message.type === 'downloaded') {
        setIsAvailable(true);
        setIsDownloading(false);
        setDownloadProgress(null);
        setDownloadAttempt(1);
        setError(null);
        pendingRef.current.get(message.id)?.resolve(undefined);
        pendingRef.current.delete(message.id);
        return;
      }
      if (message.type === 'error' && message.id === 0) {
        setIsChecking(false);
        setError(message.error);
        return;
      }

      const pending = pendingRef.current.get(message.id);
      if (!pending) return;
      pendingRef.current.delete(message.id);
      if (message.type === 'error') {
        if (pending.type === 'download') {
          setIsDownloading(false);
          setDownloadProgress(null);
          setDownloadAttempt(1);
          setError(message.error);
        }
        pending.reject(new Error(message.error));
      } else {
        pending.resolve(message.coordinates);
      }
    });
    worker.addEventListener('error', (event) => {
      const workerError = new Error(event.message || 'Offline routing worker failed');
      setIsChecking(false);
      setIsDownloading(false);
      setDownloadProgress(null);
      setError(workerError.message);
      pendingRequests.forEach((pending) => pending.reject(workerError));
      pendingRequests.clear();
    });
    worker.postMessage({ id: 0, type: 'check' });

    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingRequests.forEach((pending) => pending.reject(new Error('Offline routing was interrupted')));
      pendingRequests.clear();
    };
  }, []);

  const request = useCallback(<T,>(message: Record<string, unknown>) => new Promise<T>((resolve, reject) => {
    const worker = workerRef.current;
    if (!worker) {
      reject(new Error('Offline routing is not ready yet'));
      return;
    }
    const id = ++requestIdRef.current;
    pendingRef.current.set(id, {
      type: message.type === 'download' ? 'download' : 'route',
      resolve: (value) => resolve(value as T),
      reject,
    });
    worker.postMessage({ ...message, id });
  }), []);

  const download = useCallback(async () => {
    if (downloadInFlightRef.current) return false;
    downloadInFlightRef.current = true;
    setError(null);
    setDownloadProgress(0);
    setDownloadAttempt(1);
    setIsDownloading(true);
    try {
      await request<void>({ type: 'download' });
      return true;
    } catch (downloadError) {
      setIsDownloading(false);
      setDownloadProgress(null);
      setDownloadAttempt(1);
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download offline routing data');
      return false;
    } finally {
      downloadInFlightRef.current = false;
    }
  }, [request]);

  const calculateRoute = useCallback((
    points: OfflineRoutePoint[],
    profile: OfflineRouteProfile,
    allowPrivateRoads: boolean,
  ) => request<OfflineRouteCoordinate[]>({
    type: 'route',
    points,
    profile,
    allowPrivateRoads,
  }), [request]);

  return {
    isAvailable,
    isChecking,
    isDownloading,
    downloadProgress,
    downloadAttempt,
    maxDownloadAttempts,
    error,
    download,
    calculateRoute,
  };
}
