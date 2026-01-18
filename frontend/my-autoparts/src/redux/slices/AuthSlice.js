// src/redux/slices/AuthSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest, apiRequestFormData } from '../../utils/apiClient';

// --- Async Thunks ---
export const sendVerificationCode = createAsyncThunk(
    'auth/sendVerificationCode',
    async (email, { rejectWithValue }) => {
        try {
            await apiRequest('/auth/register/send-code', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            return { email };
        } catch (err) {
            return rejectWithValue(err);
        }
    }
);

export const verifyEmailCode = createAsyncThunk(
    'auth/verifyEmailCode',
    async ({ email, code }, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/auth/register/verify-code', {
                method: 'POST',
                body: JSON.stringify({ email, code }),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err);
        }
    }
);

export const completeRegistration = createAsyncThunk(
    'auth/completeRegistration',
    async (formData, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/auth/register/complete', {
                method: 'POST',
                body: JSON.stringify(formData),
            });
            localStorage.setItem('token', result.access_token);
            return result;
        } catch (err) {
            return rejectWithValue(err);
        }
    }
);

export const login = createAsyncThunk(
    'auth/login',
    async ({ login, password }, { rejectWithValue }) => {
        try {
            // Создаём объект FormData
            const formData = new FormData();
            formData.append('username', login);      // ← именно 'username', а не 'login'
            formData.append('password', password);

            const result = await apiRequestFormData('/auth/login', formData, {
                method: 'POST',
            });

            localStorage.setItem('token', result.access_token);
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Ошибка входа');
        }
    }
);

export const fetchProfile = createAsyncThunk(
    'auth/fetchProfile',
    async (_, { rejectWithValue }) => {
        const token = localStorage.getItem('token');
        if (!token) return rejectWithValue('Токен отсутствует');
        try {
            const result = await apiRequest('/auth/profile');
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось загрузить профиль');
        }
    }
);

export const logout = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
    localStorage.removeItem('token');
});

export const requestPasswordReset = createAsyncThunk(
    'auth/requestPasswordReset',
    async (email, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/auth/password/send-code', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Не удалось отправить код');
        }
    }
);

export const confirmPasswordReset = createAsyncThunk(
    'auth/confirmPasswordReset',
    async ({ email, code, new_password }, { rejectWithValue }) => {
        try {
            const result = await apiRequest('/auth/password/verify', {
                method: 'POST',
                body: JSON.stringify({ email, code, new_password }),
            });
            return result;
        } catch (err) {
            return rejectWithValue(err?.detail || 'Неверный код или ошибка сервера');
        }
    }
);



// --- Slice ---
const authSlice = createSlice({
    name: 'auth',
    initialState: {
        // Регистрация
        isBuyer: null,
        isSeller: null,
        formData: {
            last_name: '',
            first_name: '',
            patronymic: '',
            email: '',
            phone: '',
            password: '',
            password_repeat: '',
            name_organization: '',
            address_organization: '',
            addressData: null,
            showPassword: false,
            showPasswordRepeat: false,
        },
        code: '',
        addressError: '',
        emailVerification: {
            status: null, // null | 'sent' | 'verified' | 'error'
        },

        // Аутентификация
        token: localStorage.getItem('token') || null,
        user: null,

        // Общее
        loading: false,
        error: null,
    },
    reducers: {
        resetEmailVerificationError: (state) => {
            state.error = null;
            state.emailVerification.status = 'sent';
        },
        setIsBuyer: (state, action) => {
            state.isBuyer = action.payload;
            state.isSeller = !action.payload;
        },
        updateField: (state, action) => {
            state.formData = { ...state.formData, ...action.payload };
        },
        updateCode: (state, action) => {
            state.code = action.payload;
        },
        resetRegistration: (state) => {
            state.isBuyer = null;
            state.isSeller = null;
            state.formData = {
                last_name: '',
                first_name: '',
                patronymic: '',
                email: '',
                phone: '',
                password: '',
                password_repeat: '',
                name_organization: '',
                address_organization: '',
                addressData: null,
                showPassword: false,
                showPasswordRepeat: false,
            };
            state.code = '';
            state.emailVerification = { status: null };
            state.error = null;
            state.addressError = '';
        },
        setAddressError: (state, action) => {
            state.addressError = action.payload; // строка или ''
        },
    },
    extraReducers: (builder) => {
        builder
            // sendVerificationCode
            .addCase(sendVerificationCode.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(sendVerificationCode.fulfilled, (state, action) => {
                state.loading = false;
                state.formData.email = action.payload.email;
                state.emailVerification.status = 'sent';
            })
            .addCase(sendVerificationCode.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.detail || 'Не удалось отправить код';
                state.emailVerification.status = 'error';
            })
            // verifyEmailCode
            .addCase(verifyEmailCode.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(verifyEmailCode.fulfilled, (state) => {
                state.loading = false;
                state.emailVerification.status = 'verified';
            })
            .addCase(verifyEmailCode.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.detail || 'Неверный код';
                state.emailVerification.status = 'error';
            })
            // completeRegistration
            .addCase(completeRegistration.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(completeRegistration.fulfilled, (state, action) => {
                state.loading = false;
                state.token = action.payload.access_token;
            })
            .addCase(completeRegistration.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.detail || 'Ошибка регистрации';
            })
            // login
            .addCase(login.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(login.fulfilled, (state, action) => {
                state.loading = false;
                state.token = action.payload.access_token;
                localStorage.setItem('token', action.payload.access_token);
            })
            .addCase(login.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.detail || 'Ошибка входа';
            })
            // fetchProfile
            .addCase(fetchProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
            })
            .addCase(fetchProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                
                // Only clear token if it's definitely an authentication error
                // Don't clear for network errors or other issues
                if (action.payload?.includes('401') || 
                    action.payload?.includes('Unauthorized') || 
                    action.payload?.includes('invalid') ||
                    action.payload?.includes('expired') ||
                    action.payload?.includes('signature')) {
                    state.user = null;
                    state.token = null;
                    localStorage.removeItem('token');
                }
            })
            // logout
            .addCase(logout.fulfilled, (state) => {
                state.token = null;
                state.user = null;
            })
            // requestPasswordReset
            .addCase(requestPasswordReset.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(requestPasswordReset.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(requestPasswordReset.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // confirmPasswordReset
            .addCase(confirmPasswordReset.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(confirmPasswordReset.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
            })
            .addCase(confirmPasswordReset.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const {
    setIsBuyer,
    updateField,
    updateCode,
    resetRegistration,
    resetEmailVerificationError,
    setAddressError,
} = authSlice.actions;

export default authSlice.reducer;