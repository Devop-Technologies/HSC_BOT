import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Customer } from '@/types/clients';

interface ClientsState {
  items: Customer[];
  loading: boolean;
  error: string | null;
  search: string;
}

const initialState: ClientsState = {
  items: [],
  loading: false,
  error: null,
  search: '',
};

const clientsSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    setClients(state, action: PayloadAction<Customer[]>) {
      state.items = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
  },
});

export const { setClients, setLoading, setError, setSearch } = clientsSlice.actions;
export default clientsSlice.reducer;
