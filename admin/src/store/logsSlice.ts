import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuditLog } from '@/types/audit';

interface LogsState {
  items: AuditLog[];
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

const initialState: LogsState = {
  items: [],
  total: 0,
  totalPages: 1,
  loading: false,
  error: null,
};

const logsSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {
    setLogs(state, action: PayloadAction<{ data: AuditLog[]; total: number; totalPages: number }>) {
      state.items      = action.payload.data;
      state.total      = action.payload.total;
      state.totalPages = action.payload.totalPages;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { setLogs, setLoading, setError } = logsSlice.actions;
export default logsSlice.reducer;
