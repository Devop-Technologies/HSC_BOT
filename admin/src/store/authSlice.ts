import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '@/types/auth';

export type { AuthUser };

interface AuthState {
  isAuthenticated: boolean;
  hasChecked: boolean;
  user: AuthUser | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  hasChecked: false,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<AuthUser>) {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.hasChecked = true;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
    },
    setChecked(state) {
      state.hasChecked = true;
    },
  },
});

export const { loginSuccess, logout, setChecked } = authSlice.actions;
export default authSlice.reducer;
