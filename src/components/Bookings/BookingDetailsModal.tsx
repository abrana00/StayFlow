import React, { useState } from 'react';
import {
  AlertCircle,
  Ban,
  Calendar,
  CheckCircle2,
  Edit2,
  Hotel,
  Mail,
  Phone,
  Smartphone,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Booking, Room } from '../../types';

interface BookingDetailsModalProps {
  booking: Booking;
  room?: Room;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  onDelete: (booking: Booking) => Promise<void> | void;
  onSendSMS: (booking: Booking) => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  booking,
  room,
  onClose,
  onEdit,
  onCancel,
  onDelete,
  onSendSMS,
}) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCancelled = booking.bookingStatus === 'cancelled';

  const d1 = new Date(booking.checkInDate);
  const d2 = new Date(booking.checkOutDate);
  const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(booking);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shrink-0">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {room ? room.roomNumber : 'Room Reservation'}
              </h3>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                {booking.bookingReference} · {room ? room.roomType : 'Standard'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 px-4 py-2.5 text-xs">
          <span className="font-medium text-slate-500">Reservation Status</span>
          {isCancelled ? (
            <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold">
              <XCircle className="h-3.5 w-3.5" /> Cancelled (Dates Released)
            </span>
          ) : booking.bookingStatus === 'checked-in' ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Checked In
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
              <Calendar className="h-3.5 w-3.5" /> Confirmed
            </span>
          )}
        </div>

        {/* Stay Summary */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-xs">
          <div>
            <span className="block text-[11px] font-medium text-slate-400">Check-in</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block tabular-nums">
              {booking.checkInDate}
            </span>
            <span className="text-[11px] text-slate-500">From 14:00</span>
          </div>

          <div>
            <span className="block text-[11px] font-medium text-slate-400">Check-out</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block tabular-nums">
              {booking.checkOutDate}
            </span>
            <span className="text-[11px] text-slate-500">Until 11:00</span>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="block text-[11px] font-medium text-slate-400">Duration</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block tabular-nums">
              {nights} {nights === 1 ? 'Night' : 'Nights'}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              ${booking.totalAmount || (room?.basePrice || 120) * nights} Est. Stay
            </span>
          </div>
        </div>

        {/* Guest Information */}
        <div className="mt-5 space-y-2.5">
          <h4 className="text-xs font-semibold text-slate-500">Guest Details</h4>

          <div className="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>Full Name</span>
              </span>
              <span className="font-semibold text-slate-900">{booking.guestName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-500">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>Phone</span>
              </span>
              <span className="font-medium text-slate-800 tabular-nums">
                {booking.guestPhone || <span className="text-slate-400 italic">Not provided</span>}
              </span>
            </div>

            {booking.guestEmail && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>Email</span>
                </span>
                <span className="text-slate-700 font-medium">{booking.guestEmail}</span>
              </div>
            )}

            {booking.notes && (
              <div className="pt-2.5 border-t border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Special Notes
                </span>
                <p className="rounded-lg bg-white p-2.5 text-slate-700 text-xs border border-slate-200/70">
                  {booking.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cancellation Confirmation Box */}
        {showCancelConfirm && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cancel this reservation?</p>
                <p className="mt-0.5 leading-relaxed">
                  Dates ({booking.checkInDate} to {booking.checkOutDate}) will be released immediately so other guests can book this room.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Booking
              </button>
              <button
                onClick={() => {
                  onCancel(booking);
                  setShowCancelConfirm(false);
                }}
                className="rounded-lg bg-amber-600 px-3.5 py-1.5 font-semibold text-white hover:bg-amber-700"
              >
                Yes, Cancel Reservation
              </button>
            </div>
          </div>
        )}

        {/* Permanent Delete Confirmation Box */}
        {showDeleteConfirm && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 space-y-3">
            <div className="flex items-start gap-2.5">
              <Trash2 className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Permanently delete this record?</p>
                <p className="mt-0.5 leading-relaxed">
                  This removes {booking.guestName} ({booking.bookingReference}) from the dashboard and Google Sheet permanently.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep Record
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSendSMS(booking)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <Smartphone className="h-4 w-4 text-blue-600" />
              <span>Send SMS</span>
            </button>

            <button
              onClick={() => {
                setShowCancelConfirm(false);
                setShowDeleteConfirm(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isCancelled && (
              <>
                <button
                  onClick={() => onEdit(booking)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setShowCancelConfirm(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>Cancel Stay</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
