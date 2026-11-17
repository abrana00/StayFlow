export type RoomType = 'Regular' | 'Suite' | string;

export type UserRole = 'admin' | 'manager';
export type UserStatus = 'active' | 'disabled';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

export interface ManagedUser extends AuthUser {
  createdAt: string;
  createdBy?: string;
}

export interface RoomTypeConfig {
  id: string;
  name: string; // e.g. "Regular", "Suite"
  description?: string;
  defaultPrice?: number;
  color?: string; // "blue", "emerald", "amber", "purple", "rose", etc.
  createdAt?: string;
}

export type RoomStatus = 'active' | 'maintenance' | 'inactive';

export interface Room {
  id: string;
  roomNumber: string;
  roomType: RoomType;
  status: RoomStatus;
  description?: string;
  floor?: string;
  capacity?: number;
  basePrice?: number;
  createdAt: string;
}

export type BookingStatus = 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';

export interface Booking {
  id: string;
  bookingReference: string;
  roomId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string; // Optional
  checkInDate: string; // YYYY-MM-DD (inclusive)
  checkOutDate: string; // YYYY-MM-DD (exclusive)
  notes?: string;
  bookingStatus: BookingStatus;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessagingConfig {
  mode: 'native-sms';
  confirmationTemplate: string;
  cancellationTemplate: string;
  updateTemplate: string;
  welcomeTemplate?: string;
  wifiTemplate?: string;
}

export interface PropertySettings {
  propertyName: string;
  timezone: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  messaging: MessagingConfig;
}

export interface DriveSpreadsheetSummary {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export interface GoogleSheetStorageStatus {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  lastSyncedAt: string;
  counts: {
    rooms: number;
    roomTypes: number;
    bookings: number;
    users: number;
    smsLogs: number;
  };
}

export interface SMSLogEntry {
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

export interface DashboardStats {
  totalRooms: number;
  currentlyBookedRooms: number;
  availableRooms: number;
  upcomingCheckIns: number;
}
