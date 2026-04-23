import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// ─── Types ──────────────────────────────────────────────────────────────────

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

export interface FloatRow {
  float_id: string;
  platform_number?: string;
  dac?: string;
  profile_count?: number;
  latitude: number;
  longitude: number;
  last_seen?: string;
  first_seen?: string;
  lat?: number;
  lon?: number;
}

export interface FloatsResponse {
  floats: FloatRow[];
  count: number;
  region: string;
  parameter: string;
}

export interface ProfileEntry {
  profile_key: string;
  label: string;
  date: string | null;
  latitude: number | null;
  longitude: number | null;
  depths: (number | null)[];
  values: (number | null)[];
  temperatures: (number | null)[];
  salinities: (number | null)[];
}

export interface ProfilesResponse {
  float_id: string;
  parameter: string;
  profile_count: number;
  profiles: ProfileEntry[];
}

export interface TrajectoryPoint {
  profile_key: string;
  cycle_number: number | null;
  date: string | null;
  latitude: number;
  longitude: number;
}

export interface TrajectoryResponse {
  float_id: string;
  point_count: number;
  points: TrajectoryPoint[];
}

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

// ─── Query arg types ────────────────────────────────────────────────────────

export interface FloatsQueryParams {
  region?: string;
  parameter?: string;
  start_date?: string;
  end_date?: string;
  min_depth?: number;
  max_depth?: number;
}

export interface ProfilesQueryParams {
  float_id: string;
  parameter?: string;
  start_date?: string;
  end_date?: string;
  min_depth?: number;
  max_depth?: number;
}

// ─── RTK Query API ──────────────────────────────────────────────────────────

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
  // Cache data for 5 minutes by default
  keepUnusedDataFor: 300,
  tagTypes: ['Dashboard', 'Floats', 'UserStats'],
  endpoints: (builder) => ({

    // ── Dashboard ─────────────────────────────────────────────────────────
    getDashboardStats: builder.query<DashStats, void>({
      query: () => '/dashboard/stats',
      providesTags: ['Dashboard'],
    }),
    getDashboardActivity: builder.query<ActivityData, void>({
      query: () => '/dashboard/activity',
      providesTags: ['Dashboard'],
    }),
    getDepthDistribution: builder.query<DepthDistribution, void>({
      query: () => '/dashboard/depth-distribution',
      providesTags: ['Dashboard'],
    }),
    getTSSample: builder.query<TSSample, void>({
      query: () => '/dashboard/ts-sample',
      providesTags: ['Dashboard'],
    }),

    // ── Floats ────────────────────────────────────────────────────────────
    getFloats: builder.query<FloatRow[], FloatsQueryParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          if (params.region) searchParams.set('region', params.region);
          if (params.parameter) searchParams.set('parameter', params.parameter);
          if (params.start_date) searchParams.set('start_date', params.start_date);
          if (params.end_date) searchParams.set('end_date', params.end_date);
          if (params.min_depth != null) searchParams.set('min_depth', String(params.min_depth));
          if (params.max_depth != null) searchParams.set('max_depth', String(params.max_depth));
        }
        const qs = searchParams.toString();
        return `/floats${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: any): FloatRow[] =>
        Array.isArray(res) ? res : (res.floats || res.data || []),
      providesTags: ['Floats'],
    }),

    // ── Profiles (per float) ──────────────────────────────────────────────
    getProfiles: builder.query<ProfilesResponse, ProfilesQueryParams>({
      query: ({ float_id, parameter, start_date, end_date, min_depth, max_depth }) => {
        const sp = new URLSearchParams({ float_id });
        if (parameter) sp.set('parameter', parameter);
        if (start_date) sp.set('start_date', start_date);
        if (end_date) sp.set('end_date', end_date);
        if (min_depth != null) sp.set('min_depth', String(min_depth));
        if (max_depth != null) sp.set('max_depth', String(max_depth));
        return `/profiles?${sp.toString()}`;
      },
      // Cache profiles per unique float+param combination for 10 min
      keepUnusedDataFor: 600,
    }),

    // ── Trajectory (per float) ────────────────────────────────────────────
    getTrajectory: builder.query<TrajectoryResponse, string>({
      query: (floatId) => `/floats/${floatId}/trajectory`,
      keepUnusedDataFor: 600,
    }),

    // ── User Stats ────────────────────────────────────────────────────────
    getUserStats: builder.query<UserStats, void>({
      query: () => '/dashboard/user-stats',
      providesTags: ['UserStats'],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetDashboardActivityQuery,
  useGetDepthDistributionQuery,
  useGetTSSampleQuery,
  useGetFloatsQuery,
  useGetProfilesQuery,
  useGetTrajectoryQuery,
  useGetUserStatsQuery,
} = apiSlice;
