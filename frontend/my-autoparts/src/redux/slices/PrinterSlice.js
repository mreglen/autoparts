import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiAxios } from '../../utils/apiClient';

// Async thunks
export const fetchAvailablePrinters = createAsyncThunk(
  'printers/fetchAvailablePrinters',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiAxios.get('/printers/available');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch printers');
    }
  }
);

export const sendPrintJob = createAsyncThunk(
  'printers/sendPrintJob',
  async ({ printerId, content, copies, settings }, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post(`/printers/id/${printerId}/print`, {
        content,
        copies,
        settings
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to send print job');
    }
  }
);

export const printLabel = createAsyncThunk(
  'printers/printLabel',
  async ({ printerId, productData }, { rejectWithValue }) => {
    try {
      const response = await apiAxios.post(`/printers/id/${printerId}/print-label`, productData);
      return response.data;
    } catch (error) {
      const detail = error.response?.data?.detail;
      let message = 'Не удалось напечатать этикетку';
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        message = detail[0].msg;
      }
      return rejectWithValue(message);
    }
  }
);

export const fetchAllPrinters = createAsyncThunk(
  'printers/fetchAllPrinters',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiAxios.get('/printers');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch all printers');
    }
  }
);

export const getPrintJob = createAsyncThunk(
  'printers/getPrintJob',
  async (jobId, { rejectWithValue }) => {
    try {
      const response = await apiAxios.get(`/printers/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch print job');
    }
  }
);

export const fetchPrintJobs = createAsyncThunk(
  'printers/fetchPrintJobs',
  async ({ limit = 50, offset = 0 }, { rejectWithValue }) => {
    try {
      const response = await apiAxios.get(`/printers/jobs?limit=${limit}&offset=${offset}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch print jobs');
    }
  }
);

// Initial state
const initialState = {
  printers: [],
  availablePrinters: [],
  printJobs: [],
  currentPrintJob: null,
  loading: false,
  fetchingPrinters: false,
  sendingPrint: false,
  error: null,
  lastFetched: null
};

// Slice
const printerSlice = createSlice({
  name: 'printers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearPrinters: (state) => {
      state.printers = [];
      state.availablePrinters = [];
    },
    setPrinterRefreshTime: (state) => {
      state.lastFetched = new Date().toISOString();
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch available printers
      .addCase(fetchAvailablePrinters.pending, (state) => {
        state.fetchingPrinters = true;
        state.error = null;
      })
      .addCase(fetchAvailablePrinters.fulfilled, (state, action) => {
        state.fetchingPrinters = false;
        state.availablePrinters = action.payload;
        state.lastFetched = new Date().toISOString();
      })
      .addCase(fetchAvailablePrinters.rejected, (state, action) => {
        state.fetchingPrinters = false;
        state.error = action.payload;
      })

      // Fetch all printers
      .addCase(fetchAllPrinters.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllPrinters.fulfilled, (state, action) => {
        state.loading = false;
        state.printers = action.payload;
      })
      .addCase(fetchAllPrinters.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Send print job
      .addCase(sendPrintJob.pending, (state) => {
        state.sendingPrint = true;
        state.error = null;
      })
      .addCase(sendPrintJob.fulfilled, (state, action) => {
        state.sendingPrint = false;
        // Optionally add job to local list
      })
      .addCase(sendPrintJob.rejected, (state, action) => {
        state.sendingPrint = false;
        state.error = action.payload;
      })

      // Print label
      .addCase(printLabel.pending, (state) => {
        state.sendingPrint = true;
        state.error = null;
      })
      .addCase(printLabel.fulfilled, (state, action) => {
        state.sendingPrint = false;
      })
      .addCase(printLabel.rejected, (state, action) => {
        state.sendingPrint = false;
        state.error = action.payload;
      })

      // Get print job
      .addCase(getPrintJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPrintJob.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPrintJob = action.payload;
      })
      .addCase(getPrintJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch print jobs
      .addCase(fetchPrintJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPrintJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.printJobs = action.payload;
      })
      .addCase(fetchPrintJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

// Export actions
export const { clearError, clearPrinters, setPrinterRefreshTime } = printerSlice.actions;

// Export selectors
export const selectPrinters = (state) => state.printers.printers;
export const selectAvailablePrinters = (state) => state.printers.availablePrinters;
export const selectPrintJobs = (state) => state.printers.printJobs;
export const selectCurrentPrintJob = (state) => state.printers.currentPrintJob;
export const selectPrintersLoading = (state) => state.printers.loading;
export const selectFetchingPrinters = (state) => state.printers.fetchingPrinters;
export const selectSendingPrint = (state) => state.printers.sendingPrint;
export const selectPrintersError = (state) => state.printers.error;
export const selectLastPrinterFetch = (state) => state.printers.lastFetched;

export default printerSlice.reducer;
