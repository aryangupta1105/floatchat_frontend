import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export interface DashStats {
  total_floats: number;
  total_profiles: number;
  profiles_6months: number;
  bgc_floats: number;
  core_floats: number;
  latest_update: string | null;
}

export interface ActivityData {
  months: string[];
  counts: number[];
}

export interface DepthDistribution {
  bins: string[];
  counts: number[];
}

export interface TSSample {
  temperatures: number[];
  salinities: number[];
  depths: number[];
  float_ids: string[];
}

interface DashboardState {
  stats: DashStats | null;
  activity: ActivityData | null;
  depthDist: DepthDistribution | null;
  tsSample: TSSample | null;
  loading: boolean;
  lastFetched: number | null;
}

const initialState: DashboardState = {
  stats: null,
  activity: null,
  depthDist: null,
  tsSample: null,
  loading: false,
  lastFetched: null,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const fetchDashboardData = createAsyncThunk(
  'dashboard/fetchAll',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as any).dashboard as DashboardState;
    if (state.lastFetched && Date.now() - state.lastFetched < CACHE_TTL_MS && state.stats) {
      return null; // cached — skip fetch
    }
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, activityRes, depthRes, tsRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }),
        fetch('/api/dashboard/activity', { headers }),
        fetch('/api/dashboard/depth-distribution', { headers }),
        fetch('/api/dashboard/ts-sample', { headers }),
      ]);
      const [stats, activity, depthDist, tsSample] = await Promise.all([
        statsRes.json(), activityRes.json(), depthRes.json(), tsRes.json()
      ]);
      return { stats, activity, depthDist, tsSample };
    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    invalidate(state) {
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.stats = action.payload.stats;
          state.activity = action.payload.activity;
          state.depthDist = action.payload.depthDist;
          state.tsSample = action.payload.tsSample;
          state.lastFetched = Date.now();
        }
      })
      .addCase(fetchDashboardData.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { invalidate: invalidateDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
