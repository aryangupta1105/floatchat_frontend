import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_BASE } from '../utils/api';

export interface FloatRow {
  float_id: string;
  platform_number?: string;
  latitude: number;
  longitude: number;
  last_profile_date?: string;
  lat?: number;
  lon?: number;
}

interface FloatsState {
  list: FloatRow[];
  loading: boolean;
  lastFetched: number | null;
}

const initialState: FloatsState = {
  list: [],
  loading: false,
  lastFetched: null,
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const fetchFloats = createAsyncThunk(
  'floats/fetchAll',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as any).floats as FloatsState;
    if (state.lastFetched && Date.now() - state.lastFetched < CACHE_TTL_MS && state.list.length > 0) {
      return null; // cached
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/floats?limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Floats API failed: ${res.status}`);
      const data = await res.json();
      const rows: FloatRow[] = Array.isArray(data)
        ? data
        : (data.floats || data.data || []);
      return rows;
    } catch (e: any) {
      return rejectWithValue(e.message);
    }
  }
);

const floatsSlice = createSlice({
  name: 'floats',
  initialState,
  reducers: {
    invalidate(state) {
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFloats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFloats.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.list = action.payload;
          state.lastFetched = Date.now();
        }
      })
      .addCase(fetchFloats.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { invalidate: invalidateFloats } = floatsSlice.actions;
export default floatsSlice.reducer;
