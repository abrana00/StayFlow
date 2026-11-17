import React from 'react';
import { BedDouble, CalendarCheck, CheckCircle2, DoorClosed } from 'lucide-react';
import { DashboardStats } from '../../types';

interface OverviewCardsProps {
  stats: DashboardStats;
  isLoading: boolean;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ stats, isLoading }) => {
  const occupancyPct =
    stats.totalRooms > 0 ? Math.round((stats.currentlyBookedRooms / stats.totalRooms) * 100) : 0;

  const cards = [
    {
      title: 'Total Rooms',
      value: stats.totalRooms,
      meta: 'Active property inventory',
      icon: BedDouble,
      iconColor: 'text-slate-500',
    },
    {
      title: 'Currently Booked',
      value: stats.currentlyBookedRooms,
      meta: `${occupancyPct}% occupancy rate today`,
      icon: DoorClosed,
      iconColor: 'text-amber-600',
    },
    {
      title: 'Available Rooms',
      value: stats.availableRooms,
      meta: 'Ready for immediate check-in',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Upcoming Check-ins',
      value: stats.upcomingCheckIns,
      meta: 'Arrivals scheduled today',
      icon: CalendarCheck,
      iconColor: 'text-blue-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 transition-colors hover:border-slate-300"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 truncate">
                {card.title}
              </span>
              <Icon className={`h-4 w-4 shrink-0 ${card.iconColor}`} />
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {isLoading ? (
                  <span className="inline-block h-8 w-10 animate-pulse rounded bg-slate-100" />
                ) : (
                  card.value
                )}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500 truncate">{card.meta}</p>
          </div>
        );
      })}
    </div>
  );
};
