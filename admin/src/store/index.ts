import { configureStore } from '@reduxjs/toolkit';
import themeReducer from './themeSlice';
import authReducer from './authSlice';
import uiReducer from './uiSlice';
import servicesReducer from './servicesSlice';
import packagesReducer from './packagesSlice';
import bookingsReducer from './bookingsSlice';
import clientsReducer from './clientsSlice';
import providersReducer from './providersSlice';
import driversReducer from './driversSlice';
import logsReducer from './logsSlice';
import settingsReducer from './settingsSlice';
import dashboardReducer from './dashboardSlice';
import humanAgentsReducer from './humanAgentsSlice';

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    auth: authReducer,
    ui: uiReducer,
    services: servicesReducer,
    packages: packagesReducer,
    bookings: bookingsReducer,
    clients: clientsReducer,
    providers: providersReducer,
    drivers: driversReducer,
    logs: logsReducer,
    settings: settingsReducer,
    dashboard: dashboardReducer,
    humanAgents: humanAgentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
