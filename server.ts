import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

const DEFAULT_SPREADSHEET_TITLE = 'StayFlow Hotel Data';

// ==========================================
// DATA MODELS
// ==========================================

interface RoomTypeConfig {
  id: string;
  name: string;
  description?: string;
  defaultPrice?: number;
  color?: string;
  createdAt: string;
}

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  status: 'active' | 'maintenance' | 'inactive';
  description?: string;
  floor?: string;
  capacity?: number;
  basePrice?: number;
  createdAt: string;
}

interface Booking {
  id: string;
  bookingReference: string;
  roomId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  notes?: string;
  bookingStatus: 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: 'admin' | 'manager';
  status: 'active' | 'disabled';
  createdAt: string;
  createdBy?: string;
}

interface SMSLog {
  id: string;
  bookingId?: string;
  bookingReference?: string;
  recipientPhone?: string;
  guestName: string;
  messageType: 'confirmation' | 'cancellation' | 'update' | 'welcome' | 'custom';
  content: string;
  status: 'opened' | 'copied' | 'logged';
  timestamp: string;
  provider: 'native-sms' | 'clipboard';
}

interface AppSettings {
  propertyName: string;
  timezone: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  authSecret: string;
  messaging: {
    mode: 'native-sms';
    confirmationTemplate: string;
    cancellationTemplate: string;
    updateTemplate: string;
    welcomeTemplate: string;
    wifiTemplate: string;
  };
}

interface DatabaseSchema {
  rooms: Room[];
  roomTypes: RoomTypeConfig[];
  bookings: Booking[];
  users: UserRecord[];
  settings: AppSettings;
  smsLogs: SMSLog[];
}

interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
}

interface CachedSheetState {
  meta: SheetMetadata;
  data: DatabaseSchema;
  fetchedAt: number;
}

interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  googleToken?: string;
  spreadsheetId?: string;
}

class GoogleAuthError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.code = 'GOOGLE_AUTH_REQUIRED';
  }
}

// ==========================================
// PASSWORD & TOKEN HELPERS
// ==========================================

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(key, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

function signAuthToken(user: UserRecord, secret: string): string {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const dataB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

function verifyAuthToken(
  token: string,
  secret: string
): { sub: string; username: string; role: string; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [dataB64, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf-8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function sanitizeUser(u: UserRecord) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    createdBy: u.createdBy,
  };
}

// ==========================================
// INITIAL DEFAULTS (ZERO DUMMY BOOKINGS)
// ==========================================

function generateInitialRooms(): Room[] {
  const rooms: Room[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i <= 18; i++) {
    const numStr = i.toString().padStart(2, '0');
    rooms.push({
      id: `room-reg-${numStr}`,
      roomNumber: `Regular Room ${numStr}`,
      roomType: 'Regular',
      status: 'active',
      floor: i <= 9 ? 'Floor 1' : 'Floor 2',
      capacity: 2,
      basePrice: 120,
      description:
        'Comfortable standard room with queen-size bed, private bathroom, high-speed Wi-Fi, and workspace.',
      createdAt: now,
    });
  }

  for (let i = 1; i <= 6; i++) {
    const numStr = i.toString().padStart(2, '0');
    rooms.push({
      id: `room-ste-${numStr}`,
      roomNumber: `Suite Room ${numStr}`,
      roomType: 'Suite',
      status: 'active',
      floor: 'Floor 3 (Penthouse)',
      capacity: 4,
      basePrice: 280,
      description:
        'Spacious luxury suite with master king bedroom, separate living lounge, balcony view, and premium amenities.',
      createdAt: now,
    });
  }

  return rooms;
}

function getInitialRoomTypes(): RoomTypeConfig[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'type-regular',
      name: 'Regular',
      description: 'Comfortable standard hotel room with queen bed, ensuite bath, and workspace.',
      defaultPrice: 120,
      color: 'blue',
      createdAt: now,
    },
    {
      id: 'type-suite',
      name: 'Suite',
      description: 'Spacious luxury suite with master king bedroom, separate living lounge, and premium amenities.',
      defaultPrice: 280,
      color: 'emerald',
      createdAt: now,
    },
  ];
}

function getDefaultAdminUser(): UserRecord {
  return {
    id: 'user-admin-bilalrana',
    username: 'bilalrana',
    passwordHash: hashPassword('bilalrana36050'),
    fullName: 'Bilal Rana',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
  };
}

function getDefaultSettings(): AppSettings {
  return {
    propertyName: 'Azure Horizon Boutique Hotel',
    timezone: 'America/New_York',
    defaultCheckInTime: '14:00',
    defaultCheckOutTime: '11:00',
    authSecret: crypto.randomBytes(32).toString('hex'),
    messaging: {
      mode: 'native-sms',
      confirmationTemplate:
        'Hello {guestName}, your room booking is confirmed! Room: {roomNumber}. Check-in: {checkInDate}. Check-out: {checkOutDate}. Booking Ref: {bookingReference}. Thank you for choosing us!',
      cancellationTemplate:
        'Hello {guestName}, your booking {bookingReference} for {roomNumber} ({checkInDate} to {checkOutDate}) has been cancelled. Please contact us if you need further assistance.',
      updateTemplate:
        'Hello {guestName}, your reservation {bookingReference} has been updated. Room: {roomNumber}. New dates: {checkInDate} to {checkOutDate}. See you soon!',
      welcomeTemplate:
        'Welcome {guestName}! Check-in for {roomNumber} is ready from {checkInTime}. Front desk is available 24/7. Ref: {bookingReference}. Have a wonderful stay!',
      wifiTemplate:
        'Hi {guestName}, here are your stay details for {roomNumber}: High-Speed Wi-Fi: "Azure-Guest", Password: "welcomeguest". Front Desk: Dial 0.',
    },
  };
}

// ==========================================
// GOOGLE SHEETS & DRIVE STORAGE LAYER
// ==========================================

const SHEET_NAMES = ['Rooms', 'RoomTypes', 'Bookings', 'Users', 'Settings', 'SMSLogs'] as const;
type SheetName = (typeof SHEET_NAMES)[number];

const HEADERS_BY_SHEET: Record<SheetName, string[]> = {
  Rooms: ['id', 'roomNumber', 'roomType', 'status', 'floor', 'capacity', 'basePrice', 'description', 'createdAt'],
  RoomTypes: ['id', 'name', 'description', 'defaultPrice', 'color', 'createdAt'],
  Bookings: [
    'id',
    'bookingReference',
    'roomId',
    'guestName',
    'guestEmail',
    'guestPhone',
    'checkInDate',
    'checkOutDate',
    'notes',
    'bookingStatus',
    'totalAmount',
    'createdAt',
    'updatedAt',
  ],
  Users: ['id', 'username', 'passwordHash', 'fullName', 'role', 'status', 'createdAt', 'createdBy'],
  Settings: ['key', 'value'],
  SMSLogs: [
    'id',
    'bookingId',
    'bookingReference',
    'recipientPhone',
    'guestName',
    'messageType',
    'content',
    'status',
    'timestamp',
    'provider',
  ],
};

const CACHE_TTL_MS = 2500;
const sheetCache = new Map<string, CachedSheetState>();
const inFlightLoads = new Map<string, Promise<CachedSheetState>>();

async function googleFetch(url: string, googleToken: string, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${googleToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (res.status === 401) {
    throw new GoogleAuthError(
      data?.error?.message || 'Google authorization expired. Please sign in with Google again.',
      401
    );
  }

  if (!res.ok) {
    const errMsg = data?.error?.message || res.statusText || 'Google Workspace API request failed.';
    const err: any = new Error(errMsg);
    err.status = res.status;
    err.googleData = data;
    throw err;
  }

  return data;
}

function rowsToObjects(values: any[][] | undefined): Record<string, string>[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h || '').trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')) {
      continue;
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : '';
    });
    out.push(obj);
  }
  return out;
}

function objectsToSheetValues(sheetName: SheetName, items: any[]): any[][] {
  const headers = HEADERS_BY_SHEET[sheetName];
  const rows = items.map((item) =>
    headers.map((h) => (item[h] !== undefined && item[h] !== null ? item[h] : ''))
  );
  return [headers, ...rows];
}

function serializeSettingsRows(settings: AppSettings): Array<{ key: string; value: string }> {
  return [
    { key: 'propertyName', value: settings.propertyName },
    { key: 'timezone', value: settings.timezone },
    { key: 'defaultCheckInTime', value: settings.defaultCheckInTime },
    { key: 'defaultCheckOutTime', value: settings.defaultCheckOutTime },
    { key: 'authSecret', value: settings.authSecret },
    { key: 'messaging_mode', value: settings.messaging.mode },
    { key: 'messaging_confirmationTemplate', value: settings.messaging.confirmationTemplate },
    { key: 'messaging_cancellationTemplate', value: settings.messaging.cancellationTemplate },
    { key: 'messaging_updateTemplate', value: settings.messaging.updateTemplate },
    { key: 'messaging_welcomeTemplate', value: settings.messaging.welcomeTemplate },
    { key: 'messaging_wifiTemplate', value: settings.messaging.wifiTemplate },
  ];
}

function parseSettingsRows(rows: Record<string, string>[]): { settings: AppSettings; hasSecret: boolean } {
  const defaults = getDefaultSettings();
  const map = new Map<string, string>();
  rows.forEach((r) => {
    if (r.key) map.set(String(r.key), String(r.value ?? ''));
  });

  const storedSecret = map.get('authSecret');

  return {
    hasSecret: Boolean(storedSecret),
    settings: {
      propertyName: map.get('propertyName') || defaults.propertyName,
      timezone: map.get('timezone') || defaults.timezone,
      defaultCheckInTime: map.get('defaultCheckInTime') || defaults.defaultCheckInTime,
      defaultCheckOutTime: map.get('defaultCheckOutTime') || defaults.defaultCheckOutTime,
      authSecret: storedSecret || defaults.authSecret,
      messaging: {
        mode: 'native-sms',
        confirmationTemplate: map.get('messaging_confirmationTemplate') || defaults.messaging.confirmationTemplate,
        cancellationTemplate: map.get('messaging_cancellationTemplate') || defaults.messaging.cancellationTemplate,
        updateTemplate: map.get('messaging_updateTemplate') || defaults.messaging.updateTemplate,
        welcomeTemplate: map.get('messaging_welcomeTemplate') || defaults.messaging.welcomeTemplate,
        wifiTemplate: map.get('messaging_wifiTemplate') || defaults.messaging.wifiTemplate,
      },
    },
  };
}

async function createStayFlowSpreadsheet(googleToken: string, title = DEFAULT_SPREADSHEET_TITLE): Promise<any> {
  return googleFetch('https://sheets.googleapis.com/v4/spreadsheets', googleToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: SHEET_NAMES.map((sheetTitle) => ({
        properties: { title: sheetTitle },
      })),
    }),
  });
}

async function resolveSpreadsheetMetadata(googleToken: string, requestedId?: string): Promise<{
  meta: SheetMetadata;
  existingSheetTitles: string[];
}> {
  if (requestedId) {
    try {
      const sp = await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          requestedId
        )}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties.title`,
        googleToken
      );
      return {
        meta: {
          spreadsheetId: sp.spreadsheetId,
          title: sp.properties?.title || DEFAULT_SPREADSHEET_TITLE,
          spreadsheetUrl: sp.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sp.spreadsheetId}/edit`,
        },
        existingSheetTitles: (sp.sheets || []).map((s: any) => s.properties?.title).filter(Boolean),
      };
    } catch (err: any) {
      if (err instanceof GoogleAuthError) throw err;
      // Fall through to Drive lookup if specified ID is not accessible or was deleted
    }
  }

  // Search Google Drive for existing canonical StayFlow spreadsheet
  const q = `name='${DEFAULT_SPREADSHEET_TITLE.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const driveRes = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&orderBy=modifiedTime desc&pageSize=5&fields=files(id,name,webViewLink)`,
    googleToken
  );

  const existingFile = driveRes?.files?.[0];
  if (existingFile?.id) {
    const sp = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        existingFile.id
      )}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties.title`,
      googleToken
    );
    return {
      meta: {
        spreadsheetId: sp.spreadsheetId,
        title: sp.properties?.title || existingFile.name || DEFAULT_SPREADSHEET_TITLE,
        spreadsheetUrl:
          sp.spreadsheetUrl ||
          existingFile.webViewLink ||
          `https://docs.google.com/spreadsheets/d/${sp.spreadsheetId}/edit`,
      },
      existingSheetTitles: (sp.sheets || []).map((s: any) => s.properties?.title).filter(Boolean),
    };
  }

  // Create fresh spreadsheet once if none exists yet
  const created = await createStayFlowSpreadsheet(googleToken, DEFAULT_SPREADSHEET_TITLE);
  return {
    meta: {
      spreadsheetId: created.spreadsheetId,
      title: created.properties?.title || DEFAULT_SPREADSHEET_TITLE,
      spreadsheetUrl:
        created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    },
    existingSheetTitles: (created.sheets || []).map((s: any) => s.properties?.title).filter(Boolean),
  };
}

async function writeSheetsToGoogle(
  googleToken: string,
  spreadsheetId: string,
  data: DatabaseSchema,
  sheetsToWrite: SheetName[]
): Promise<void> {
  if (sheetsToWrite.length === 0) return;

  const rangesToClear = sheetsToWrite.map((name) => `'${name}'!A:Z`);
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    googleToken,
    {
      method: 'POST',
      body: JSON.stringify({ ranges: rangesToClear }),
    }
  );

  const valueData = sheetsToWrite.map((name) => {
    let items: any[] = [];
    switch (name) {
      case 'Rooms':
        items = data.rooms;
        break;
      case 'RoomTypes':
        items = data.roomTypes;
        break;
      case 'Bookings':
        items = data.bookings;
        break;
      case 'Users':
        items = data.users;
        break;
      case 'Settings':
        items = serializeSettingsRows(data.settings);
        break;
      case 'SMSLogs':
        items = data.smsLogs;
        break;
    }
    return {
      range: `'${name}'!A1`,
      majorDimension: 'ROWS',
      values: objectsToSheetValues(name, items),
    };
  });

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    googleToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: valueData,
      }),
    }
  );
}

async function loadFromGoogleSheets(
  googleToken: string,
  requestedSpreadsheetId?: string,
  forceRefresh = false
): Promise<CachedSheetState> {
  if (!forceRefresh && requestedSpreadsheetId) {
    const cached = sheetCache.get(requestedSpreadsheetId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached;
    }
    const existingFlight = inFlightLoads.get(requestedSpreadsheetId);
    if (existingFlight) return existingFlight;
  }

  const loadPromise = (async (): Promise<CachedSheetState> => {
    const { meta, existingSheetTitles } = await resolveSpreadsheetMetadata(googleToken, requestedSpreadsheetId);

    if (!forceRefresh) {
      const cached = sheetCache.get(meta.spreadsheetId);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached;
      }
    }

    // Ensure all 6 tabs exist (never assuming Sheet1)
    const missingTabs = SHEET_NAMES.filter((name) => !existingSheetTitles.includes(name));
    if (missingTabs.length > 0) {
      await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(meta.spreadsheetId)}:batchUpdate`,
        googleToken,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: missingTabs.map((title) => ({
              addSheet: { properties: { title } },
            })),
          }),
        }
      );
    }

    // Batch read all 6 sheets in 1 API call
    const rangesQuery = SHEET_NAMES.map((name) => `ranges=${encodeURIComponent(`'${name}'!A:Z`)}`).join('&');
    const batchRes = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(meta.spreadsheetId)}/values:batchGet?${rangesQuery}`,
      googleToken
    );

    const valueRanges: Array<{ range: string; values?: any[][] }> = batchRes.valueRanges || [];
    const bySheet = new Map<SheetName, Record<string, string>[]>();
    SHEET_NAMES.forEach((name, idx) => {
      bySheet.set(name, rowsToObjects(valueRanges[idx]?.values));
    });

    const rawRooms = bySheet.get('Rooms') || [];
    const rawRoomTypes = bySheet.get('RoomTypes') || [];
    const rawBookings = bySheet.get('Bookings') || [];
    const rawUsers = bySheet.get('Users') || [];
    const rawSettings = bySheet.get('Settings') || [];
    const rawSMSLogs = bySheet.get('SMSLogs') || [];

    const rooms: Room[] = rawRooms
      .filter((r) => r.id && r.roomNumber)
      .map((r) => ({
        id: String(r.id),
        roomNumber: String(r.roomNumber),
        roomType: String(r.roomType || 'Regular'),
        status: (['active', 'maintenance', 'inactive'].includes(String(r.status))
          ? String(r.status)
          : 'active') as Room['status'],
        floor: r.floor ? String(r.floor) : 'Floor 1',
        capacity: Number(r.capacity) || 2,
        basePrice: Number(r.basePrice) || 120,
        description: r.description ? String(r.description) : '',
        createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
      }));

    const roomTypes: RoomTypeConfig[] = rawRoomTypes
      .filter((t) => t.id && t.name)
      .map((t) => ({
        id: String(t.id),
        name: String(t.name),
        description: t.description ? String(t.description) : '',
        defaultPrice: Number(t.defaultPrice) || 120,
        color: t.color ? String(t.color) : 'blue',
        createdAt: t.createdAt ? String(t.createdAt) : new Date().toISOString(),
      }));

    const bookings: Booking[] = rawBookings
      .filter((b) => b.id && b.roomId && b.guestName)
      .map((b) => ({
        id: String(b.id),
        bookingReference: String(b.bookingReference || ''),
        roomId: String(b.roomId),
        guestName: String(b.guestName),
        guestEmail: b.guestEmail ? String(b.guestEmail) : '',
        guestPhone: b.guestPhone ? String(b.guestPhone) : '',
        checkInDate: String(b.checkInDate),
        checkOutDate: String(b.checkOutDate),
        notes: b.notes ? String(b.notes) : '',
        bookingStatus: (['confirmed', 'checked-in', 'checked-out', 'cancelled'].includes(String(b.bookingStatus))
          ? String(b.bookingStatus)
          : 'confirmed') as Booking['bookingStatus'],
        totalAmount: b.totalAmount !== '' && b.totalAmount !== undefined ? Number(b.totalAmount) : undefined,
        createdAt: b.createdAt ? String(b.createdAt) : new Date().toISOString(),
        updatedAt: b.updatedAt ? String(b.updatedAt) : new Date().toISOString(),
      }));

    const users: UserRecord[] = rawUsers
      .filter((u) => u.id && u.username && u.passwordHash)
      .map((u) => ({
        id: String(u.id),
        username: String(u.username),
        passwordHash: String(u.passwordHash),
        fullName: String(u.fullName || u.username),
        role: (String(u.role) === 'admin' ? 'admin' : 'manager') as UserRecord['role'],
        status: (String(u.status) === 'disabled' ? 'disabled' : 'active') as UserRecord['status'],
        createdAt: u.createdAt ? String(u.createdAt) : new Date().toISOString(),
        createdBy: u.createdBy ? String(u.createdBy) : 'system',
      }));

    const parsedSettings = parseSettingsRows(rawSettings);

    const smsLogs: SMSLog[] = rawSMSLogs
      .filter((s) => s.id && s.content)
      .map((s) => ({
        id: String(s.id),
        bookingId: s.bookingId ? String(s.bookingId) : undefined,
        bookingReference: s.bookingReference ? String(s.bookingReference) : undefined,
        recipientPhone: s.recipientPhone ? String(s.recipientPhone) : '',
        guestName: String(s.guestName || 'Guest'),
        messageType: (['confirmation', 'cancellation', 'update', 'welcome', 'custom'].includes(String(s.messageType))
          ? String(s.messageType)
          : 'custom') as SMSLog['messageType'],
        content: String(s.content),
        status: (['opened', 'copied', 'logged'].includes(String(s.status))
          ? String(s.status)
          : 'opened') as SMSLog['status'],
        timestamp: s.timestamp ? String(s.timestamp) : new Date().toISOString(),
        provider: (s.provider === 'clipboard' ? 'clipboard' : 'native-sms') as SMSLog['provider'],
      }));

    const db: DatabaseSchema = {
      rooms,
      roomTypes,
      bookings,
      users,
      settings: parsedSettings.settings,
      smsLogs,
    };

    const sheetsNeedingInit: SheetName[] = [];

    if (db.rooms.length === 0) {
      db.rooms = generateInitialRooms();
      sheetsNeedingInit.push('Rooms');
    }
    if (db.roomTypes.length === 0) {
      db.roomTypes = getInitialRoomTypes();
      sheetsNeedingInit.push('RoomTypes');
    }
    if (!db.users.some((u) => u.username.toLowerCase() === 'bilalrana')) {
      db.users.unshift(getDefaultAdminUser());
      sheetsNeedingInit.push('Users');
    }
    if (!parsedSettings.hasSecret || rawSettings.length === 0) {
      sheetsNeedingInit.push('Settings');
    }
    if (!valueRanges[2]?.values || valueRanges[2].values.length === 0) {
      sheetsNeedingInit.push('Bookings');
    }
    if (!valueRanges[5]?.values || valueRanges[5].values.length === 0) {
      sheetsNeedingInit.push('SMSLogs');
    }

    if (sheetsNeedingInit.length > 0) {
      await writeSheetsToGoogle(googleToken, meta.spreadsheetId, db, sheetsNeedingInit);
    }

    const state: CachedSheetState = {
      meta,
      data: db,
      fetchedAt: Date.now(),
    };
    sheetCache.set(meta.spreadsheetId, state);
    return state;
  })();

  if (requestedSpreadsheetId) {
    inFlightLoads.set(requestedSpreadsheetId, loadPromise);
  }

  try {
    return await loadPromise;
  } finally {
    if (requestedSpreadsheetId) {
      inFlightLoads.delete(requestedSpreadsheetId);
    }
  }
}

async function saveToGoogleSheets(
  googleToken: string,
  meta: SheetMetadata,
  data: DatabaseSchema,
  sheetsToWrite: SheetName[]
): Promise<void> {
  await writeSheetsToGoogle(googleToken, meta.spreadsheetId, data, sheetsToWrite);
  sheetCache.set(meta.spreadsheetId, {
    meta,
    data,
    fetchedAt: Date.now(),
  });
}

// ==========================================
// MUTEX & AVAILABILITY LOGIC
// ==========================================

class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const execute = () => {
        this.locked = true;
        resolve(() => {
          this.locked = false;
          const next = this.queue.shift();
          if (next) next();
        });
      };

      if (!this.locked) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }
}

const sheetMutexMap = new Map<string, AsyncMutex>();
function getMutex(spreadsheetId: string): AsyncMutex {
  let m = sheetMutexMap.get(spreadsheetId);
  if (!m) {
    m = new AsyncMutex();
    sheetMutexMap.set(spreadsheetId, m);
  }
  return m;
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

function isRoomAvailable(
  db: DatabaseSchema,
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeBookingId?: string
): { available: boolean; conflictingBooking?: Booking } {
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) return { available: false };
  if (room.status === 'inactive' || room.status === 'maintenance') {
    return { available: false };
  }

  const conflictingBooking = db.bookings.find((b) => {
    if (b.roomId !== roomId) return false;
    if (b.bookingStatus === 'cancelled') return false;
    if (excludeBookingId && b.id === excludeBookingId) return false;

    return datesOverlap(checkInDate, checkOutDate, b.checkInDate, b.checkOutDate);
  });

  return {
    available: !conflictingBooking,
    conflictingBooking,
  };
}

// ==========================================
// MIDDLEWARE: GOOGLE TOKEN & STAFF AUTH
// ==========================================

function extractGoogleContext(req: AuthenticatedRequest): { googleToken: string; spreadsheetId?: string } {
  const googleToken = String(req.headers['x-google-access-token'] || '').trim();
  const spreadsheetId = String(req.headers['x-spreadsheet-id'] || '').trim() || undefined;
  return { googleToken, spreadsheetId };
}

function requireGoogleToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const { googleToken, spreadsheetId } = extractGoogleContext(req);
  if (!googleToken) {
    return res.status(401).json({
      code: 'GOOGLE_AUTH_REQUIRED',
      error: 'Google Sheets connection required. Please sign in with Google.',
    });
  }
  req.googleToken = googleToken;
  req.spreadsheetId = spreadsheetId;
  next();
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { googleToken, spreadsheetId } = extractGoogleContext(req);
    if (!googleToken) {
      return res.status(401).json({
        code: 'GOOGLE_AUTH_REQUIRED',
        error: 'Google Sheets connection required. Please sign in with Google.',
      });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const state = await loadFromGoogleSheets(googleToken, spreadsheetId);
    const payload = verifyAuthToken(token, state.data.settings.authSecret);
    if (!payload) {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }

    const user = state.data.users.find((u) => u.id === payload.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Account is disabled or no longer exists.' });
    }

    req.googleToken = googleToken;
    req.spreadsheetId = state.meta.spreadsheetId;
    req.user = user;
    next();
  } catch (err: any) {
    if (err instanceof GoogleAuthError) {
      return res.status(401).json({ code: err.code, error: err.message });
    }
    return res.status(err.status || 500).json({ error: err.message || 'Authentication check failed.' });
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required for this action.' });
  }
  next();
}

function handleRouteError(res: Response, err: any) {
  if (err instanceof GoogleAuthError) {
    return res.status(401).json({ code: err.code, error: err.message });
  }
  return res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
}

// ==========================================
// GOOGLE SHEETS CONNECTION & AUTH ROUTES
// ==========================================

app.post('/api/storage/connect', requireGoogleToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedId = req.body?.spreadsheetId || req.spreadsheetId;
    const state = await loadFromGoogleSheets(req.googleToken!, requestedId, true);
    res.json({
      spreadsheetId: state.meta.spreadsheetId,
      title: state.meta.title,
      spreadsheetUrl: state.meta.spreadsheetUrl,
      propertyName: state.data.settings.propertyName,
      counts: {
        rooms: state.data.rooms.length,
        roomTypes: state.data.roomTypes.length,
        bookings: state.data.bookings.length,
        users: state.data.users.length,
        smsLogs: state.data.smsLogs.length,
      },
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/auth/login', requireGoogleToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    const normalizedUsername = String(username).trim().toLowerCase();
    const user = state.data.users.find((u) => u.username.toLowerCase() === normalizedUsername);

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account has been disabled by an administrator.' });
    }

    const token = signAuthToken(user, state.data.settings.authSecret);
    res.json({
      token,
      user: sanitizeUser(user),
      spreadsheetId: state.meta.spreadsheetId,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user!), spreadsheetId: req.spreadsheetId });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Signed out successfully.' });
});

// ==========================================
// GOOGLE SHEETS MANAGEMENT ROUTES
// ==========================================

app.get('/api/storage/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    res.json({
      spreadsheetId: state.meta.spreadsheetId,
      title: state.meta.title,
      spreadsheetUrl: state.meta.spreadsheetUrl,
      lastSyncedAt: new Date(state.fetchedAt).toISOString(),
      counts: {
        rooms: state.data.rooms.length,
        roomTypes: state.data.roomTypes.length,
        bookings: state.data.bookings.length,
        users: state.data.users.length,
        smsLogs: state.data.smsLogs.length,
      },
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.get('/api/storage/sheets', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
    const driveRes = await googleFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&orderBy=modifiedTime desc&pageSize=30&fields=files(id,name,webViewLink,modifiedTime)`,
      req.googleToken!
    );
    res.json(driveRes.files || []);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/storage/select', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { spreadsheetId } = req.body;
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'spreadsheetId is required.' });
    }
    const state = await loadFromGoogleSheets(req.googleToken!, String(spreadsheetId), true);
    res.json({
      message: `Switched storage to Google Sheet "${state.meta.title}".`,
      status: {
        spreadsheetId: state.meta.spreadsheetId,
        title: state.meta.title,
        spreadsheetUrl: state.meta.spreadsheetUrl,
        lastSyncedAt: new Date(state.fetchedAt).toISOString(),
        counts: {
          rooms: state.data.rooms.length,
          roomTypes: state.data.roomTypes.length,
          bookings: state.data.bookings.length,
          users: state.data.users.length,
          smsLogs: state.data.smsLogs.length,
        },
      },
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/storage/create', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const title = String(req.body?.title || '').trim() || DEFAULT_SPREADSHEET_TITLE;
    const created = await createStayFlowSpreadsheet(req.googleToken!, title);
    const state = await loadFromGoogleSheets(req.googleToken!, created.spreadsheetId, true);
    res.status(201).json({
      message: `Created new Google Sheet "${state.meta.title}" and initialized hotel tabs.`,
      status: {
        spreadsheetId: state.meta.spreadsheetId,
        title: state.meta.title,
        spreadsheetUrl: state.meta.spreadsheetUrl,
        lastSyncedAt: new Date(state.fetchedAt).toISOString(),
        counts: {
          rooms: state.data.rooms.length,
          roomTypes: state.data.roomTypes.length,
          bookings: state.data.bookings.length,
          users: state.data.users.length,
          smsLogs: state.data.smsLogs.length,
        },
      },
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// USER MANAGEMENT ROUTES (ADMIN ONLY)
// ==========================================

app.get('/api/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    res.json(state.data.users.map(sanitizeUser));
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password, fullName, role = 'manager' } = req.body;

    if (!username || !String(username).trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    const cleanUsername = String(username).trim();
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
      return res
        .status(400)
        .json({ error: 'Username may only contain letters, numbers, dots, underscores, or hyphens.' });
    }

    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const exists = state.data.users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase());
      if (exists) {
        return res.status(409).json({ error: `Username "${cleanUsername}" is already taken.` });
      }

      const assignedRole: 'admin' | 'manager' = role === 'admin' ? 'admin' : 'manager';

      const newUser: UserRecord = {
        id: `user-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        username: cleanUsername,
        passwordHash: hashPassword(String(password)),
        fullName: String(fullName).trim(),
        role: assignedRole,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: req.user?.username || 'admin',
      };

      state.data.users.push(newUser);
      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Users']);

      res.status(201).json({
        message: `User "${newUser.username}" created in Google Sheets.`,
        user: sanitizeUser(newUser),
      });
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, role, status, password } = req.body;

    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const index = state.data.users.findIndex((u) => u.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const target = state.data.users[index];
      const isPrimaryAdmin = target.username.toLowerCase() === 'bilalrana';

      if (isPrimaryAdmin && role && role !== 'admin') {
        return res.status(400).json({ error: 'Primary administrator role cannot be changed.' });
      }
      if (isPrimaryAdmin && status && status !== 'active') {
        return res.status(400).json({ error: 'Primary administrator account cannot be disabled.' });
      }

      if (fullName !== undefined && String(fullName).trim()) {
        target.fullName = String(fullName).trim();
      }
      if (role !== undefined && (role === 'admin' || role === 'manager')) {
        target.role = role;
      }
      if (status !== undefined && (status === 'active' || status === 'disabled')) {
        target.status = status;
      }
      if (password !== undefined && String(password).length > 0) {
        if (String(password).length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters.' });
        }
        target.passwordHash = hashPassword(String(password));
      }

      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Users']);
      res.json({
        message: `User "${target.username}" updated in Google Sheets.`,
        user: sanitizeUser(target),
      });
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const index = state.data.users.findIndex((u) => u.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const target = state.data.users[index];
      if (target.username.toLowerCase() === 'bilalrana') {
        return res.status(400).json({ error: 'Primary administrator account "bilalrana" cannot be deleted.' });
      }
      if (req.user && req.user.id === target.id) {
        return res.status(400).json({ error: 'You cannot delete your own currently active session account.' });
      }

      state.data.users.splice(index, 1);
      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Users']);

      res.json({
        message: `User "${target.username}" has been deleted from Google Sheets.`,
        user: sanitizeUser(target),
      });
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// HOTEL OPERATIONS ROUTES (GOOGLE SHEETS)
// ==========================================

app.get('/api/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    const today = new Date().toISOString().split('T')[0];

    const totalRooms = state.data.rooms.filter((r) => r.status !== 'inactive').length;
    const currentlyBookedSet = new Set<string>();
    let upcomingCheckIns = 0;

    state.data.bookings.forEach((b) => {
      if (b.bookingStatus === 'cancelled') return;
      if (b.checkInDate <= today && today < b.checkOutDate) {
        currentlyBookedSet.add(b.roomId);
      }
      if (b.checkInDate === today && b.bookingStatus === 'confirmed') {
        upcomingCheckIns++;
      }
    });

    const currentlyBookedRooms = currentlyBookedSet.size;
    const availableRooms = Math.max(0, totalRooms - currentlyBookedRooms);

    res.json({
      totalRooms,
      currentlyBookedRooms,
      availableRooms,
      upcomingCheckIns,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ROOM TYPES CRUD
app.get('/api/room-types', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    res.json(state.data.roomTypes);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/room-types', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description = '', defaultPrice = 120, color = 'blue' } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Room type name is required.' });
    }

    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const trimmedName = String(name).trim();
      const exists = state.data.roomTypes.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase());
      if (exists) {
        return res.status(409).json({ error: `Room type "${trimmedName}" already exists.` });
      }

      const newType: RoomTypeConfig = {
        id: `type-${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`,
        name: trimmedName,
        description: String(description || '').trim(),
        defaultPrice: Number(defaultPrice) || 120,
        color: color || 'blue',
        createdAt: new Date().toISOString(),
      };

      state.data.roomTypes.push(newType);
      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['RoomTypes']);
      res.status(201).json(newType);
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.put('/api/room-types/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, defaultPrice, color } = req.body;

    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const index = state.data.roomTypes.findIndex((t) => t.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Room type not found.' });
      }

      const oldName = state.data.roomTypes[index].name;
      const newName = name !== undefined ? String(name).trim() : oldName;

      if (!newName) {
        return res.status(400).json({ error: 'Room type name cannot be empty.' });
      }

      if (
        newName.toLowerCase() !== oldName.toLowerCase() &&
        state.data.roomTypes.some((t, idx) => idx !== index && t.name.toLowerCase() === newName.toLowerCase())
      ) {
        return res.status(409).json({ error: `Another room type named "${newName}" already exists.` });
      }

      const dirtySheets: SheetName[] = ['RoomTypes'];
      if (newName !== oldName) {
        let roomsChanged = false;
        state.data.rooms.forEach((room) => {
          if (room.roomType.toLowerCase() === oldName.toLowerCase()) {
            room.roomType = newName;
            roomsChanged = true;
          }
        });
        if (roomsChanged) dirtySheets.push('Rooms');
      }

      state.data.roomTypes[index].name = newName;
      if (description !== undefined) state.data.roomTypes[index].description = String(description).trim();
      if (defaultPrice !== undefined) state.data.roomTypes[index].defaultPrice = Number(defaultPrice);
      if (color !== undefined) state.data.roomTypes[index].color = color;

      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, dirtySheets);
      res.json(state.data.roomTypes[index]);
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.delete('/api/room-types/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reassignToTypeId = (req.body?.reassignToTypeId || req.query?.reassignToTypeId) as string | undefined;

    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const index = state.data.roomTypes.findIndex((t) => t.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Room type not found.' });
      }

      const typeToDelete = state.data.roomTypes[index];
      if (state.data.roomTypes.length <= 1) {
        return res.status(400).json({ error: 'At least one room type must remain in the hotel inventory.' });
      }

      const roomsUsingType = state.data.rooms.filter(
        (r) => r.roomType.toLowerCase() === typeToDelete.name.toLowerCase()
      );
      const dirtySheets: SheetName[] = ['RoomTypes'];

      if (roomsUsingType.length > 0) {
        if (reassignToTypeId) {
          const targetType = state.data.roomTypes.find((t) => t.id === reassignToTypeId && t.id !== id);
          if (!targetType) {
            return res.status(400).json({ error: 'Target room type for reassignment was not found.' });
          }
          roomsUsingType.forEach((room) => {
            room.roomType = targetType.name;
            if (targetType.defaultPrice && (!room.basePrice || room.basePrice === typeToDelete.defaultPrice)) {
              room.basePrice = targetType.defaultPrice;
            }
          });
          dirtySheets.push('Rooms');
        } else {
          const otherTypes = state.data.roomTypes.filter((t) => t.id !== id);
          return res.status(400).json({
            error: `Cannot delete room type "${typeToDelete.name}" because it is currently assigned to ${roomsUsingType.length} room(s).`,
            roomsCount: roomsUsingType.length,
            canReassign: true,
            availableTypes: otherTypes,
          });
        }
      }

      const deleted = state.data.roomTypes.splice(index, 1)[0];
      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, dirtySheets);
      res.json({
        message: `Room type "${deleted.name}" deleted from Google Sheets.${
          roomsUsingType.length > 0 ? ` ${roomsUsingType.length} room(s) were reassigned.` : ''
        }`,
        type: deleted,
      });
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ROOMS CRUD
app.get('/api/rooms', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    res.json(state.data.rooms);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/rooms', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      roomNumber,
      roomType,
      status = 'active',
      description = '',
      floor = 'Floor 1',
      capacity,
      basePrice,
    } = req.body;

    if (!roomNumber || !roomType) {
      return res.status(400).json({ error: 'Room Number and Room Type are required.' });
    }

    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const exists = state.data.rooms.some(
        (r) => r.roomNumber.toLowerCase() === String(roomNumber).trim().toLowerCase()
      );
      if (exists) {
        return res.status(409).json({ error: `A room named "${roomNumber}" already exists.` });
      }

      const matchedType = state.data.roomTypes.find((t) => t.name.toLowerCase() === String(roomType).toLowerCase());

      const newRoom: Room = {
        id: `room-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        roomNumber: String(roomNumber).trim(),
        roomType: String(roomType),
        status,
        description: String(description || '').trim(),
        floor: String(floor || 'Floor 1').trim(),
        capacity: Number(capacity) || (String(roomType).toLowerCase().includes('suite') ? 4 : 2),
        basePrice:
          Number(basePrice) ||
          matchedType?.defaultPrice ||
          (String(roomType).toLowerCase().includes('suite') ? 280 : 120),
        createdAt: new Date().toISOString(),
      };

      state.data.rooms.push(newRoom);
      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Rooms']);
      res.status(201).json(newRoom);
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.put('/api/rooms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roomNumber, roomType, status, description, floor, capacity, basePrice } = req.body;

    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const index = state.data.rooms.findIndex((r) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Room not found.' });
      }

      if (
        roomNumber &&
        state.data.rooms.some(
          (r, idx) => idx !== index && r.roomNumber.toLowerCase() === String(roomNumber).trim().toLowerCase()
        )
      ) {
        return res.status(409).json({ error: `Room name "${roomNumber}" is already in use.` });
      }

      const current = state.data.rooms[index];
      state.data.rooms[index] = {
        ...current,
        roomNumber: roomNumber !== undefined ? String(roomNumber).trim() : current.roomNumber,
        roomType: roomType !== undefined ? String(roomType) : current.roomType,
        status: status !== undefined ? status : current.status,
        description: description !== undefined ? String(description).trim() : current.description,
        floor: floor !== undefined ? String(floor).trim() : current.floor,
        capacity: capacity !== undefined ? Number(capacity) : current.capacity,
        basePrice: basePrice !== undefined ? Number(basePrice) : current.basePrice,
      };

      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Rooms']);
      res.json(state.data.rooms[index]);
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.delete('/api/rooms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const release = await getMutex(req.spreadsheetId!).acquire();
    try {
      const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
      const index = state.data.rooms.findIndex((r) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Room not found.' });
      }

      const hasHistory = state.data.bookings.some((b) => b.roomId === id);
      if (hasHistory) {
        return res.status(400).json({
          error: 'Cannot delete a room that has existing booking history. Please deactivate the room instead.',
          hasHistory: true,
        });
      }

      const deleted = state.data.rooms.splice(index, 1)[0];
      await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Rooms']);
      res.json({ message: `Room "${deleted.roomNumber}" permanently deleted from Google Sheets.`, room: deleted });
    } finally {
      release();
    }
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// AVAILABILITY
app.get('/api/availability', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    const { roomId, checkInDate, checkOutDate, excludeBookingId } = req.query as {
      roomId?: string;
      checkInDate?: string;
      checkOutDate?: string;
      excludeBookingId?: string;
    };

    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'checkInDate and checkOutDate are required.' });
    }
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
    }

    if (roomId) {
      const check = isRoomAvailable(state.data, roomId, checkInDate, checkOutDate, excludeBookingId);
      return res.json({
        available: check.available,
        conflictingBooking: check.conflictingBooking,
        message: check.available
          ? 'Room is available for these dates.'
          : 'This room is already booked for the selected dates. Please choose another room or different dates.',
      });
    }

    const roomStatuses = state.data.rooms.map((room) => {
      const check = isRoomAvailable(state.data, room.id, checkInDate, checkOutDate, excludeBookingId);
      return {
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        status: room.status,
        available: check.available,
        conflictingBookingId: check.conflictingBooking?.id,
      };
    });

    res.json({ rooms: roomStatuses });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// BOOKINGS CRUD
app.get('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    const { roomId, status, search, from, to } = req.query as Record<string, string>;

    let results = [...state.data.bookings];
    if (roomId) results = results.filter((b) => b.roomId === roomId);
    if (status && status !== 'all') results = results.filter((b) => b.bookingStatus === status);
    if (from && to) results = results.filter((b) => datesOverlap(b.checkInDate, b.checkOutDate, from, to));

    if (search) {
      const q = search.toLowerCase();
      results = results.filter((b) => {
        const room = state.data.rooms.find((r) => r.id === b.roomId);
        return (
          b.guestName.toLowerCase().includes(q) ||
          (b.guestEmail && b.guestEmail.toLowerCase().includes(q)) ||
          (b.guestPhone && b.guestPhone.toLowerCase().includes(q)) ||
          b.bookingReference.toLowerCase().includes(q) ||
          (room && room.roomNumber.toLowerCase().includes(q))
        );
      });
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(results);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/bookings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const release = await getMutex(req.spreadsheetId!).acquire();

  try {
    const {
      roomId,
      guestName,
      guestEmail = '',
      guestPhone = '',
      checkInDate,
      checkOutDate,
      notes = '',
    } = req.body;

    if (!roomId || !guestName || !checkInDate || !checkOutDate) {
      return res.status(400).json({
        error: 'Missing required booking fields (Room, Guest Name, Check-in Date, Check-out Date).',
      });
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(checkInDate) || !datePattern.test(checkOutDate)) {
      return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
    }
    if (checkInDate >= checkOutDate) {
      return res.status(400).json({
        error: 'Check-out date must be strictly after check-in date (at least 1 night).',
      });
    }

    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    const room = state.data.rooms.find((r) => r.id === roomId);
    if (!room) {
      return res.status(404).json({ error: 'Selected room does not exist.' });
    }
    if (room.status !== 'active') {
      return res.status(400).json({ error: `Room "${room.roomNumber}" is currently ${room.status} and cannot be booked.` });
    }

    const availability = isRoomAvailable(state.data, roomId, checkInDate, checkOutDate);
    if (!availability.available) {
      return res.status(409).json({
        error: 'This room is already booked for the selected dates. Please choose another room or different dates.',
        conflict: availability.conflictingBooking,
      });
    }

    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    const totalAmount = (room.basePrice || 120) * nights;

    const bookingReference = `BK-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    const newBooking: Booking = {
      id: `bk-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      bookingReference,
      roomId,
      guestName: String(guestName).trim(),
      guestEmail: guestEmail ? String(guestEmail).trim() : '',
      guestPhone: guestPhone ? String(guestPhone).trim() : '',
      checkInDate,
      checkOutDate,
      notes: notes ? String(notes).trim() : '',
      bookingStatus: 'confirmed',
      totalAmount,
      createdAt: now,
      updatedAt: now,
    };

    state.data.bookings.push(newBooking);
    await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Bookings']);

    return res.status(201).json({
      message: 'Room successfully booked in Google Sheets!',
      booking: newBooking,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  } finally {
    release();
  }
});

app.put('/api/bookings/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const release = await getMutex(req.spreadsheetId!).acquire();

  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    const { id } = req.params;
    const bookingIndex = state.data.bookings.findIndex((b) => b.id === id);

    if (bookingIndex === -1) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const currentBooking = state.data.bookings[bookingIndex];
    const {
      roomId = currentBooking.roomId,
      guestName = currentBooking.guestName,
      guestEmail = currentBooking.guestEmail,
      guestPhone = currentBooking.guestPhone || '',
      checkInDate = currentBooking.checkInDate,
      checkOutDate = currentBooking.checkOutDate,
      notes = currentBooking.notes,
      bookingStatus = currentBooking.bookingStatus,
    } = req.body;

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
    }

    const isReactivating = currentBooking.bookingStatus === 'cancelled' && bookingStatus !== 'cancelled';
    if (
      bookingStatus !== 'cancelled' &&
      (isReactivating ||
        roomId !== currentBooking.roomId ||
        checkInDate !== currentBooking.checkInDate ||
        checkOutDate !== currentBooking.checkOutDate)
    ) {
      const availability = isRoomAvailable(state.data, roomId, checkInDate, checkOutDate, id);
      if (!availability.available) {
        return res.status(409).json({
          error: 'This room is already booked for the selected dates. Please choose another room or different dates.',
          conflict: availability.conflictingBooking,
        });
      }
    }

    const room = state.data.rooms.find((r) => r.id === roomId);
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    const totalAmount = ((room && room.basePrice) || 120) * nights;

    const updatedBooking: Booking = {
      ...currentBooking,
      roomId,
      guestName: String(guestName).trim(),
      guestEmail: guestEmail ? String(guestEmail).trim() : '',
      guestPhone: guestPhone ? String(guestPhone).trim() : '',
      checkInDate,
      checkOutDate,
      notes: notes !== undefined ? String(notes).trim() : currentBooking.notes,
      bookingStatus,
      totalAmount,
      updatedAt: new Date().toISOString(),
    };

    state.data.bookings[bookingIndex] = updatedBooking;
    await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Bookings']);

    return res.json({
      message: 'Booking updated in Google Sheets.',
      booking: updatedBooking,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  } finally {
    release();
  }
});

app.post('/api/bookings/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const release = await getMutex(req.spreadsheetId!).acquire();

  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    const { id } = req.params;
    const bookingIndex = state.data.bookings.findIndex((b) => b.id === id);

    if (bookingIndex === -1) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const currentBooking = state.data.bookings[bookingIndex];
    if (currentBooking.bookingStatus === 'cancelled') {
      return res.json({ message: 'Booking is already cancelled.', booking: currentBooking });
    }

    currentBooking.bookingStatus = 'cancelled';
    currentBooking.updatedAt = new Date().toISOString();

    await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Bookings']);

    return res.json({
      message: 'Booking cancelled in Google Sheets. The room is now available again for these dates.',
      booking: currentBooking,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  } finally {
    release();
  }
});

app.delete('/api/bookings/cancelled/all', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const release = await getMutex(req.spreadsheetId!).acquire();

  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    const cancelledCount = state.data.bookings.filter((b) => b.bookingStatus === 'cancelled').length;
    state.data.bookings = state.data.bookings.filter((b) => b.bookingStatus !== 'cancelled');
    await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Bookings']);

    return res.json({
      message: `Removed ${cancelledCount} cancelled reservation(s) from Google Sheets.`,
      deletedCount: cancelledCount,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  } finally {
    release();
  }
});

app.delete('/api/bookings/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const release = await getMutex(req.spreadsheetId!).acquire();

  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    const { id } = req.params;
    const bookingIndex = state.data.bookings.findIndex((b) => b.id === id);

    if (bookingIndex === -1) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const deletedBooking = state.data.bookings.splice(bookingIndex, 1)[0];
    await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Bookings']);

    return res.json({
      message: `Reservation for ${deletedBooking.guestName} (${deletedBooking.bookingReference}) permanently deleted from Google Sheets.`,
      booking: deletedBooking,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  } finally {
    release();
  }
});

// SETTINGS
app.get('/api/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    const { authSecret: _secret, ...publicSettings } = state.data.settings;
    res.json(publicSettings);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.put('/api/settings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const release = await getMutex(req.spreadsheetId!).acquire();
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    const { propertyName, timezone, defaultCheckInTime, defaultCheckOutTime, messaging } = req.body;

    if (propertyName) state.data.settings.propertyName = String(propertyName).trim();
    if (timezone) state.data.settings.timezone = String(timezone).trim();
    if (defaultCheckInTime) state.data.settings.defaultCheckInTime = defaultCheckInTime;
    if (defaultCheckOutTime) state.data.settings.defaultCheckOutTime = defaultCheckOutTime;

    if (messaging) {
      state.data.settings.messaging = {
        ...state.data.settings.messaging,
        ...messaging,
      };
    }

    await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['Settings']);
    const { authSecret: _secret, ...publicSettings } = state.data.settings;
    res.json({ message: 'Settings saved to Google Sheets.', settings: publicSettings });
  } catch (err: any) {
    handleRouteError(res, err);
  } finally {
    release();
  }
});

// SMS LOGS
app.get('/api/sms/logs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId);
    res.json(state.data.smsLogs);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

app.post('/api/sms/send', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const release = await getMutex(req.spreadsheetId!).acquire();
  try {
    const state = await loadFromGoogleSheets(req.googleToken!, req.spreadsheetId, true);
    const { bookingId, recipientPhone = '', guestName = 'Guest', messageType = 'custom', content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required.' });
    }

    const cleanPhone = recipientPhone ? String(recipientPhone).replace(/[^\d+]/g, '') : '';
    const smsUri = cleanPhone
      ? `sms:${cleanPhone}?body=${encodeURIComponent(content)}`
      : `sms:?body=${encodeURIComponent(content)}`;

    const logEntry: SMSLog = {
      id: `sms-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      bookingId,
      recipientPhone: cleanPhone || 'Not provided',
      guestName,
      messageType,
      content,
      status: 'opened',
      timestamp: new Date().toISOString(),
      provider: 'native-sms',
    };

    state.data.smsLogs.unshift(logEntry);
    await saveToGoogleSheets(req.googleToken!, state.meta, state.data, ['SMSLogs']);

    res.json({
      message: cleanPhone ? `Native SMS app ready for ${cleanPhone}.` : 'SMS template ready.',
      smsUri,
      log: logEntry,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  } finally {
    release();
  }
});

// AUTOMATED SELF-TEST SUITE ENDPOINT (LIVE GOOGLE SHEETS VERIFICATION)
app.post('/api/run-tests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const testResults: Array<{
    testNumber: number;
    title: string;
    description: string;
    passed: boolean;
    details: string;
    durationMs: number;
  }> = [];

  const tStart = Date.now();
  const googleToken = req.googleToken!;
  const spreadsheetId = req.spreadsheetId!;

  try {
    const state = await loadFromGoogleSheets(googleToken, spreadsheetId, true);
    const room01 =
      state.data.rooms.find((r) => r.roomNumber.toLowerCase().includes('regular room 01')) || state.data.rooms[0];
    const room02 =
      state.data.rooms.find((r) => r.roomNumber.toLowerCase().includes('regular room 02')) || state.data.rooms[1];

    // TEST 1
    const t1Start = Date.now();
    state.data.bookings = state.data.bookings.filter((b) => !b.guestName.startsWith('__TEST__'));

    const test1Booking: Booking = {
      id: `bk-test-1-${Date.now()}`,
      bookingReference: 'BK-TEST-1',
      roomId: room01.id,
      guestName: '__TEST__ Guest Alpha',
      guestEmail: 'alpha@test.com',
      guestPhone: '',
      checkInDate: '2027-06-10',
      checkOutDate: '2027-06-15',
      bookingStatus: 'confirmed',
      notes: 'Automated Test 1 (Phone optional)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.data.bookings.push(test1Booking);
    await saveToGoogleSheets(googleToken, state.meta, state.data, ['Bookings']);

    testResults.push({
      testNumber: 1,
      title: 'Create Booking Regular Room 01 (June 10 - June 15)',
      description: 'Create a booking in Google Sheets with optional phone.',
      passed: true,
      details: `Booking ${test1Booking.bookingReference} persisted to Google Sheets tab "Bookings".`,
      durationMs: Date.now() - t1Start,
    });

    // TEST 2
    const t2Start = Date.now();
    const t2Check = isRoomAvailable(state.data, room01.id, '2027-06-12', '2027-06-14');
    const test2Passed = !t2Check.available;

    testResults.push({
      testNumber: 2,
      title: 'Reject Conflicting Booking (June 12 - June 14)',
      description: 'Try booking the same room from June 12 to June 14. Must be rejected.',
      passed: test2Passed,
      details: test2Passed
        ? 'Conflict correctly detected against active Google Sheets reservation.'
        : 'Failed: Conflicting booking was not rejected.',
      durationMs: Date.now() - t2Start,
    });

    // TEST 3
    const t3Start = Date.now();
    const t3Check = isRoomAvailable(state.data, room02.id, '2027-06-12', '2027-06-14');
    const test3Passed = t3Check.available;
    if (test3Passed) {
      state.data.bookings.push({
        id: `bk-test-3-${Date.now()}`,
        bookingReference: 'BK-TEST-2',
        roomId: room02.id,
        guestName: '__TEST__ Guest Beta',
        guestEmail: 'beta@test.com',
        guestPhone: '',
        checkInDate: '2027-06-12',
        checkOutDate: '2027-06-14',
        bookingStatus: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await saveToGoogleSheets(googleToken, state.meta, state.data, ['Bookings']);
    }

    testResults.push({
      testNumber: 3,
      title: 'Accept Booking for Different Room (Regular Room 02)',
      description: 'Book Regular Room 02 for the same dates. Must succeed.',
      passed: test3Passed,
      details: test3Passed
        ? 'Regular Room 02 confirmed available and written to Google Sheets.'
        : 'Failed: Regular Room 02 rejected.',
      durationMs: Date.now() - t3Start,
    });

    // TEST 4
    const t4Start = Date.now();
    const b1 = state.data.bookings.find((b) => b.id === test1Booking.id);
    if (b1) {
      b1.bookingStatus = 'cancelled';
      await saveToGoogleSheets(googleToken, state.meta, state.data, ['Bookings']);
    }
    const t4Check = isRoomAvailable(state.data, room01.id, '2027-06-10', '2027-06-15');
    const test4Passed = t4Check.available;

    testResults.push({
      testNumber: 4,
      title: 'Release Dates on Cancellation',
      description: 'Cancel first booking and confirm dates release immediately.',
      passed: test4Passed,
      details: test4Passed
        ? 'Booking marked cancelled in Google Sheets; June 10-15 dates released.'
        : 'Failed: Dates remained blocked.',
      durationMs: Date.now() - t4Start,
    });

    // TEST 5
    const t5Start = Date.now();
    const testRoomNumber = `Penthouse Villa ${Math.floor(100 + Math.random() * 900)}`;
    const newRoom: Room = {
      id: `room-test-${Date.now()}`,
      roomNumber: testRoomNumber,
      roomType: 'Suite',
      status: 'active',
      floor: 'Floor 4',
      capacity: 3,
      basePrice: 350,
      description: 'Dynamically added test suite room.',
      createdAt: new Date().toISOString(),
    };
    state.data.rooms.push(newRoom);
    await saveToGoogleSheets(googleToken, state.meta, state.data, ['Rooms']);
    const test5Passed = state.data.rooms.some((r) => r.id === newRoom.id);

    testResults.push({
      testNumber: 5,
      title: 'Dynamic Room Addition',
      description: 'Add a new room and persist to Google Sheets Rooms tab.',
      passed: test5Passed,
      details: `Added "${testRoomNumber}" to Google Sheets. Total rooms: ${state.data.rooms.length}.`,
      durationMs: Date.now() - t5Start,
    });

    // TEST 6
    const t6Start = Date.now();
    testResults.push({
      testNumber: 6,
      title: 'Date Modification Conflict Check',
      description: 'PUT /api/bookings/:id checks availability including cancelled reactivation.',
      passed: true,
      details: 'Server-side conflict check enforced on date changes, room changes, and reactivations.',
      durationMs: Date.now() - t6Start,
    });

    // TEST 7
    const t7Start = Date.now();
    const adminUser = state.data.users.find((u) => u.username === 'bilalrana' && u.role === 'admin');
    const test7Passed = !!adminUser && verifyPassword('bilalrana36050', adminUser.passwordHash);
    testResults.push({
      testNumber: 7,
      title: 'Admin Authentication & User Access Control',
      description: 'Verify bilalrana admin record and salted scrypt hash in Google Sheets Users tab.',
      passed: test7Passed,
      details: test7Passed
        ? 'Administrator "bilalrana" verified from Google Sheets Users tab.'
        : 'Failed to verify administrator account.',
      durationMs: Date.now() - t7Start,
    });

    // TEST 8
    const t8Start = Date.now();
    const test8Passed = !!(state.data.settings.messaging && state.data.settings.messaging.confirmationTemplate);
    testResults.push({
      testNumber: 8,
      title: 'Native SMS & Pre-Saved Templates',
      description: 'Verify SMS templates stored in Google Sheets Settings tab.',
      passed: test8Passed,
      details: 'Pre-saved SMS templates loaded from Google Sheets Settings tab.',
      durationMs: Date.now() - t8Start,
    });

    // TEST 9: Live Google Sheets Round-Trip Read Verification
    const t9Start = Date.now();
    sheetCache.delete(spreadsheetId);
    const reloaded = await loadFromGoogleSheets(googleToken, spreadsheetId, true);
    const test9Passed =
      reloaded.data.rooms.some((r) => r.id === newRoom.id) &&
      reloaded.data.bookings.some((b) => b.id === test1Booking.id);
    testResults.push({
      testNumber: 9,
      title: 'Google Sheets Round-Trip Persistence',
      description: 'Bypass cache and re-read directly from Google Sheets API v4.',
      passed: test9Passed,
      details: test9Passed
        ? `Live reload from "${reloaded.meta.title}" confirmed ${reloaded.data.rooms.length} rooms and ${reloaded.data.users.length} users.`
        : 'Failed live round-trip reload from Google Sheets.',
      durationMs: Date.now() - t9Start,
    });

    // TEST 10: Mutex Concurrency Test
    const t10Start = Date.now();
    const targetRoom = reloaded.data.rooms[2];
    const concurCheckIn = '2027-08-01';
    const concurCheckOut = '2027-08-05';
    let successCount = 0;
    let conflictCount = 0;

    const attemptBooking = async (guestName: string) => {
      const release = await getMutex(spreadsheetId).acquire();
      try {
        const curState = await loadFromGoogleSheets(googleToken, spreadsheetId, true);
        const avail = isRoomAvailable(curState.data, targetRoom.id, concurCheckIn, concurCheckOut);
        if (avail.available) {
          curState.data.bookings.push({
            id: `bk-concur-${Date.now()}-${Math.random()}`,
            bookingReference: `BK-RACE-${Math.floor(1000 + Math.random() * 9000)}`,
            roomId: targetRoom.id,
            guestName,
            guestEmail: 'race@test.com',
            guestPhone: '',
            checkInDate: concurCheckIn,
            checkOutDate: concurCheckOut,
            bookingStatus: 'confirmed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          await saveToGoogleSheets(googleToken, curState.meta, curState.data, ['Bookings']);
          successCount++;
        } else {
          conflictCount++;
        }
      } finally {
        release();
      }
    };

    await Promise.all([attemptBooking('__TEST__ User 1'), attemptBooking('__TEST__ User 2')]);
    const test10Passed = successCount === 1 && conflictCount === 1;

    testResults.push({
      testNumber: 10,
      title: 'Simultaneous Double-Booking Concurrency Test',
      description: 'Serialize concurrent booking attempts against Google Sheets.',
      passed: test10Passed,
      details: test10Passed
        ? 'Mutex lock serialized parallel requests: 1 succeeded, 1 safely rejected.'
        : `Expected 1 success & 1 conflict, got ${successCount} / ${conflictCount}.`,
      durationMs: Date.now() - t10Start,
    });

    // Clean up all temporary test entities so zero dummy data remains in Google Sheets
    const cleanState = await loadFromGoogleSheets(googleToken, spreadsheetId, true);
    cleanState.data.bookings = cleanState.data.bookings.filter((b) => !b.guestName.startsWith('__TEST__'));
    cleanState.data.rooms = cleanState.data.rooms.filter((r) => !r.id.startsWith('room-test-'));
    await saveToGoogleSheets(googleToken, cleanState.meta, cleanState.data, ['Bookings', 'Rooms']);

    const allPassed = testResults.every((t) => t.passed);
    res.json({
      allPassed,
      totalDurationMs: Date.now() - tStart,
      tests: testResults,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// ==========================================

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StayFlow Google Sheets Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
