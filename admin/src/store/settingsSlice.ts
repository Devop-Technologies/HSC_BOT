import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { BusinessHours } from '@/types/settings';

interface SettingsState {
  businessHours: BusinessHours[];
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  businessHours: [],
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setBusinessHours(state, action: PayloadAction<BusinessHours[]>) {
      state.businessHours = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { setBusinessHours, setLoading, setError } = settingsSlice.actions;
export default settingsSlice.reducer;
