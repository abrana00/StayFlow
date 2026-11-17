import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  DoorClosed,
  Filter,
  Grid,
  List,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { Booking, Room, RoomTypeConfig } from '../../types';

interface BookingCalendarProps {
  rooms: Room[];
  roomTypes?: RoomTypeConfig[];
  bookings: Booking[];
  onSelectBooking: (booking: Booking) => void;
  onSelectDateSlot: (roomId: string, dateStr: string) => void;
  isFullCalendar?: boolean;
  onToggleFullCalendar?: () => void;
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  rooms,
  roomTypes,
  bookings,
  onSelectBooking,
  onSelectDateSlot,
  isFullCalendar = false,
  onToggleFullCalendar,
}) => {
  // Navigation & View state
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [mobileViewMode, setMobileViewMode] = useState<'timeline' | 'agenda'>('timeline');

  // Selected date for Daily Agenda View on mobile
  const formatLocalDate = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const todayStr = useMemo(() => {
    return formatLocalDate(new Date());
  }, []);

  const [agendaDateStr, setAgendaDateStr] = useState<string>(() => {
    return formatLocalDate(new Date());
  });

  // Collapsible room name column (allows dates to take 100% of the screen)
  const [isRoomColumnCollapsed, setIsRoomColumnCollapsed] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  // Compute days in viewing month
  const daysInMonth = useMemo(() => {
    const days: Array<{
      dateStr: string;
      dayNumber: number;
      dayOfWeek: string;
      isWeekend: boolean;
      isToday: boolean;
    }> = [];

    const numDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= numDays; day++) {
      const d = new Date(currentYear, currentMonth, day);
      const yearStr = d.getFullYear();
      const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
      const dayStr = day.toString().padStart(2, '0');
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

      const dayOfWeekIndex = d.getDay();
      const dayOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      days.push({
        dateStr,
        dayNumber: day,
        dayOfWeek: dayOfWeekNames[dayOfWeekIndex],
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  // Auto-scroll timeline to "Today" on mount or when today is clicked
  const scrollToToday = () => {
    if (!scrollContainerRef.current) return;
    const todayIndex = daysInMonth.findIndex((d) => d.dateStr === todayStr);
    if (todayIndex > 0) {
      // Cell width is approx 40px - 48px
      const targetScroll = Math.max(0, (todayIndex - 2) * 44);
      scrollContainerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToToday();
  }, [daysInMonth]);

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setViewDate(now);
    setAgendaDateStr(todayStr);
    setTimeout(scrollToToday, 50);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const filteredRooms = useMemo(() => {
    if (filterType === 'all') return rooms;
    return rooms.filter((r) => r.roomType.toLowerCase() === filterType.toLowerCase());
  }, [rooms, filterType]);

  // Bookings map for quick lookup
  const roomBookingsMap = useMemo(() => {
    const map = new Map<string, Booking[]>();
    rooms.forEach((r) => map.set(r.id, []));

    bookings.forEach((b) => {
      if (b.bookingStatus === 'cancelled') return;
      const list = map.get(b.roomId);
      if (list) list.push(b);
    });

    return map;
  }, [rooms, bookings]);

  // Order rooms: Booked rooms on top (ordered by booking date in current month), unbooked rooms below
  const orderedRooms = useMemo(() => {
    const monthStartStr = daysInMonth[0]?.dateStr || '';
    const monthEndStr = daysInMonth[daysInMonth.length - 1]?.dateStr || '';

    const bookedRoomsList: Array<{ room: Room; earliestBookingDate: string }> = [];
    const unbookedRoomsList: Room[] = [];

    filteredRooms.forEach((room) => {
      const roomBookings = (roomBookingsMap.get(room.id) || []).filter(
        (b) => b.checkInDate <= monthEndStr && b.checkOutDate > monthStartStr
      );

      if (roomBookings.length > 0) {
        const sortedB = [...roomBookings].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
        bookedRoomsList.push({
          room,
          earliestBookingDate: sortedB[0].checkInDate,
        });
      } else {
        unbookedRoomsList.push(room);
      }
    });

    // Order booked rooms by their earliest booking date in this viewing month
    bookedRoomsList.sort((a, b) => a.earliestBookingDate.localeCompare(b.earliestBookingDate));

    return [
      ...bookedRoomsList.map((item) => item.room),
      ...unbookedRoomsList,
    ];
  }, [filteredRooms, daysInMonth, roomBookingsMap]);

  // Helper to compute booking bars in the current viewing month
  const getBookingBarsForRoom = (roomId: string) => {
    const roomBookings = roomBookingsMap.get(roomId) || [];
    if (roomBookings.length === 0) return [];

    const monthStartStr = daysInMonth[0].dateStr;
    const monthEndStr = daysInMonth[daysInMonth.length - 1].dateStr;

    return roomBookings
      .filter((b) => b.checkInDate <= monthEndStr && b.checkOutDate > monthStartStr)
      .map((b) => {
        const startIndex = daysInMonth.findIndex((d) => d.dateStr === b.checkInDate);
        const actualStartIndex = startIndex !== -1 ? startIndex : 0;
        const continuesFromPrevMonth = b.checkInDate < monthStartStr;

        const endIndex = daysInMonth.findIndex((d) => d.dateStr === b.checkOutDate);
        const actualEndIndex = endIndex !== -1 ? endIndex : daysInMonth.length;
        const continuesToNextMonth = b.checkOutDate > monthEndStr;

        const spanDays = Math.max(1, actualEndIndex - actualStartIndex);

        return {
          booking: b,
          startIndex: actualStartIndex,
          spanDays,
          continuesFromPrevMonth,
          continuesToNextMonth,
        };
      });
  };

  // Helper for Daily Agenda mode: check if room is booked on agendaDateStr
  const getRoomBookingForDate = (roomId: string, dateStr: string) => {
    const roomBookings = roomBookingsMap.get(roomId) || [];
    return roomBookings.find((b) => b.checkInDate <= dateStr && dateStr < b.checkOutDate);
  };

  // Quick dates for mobile agenda carousel (5 days window)
  const agendaDatesCarousel = useMemo(() => {
    const target = parseLocalDate(agendaDateStr);
    const result = [];
    for (let offset = -2; offset <= 2; offset++) {
      const d = new Date(target.getFullYear(), target.getMonth(), target.getDate() + offset);
      const str = formatLocalDate(d);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      result.push({
        dateStr: str,
        dayNum: d.getDate(),
        dayName: dayNames[d.getDay()],
        isToday: str === todayStr,
        isSelected: str === agendaDateStr,
      });
    }
    return result;
  }, [agendaDateStr, todayStr]);

  // Render a single room row for Timeline Grid view
  const renderRoomRow = (room: Room) => {
    const isSuite = room.roomType.toLowerCase().includes('suite');
    const isMaintenance = room.status === 'maintenance';
    const bookingBars = getBookingBarsForRoom(room.id);
    const typeConfig = roomTypes?.find((t) => t.name.toLowerCase() === room.roomType.toLowerCase());

    const pillColorClass = typeConfig?.color === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : typeConfig?.color === 'purple'
      ? 'bg-purple-50 text-purple-800 border-purple-200'
      : typeConfig?.color === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : typeConfig?.color === 'rose'
      ? 'bg-rose-50 text-rose-800 border-rose-200'
      : typeConfig?.color === 'cyan'
      ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
      : isSuite
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : 'bg-blue-50 text-blue-800 border-blue-200';

    return (
      <div
        key={room.id}
        className={`flex relative group hover:bg-slate-50/70 transition-colors ${
          isMaintenance ? 'bg-amber-50/30' : ''
        }`}
      >
        {/* Professional Room Column: Room name, Floor, and Pill under Floor */}
        {!isRoomColumnCollapsed && (
          <div
            className={`w-[88px] min-w-[88px] max-w-[88px] sm:w-[124px] sm:min-w-[124px] sm:max-w-[124px] shrink-0 border-r border-slate-200 bg-white group-hover:bg-slate-50/90 px-2 sm:px-2.5 py-1.5 sticky left-0 z-30 flex flex-col justify-center shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)] overflow-hidden min-h-[58px] sm:min-h-[64px] transition-colors border-l-[3px] ${
              isMaintenance
                ? 'border-l-amber-500 bg-amber-50/20'
                : isSuite
                ? 'border-l-emerald-600'
                : 'border-l-blue-600'
            }`}
          >
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs font-black text-slate-900 truncate tracking-tight block leading-tight">
                {room.roomNumber
                  .replace(/Regular Room /i, 'Reg ')
                  .replace(/Suite Room /i, 'Suite ')
                  .replace(/Room /i, 'R ')}
              </span>
            </div>
            <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400 truncate mt-0.5 leading-tight">
              <span>{room.floor || 'Floor 1'}</span>
            </div>
            {/* Pill under Floor */}
            <div className="mt-1">
              <span
                className={`inline-block rounded-md px-1.5 py-0.5 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider border leading-none truncate max-w-full ${pillColorClass}`}
              >
                {room.roomType}
              </span>
            </div>
          </div>
        )}

        {/* Timeline Days Grid & Booking Bars */}
        <div className="relative flex flex-1">
          {daysInMonth.map((d) => (
            <div
              key={d.dateStr}
              onClick={() => {
                if (!isMaintenance) {
                  onSelectDateSlot(room.id, d.dateStr);
                }
              }}
              className={`flex-1 min-w-[34px] sm:min-w-[40px] max-w-[46px] border-r border-slate-100 min-h-[58px] sm:min-h-[64px] transition-colors relative cursor-pointer ${
                d.isToday
                  ? 'bg-blue-50/35 ring-1 ring-inset ring-blue-500/20'
                  : d.isWeekend
                  ? 'bg-slate-50/80'
                  : ''
              } hover:bg-blue-50/60`}
              title={`Click to reserve ${room.roomNumber} on ${d.dateStr}`}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 text-blue-500 transition-opacity">
                <Plus className="h-3 w-3" />
              </div>
            </div>
          ))}

          {/* Maintenance Banner */}
          {isMaintenance && (
            <div className="absolute inset-0 z-5 pointer-events-none flex items-center justify-center bg-amber-100/50 text-amber-900 text-[11px] font-extrabold uppercase tracking-wider">
              Maintenance
            </div>
          )}

          {/* Colored Reservation Bars */}
          {bookingBars.map(
            ({ booking, startIndex, spanDays, continuesFromPrevMonth, continuesToNextMonth }) => {
              const totalDays = daysInMonth.length;
              const leftPct = (startIndex / totalDays) * 100;
              const widthPct = (spanDays / totalDays) * 100;
              const isCheckedIn = booking.bookingStatus === 'checked-in';

              return (
                <div
                  key={booking.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBooking(booking);
                  }}
                  style={{
                    left: `${leftPct}%`,
                    width: `calc(${widthPct}% - 3px)`,
                  }}
                  className={`absolute top-1.5 bottom-1.5 z-10 mx-0.5 flex items-center px-2.5 cursor-pointer rounded-xl shadow-xs transition-all active:scale-98 hover:brightness-105 select-none ${
                    isSuite
                      ? isCheckedIn
                        ? 'bg-emerald-700 text-white border-l-4 border-l-amber-300'
                        : 'bg-emerald-600 text-white'
                      : isCheckedIn
                      ? 'bg-blue-700 text-white border-l-4 border-l-amber-300'
                      : 'bg-blue-600 text-white'
                  } ${continuesFromPrevMonth ? 'rounded-l-none' : ''} ${
                    continuesToNextMonth ? 'rounded-r-none' : ''
                  }`}
                  title={`${booking.guestName} (${booking.bookingReference})\n${booking.checkInDate} to ${booking.checkOutDate}\nStatus: ${booking.bookingStatus}`}
                >
                  <div className="flex w-full items-center justify-between overflow-hidden text-[11px] sm:text-xs font-semibold leading-none">
                    <span className="truncate tracking-tight">
                      {booking.guestName}
                    </span>
                    <span className="hidden md:inline-block ml-1.5 shrink-0 text-[10px] font-mono font-normal opacity-85 tabular-nums">
                      {booking.bookingReference}
                    </span>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white overflow-hidden transition-all duration-200 ${
        isFullCalendar
          ? 'fixed inset-0 z-50 rounded-none border-none flex flex-col h-screen'
          : 'relative'
      }`}
    >
      {/* Top Controls Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 sm:px-6 py-3.5 sm:py-4 bg-white">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Month & Jump Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-0.5 sm:p-1 shadow-xs">
              <button
                onClick={handlePrevMonth}
                className="rounded-xl p-1.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 sm:px-3.5 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 rounded-lg transition"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="rounded-xl p-1.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 pl-1">
              <CalendarIcon className="h-4 w-4 text-blue-600 hidden sm:inline" />
              <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                {monthNames[currentMonth]} {currentYear}
              </span>
            </div>
          </div>

          {/* Right Action Controls: View switcher & Full Calendar expand */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile View Toggle: Timeline Grid vs Agenda */}
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold">
              <button
                onClick={() => setMobileViewMode('timeline')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 transition ${
                  mobileViewMode === 'timeline'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Timeline Grid (Rooms vs Dates)"
              >
                <Grid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
              <button
                onClick={() => setMobileViewMode('agenda')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 transition ${
                  mobileViewMode === 'agenda'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Daily Room Sheet (Tap by Day)"
              >
                <List className="h-3.5 w-3.5" />
                <span>Day Sheet</span>
              </button>
            </div>

            {/* Room Type Filter */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-[11px] sm:text-xs text-slate-700 shadow-xs">
              <Filter className="h-3 w-3 text-slate-400 shrink-0" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                <option value="all">All ({rooms.length})</option>
                {roomTypes && roomTypes.length > 0 ? (
                  roomTypes.map((t) => {
                    const count = rooms.filter(
                      (r) => r.roomType.toLowerCase() === t.name.toLowerCase()
                    ).length;
                    return (
                      <option key={t.id} value={t.name.toLowerCase()}>
                        {t.name} ({count})
                      </option>
                    );
                  })
                ) : (
                  <>
                    <option value="regular">Regular ({rooms.filter((r) => r.roomType.toLowerCase() === 'regular').length})</option>
                    <option value="suite">Suite ({rooms.filter((r) => r.roomType.toLowerCase() === 'suite').length})</option>
                  </>
                )}
              </select>
            </div>

            {/* Toggle Room Column Collapse (Gives 100% full screen to dates) */}
            {mobileViewMode === 'timeline' && (
              <button
                onClick={() => setIsRoomColumnCollapsed(!isRoomColumnCollapsed)}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] sm:text-xs font-bold transition shadow-xs ${
                  isRoomColumnCollapsed
                    ? 'border-blue-600 bg-blue-600 text-white shadow-blue-500/25'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={isRoomColumnCollapsed ? 'Show Room Column' : 'Collapse Room Column (Dates take full width)'}
              >
                {isRoomColumnCollapsed ? (
                  <>
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                    <span>Show Rooms</span>
                  </>
                ) : (
                  <>
                    <PanelLeftClose className="h-3.5 w-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Collapse Column</span>
                    <span className="sm:hidden">Hide Rooms</span>
                  </>
                )}
              </button>
            )}

            {/* Expand / Collapse Fullscreen Calendar Toggle */}
            {onToggleFullCalendar && (
              <button
                onClick={onToggleFullCalendar}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                  isFullCalendar
                    ? 'border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={isFullCalendar ? 'Collapse Calendar to Standard View' : 'Expand to Full Calendar View'}
              >
                {isFullCalendar ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>Collapse</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Full Calendar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: DAILY AGENDA / ROOM SHEET (Big Tech Mobile Style) */}
      {/* ========================================================= */}
      {mobileViewMode === 'agenda' && (
        <div className="p-3 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Day Carousel Ribbon */}
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => {
                const prev = parseLocalDate(agendaDateStr);
                prev.setDate(prev.getDate() - 1);
                setAgendaDateStr(formatLocalDate(prev));
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 flex-1 justify-center">
              {agendaDatesCarousel.map((d) => (
                <button
                  key={d.dateStr}
                  onClick={() => setAgendaDateStr(d.dateStr)}
                  className={`flex flex-col items-center justify-center py-2 px-3 rounded-2xl transition-all shrink-0 ${
                    d.isSelected
                      ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-500/25 scale-105'
                      : d.isToday
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                      : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    {d.dayName}
                  </span>
                  <span className="text-sm font-black mt-0.5 tabular-nums">{d.dayNum}</span>
                  {d.isToday && !d.isSelected && (
                    <span className="h-1 w-1 rounded-full bg-blue-600 mt-0.5" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const next = parseLocalDate(agendaDateStr);
                next.setDate(next.getDate() + 1);
                setAgendaDateStr(formatLocalDate(next));
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span>Room Availability on <strong className="text-slate-800">{agendaDateStr}</strong>:</span>
            <span className="font-semibold text-blue-600">Tap room to view or book</span>
          </div>

          {/* Rooms List for Selected Date: Booked on top */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {[...filteredRooms]
              .sort((a, b) => {
                const bA = getRoomBookingForDate(a.id, agendaDateStr);
                const bB = getRoomBookingForDate(b.id, agendaDateStr);
                if (bA && !bB) return -1;
                if (!bA && bB) return 1;
                return 0;
              })
              .map((room) => {
              const activeBooking = getRoomBookingForDate(room.id, agendaDateStr);
              const isSuite = room.roomType.toLowerCase().includes('suite');
              const isMaintenance = room.status === 'maintenance';

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    if (isMaintenance) return;
                    if (activeBooking) {
                      onSelectBooking(activeBooking);
                    } else {
                      onSelectDateSlot(room.id, agendaDateStr);
                    }
                  }}
                  className={`rounded-2xl border p-3.5 transition-all flex items-center justify-between cursor-pointer ${
                    isMaintenance
                      ? 'border-amber-200 bg-amber-50/30'
                      : activeBooking
                      ? isSuite
                        ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 shadow-xs'
                        : 'border-blue-200 bg-blue-50/50 hover:bg-blue-50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl font-black text-xs ${
                        isMaintenance
                          ? 'bg-amber-100 text-amber-800'
                          : activeBooking
                          ? isSuite
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <DoorClosed className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-900">
                          {room.roomNumber}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            isSuite
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {room.roomType}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {room.floor || 'Floor 1'} • ${room.basePrice || 120}/nt
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    {isMaintenance ? (
                      <span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-extrabold text-amber-800">
                        Maintenance
                      </span>
                    ) : activeBooking ? (
                      <div>
                        <span className="block font-black text-xs text-slate-900 truncate max-w-[130px]">
                          {activeBooking.guestName}
                        </span>
                        <span className="text-[10px] font-mono text-blue-700 font-semibold">
                          {activeBooking.bookingReference}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                        <Plus className="h-3 w-3" /> Available
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: TIMELINE GRID (Horizontal scroll with collapsible) */}
      {/* ========================================================= */}
      {mobileViewMode === 'timeline' && (
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto calendar-scrollbar flex-1"
        >
          <div className="min-w-[1050px] sm:min-w-[1150px]">
            {/* Header Row: Room Label + Days */}
            <div className="flex border-b border-slate-200 bg-slate-100/95 sticky top-0 z-20">
              {!isRoomColumnCollapsed ? (
                <div className="w-[84px] min-w-[84px] max-w-[84px] sm:w-[120px] sm:min-w-[120px] sm:max-w-[120px] shrink-0 border-r border-slate-200 bg-slate-100 px-2 sm:px-2.5 py-2 font-bold text-[10px] sm:text-xs uppercase tracking-wider text-slate-600 sticky left-0 z-40 flex items-center justify-between shadow-[3px_0_8px_-2px_rgba(0,0,0,0.06)] overflow-hidden border-l-[3px] border-l-slate-400">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate font-black text-slate-800 tracking-wider">Rooms</span>
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-600">
                      {filteredRooms.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsRoomColumnCollapsed(true)}
                    className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/80 rounded transition shrink-0"
                    title="Collapse Room Column (Dates take full screen)"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                </div>
              ) : (
                <div className="sticky left-0 z-40 shrink-0">
                  <button
                    onClick={() => setIsRoomColumnCollapsed(false)}
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-2 text-[10px] sm:text-xs font-bold border-r border-slate-200 transition"
                    title="Show Room Column"
                  >
                    <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>Rooms</span>
                  </button>
                </div>
              )}

              <div className="flex flex-1">
                {daysInMonth.map((d) => (
                  <div
                    key={d.dateStr}
                    className={`flex-1 min-w-[34px] sm:min-w-[40px] max-w-[46px] border-r border-slate-200/70 py-1.5 sm:py-2 px-0.5 text-center transition-colors ${
                      d.isToday
                        ? 'bg-blue-50/90 font-bold text-blue-700 border-b-2 border-b-blue-600'
                        : d.isWeekend
                        ? 'bg-slate-200/50 text-slate-600'
                        : 'text-slate-700'
                    }`}
                  >
                    <span className="block text-[9px] sm:text-[10px] font-semibold uppercase text-slate-400">
                      {d.dayOfWeek}
                    </span>
                    <span
                      className={`inline-block text-xs font-bold tabular-nums ${
                        d.isToday
                          ? 'flex h-5 w-5 mx-auto items-center justify-center rounded-full bg-blue-600 text-white'
                          : ''
                      }`}
                    >
                      {d.dayNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Room Rows: No category sections, booked rooms placed on top ordered by booking */}
            <div className="divide-y divide-slate-100">
              {orderedRooms.map((room) => renderRoomRow(room))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Helper */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/80 bg-slate-50/70 px-4 sm:px-6 py-2.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
          <span>Tap any reservation bar to view details, or tap an empty date cell to book instantly.</span>
        </div>
        <div className="mt-1 sm:mt-0 font-medium text-slate-400 text-[11px]">
          Inclusive check-in, exclusive check-out.
        </div>
      </div>
    </div>
  );
};
