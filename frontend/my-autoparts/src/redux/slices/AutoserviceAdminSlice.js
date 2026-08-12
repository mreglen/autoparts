import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

export const fetchAutoserviceApplications = createAsyncThunk(
  'autoserviceAdmin/fetchApplications',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/admin/autoservice-applications');
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка загрузки заявок');
    }
  },
);

export const fetchAutoserviceConnectedOrgs = createAsyncThunk(
  'autoserviceAdmin/fetchConnectedOrgs',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/admin/autoservice-organizations');
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка загрузки подключённых организаций');
    }
  },
);

export const approveAutoserviceApplication = createAsyncThunk(
  'autoserviceAdmin/approveApplication',
  async (applicationId, { rejectWithValue }) => {
    try {
      return await apiRequest(`/admin/autoservice-applications/${applicationId}/approve`, {
        method: 'POST',
      });
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка одобрения заявки');
    }
  },
);

export const rejectAutoserviceApplication = createAsyncThunk(
  'autoserviceAdmin/rejectApplication',
  async ({ applicationId, reason }, { rejectWithValue }) => {
    try {
      return await apiRequest(`/admin/autoservice-applications/${applicationId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка отклонения заявки');
    }
  },
);

export const disableAutoserviceOrganization = createAsyncThunk(
  'autoserviceAdmin/disableOrganization',
  async (organizationId, { rejectWithValue }) => {
    try {
      await apiRequest(`/admin/autoservice-organizations/${organizationId}/disable`, {
        method: 'POST',
      });
      return organizationId;
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка отключения автосервиса');
    }
  },
);

export const pauseAutoserviceOrganization = createAsyncThunk(
  'autoserviceAdmin/pauseOrganization',
  async (organizationId, { rejectWithValue }) => {
    try {
      const res = await apiRequest(
        `/admin/autoservice-organizations/${organizationId}/pause`,
        { method: 'POST' },
      );
      return res?.organization_id || organizationId;
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка приостановки автосервиса');
    }
  },
);

export const resumeAutoserviceOrganization = createAsyncThunk(
  'autoserviceAdmin/resumeOrganization',
  async (organizationId, { rejectWithValue }) => {
    try {
      const res = await apiRequest(
        `/admin/autoservice-organizations/${organizationId}/resume`,
        { method: 'POST' },
      );
      return res?.organization_id || organizationId;
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка возобновления автосервиса');
    }
  },
);

export const fetchMyAutoserviceApplication = createAsyncThunk(
  'autoserviceAdmin/fetchMyApplication',
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest('/autoservice/applications/me');
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка загрузки статуса заявки');
    }
  },
);

export const submitAutoserviceApplication = createAsyncThunk(
  'autoserviceAdmin/submitApplication',
  async (payload, { rejectWithValue }) => {
    try {
      return await apiRequest('/autoservice/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return rejectWithValue(error?.message || 'Ошибка отправки заявки');
    }
  },
);

const autoserviceAdminSlice = createSlice({
  name: 'autoserviceAdmin',
  initialState: {
    applications: [],
    connectedOrgs: [],
    myApplicationState: null,
    loading: false,
    myLoading: false,
    submitting: false,
    actionLoading: false,
    error: null,
    myError: null,
  },
  reducers: {
    clearAutoserviceAdminErrors: (state) => {
      state.error = null;
      state.myError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAutoserviceApplications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAutoserviceApplications.fulfilled, (state, action) => {
        state.loading = false;
        state.applications = action.payload || [];
      })
      .addCase(fetchAutoserviceApplications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchAutoserviceConnectedOrgs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAutoserviceConnectedOrgs.fulfilled, (state, action) => {
        state.loading = false;
        state.connectedOrgs = action.payload || [];
      })
      .addCase(fetchAutoserviceConnectedOrgs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(approveAutoserviceApplication.pending, (state) => {
        state.actionLoading = true;
      })
      .addCase(approveAutoserviceApplication.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        state.applications = state.applications.map((item) =>
          item.id === updated.id ? updated : item,
        );
      })
      .addCase(approveAutoserviceApplication.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })
      .addCase(rejectAutoserviceApplication.fulfilled, (state, action) => {
        state.actionLoading = false;
        const updated = action.payload;
        state.applications = state.applications.map((item) =>
          item.id === updated.id ? updated : item,
        );
      })
      .addCase(disableAutoserviceOrganization.fulfilled, (state, action) => {
        state.connectedOrgs = state.connectedOrgs.filter(
          (org) => org.organization_id !== action.payload,
        );
      })
      .addCase(pauseAutoserviceOrganization.fulfilled, (state, action) => {
        const orgId = action.payload;
        state.connectedOrgs = state.connectedOrgs.map((org) =>
          org.organization_id === orgId
            ? { ...org, is_paused: true, is_active: false }
            : org,
        );
      })
      .addCase(resumeAutoserviceOrganization.fulfilled, (state, action) => {
        const orgId = action.payload;
        state.connectedOrgs = state.connectedOrgs.map((org) =>
          org.organization_id === orgId
            ? { ...org, is_paused: false, is_active: true }
            : org,
        );
      })
      .addCase(fetchMyAutoserviceApplication.pending, (state) => {
        state.myLoading = true;
        state.myError = null;
      })
      .addCase(fetchMyAutoserviceApplication.fulfilled, (state, action) => {
        state.myLoading = false;
        state.myApplicationState = action.payload;
      })
      .addCase(fetchMyAutoserviceApplication.rejected, (state, action) => {
        state.myLoading = false;
        state.myError = action.payload;
      })
      .addCase(submitAutoserviceApplication.pending, (state) => {
        state.submitting = true;
        state.myError = null;
      })
      .addCase(submitAutoserviceApplication.fulfilled, (state, action) => {
        state.submitting = false;
        if (state.myApplicationState) {
          state.myApplicationState.application = action.payload;
        } else {
          state.myApplicationState = { application: action.payload };
        }
      })
      .addCase(submitAutoserviceApplication.rejected, (state, action) => {
        state.submitting = false;
        state.myError = action.payload;
      });
  },
});

export const { clearAutoserviceAdminErrors } = autoserviceAdminSlice.actions;
export default autoserviceAdminSlice.reducer;
