import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Booking } from '@/types/bookings';

interface BookingsState {
  items: Booking[];
  loading: boolean;
  error: string | null;
  search: string;
  statusFilter: string;
  paymentFilter: string;
  dateFilter: string;
}

const initialState: BookingsState = {
  items: [],
  loading: false,
  error: null,
  search: '',
  statusFilter: '',
  paymentFilter: '',
  dateFilter: '',
};

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setBookings(state, action: PayloadAction<Booking[]>) {
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
    setStatusFilter(state, action: PayloadAction<string>) {
      state.statusFilter = action.payload;
    },
    setPaymentFilter(state, action: PayloadAction<string>) {
      state.paymentFilter = action.payload;
    },
    setDateFilter(state, action: PayloadAction<string>) {
      state.dateFilter = action.payload;
    },
    clearFilters(state) {
      state.search = '';
      state.statusFilter = '';
      state.paymentFilter = '';
      state.dateFilter = '';
    },
  },
});

export const {
  setBookings, setLoading, setError,
  setSearch, setStatusFilter, setPaymentFilter, setDateFilter, clearFilters,
} = bookingsSlice.actions;

export default bookingsSlice.reducer;
