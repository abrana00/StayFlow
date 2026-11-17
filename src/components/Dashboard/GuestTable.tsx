import React, { useMemo, useState } from 'react';
import {
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  Loader2,
  MessageSquare,
  Phone,
  Search,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Booking, Room } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface GuestTableProps {
  bookings: Booking[];
  rooms: Room[];
  onViewBooking: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => Promise<void> | void;
  onDeleteBooking: (booking: Booking) => Promise<void> | void;
  onDeleteAllCancelled: () => Promise<void> | void;
  onSendSMS: (booking: Booking) => void;
}

export const GuestTable: React.FC<GuestTableProps> = ({
  bookings,
  rooms,
  onViewBooking,
  onEditBooking,
  onCancelBooking,
  onDeleteBooking,
  onDeleteAllCancelled,
  onSendSMS,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [isClearCancelledModalOpen, setIsClearCancelledModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // CSV Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPreset, setExportPreset] = useState<'all' | 'this-month' | 'next-30' | 'past-30' | 'custom'>('this-month');
  const [exportStartDate, setExportStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [exportEndDate, setExportEndDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [exportStatusFilter, setExportStatusFilter] = useState<string>('all');

  const roomMap = useMemo(() => {
    const map = new Map<string, Room>();
    rooms.forEach((r) => map.set(r.id, r));
    return map;
  }, [rooms]);

  const cancelledCount = useMemo(
    () => bookings.filter((b) => b.bookingStatus === 'cancelled').length,
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    let list = [...bookings];

    if (statusFilter !== 'all') {
      list = list.filter((b) => b.bookingStatus === statusFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((b) => {
        const room = roomMap.get(b.roomId);
        const roomName = room ? room.roomNumber.toLowerCase() : '';
        return (
          b.guestName.toLowerCase().includes(q) ||
          (b.guestPhone && b.guestPhone.toLowerCase().includes(q)) ||
          b.bookingReference.toLowerCase().includes(q) ||
          (b.guestEmail && b.guestEmail.toLowerCase().includes(q)) ||
          roomName.includes(q)
        );
      });
    }

    return list.sort((a, b) => {
      if (a.bookingStatus === 'cancelled' && b.bookingStatus !== 'cancelled') return 1;
      if (a.bookingStatus !== 'cancelled' && b.bookingStatus === 'cancelled') return -1;
      return b.checkInDate.localeCompare(a.checkInDate);
    });
  }, [bookings, statusFilter, searchTerm, roomMap]);

  const handleSelectPreset = (preset: 'all' | 'this-month' | 'next-30' | 'past-30' | 'custom') => {
    setExportPreset(preset);
    const now = new Date();
    if (preset === 'this-month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setExportStartDate(start);
      setExportEndDate(end);
    } else if (preset === 'next-30') {
      const start = now.toISOString().split('T')[0];
      const future = new Date(now);
      future.setDate(future.getDate() + 30);
      setExportStartDate(start);
      setExportEndDate(future.toISOString().split('T')[0]);
    } else if (preset === 'past-30') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      setExportStartDate(past.toISOString().split('T')[0]);
      setExportEndDate(now.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setExportStartDate('2000-01-01');
      setExportEndDate('2099-12-31');
    }
  };

  const exportMatchingBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (exportStatusFilter !== 'all' && b.bookingStatus !== exportStatusFilter) {
        return false;
      }
      if (exportPreset !== 'all') {
        if (exportStartDate && b.checkOutDate < exportStartDate) return false;
        if (exportEndDate && b.checkInDate > exportEndDate) return false;
      }
      return true;
    });
  }, [bookings, exportStatusFilter, exportPreset, exportStartDate, exportEndDate]);

  const handleDownloadCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Booking Reference',
      'Guest Name',
      'Email',
      'Phone',
      'Room Number',
      'Room Type',
      'Floor',
      'Check-in Date',
      'Check-out Date',
      'Nights',
      'Nightly Rate ($)',
      'Total Amount ($)',
      'Booking Status',
      'Notes',
      'Created Date',
    ];

    const rows = exportMatchingBookings.map((b) => {
      const room = roomMap.get(b.roomId);
      const d1 = new Date(b.checkInDate);
      const d2 = new Date(b.checkOutDate);
      const diff = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
      const baseRate = room?.basePrice || 120;
      const total = b.totalAmount || baseRate * diff;

      return [
        escapeCSV(b.bookingReference),
        escapeCSV(b.guestName),
        escapeCSV(b.guestEmail || ''),
        escapeCSV(b.guestPhone || ''),
        escapeCSV(room?.roomNumber || 'Unassigned'),
        escapeCSV(room?.roomType || 'Standard'),
        escapeCSV(room?.floor || ''),
        escapeCSV(b.checkInDate),
        escapeCSV(b.checkOutDate),
        diff,
        baseRate,
        total,
        escapeCSV(b.bookingStatus),
        escapeCSV(b.notes || ''),
        escapeCSV(b.createdAt.split('T')[0]),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `hotel-reservations-export-${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportModalOpen(false);
  };

  const handleConfirmCancelSingle = async () => {
    if (!bookingToCancel) return;
    setIsCancelling(true);
    try {
      await onCancelBooking(bookingToCancel);
      setBookingToCancel(null);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!bookingToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteBooking(bookingToDelete);
      setBookingToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmClearCancelled = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAllCancelled();
      setIsClearCancelledModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatus = (status: Booking['bookingStatus']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <Calendar className="h-3.5 w-3.5" /> Confirmed
          </span>
        );
      case 'checked-in':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Checked In
          </span>
        );
      case 'checked-out':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Clock className="h-3.5 w-3.5" /> Checked Out
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <XCircle className="h-3.5 w-3.5" /> Cancelled
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
      {/* Header: Title, Search, Filter Tabs, Clear Cancelled & Export CSV */}
      <div className="flex flex-col gap-3.5 border-b border-slate-200/80 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Guest Reservations</h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Showing {filteredBookings.length} of {bookings.length} reservations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {cancelledCount > 0 && (
              <button
                onClick={() => setIsClearCancelledModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition whitespace-nowrap"
                title="Permanently delete all cancelled reservations"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Cancelled ({cancelledCount})</span>
              </button>
            )}

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
              title="Export reservations by date range to CSV spreadsheet"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by guest name, email, phone, or reference (e.g. BK-12345)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9.5 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-hidden transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Segmented Status Filter */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs overflow-x-auto no-scrollbar shrink-0">
            {['all', 'confirmed', 'checked-in', 'cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1.5 font-semibold capitalize whitespace-nowrap transition ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'all' ? 'All' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================== */}
      {/* MOBILE VIEW: RESERVATION CARDS (< sm)               */}
      {/* =================================================== */}
      <div className="sm:hidden divide-y divide-slate-100">
        {filteredBookings.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-400">
            <User className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-xs">No reservations found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {bookings.length === 0
                ? 'Create a new booking from the calendar or Bookings tab.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          filteredBookings.map((b) => {
            const room = roomMap.get(b.roomId);
            const isCancelled = b.bookingStatus === 'cancelled';

            return (
              <div
                key={b.id}
                onClick={() => onViewBooking(b)}
                className={`p-4 space-y-3 transition-colors active:bg-slate-50 ${
                  isCancelled ? 'bg-slate-50/60' : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className={`font-bold text-sm truncate ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {b.guestName}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      {b.bookingReference} · {room ? room.roomNumber : 'Unassigned'}
                    </p>
                  </div>
                  <div className="shrink-0">{renderStatus(b.bookingStatus)}</div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                  <span>
                    {b.checkInDate} → {b.checkOutDate}
                  </span>
                  <span className="text-slate-400">
                    {b.guestPhone || 'No phone'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSendSMS(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                    <span>SMS</span>
                  </button>

                  {!isCancelled && (
                    <button
                      onClick={() => onEditBooking(b)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                      <span>Edit</span>
                    </button>
                  )}

                  <button
                    onClick={() => setBookingToDelete(b)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =================================================== */}
      {/* DESKTOP VIEW: CLEAN DATA TABLE (>= sm)              */}
      {/* =================================================== */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Guest</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Check-in</th>
              <th className="px-4 py-3">Check-out</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-slate-400">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
                    <User className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-slate-700">No reservations found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {bookings.length === 0
                      ? 'Your connected Google Sheet has no reservations yet. Create your first booking above.'
                      : 'Try adjusting your search query or filter tabs.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredBookings.map((b) => {
                const room = roomMap.get(b.roomId);
                const isCancelled = b.bookingStatus === 'cancelled';

                return (
                  <tr
                    key={b.id}
                    onClick={() => onViewBooking(b)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${
                      isCancelled ? 'bg-slate-50/40' : ''
                    }`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="min-w-0">
                        <span className={`font-semibold block ${isCancelled ? 'text-slate-500' : 'text-slate-900'}`}>
                          {b.guestName}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {b.bookingReference}
                          {b.guestEmail ? ` · ${b.guestEmail}` : ''}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-800 block">
                        {room ? room.roomNumber : 'Unassigned'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {room ? room.roomType : 'Standard'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {b.checkInDate}
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {b.checkOutDate}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 tabular-nums">
                      {b.guestPhone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {b.guestPhone}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {renderStatus(b.bookingStatus)}
                    </td>

                    <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onViewBooking(b)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                          title="View booking details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => onSendSMS(b)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition"
                          title="Send SMS template"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>

                        {!isCancelled && (
                          <button
                            onClick={() => onEditBooking(b)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600 transition"
                            title="Edit booking"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {!isCancelled && (
                          <button
                            onClick={() => setBookingToCancel(b)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700 transition"
                            title="Cancel booking and release dates"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setBookingToDelete(b)}
                          className={`rounded-lg p-1.5 transition ${
                            isCancelled
                              ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                              : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'
                          }`}
                          title={
                            isCancelled
                              ? 'Delete cancelled reservation permanently'
                              : 'Delete guest reservation permanently'
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Single Reservation Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  {bookingToDelete.bookingStatus === 'cancelled'
                    ? 'Delete Cancelled Reservation'
                    : 'Delete Guest Reservation'}
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  {bookingToDelete.guestName} · {bookingToDelete.bookingReference}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Are you sure you want to permanently remove this reservation ({bookingToDelete.checkInDate} to{' '}
              {bookingToDelete.checkOutDate}) from the dashboard and Google Sheet? This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBookingToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Keep Record
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Cancelled Reservations Confirmation Modal */}
      {isClearCancelledModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Clear All Cancelled Bookings</h4>
                <p className="text-xs text-slate-500">
                  {cancelledCount} cancelled reservation{cancelledCount === 1 ? '' : 's'} found
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              This will permanently delete all <strong className="text-slate-900">{cancelledCount}</strong> cancelled
              reservations from the dashboard and Google Sheets storage. Active and confirmed reservations will not be touched.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClearCancelledModalOpen(false)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearCancelled}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Delete {cancelledCount} Cancelled</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Export Reservations</h3>
                  <p className="text-xs text-slate-500">
                    Download filtered reservation records as a CSV spreadsheet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Date Range Preset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'this-month', label: 'This Month' },
                    { id: 'next-30', label: 'Next 30 Days' },
                    { id: 'past-30', label: 'Past 30 Days' },
                    { id: 'all', label: 'All Time' },
                    { id: 'custom', label: 'Custom Range' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p.id as any)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        exportPreset === p.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => {
                      setExportPreset('custom');
                      setExportStartDate(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 font-medium text-slate-800 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => {
                      setExportPreset('custom');
                      setExportEndDate(e.target.value);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 font-medium text-slate-800 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Filter by Booking Status</label>
                <select
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-semibold text-slate-800 focus:outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed Only</option>
                  <option value="checked-in">Checked-in Only</option>
                  <option value="checked-out">Checked-out Only</option>
                  <option value="cancelled">Cancelled Only</option>
                </select>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Matching Records</span>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">
                    {exportMatchingBookings.length}{' '}
                    {exportMatchingBookings.length === 1 ? 'reservation' : 'reservations'} selected
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  disabled={exportMatchingBookings.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Single Reservation Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!bookingToCancel}
        title="Cancel Reservation?"
        subtitle={
          bookingToCancel ? `${bookingToCancel.guestName} · ${bookingToCancel.bookingReference}` : undefined
        }
        description={
          bookingToCancel
            ? `This will mark reservation ${bookingToCancel.bookingReference} as cancelled in Google Sheets and immediately release dates (${bookingToCancel.checkInDate} to ${bookingToCancel.checkOutDate}).`
            : ''
        }
        confirmLabel="Yes, Cancel Reservation"
        cancelLabel="Keep Booking"
        variant="amber"
        isLoading={isCancelling}
        onConfirm={handleConfirmCancelSingle}
        onCancel={() => setBookingToCancel(null)}
      />
    </div>
  );
};
