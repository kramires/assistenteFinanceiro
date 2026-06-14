import { useCallback, useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface AsyncState<T> {
  status: Status;
  data: T | null;
  error: string | null;
}

interface UseAsyncStateReturn<T> extends AsyncState<T> {
  run: (promise: Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export function useAsyncState<T>(): UseAsyncStateReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const run = useCallback(async (promise: Promise<T>): Promise<T | null> => {
    setState({ status: 'loading', data: null, error: null });
    try {
      const data = await promise;
      setState({ status: 'success', data, error: null });
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
      setState({ status: 'error', data: null, error: msg });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null });
  }, []);

  return { ...state, run, reset };
}
