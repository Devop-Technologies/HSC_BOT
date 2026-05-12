import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Package } from '@/types/packages';

interface PackagesState {
  items: Package[];
  loading: boolean;
  error: string | null;
}

const initialState: PackagesState = {
  items: [],
  loading: false,
  error: null,
};

const packagesSlice = createSlice({
  name: 'packages',
  initialState,
  reducers: {
    setPackages(state, action: PayloadAction<Package[]>) {
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

export const { setPackages, setLoading, setError } = packagesSlice.actions;
export default packagesSlice.reducer;
