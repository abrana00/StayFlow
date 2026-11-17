import React from 'react';
import {
  CalendarDays,
  Hotel,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { AuthUser } from '../types';

export type NavTab = 'dashboard' | 'bookings' | 'rooms' | 'users' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  openNewBookingModal: () => void;
  openTestSuiteModal: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  propertyName: string;
  totalRooms: number;
  currentUser: AuthUser;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  openNewBookingModal,
  openTestSuiteModal,
  isMobileOpen,
  setIsMobileOpen,
  propertyName,
  totalRooms,
  currentUser,
  onLogout,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Calendar & Occupancy',
    },
    {
      id: 'bookings',
      label: 'Room Bookings',
      icon: CalendarDays,
      description: 'New Reservations',
    },
    {
      id: 'rooms',
      label: 'Rooms Management',
      icon: Hotel,
      description: `${totalRooms} Total Rooms`,
    },
    ...(currentUser.role === 'admin'
      ? [
          {
            id: 'users' as NavTab,
            label: 'Users',
            icon: Users,
            description: 'Staff Access Control',
          },
        ]
      : []),
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Google Sheets & SMS',
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-68 flex-col border-r border-slate-800 bg-slate-950 text-slate-200 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
              <Hotel className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold tracking-tight text-white block whitespace-nowrap">
                StayFlow
              </span>
              <p className="text-xs text-slate-400 truncate">
                {propertyName || 'Azure Horizon Hotel'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick New Booking Button */}
        <div className="px-4 pt-4">
          <button
            onClick={() => {
              openNewBookingModal();
              setIsMobileOpen(false);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 active:scale-[0.99] transition whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New Reservation</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 px-3 py-5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-slate-800/90 text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <span className={`block text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* System Diagnostics & User Footer */}
        <div className="border-t border-slate-800/80 p-4 space-y-3">
          <button
            onClick={() => {
              openTestSuiteModal();
              setIsMobileOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2.5 text-left hover:bg-slate-800/80 transition"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">System Diagnostics</span>
                <span className="text-[11px] text-slate-500 block">10-point integrity check</span>
              </div>
            </div>
          </button>

          {/* Current Logged-in User + Sign Out */}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentUser.fullName}</p>
              <p className="text-[11px] text-slate-400 truncate">
                @{currentUser.username} · {currentUser.role === 'admin' ? 'Admin' : 'Manager'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
