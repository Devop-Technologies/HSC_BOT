import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { HumanAgent } from '@/types/humanAgents';

interface HumanAgentsState {
  items: HumanAgent[];
  loading: boolean;
  error: string | null;
}

const initialState: HumanAgentsState = {
  items: [],
  loading: false,
  error: null,
};

const humanAgentsSlice = createSlice({
  name: 'humanAgents',
  initialState,
  reducers: {
    setHumanAgents(state, action: PayloadAction<HumanAgent[]>) {
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

export const { setHumanAgents, setLoading, setError } = humanAgentsSlice.actions;
export default humanAgentsSlice.reducer;
