import {
  AuthUser,
  Booking,
  DashboardStats,
  DriveSpreadsheetSummary,
  GoogleSheetStorageStatus,
  ManagedUser,
  PropertySettings,
  Room,
  RoomTypeConfig,
  SMSLogEntry,
  UserRole,
  UserStatus,
} from '../types';
import { clearGoogleAccessToken, getGoogleAccessToken } from './googleAuth';

const AUTH_TOKEN_KEY = 'stayflow_auth_token';
const SPREADSHEET_ID_KEY = 'stayflow_spreadsheet_id';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getSelectedSpreadsheetId(): string | null {
  try {
    return localStorage.getItem(SPREADSHEET_ID_KEY);
  } catch {
    return null;
  }
}

export function setSelectedSpreadsheetId(id: string): void {
  try {
    localStorage.setItem(SPREADSHEET_ID_KEY, id);
  } catch {
    // Ignore storage errors
  }
}

let onUnauthorizedCallback: (() => void) | null = null;
let onGoogleAuthRequiredCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export function registerGoogleAuthRequiredHandler(cb: () => void) {
  onGoogleAuthRequiredCallback = cb;
}

export class APIError extends Error {
  status: number;
  code?: string;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = data?.code;
    this.data = data;
  }
}

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const googleToken = getGoogleAccessToken();
  const spreadsheetId = getSelectedSpreadsheetId();

  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (googleToken && !headers.has('X-Google-Access-Token')) {
    headers.set('X-Google-Access-Token', googleToken);
  }
  if (spreadsheetId && !headers.has('X-Spreadsheet-Id')) {
    headers.set('X-Spreadsheet-Id', spreadsheetId);
  }

  return fetch(input, { ...init, headers });
}

async function handleResponse<T>(res: Response, skipAuthRedirect = false): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (data?.code === 'GOOGLE_AUTH_REQUIRED') {
      clearGoogleAccessToken();
      if (onGoogleAuthRequiredCallback) onGoogleAuthRequiredCallback();
    } else if (!skipAuthRedirect) {
      clearAuthToken();
      if (onUnauthorizedCallback) onUnauthorizedCallback();
    }
  }
  if (!res.ok) {
    throw new APIError(data.error || res.statusText || 'Request failed', res.status, data);
  }
  return data as T;
}

export const api = {
  // Connect & initialize Google Sheets storage
  async connectGoogleStorage(spreadsheetId?: string): Promise<{
    spreadsheetId: string;
    title: string;
    spreadsheetUrl: string;
    propertyName: string;
    counts: GoogleSheetStorageStatus['counts'];
  }> {
    const res = await apiFetch('/api/storage/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId }),
    });
    const data = await handleResponse<{
      spreadsheetId: string;
      title: string;
      spreadsheetUrl: string;
      propertyName: string;
      counts: GoogleSheetStorageStatus['counts'];
    }>(res, true);
    if (data.spreadsheetId) {
      setSelectedSpreadsheetId(data.spreadsheetId);
    }
    return data;
  },

  // Staff Authentication (Login Only - No Sign Up)
  async login(
    username: string,
    password: string
  ): Promise<{ token: string; user: AuthUser; spreadsheetId?: string }> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await handleResponse<{ token: string; user: AuthUser; spreadsheetId?: string }>(res, true);
    if (data.spreadsheetId) {
      setSelectedSpreadsheetId(data.spreadsheetId);
    }
    return data;
  },

  async getMe(): Promise<{ user: AuthUser; spreadsheetId?: string }> {
    const res = await apiFetch('/api/auth/me');
    return handleResponse<{ user: AuthUser; spreadsheetId?: string }>(res);
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },

  // Google Sheets Storage Management
  async getStorageStatus(): Promise<GoogleSheetStorageStatus> {
    const res = await apiFetch('/api/storage/status');
    return handleResponse<GoogleSheetStorageStatus>(res);
  },

  async listDriveSpreadsheets(): Promise<DriveSpreadsheetSummary[]> {
    const res = await apiFetch('/api/storage/sheets');
    return handleResponse<DriveSpreadsheetSummary[]>(res);
  },

  async selectSpreadsheet(
    spreadsheetId: string
  ): Promise<{ message: string; status: GoogleSheetStorageStatus }> {
    const res = await apiFetch('/api/storage/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId }),
    });
    const data = await handleResponse<{ message: string; status: GoogleSheetStorageStatus }>(res);
    setSelectedSpreadsheetId(data.status.spreadsheetId);
    return data;
  },

  async createSpreadsheet(
    title: string
  ): Promise<{ message: string; status: GoogleSheetStorageStatus }> {
    const res = await apiFetch('/api/storage/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const data = await handleResponse<{ message: string; status: GoogleSheetStorageStatus }>(res);
    setSelectedSpreadsheetId(data.status.spreadsheetId);
    return data;
  },

  // User Management (Admin Only)
  async getUsers(): Promise<ManagedUser[]> {
    const res = await apiFetch('/api/users');
    return handleResponse<ManagedUser[]>(res);
  },

  async createUser(payload: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
  }): Promise<{ message: string; user: ManagedUser }> {
    const res = await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ message: string; user: ManagedUser }>(res);
  },

  async updateUser(
    id: string,
    updates: {
      fullName?: string;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    }
  ): Promise<{ message: string; user: ManagedUser }> {
    const res = await apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<{ message: string; user: ManagedUser }>(res);
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    const res = await apiFetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ message: string }>(res);
  },

  // Stats
  async getStats(): Promise<DashboardStats> {
    const res = await apiFetch('/api/stats');
    return handleResponse<DashboardStats>(res);
  },

  // Room Types
  async getRoomTypes(): Promise<RoomTypeConfig[]> {
    const res = await apiFetch('/api/room-types');
    return handleResponse<RoomTypeConfig[]>(res);
  },

  async createRoomType(typeData: Partial<RoomTypeConfig>): Promise<RoomTypeConfig> {
    const res = await apiFetch('/api/room-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeData),
    });
    return handleResponse<RoomTypeConfig>(res);
  },

  async updateRoomType(id: string, typeData: Partial<RoomTypeConfig>): Promise<RoomTypeConfig> {
    const res = await apiFetch(`/api/room-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeData),
    });
    return handleResponse<RoomTypeConfig>(res);
  },

  async deleteRoomType(id: string, reassignToTypeId?: string): Promise<{ message: string }> {
    const url = reassignToTypeId
      ? `/api/room-types/${id}?reassignToTypeId=${encodeURIComponent(reassignToTypeId)}`
      : `/api/room-types/${id}`;
    const res = await apiFetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: reassignToTypeId ? JSON.stringify({ reassignToTypeId }) : undefined,
    });
    return handleResponse<{ message: string }>(res);
  },

  // Rooms
  async getRooms(): Promise<Room[]> {
    const res = await apiFetch('/api/rooms');
    return handleResponse<Room[]>(res);
  },

  async createRoom(room: Partial<Room>): Promise<Room> {
    const res = await apiFetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    });
    return handleResponse<Room>(res);
  },

  async updateRoom(id: string, room: Partial<Room>): Promise<Room> {
    const res = await apiFetch(`/api/rooms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    });
    return handleResponse<Room>(res);
  },

  async deleteRoom(id: string): Promise<{ message: string }> {
    const res = await apiFetch(`/api/rooms/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ message: string }>(res);
  },

  // Availability
  async checkAvailability(params: {
    roomId?: string;
    checkInDate: string;
    checkOutDate: string;
    excludeBookingId?: string;
  }): Promise<{
    available?: boolean;
    conflictingBooking?: Booking;
    message?: string;
    rooms?: Array<{
      roomId: string;
      roomNumber: string;
      roomType: string;
      status: string;
      available: boolean;
    }>;
  }> {
    const query = new URLSearchParams();
    if (params.roomId) query.append('roomId', params.roomId);
    query.append('checkInDate', params.checkInDate);
    query.append('checkOutDate', params.checkOutDate);
    if (params.excludeBookingId) query.append('excludeBookingId', params.excludeBookingId);

    const res = await apiFetch(`/api/availability?${query.toString()}`);
    return handleResponse(res);
  },

  // Bookings
  async getBookings(params?: {
    roomId?: string;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<Booking[]> {
    const query = new URLSearchParams();
    if (params?.roomId) query.append('roomId', params.roomId);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);

    const res = await apiFetch(`/api/bookings?${query.toString()}`);
    return handleResponse<Booking[]>(res);
  },

  async createBooking(booking: {
    roomId: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    checkInDate: string;
    checkOutDate: string;
    notes?: string;
  }): Promise<{ message: string; booking: Booking }> {
    const res = await apiFetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    });
    return handleResponse<{ message: string; booking: Booking }>(res);
  },

  async updateBooking(
    id: string,
    updates: Partial<Booking>
  ): Promise<{ message: string; booking: Booking }> {
    const res = await apiFetch(`/api/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse<{ message: string; booking: Booking }>(res);
  },

  async cancelBooking(id: string): Promise<{ message: string; booking: Booking }> {
    const res = await apiFetch(`/api/bookings/${id}/cancel`, {
      method: 'POST',
    });
    return handleResponse<{ message: string; booking: Booking }>(res);
  },

  async deleteBooking(id: string): Promise<{ message: string; booking: Booking }> {
    const res = await apiFetch(`/api/bookings/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ message: string; booking: Booking }>(res);
  },

  async deleteAllCancelledBookings(): Promise<{ message: string; deletedCount: number }> {
    const res = await apiFetch('/api/bookings/cancelled/all', {
      method: 'DELETE',
    });
    return handleResponse<{ message: string; deletedCount: number }>(res);
  },

  // Settings
  async getSettings(): Promise<PropertySettings> {
    const res = await apiFetch('/api/settings');
    return handleResponse<PropertySettings>(res);
  },

  async updateSettings(
    settings: Partial<PropertySettings>
  ): Promise<{ message: string; settings: PropertySettings }> {
    const res = await apiFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return handleResponse<{ message: string; settings: PropertySettings }>(res);
  },

  // SMS
  async getSMSLogs(): Promise<SMSLogEntry[]> {
    const res = await apiFetch('/api/sms/logs');
    return handleResponse<SMSLogEntry[]>(res);
  },

  async sendSMS(payload: {
    bookingId?: string;
    recipientPhone?: string;
    guestName: string;
    messageType: string;
    content: string;
  }): Promise<{ message: string; smsUri: string; log: SMSLogEntry }> {
    const res = await apiFetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ message: string; smsUri: string; log: SMSLogEntry }>(res);
  },

  // Tests
  async runAutomatedTests(): Promise<{
    allPassed: boolean;
    totalDurationMs: number;
    tests: Array<{
      testNumber: number;
      title: string;
      description: string;
      passed: boolean;
      details: string;
      durationMs: number;
    }>;
  }> {
    const res = await apiFetch('/api/run-tests', { method: 'POST' });
    return handleResponse(res);
  },
};
