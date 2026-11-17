import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { GoogleSignInButton } from './components/Auth/GoogleSignInButton';
import { LoginScreen } from './components/Auth/LoginScreen';
import { BookingDetailsModal } from './components/Bookings/BookingDetailsModal';
import { BookingScreen } from './components/Bookings/BookingScreen';
import { EditBookingModal } from './components/Bookings/EditBookingModal';
import { SendSMSModal } from './components/Bookings/SendSMSModal';
import { BookingCalendar } from './components/Dashboard/BookingCalendar';
import { GuestTable } from './components/Dashboard/GuestTable';
import { OverviewCards } from './components/Dashboard/OverviewCards';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { RoomsManagement } from './components/Rooms/RoomsManagement';
import { SettingsScreen } from './components/Settings/SettingsScreen';
import { NavTab, Sidebar } from './components/Sidebar';
import { SelfTestSuiteModal } from './components/Testing/SelfTestSuiteModal';
import { UsersManagement } from './components/Users/UsersManagement';
import {
  api,
  clearAuthToken,
  getAuthToken,
  registerGoogleAuthRequiredHandler,
  registerUnauthorizedHandler,
} from './services/api';
import {
  getGoogleAccessToken,
  googleSignIn,
  googleSignOut,
  initGoogleAuth,
} from './services/googleAuth';
import {
  AuthUser,
  Booking,
  DashboardStats,
  PropertySettings,
  Room,
  RoomTypeConfig,
} from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() => !!getGoogleAccessToken());
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [connectedSheet, setConnectedSheet] = useState<{
    spreadsheetId: string;
    title: string;
    spreadsheetUrl: string;
  } | null>(null);
  const [needsGoogleReconnect, setNeedsGoogleReconnect] = useState(false);
  const [isReconnectingGoogle, setIsReconnectingGoogle] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFullCalendar, setIsFullCalendar] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeConfig[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    currentlyBookedRooms: 0,
    availableRooms: 0,
    upcomingCheckIns: 0,
  });
  const [settings, setSettings] = useState<PropertySettings>({
    propertyName: 'Azure Horizon Boutique Hotel',
    timezone: 'America/New_York',
    defaultCheckInTime: '14:00',
    defaultCheckOutTime: '11:00',
    messaging: {
      mode: 'native-sms',
      confirmationTemplate:
        'Hello {guestName}, your room booking is confirmed! Room: {roomNumber}. Check-in: {checkInDate}. Check-out: {checkOutDate}. Booking Ref: {bookingReference}. Thank you for choosing us!',
      cancellationTemplate:
        'Hello {guestName}, your booking {bookingReference} for {roomNumber} has been cancelled.',
      updateTemplate:
        'Hello {guestName}, your reservation {bookingReference} has been updated.',
      welcomeTemplate:
        'Welcome {guestName}! Check-in for {roomNumber} is open from 14:00. Ref: {bookingReference}.',
      wifiTemplate:
        'Hi {guestName}, Wi-Fi: "Azure-Guest", Password: "welcomeguest". Room: {roomNumber}.',
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bannerFeedback, setBannerFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<{
    roomId?: string;
    dateStr?: string;
  }>({});
  const [activeBookingDetails, setActiveBookingDetails] = useState<Booking | null>(null);
  const [activeBookingForEdit, setActiveBookingForEdit] = useState<Booking | null>(null);
  const [activeBookingForSMS, setActiveBookingForSMS] = useState<Booking | null>(null);
  const [isTestSuiteOpen, setIsTestSuiteOpen] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setBannerFeedback({ type, message });
    setTimeout(() => {
      setBannerFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Register global auth + Google Sheets handlers and initialize Firebase Google Auth observer
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setCurrentUser(null);
      setCurrentTab('dashboard');
    });

    registerGoogleAuthRequiredHandler(() => {
      setIsGoogleConnected(false);
      setNeedsGoogleReconnect(true);
    });

    const unsubscribe = initGoogleAuth(
      (user) => {
        setGoogleEmail(user.email);
        setIsGoogleConnected(true);
      },
      () => {
        setIsGoogleConnected(false);
      }
    );

    const token = getAuthToken();
    const googleToken = getGoogleAccessToken();
    if (!token || !googleToken) {
      setIsAuthChecking(false);
    } else {
      api
        .getMe()
        .then((res) => {
          setCurrentUser(res.user);
        })
        .catch(() => {
          clearAuthToken();
          setCurrentUser(null);
        })
        .finally(() => {
          setIsAuthChecking(false);
        });
    }

    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentUser || !getGoogleAccessToken()) return;
    setIsRefreshing(true);
    try {
      const [
        fetchedRooms,
        fetchedRoomTypes,
        fetchedBookings,
        fetchedStats,
        fetchedSettings,
      ] = await Promise.all([
        api.getRooms(),
        api.getRoomTypes(),
        api.getBookings(),
        api.getStats(),
        api.getSettings(),
      ]);

      setRooms(fetchedRooms);
      setRoomTypes(fetchedRoomTypes);
      setBookings(fetchedBookings);
      setStats(fetchedStats);
      setSettings(fetchedSettings);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && isGoogleConnected) {
      setIsLoading(true);
      fetchData();
    }
  }, [currentUser, isGoogleConnected, fetchData]);

  // Guard admin-only Users tab
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && currentTab === 'users') {
      setCurrentTab('dashboard');
    }
  }, [currentUser, currentTab]);

  const handleGoogleConnectedFromLogin = async (info: {
    email: string | null;
    spreadsheetId: string;
    title: string;
    spreadsheetUrl: string;
    propertyName?: string;
  }) => {
    setGoogleEmail(info.email);
    setConnectedSheet({
      spreadsheetId: info.spreadsheetId,
      title: info.title,
      spreadsheetUrl: info.spreadsheetUrl,
    });
    setIsGoogleConnected(true);
    setNeedsGoogleReconnect(false);
    if (info.propertyName) {
      setSettings((prev) => ({ ...prev, propertyName: info.propertyName! }));
    }

    // If a valid staff session token already exists in localStorage, verify it automatically
    if (getAuthToken()) {
      try {
        const res = await api.getMe();
        setCurrentUser(res.user);
      } catch {
        clearAuthToken();
      }
    }
  };

  const handleGoogleReconnect = async () => {
    setIsReconnectingGoogle(true);
    setReconnectError(null);
    try {
      const { user } = await googleSignIn();
      const connected = await api.connectGoogleStorage();
      setGoogleEmail(user.email);
      setConnectedSheet({
        spreadsheetId: connected.spreadsheetId,
        title: connected.title,
        spreadsheetUrl: connected.spreadsheetUrl,
      });
      setIsGoogleConnected(true);
      setNeedsGoogleReconnect(false);
      await fetchData();
      showFeedback('success', `Reconnected to Google Sheet "${connected.title}".`);
    } catch (err: any) {
      setReconnectError(err?.message || 'Failed to reconnect Google Sheets.');
    } finally {
      setIsReconnectingGoogle(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await api.logout();
    await googleSignOut();
    setCurrentUser(null);
    setIsGoogleConnected(false);
    setGoogleEmail(null);
    setConnectedSheet(null);
    setNeedsGoogleReconnect(false);
    setCurrentTab('dashboard');
    setActiveBookingDetails(null);
    setActiveBookingForEdit(null);
    setActiveBookingForSMS(null);
    setIsNewBookingModalOpen(false);
    setIsTestSuiteOpen(false);
    setIsFullCalendar(false);
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentTab('dashboard');
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setCurrentTab('dashboard');
    setActiveBookingDetails(null);
    setActiveBookingForEdit(null);
    setActiveBookingForSMS(null);
    setIsNewBookingModalOpen(false);
    setIsTestSuiteOpen(false);
    setIsFullCalendar(false);
  };

  const handleSelectDateSlot = (roomId: string, dateStr: string) => {
    setSelectedSlotForBooking({ roomId, dateStr });
    setIsNewBookingModalOpen(true);
  };

  const handleBookingCreated = () => {
    fetchData();
  };

  const handleBookingUpdated = (updatedBooking: Booking) => {
    fetchData();
    if (activeBookingDetails && activeBookingDetails.id === updatedBooking.id) {
      setActiveBookingDetails(updatedBooking);
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    try {
      const res = await api.cancelBooking(booking.id);
      await fetchData();
      if (activeBookingDetails && activeBookingDetails.id === booking.id) {
        setActiveBookingDetails(res.booking);
      }
      showFeedback('success', `Reservation ${booking.bookingReference} cancelled and dates released.`);
    } catch (err: any) {
      showFeedback('error', `Failed to cancel booking: ${err.message}`);
    }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    try {
      await api.deleteBooking(booking.id);
      if (activeBookingDetails && activeBookingDetails.id === booking.id) {
        setActiveBookingDetails(null);
      }
      await fetchData();
      showFeedback(
        'success',
        `Reservation ${booking.bookingReference} (${booking.guestName}) deleted permanently.`
      );
    } catch (err: any) {
      showFeedback('error', `Failed to delete booking: ${err.message}`);
    }
  };

  const handleDeleteAllCancelled = async () => {
    try {
      const res = await api.deleteAllCancelledBookings();
      await fetchData();
      showFeedback('success', res.message || `Deleted ${res.deletedCount} cancelled bookings.`);
    } catch (err: any) {
      showFeedback('error', `Failed to clear cancelled bookings: ${err.message}`);
    }
  };

  const getRoomForBooking = (roomId: string) => {
    return rooms.find((r) => r.id === roomId);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        <p className="text-xs font-semibold tracking-wide">Loading StayFlow workspace...</p>
      </div>
    );
  }

  if (!currentUser || !isGoogleConnected) {
    return (
      <LoginScreen
        isGoogleConnected={isGoogleConnected}
        googleEmail={googleEmail}
        connectedSheet={connectedSheet}
        onGoogleConnected={handleGoogleConnectedFromLogin}
        onGoogleDisconnect={handleGoogleDisconnect}
        onLoginSuccess={handleLoginSuccess}
        propertyName={settings.propertyName}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 antialiased font-sans overflow-x-hidden">
      {/* Desktop / Tablet Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openNewBookingModal={() => {
          setSelectedSlotForBooking({});
          setIsNewBookingModalOpen(true);
        }}
        openTestSuiteModal={() => setIsTestSuiteOpen(true)}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        propertyName={settings.propertyName}
        totalRooms={rooms.length}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          currentTab={currentTab}
          openNewBookingModal={() => {
            setSelectedSlotForBooking({});
            setIsNewBookingModalOpen(true);
          }}
          setIsMobileOpen={setIsMobileMenuOpen}
          refreshData={fetchData}
          isRefreshing={isRefreshing}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Responsive padding: pb-28 on mobile for bottom navigation bar */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-7xl w-full mx-auto pb-28 md:pb-8">
          {bannerFeedback && (
            <div
              className={`rounded-2xl border p-3.5 text-xs font-semibold flex items-center justify-between gap-2 ${
                bannerFeedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {bannerFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{bannerFeedback.message}</span>
              </div>
              <button
                onClick={() => setBannerFeedback(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* SCREEN 1: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <div className="space-y-5 sm:space-y-6">
              {/* Overview KPI Cards */}
              {!isFullCalendar && (
                <OverviewCards stats={stats} isLoading={isLoading} />
              )}

              {/* Booking Calendar */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                      Reservation Calendar
                    </h2>
                    <p className="text-xs text-slate-500">
                      Booked rooms prioritized at top. Click a reservation bar or empty date slot.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsFullCalendar(!isFullCalendar)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl transition shrink-0"
                  >
                    {isFullCalendar ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5" />
                        <span>Collapse View</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
                        <span>Full Calendar</span>
                      </>
                    )}
                  </button>
                </div>

                <BookingCalendar
                  rooms={rooms}
                  roomTypes={roomTypes}
                  bookings={bookings}
                  onSelectBooking={(b) => setActiveBookingDetails(b)}
                  onSelectDateSlot={handleSelectDateSlot}
                  isFullCalendar={isFullCalendar}
                  onToggleFullCalendar={() => setIsFullCalendar(!isFullCalendar)}
                />
              </div>

              {/* Guest Information Table */}
              {!isFullCalendar && (
                <GuestTable
                  bookings={bookings}
                  rooms={rooms}
                  onViewBooking={(b) => setActiveBookingDetails(b)}
                  onEditBooking={(b) => setActiveBookingForEdit(b)}
                  onCancelBooking={handleCancelBooking}
                  onDeleteBooking={handleDeleteBooking}
                  onDeleteAllCancelled={handleDeleteAllCancelled}
                  onSendSMS={(b) => setActiveBookingForSMS(b)}
                />
              )}
            </div>
          )}

          {/* SCREEN 2: ROOM BOOKINGS */}
          {currentTab === 'bookings' && (
            <BookingScreen
              rooms={rooms}
              bookings={bookings}
              onBookingSuccess={handleBookingCreated}
              isModal={false}
            />
          )}

          {/* SCREEN 3: ROOMS MANAGEMENT */}
          {currentTab === 'rooms' && (
            <RoomsManagement
              rooms={rooms}
              roomTypes={roomTypes}
              bookings={bookings}
              onRoomsUpdated={fetchData}
            />
          )}

          {/* SCREEN 4: USERS MANAGEMENT (Admin Only) */}
          {currentTab === 'users' && currentUser.role === 'admin' && (
            <UsersManagement currentUser={currentUser} />
          )}

          {/* SCREEN 5: SETTINGS & GOOGLE SHEETS STORAGE */}
          {currentTab === 'settings' && (
            <SettingsScreen
              settings={settings}
              currentUser={currentUser}
              googleEmail={googleEmail}
              onSettingsUpdated={(newSettings) => setSettings(newSettings)}
              onStorageChanged={fetchData}
              onDisconnectGoogle={handleGoogleDisconnect}
            />
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openNewBookingModal={() => {
          setSelectedSlotForBooking({});
          setIsNewBookingModalOpen(true);
        }}
        currentUser={currentUser}
      />

      {/* MODAL: New Booking */}
      {isNewBookingModalOpen && (
        <BookingScreen
          rooms={rooms}
          bookings={bookings}
          initialRoomId={selectedSlotForBooking.roomId}
          initialCheckInDate={selectedSlotForBooking.dateStr}
          onBookingSuccess={() => {
            handleBookingCreated();
            setIsNewBookingModalOpen(false);
          }}
          onClose={() => setIsNewBookingModalOpen(false)}
          isModal={true}
        />
      )}

      {/* MODAL: Booking Details */}
      {activeBookingDetails && (
        <BookingDetailsModal
          booking={activeBookingDetails}
          room={getRoomForBooking(activeBookingDetails.roomId)}
          onClose={() => setActiveBookingDetails(null)}
          onEdit={(b) => {
            setActiveBookingDetails(null);
            setActiveBookingForEdit(b);
          }}
          onCancel={handleCancelBooking}
          onDelete={handleDeleteBooking}
          onSendSMS={(b) => {
            setActiveBookingDetails(null);
            setActiveBookingForSMS(b);
          }}
        />
      )}

      {/* MODAL: Edit Booking Dates / Room */}
      {activeBookingForEdit && (
        <EditBookingModal
          booking={activeBookingForEdit}
          rooms={rooms}
          onClose={() => setActiveBookingForEdit(null)}
          onBookingUpdated={handleBookingUpdated}
        />
      )}

      {/* MODAL: Send Native SMS to Guest */}
      {activeBookingForSMS && (
        <SendSMSModal
          booking={activeBookingForSMS}
          room={getRoomForBooking(activeBookingForSMS.roomId)}
          messaging={settings.messaging}
          defaultCheckInTime={settings.defaultCheckInTime}
          propertyName={settings.propertyName}
          onClose={() => setActiveBookingForSMS(null)}
          onSMSSent={() => fetchData()}
        />
      )}

      {/* MODAL: 10-Point Automated Test Suite */}
      {isTestSuiteOpen && (
        <SelfTestSuiteModal
          onClose={() => setIsTestSuiteOpen(false)}
          onRefreshData={fetchData}
        />
      )}

      {/* MODAL: Reconnect Google Sheets OAuth Session */}
      {needsGoogleReconnect && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Reconnect Google Sheets Storage
                </h4>
                <p className="text-xs text-slate-500">
                  Your in-memory Google access token expired and needs renewal.
                </p>
              </div>
            </div>

            {reconnectError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{reconnectError}</span>
              </div>
            )}

            <GoogleSignInButton
              onClick={handleGoogleReconnect}
              isLoading={isReconnectingGoogle}
              label="Reconnect Google Sheets"
            />

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleGoogleDisconnect}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out to login screen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
