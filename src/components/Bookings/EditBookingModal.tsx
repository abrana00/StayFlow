import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Hotel,
  Loader2,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { Booking, Room } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface EditBookingModalProps {
  booking: Booking;
  rooms: Room[];
  onClose: () => void;
  onBookingUpdated: (updatedBooking: Booking) => void;
}

export const EditBookingModal: React.FC<EditBookingModalProps> = ({
  booking,
  rooms,
  onClose,
  onBookingUpdated,
}) => {
  const [roomId, setRoomId] = useState(booking.roomId);
  const [checkInDate, setCheckInDate] = useState(booking.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(booking.checkOutDate);
  const [guestName, setGuestName] = useState(booking.guestName);
  const [guestEmail, setGuestEmail] = useState(booking.guestEmail || '');
  const [guestPhone, setGuestPhone] = useState(booking.guestPhone || ''); // OPTIONAL
  const [notes, setNotes] = useState(booking.notes || '');
  const [bookingStatus, setBookingStatus] = useState<Booking['bookingStatus']>(booking.bookingStatus);

  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(true);
  const [conflictMessage, setConflictMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!checkInDate || !checkOutDate) return;
    if (checkInDate >= checkOutDate) {
      setIsAvailable(false);
      setConflictMessage('Check-out date must be strictly after check-in date.');
      return;
    }

    let isMounted = true;
    setIsChecking(true);
    setErrorMessage('');

    api
      .checkAvailability({
        roomId,
        checkInDate,
        checkOutDate,
        excludeBookingId: booking.id,
      })
      .then((res) => {
        if (!isMounted) return;
        const avail = res.available ?? true;
        setIsAvailable(avail);
        if (!avail) {
          setConflictMessage(
            'This room is already booked for the selected dates. Please choose another room or different dates.'
          );
        } else {
          setConflictMessage('');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Availability check failed:', err);
      })
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomId, checkInDate, checkOutDate, booking.id]);

  const addDaysToDateStr = (dateStr: string, daysToAdd: number): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + daysToAdd);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setErrorMessage('Guest Name is required.');
      return;
    }
    if (bookingStatus !== 'cancelled' && isAvailable === false) {
      setErrorMessage('Room is already booked for the selected dates. Please adjust dates or room.');
      return;
    }

    setErrorMessage('');
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      const res = await api.updateBooking(booking.id, {
        roomId,
        checkInDate,
        checkOutDate,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        notes: notes.trim(),
        bookingStatus,
      });

      setIsConfirmOpen(false);
      onBookingUpdated(res.booking);
      onClose();
    } catch (err: any) {
      setIsConfirmOpen(false);
      setErrorMessage(err.message || 'Failed to update reservation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border-t sm:border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Edit Reservation</h3>
            <p className="text-xs text-slate-500 font-mono">
              Ref: {booking.bookingReference}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isAvailable === false && conflictMessage && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{conflictMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Room Assignment</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              {rooms.map((r) => {
                const isUnavailableRoom = (r.status === 'maintenance' || r.status === 'inactive') && r.id !== booking.roomId;
                return (
                  <option key={r.id} value={r.id} disabled={isUnavailableRoom}>
                    {r.roomNumber} ({r.roomType}) - ${r.basePrice || 120}/nt
                    {r.status === 'maintenance' ? ' [Maintenance]' : r.status === 'inactive' ? ' [Inactive]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Check-in Date</label>
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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Check-out Date</label>
              <input
                type="date"
                required
                min={checkInDate}
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reservation Status</label>
            <select
              value={bookingStatus}
              onChange={(e) => setBookingStatus(e.target.value as Booking['bookingStatus'])}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            >
              <option value="confirmed">Confirmed</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
              <option value="cancelled">Cancelled (Release dates)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Guest Name</label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Phone is NOT required */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Guest Phone <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Guest Email <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isAvailable === false}
              className={`flex items-center gap-1.5 rounded-2xl px-5 py-2 font-extrabold text-white shadow-md transition ${
                isAvailable === false
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Save Reservation Changes?"
        subtitle={`Ref: ${booking.bookingReference} · ${guestName.trim()}`}
        description={`Update this booking in Google Sheets with status "${bookingStatus}" for dates ${checkInDate} to ${checkOutDate}?`}
        confirmLabel="Save to Google Sheets"
        isLoading={isSaving}
        onConfirm={handleConfirmSave}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
