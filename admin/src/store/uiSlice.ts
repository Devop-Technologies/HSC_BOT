import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarCollapsed: boolean;  // desktop: icon-only mode
  sidebarMobileOpen: boolean; // mobile/tablet: overlay open
}

const initialState: UIState = {
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebarCollapse(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    toggleMobileSidebar(state) {
      state.sidebarMobileOpen = !state.sidebarMobileOpen;
    },
    closeMobileSidebar(state) {
      state.sidebarMobileOpen = false;
    },
  },
});

export const {
  toggleSidebarCollapse,
  setSidebarCollapsed,
  toggleMobileSidebar,
  closeMobileSidebar,
} = uiSlice.actions;

export default uiSlice.reducer;
