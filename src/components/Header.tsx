import React from 'react';
import {
  LogOut,
  Menu,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { AuthUser } from '../types';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  openNewBookingModal: () => void;
  setIsMobileOpen: (open: boolean) => void;
  refreshData: () => void;
  isRefreshing: boolean;
  currentUser: AuthUser;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  openNewBookingModal,
  setIsMobileOpen,
  refreshData,
  isRefreshing,
  currentUser,
  onLogout,
}) => {
  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Reservations Dashboard',
      subtitle: 'Room availability timeline and guest reservations',
    },
    bookings: {
      title: 'Room Bookings',
      subtitle: 'Create reservations with instant conflict protection',
    },
    rooms: {
      title: 'Rooms Management',
      subtitle: 'Dynamic inventory for Regular, Suite, and custom room types',
    },
    users: {
      title: 'Users Management',
      subtitle: 'Administrator access control for hotel staff accounts',
    },
    settings: {
      title: 'Settings & Storage',
      subtitle: 'Google Sheets storage, property details, and SMS templates',
    },
  };

  const currentInfo = titles[currentTab] || titles.dashboard;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3.5 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Toggle & Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 md:hidden shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl truncate">
              {currentInfo.title}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block truncate">{currentInfo.subtitle}</p>
          </div>
        </div>

        {/* Right: Clean Single-Line Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition whitespace-nowrap shrink-0"
            title="Sync from Google Sheets"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={openNewBookingModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Booking</span>
          </button>

          <button
            onClick={onLogout}
            className="md:hidden inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            title={`Sign out (${currentUser.username})`}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
