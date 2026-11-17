import React from 'react';
import {
  CalendarDays,
  Hotel,
  LayoutDashboard,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import { AuthUser } from '../types';
import { NavTab } from './Sidebar';

interface MobileBottomNavProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  openNewBookingModal: () => void;
  currentUser: AuthUser;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  openNewBookingModal,
  currentUser,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-lg border-t border-slate-200 px-2 py-1.5 pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            currentTab === 'dashboard' ? 'text-blue-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-semibold">Calendar</span>
        </button>

        <button
          onClick={() => setCurrentTab('bookings')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            currentTab === 'bookings' ? 'text-blue-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <CalendarDays className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-semibold">Bookings</span>
        </button>

        <button
          onClick={openNewBookingModal}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-md active:scale-95 transition-transform"
          aria-label="New Room Reservation"
        >
          <Plus className="h-5 w-5 stroke-[2.25]" />
        </button>

        <button
          onClick={() => setCurrentTab('rooms')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
            currentTab === 'rooms' ? 'text-blue-600 font-semibold' : 'text-slate-500'
          }`}
        >
          <Hotel className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-semibold">Rooms</span>
        </button>

        {currentUser.role === 'admin' ? (
          <button
            onClick={() => setCurrentTab('users')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
              currentTab === 'users' ? 'text-blue-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 font-semibold">Users</span>
          </button>
        ) : (
          <button
            onClick={() => setCurrentTab('settings')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors ${
              currentTab === 'settings' ? 'text-blue-600 font-semibold' : 'text-slate-500'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 font-semibold">Settings</span>
          </button>
        )}
      </div>
    </nav>
  );
};
