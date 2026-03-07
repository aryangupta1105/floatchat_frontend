import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_BASE } from '../utils/api';

export interface UserStats {
  total_users: number;
  total_queries: number;
  today_queries: number;
  query_delta_pct: number | null;
  avg_response_ms: number;
  query_types: { type: string; count: number }[];
  recent_users: { username: string; email: string; created_at: string }[];
  queries_per_day: { days: string[]; counts: number[] };
}

interface UserStatsState {
  data: UserStats | null;
  loading: boolean;
  lastFetched: number | null;
}

const initialState: UserStatsState = {
  data: null,
  loading: false,
  lastFetched: null,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const fetchUserStats = createAsyncThunk(
  'userStats/fetch',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as any).userStats as UserStatsState;
    if (state.lastFetched && Date.now() - state.lastFetched < CACHE_TTL_MS && state.data) {
      return null; // cached
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/dashboard/user-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`User stats API failed: ${res.status}`);
      return await res.json();
    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

const userStatsSlice = createSlice({
  name: 'userStats',
  initialState,
  reducers: {
    invalidate(state) {
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.data = action.payload;
          state.lastFetched = Date.now();
        }
      })
      .addCase(fetchUserStats.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { invalidate: invalidateUserStats } = userStatsSlice.actions;
export default userStatsSlice.reducer;
