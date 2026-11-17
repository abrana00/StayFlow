import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  Hotel,
  Info,
  Loader2,
  Moon,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { Booking, Room } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface BookingScreenProps {
  rooms: Room[];
  bookings: Booking[];
  initialRoomId?: string;
  initialCheckInDate?: string;
  initialCheckOutDate?: string;
  onBookingSuccess: (newBooking: Booking) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({
  rooms,
  bookings,
  initialRoomId,
  initialCheckInDate,
  initialCheckOutDate,
  onBookingSuccess,
  onClose,
  isModal = false,
}) => {
  const addDaysToDateStr = (dateStr: string, daysToAdd: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + daysToAdd);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const todayLocalStr = () => {
    const now = new Date();
    const yy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || '');
  const [checkInDate, setCheckInDate] = useState<string>(() => {
    if (initialCheckInDate) return initialCheckInDate;
    return todayLocalStr();
  });
  const [checkOutDate, setCheckOutDate] = useState<string>(() => {
    if (initialCheckOutDate) return initialCheckOutDate;
    const baseCheckIn = initialCheckInDate || todayLocalStr();
    return addDaysToDateStr(baseCheckIn, 1);
  });
  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>(''); // OPTIONAL
  const [notes, setNotes] = useState<string>('');

  const [isCheckingAvailability, setIsCheckingAvailability] = useState<boolean>(false);
  const [isRoomAvailable, setIsRoomAvailable] = useState<boolean | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string>('');
  const [roomsAvailabilityMap, setRoomsAvailabilityMap] = useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId);
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      const firstActive = rooms.find((r) => r.status === 'active');
      if (firstActive) setSelectedRoomId(firstActive.id);
    }
  }, [rooms, selectedRoomId]);

  const nights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [checkInDate, checkOutDate]);

  const estimatedTotal = useMemo(() => {
    if (!selectedRoom || nights <= 0) return 0;
    return (selectedRoom.basePrice || 120) * nights;
  }, [selectedRoom, nights]);

  useEffect(() => {
    if (!checkInDate || !checkOutDate) return;

    if (checkInDate >= checkOutDate) {
      setIsRoomAvailable(false);
      setConflictMessage('Check-out date must be strictly after check-in date.');
      return;
    }

    let isMounted = true;
    setIsCheckingAvailability(true);
    setErrorMessage('');

    api
      .checkAvailability({
        roomId: selectedRoomId || undefined,
        checkInDate,
        checkOutDate,
      })
      .then((res) => {
        if (!isMounted) return;

        if (res.rooms) {
          const map: Record<string, boolean> = {};
          res.rooms.forEach((r) => {
            map[r.roomId] = r.available && r.status === 'active';
          });
          setRoomsAvailabilityMap(map);
        }

        if (selectedRoomId) {
          const avail = res.available ?? true;
          setIsRoomAvailable(avail);
          if (!avail) {
            setConflictMessage(
              'This room is already booked for the selected dates. Please choose another room or different dates.'
            );
          } else {
            setConflictMessage('');
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Availability check failed:', err);
      })
      .finally(() => {
        if (isMounted) setIsCheckingAvailability(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRoomId, checkInDate, checkOutDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedRoomId) {
      setErrorMessage('Please select a room.');
      return;
    }

    if (!guestName.trim()) {
      setErrorMessage('Guest Full Name is required.');
      return;
    }

    if (!checkInDate || !checkOutDate || checkInDate >= checkOutDate) {
      setErrorMessage('Valid check-in and check-out dates are required.');
      return;
    }

    if (isRoomAvailable === false) {
      setErrorMessage('This room is already booked for the selected dates. Please choose another room or different dates.');
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmCreateBooking = async () => {
    setIsSubmitting(true);

    try {
      const res = await api.createBooking({
        roomId: selectedRoomId,
        guestName,
        guestEmail,
        guestPhone, // Optional!
        checkInDate,
        checkOutDate,
        notes,
      });

      setIsConfirmOpen(false);
      setSuccessMessage('Room successfully booked!');
      setCreatedBooking(res.booking);
      onBookingSuccess(res.booking);

      setTimeout(() => {
        if (onClose) onClose();
      }, 1600);
    } catch (err: any) {
      setIsConfirmOpen(false);
      setErrorMessage(
        err.message ||
          'This room is already booked for the selected dates. Please choose another room or different dates.'
      );
      setIsRoomAvailable(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Success Notification Alert */}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="font-extrabold text-sm">{successMessage}</p>
              {createdBooking && (
                <p className="text-xs text-emerald-700">
                  Reference: <span className="font-mono font-bold">{createdBooking.bookingReference}</span> • Room: {selectedRoom?.roomNumber}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error / Conflict Alert */}
      {(errorMessage || (isRoomAvailable === false && conflictMessage)) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-xs flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <p className="font-extrabold text-sm text-rose-900">Booking Conflict Detected</p>
            <p className="mt-0.5">
              {errorMessage || conflictMessage || 'This room is already booked for the selected dates. Please choose another room or different dates.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Dates & Room */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">Dates & Room Selection</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Check-in Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={checkInDate}
                onChange={(e) => {
                  const nextIn = e.target.value;
                  setCheckInDate(nextIn);
                  if (nextIn && (!checkOutDate || nextIn >= checkOutDate)) {
                    setCheckOutDate(addDaysToDateStr(nextIn, 1));
                  }
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
              <span className="mt-1 block text-[10px] text-slate-400">Check-in day (inclusive)</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Check-out Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={checkInDate}
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
              <span className="mt-1 block text-[10px] text-slate-400">Check-out day (exclusive)</span>
            </div>
          </div>

          {nights > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-100 px-4 py-2.5 text-xs text-blue-900">
              <span className="flex items-center gap-1.5">
                <Moon className="h-4 w-4 text-blue-600" />
                <span>Length of Stay:</span>
                <strong className="font-extrabold text-blue-950">{nights} {nights === 1 ? 'Night' : 'Nights'}</strong>
              </span>
              {selectedRoom && (
                <span className="flex items-center gap-1 font-bold text-blue-900">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  Estimated: ${estimatedTotal} (${selectedRoom.basePrice || 120}/nt)
                </span>
              )}
            </div>
          )}

          {/* Room Selection Dropdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Select Room <span className="text-rose-500">*</span>
              </label>
              {isCheckingAvailability && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  Checking availability...
                </span>
              )}
            </div>

            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            >
              <option value="" disabled>-- Select an available room --</option>
              {rooms.map((r) => {
                const isAvailable = roomsAvailabilityMap[r.id] ?? (r.status === 'active');
                const isMaintenance = r.status === 'maintenance';
                return (
                  <option
                    key={r.id}
                    value={r.id}
                    disabled={!isAvailable || isMaintenance}
                  >
                    {r.roomNumber} ({r.roomType}) - ${r.basePrice || 120}/nt
                    {isMaintenance
                      ? ' [Under Maintenance]'
                      : isAvailable
                      ? ' [Available]'
                      : ' [Occupied / Conflicting Dates]'}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedRoom && (
            <div className="flex flex-wrap items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs">
              <div className="flex items-center gap-2.5">
                <Hotel className="h-4 w-4 text-blue-600" />
                <div>
                  <span className="font-extrabold text-slate-800">{selectedRoom.roomNumber}</span>
                  <span className="ml-2 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
                    {selectedRoom.roomType}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-medium">{selectedRoom.floor || 'Floor 1'}</span>
                {isRoomAvailable === true ? (
                  <span className="flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Room Available
                  </span>
                ) : isRoomAvailable === false ? (
                  <span className="flex items-center gap-1 font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5" /> Booked for these dates
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Guest Details */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <User className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">Guest Information</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Customer Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Eleanor Vance"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Customer Phone - NOT REQUIRED */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Customer Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. +1 (555) 019-2834"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Customer Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="e.g. eleanor.vance@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Additional Notes & Requests
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Early check-in requested, high floor, quiet room, late flight arrival..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden resize-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isRoomAvailable === false || nights <= 0}
            className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-xs font-extrabold text-white shadow-md transition active:scale-[0.99] ${
              isRoomAvailable === false || nights <= 0
                ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Reserving Room...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Confirm & Reserve Room</span>
              </>
            )}
          </button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Confirm New Reservation?"
        subtitle={`${selectedRoom?.roomNumber || 'Room'} · ${checkInDate} → ${checkOutDate}`}
        description={`Save this reservation for ${guestName.trim()} (${nights} ${
          nights === 1 ? 'night' : 'nights'
        }, est. $${estimatedTotal}) to Google Sheets?`}
        confirmLabel="Create Booking"
        isLoading={isSubmitting}
        onConfirm={handleConfirmCreateBooking}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
        <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border-t sm:border border-slate-100 max-h-[92vh] overflow-y-auto">
          {/* Mobile Pull Handle */}
          <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Create New Reservation</h2>
              <p className="text-xs text-slate-500">Atomic room lock prevents double-bookings</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">New Room Reservation</h2>
          <p className="text-xs text-slate-500">
            Book a room with automated availability validation and instant reservation timeline updates
          </p>
        </div>
      </div>
      {content}
    </div>
  );
};
