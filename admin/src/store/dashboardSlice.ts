import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { DashboardData } from '@/types/dashboard';

interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null; // ISO string — serializable
}

const initialState: DashboardState = {
  data: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setData(state, action: PayloadAction<DashboardData>) {
      state.data = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { setData, setLoading, setError } = dashboardSlice.actions;
export default dashboardSlice.reducer;
