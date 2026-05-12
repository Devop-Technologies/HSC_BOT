import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Therapist } from '@/types/providers';

interface ProvidersState {
  items: Therapist[];
  loading: boolean;
  error: string | null;
}

const initialState: ProvidersState = {
  items: [],
  loading: false,
  error: null,
};

const providersSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    setProviders(state, action: PayloadAction<Therapist[]>) {
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

export const { setProviders, setLoading, setError } = providersSlice.actions;
export default providersSlice.reducer;
