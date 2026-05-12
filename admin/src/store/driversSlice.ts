import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Driver } from '@/types/drivers';

interface DriversState {
  items: Driver[];
  loading: boolean;
  error: string | null;
}

const initialState: DriversState = {
  items: [],
  loading: false,
  error: null,
};

const driversSlice = createSlice({
  name: 'drivers',
  initialState,
  reducers: {
    setDrivers(state, action: PayloadAction<Driver[]>) {
      state.items = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { setDrivers, setLoading, setError } = driversSlice.actions;
export default driversSlice.reducer;
