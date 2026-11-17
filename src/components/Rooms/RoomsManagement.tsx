import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BedDouble,
  Check,
  DollarSign,
  Edit2,
  Filter,
  Hotel,
  Layers,
  Loader2,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { Booking, Room, RoomStatus, RoomTypeConfig } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';
import { RoomTypesModal } from './RoomTypesModal';

interface RoomsManagementProps {
  rooms: Room[];
  roomTypes?: RoomTypeConfig[];
  bookings: Booking[];
  onRoomsUpdated: () => void;
}

export const RoomsManagement: React.FC<RoomsManagementProps> = ({
  rooms,
  roomTypes = [],
  bookings,
  onRoomsUpdated,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRoomTypesModalOpen, setIsRoomTypesModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('Regular');
  const [status, setStatus] = useState<RoomStatus>('active');
  const [floor, setFloor] = useState('Floor 1');
  const [capacity, setCapacity] = useState(2);
  const [basePrice, setBasePrice] = useState(120);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [generalFeedback, setGeneralFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [roomToToggleMaintenance, setRoomToToggleMaintenance] = useState<Room | null>(null);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);

  const handleOpenAdd = () => {
    const count = rooms.length + 1;
    const nextNum = count.toString().padStart(2, '0');
    const defaultType = roomTypes.length > 0 ? roomTypes[0] : { name: 'Regular', defaultPrice: 120 };
    setRoomNumber(`${defaultType.name} Room ${nextNum}`);
    setRoomType(defaultType.name);
    setStatus('active');
    setFloor('Floor 1');
    setCapacity(2);
    setBasePrice(defaultType.defaultPrice || 120);
    setDescription('Clean, comfortable room with queen bed and private bath.');
    setModalError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (room: Room) => {
    setEditingRoom(room);
    setRoomNumber(room.roomNumber);
    setRoomType(room.roomType);
    setStatus(room.status);
    setFloor(room.floor || 'Floor 1');
    setCapacity(room.capacity || 2);
    setBasePrice(room.basePrice || 120);
    setDescription(room.description || '');
    setModalError('');
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      setModalError('Room Number / Name is required.');
      return;
    }

    setModalError('');
    setIsConfirmSaveOpen(true);
  };

  const handleConfirmSaveRoom = async () => {
    setIsSubmitting(true);
    setModalError('');

    try {
      if (editingRoom) {
        await api.updateRoom(editingRoom.id, {
          roomNumber,
          roomType,
          status,
          floor,
          capacity: Number(capacity),
          basePrice: Number(basePrice),
          description,
        });
        setGeneralFeedback({
          type: 'success',
          message: `Room "${roomNumber}" successfully updated.`,
        });
        setEditingRoom(null);
      } else {
        await api.createRoom({
          roomNumber,
          roomType,
          status,
          floor,
          capacity: Number(capacity),
          basePrice: Number(basePrice),
          description,
        });
        setGeneralFeedback({
          type: 'success',
          message: `New room "${roomNumber}" successfully created and added to inventory.`,
        });
        setIsAddModalOpen(false);
      }

      setIsConfirmSaveOpen(false);
      onRoomsUpdated();
      setTimeout(() => setGeneralFeedback(null), 3000);
    } catch (err: any) {
      setIsConfirmSaveOpen(false);
      setModalError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMaintenance = (room: Room) => {
    setRoomToToggleMaintenance(room);
  };

  const handleConfirmToggleMaintenance = async () => {
    if (!roomToToggleMaintenance) return;
    const room = roomToToggleMaintenance;
    const newStatus: RoomStatus = room.status === 'maintenance' ? 'active' : 'maintenance';
    setIsTogglingMaintenance(true);
    try {
      await api.updateRoom(room.id, { status: newStatus });
      setRoomToToggleMaintenance(null);
      setGeneralFeedback({
        type: 'success',
        message: `${room.roomNumber} is now ${newStatus === 'active' ? 'Reactivated' : 'Under Maintenance'}.`,
      });
      onRoomsUpdated();
      setTimeout(() => setGeneralFeedback(null), 3000);
    } catch (err: any) {
      setRoomToToggleMaintenance(null);
      setGeneralFeedback({ type: 'error', message: err.message || 'Failed to update status.' });
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  const handleDeleteRoom = (room: Room) => {
    const hasHistory = bookings.some((b) => b.roomId === room.id);
    if (hasHistory) {
      setGeneralFeedback({
        type: 'error',
        message: `Cannot delete "${room.roomNumber}" because it has existing booking history. Edit the room and set its status to "Inactive" or "Maintenance" instead.`,
      });
      setTimeout(() => setGeneralFeedback(null), 5000);
      return;
    }

    setRoomToDelete(room);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsDeletingRoom(true);
    try {
      await api.deleteRoom(roomToDelete.id);
      setGeneralFeedback({
        type: 'success',
        message: `Room "${roomToDelete.roomNumber}" deleted.`,
      });
      setRoomToDelete(null);
      onRoomsUpdated();
      setTimeout(() => setGeneralFeedback(null), 3000);
    } catch (err: any) {
      setGeneralFeedback({
        type: 'error',
        message: err.message || 'Failed to delete room.',
      });
      setRoomToDelete(null);
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (typeFilter !== 'all' && r.roomType.toLowerCase() !== typeFilter.toLowerCase()) {
      return false;
    }
    if (statusFilter !== 'all' && r.status !== statusFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        r.roomNumber.toLowerCase().includes(q) ||
        r.roomType.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.floor && r.floor.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls & Summary Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Rooms Inventory</h2>
          <p className="text-xs text-slate-500">
            Total of {rooms.length} rooms in dynamic inventory (unlimited expansion)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsRoomTypesModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition"
          >
            <Layers className="h-4 w-4 text-blue-600" />
            <span>Manage Room Types</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 active:scale-95 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Room</span>
          </button>
        </div>
      </div>

      {generalFeedback && (
        <div
          className={`rounded-2xl p-3.5 text-xs font-semibold flex items-center gap-2.5 ${
            generalFeedback.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>{generalFeedback.message}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by room name, type, floor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-10 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 font-bold focus:outline-hidden"
          >
            <option value="all">All Types</option>
            {roomTypes && roomTypes.length > 0 ? (
              roomTypes.map((t) => (
                <option key={t.id} value={t.name.toLowerCase()}>
                  {t.name}
                </option>
              ))
            ) : (
              <>
                <option value="regular">Regular</option>
                <option value="suite">Suite</option>
              </>
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 font-bold focus:outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRooms.map((room) => {
          const typeConfig = roomTypes.find((t) => t.name.toLowerCase() === room.roomType.toLowerCase());
          const isSuite = room.roomType.toLowerCase().includes('suite');
          const isMaintenance = room.status === 'maintenance';
          const isInactive = room.status === 'inactive';
          const roomBookingCount = bookings.filter((b) => b.roomId === room.id).length;

          const badgeColorClass = typeConfig?.color === 'emerald'
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
              className={`rounded-3xl border p-5 shadow-xs transition-all relative flex flex-col justify-between ${
                isMaintenance
                  ? 'border-amber-200 bg-amber-50/30'
                  : isInactive
                  ? 'border-slate-200 bg-slate-50/60 opacity-70'
                  : 'border-slate-200/90 bg-white hover:border-blue-200 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      {room.roomNumber}
                    </h3>
                    <span className="text-[11px] text-slate-400 block mt-0.5 font-medium">
                      {room.floor || 'Floor 1'}
                    </span>
                  </div>

                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 border ${badgeColorClass}`}
                  >
                    {room.roomType}
                  </span>
                </div>

                <p className="mt-2.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {room.description || 'Standard hotel room with complete guest conveniences.'}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="flex items-center gap-1 font-extrabold text-slate-900">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 -mr-0.5" />
                    {room.basePrice || 120}
                    <span className="text-[10px] font-normal text-slate-400">/ night</span>
                  </span>

                  <span className="flex items-center gap-1 text-slate-500 font-medium">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>Up to {room.capacity || 2}</span>
                  </span>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {isMaintenance ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <Wrench className="h-3 w-3" /> Maintenance
                    </span>
                  ) : isInactive ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      <Power className="h-3 w-3" /> Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleMaintenance(room)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition"
                    title={isMaintenance ? 'Reactivate Room' : 'Mark as Maintenance'}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenEdit(room)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                    title="Edit room details"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteRoom(room)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    title={
                      roomBookingCount > 0
                        ? `Cannot delete (${roomBookingCount} bookings in history)`
                        : 'Delete room'
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Room Modal */}
      {(isAddModalOpen || editingRoom) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border-t sm:border border-slate-100 max-h-[92vh] overflow-y-auto">
            {/* Mobile Pull Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingRoom ? `Edit ${editingRoom.roomNumber}` : 'Add New Hotel Room'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingRoom(null);
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRoom} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Room Number / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Regular Room 19, Penthouse 01..."
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Type</label>
                  <select
                    value={roomType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setRoomType(newType);
                      // If adding new room, auto-suggest default price of selected type
                      if (!editingRoom && roomTypes) {
                        const matched = roomTypes.find((t) => t.name.toLowerCase() === newType.toLowerCase());
                        if (matched && matched.defaultPrice) {
                          setBasePrice(matched.defaultPrice);
                        }
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  >
                    {roomTypes && roomTypes.length > 0 ? (
                      roomTypes.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} (Default ${t.defaultPrice || 120}/nt)
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Regular">Regular</option>
                        <option value="Suite">Suite</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Room Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RoomStatus)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance / Unavailable</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Floor / Wing</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price / Night ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Guest Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Room Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingRoom(null);
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 font-extrabold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Room...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>{editingRoom ? 'Update Room' : 'Add Room to Inventory'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Types Management Modal */}
      {isRoomTypesModalOpen && (
        <RoomTypesModal
          roomTypes={roomTypes}
          rooms={rooms}
          onClose={() => setIsRoomTypesModalOpen(false)}
          onRoomTypesUpdated={() => {
            onRoomsUpdated();
          }}
        />
      )}

      {/* Delete Room Confirmation Modal */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete Room</h4>
                <p className="text-xs text-slate-500">
                  {roomToDelete.roomNumber} · {roomToDelete.roomType}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              Are you sure you want to permanently remove <strong className="text-slate-900">{roomToDelete.roomNumber}</strong> from the Google Sheets inventory?
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                disabled={isDeletingRoom}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRoom}
                disabled={isDeletingRoom}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeletingRoom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Delete Room</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Room Confirmation Modal */}
      <ConfirmDialog
        isOpen={isConfirmSaveOpen}
        title={editingRoom ? 'Save Room Changes?' : 'Add New Room to Google Sheets?'}
        subtitle={`${roomNumber.trim()} · ${roomType} ($${basePrice}/nt)`}
        description={
          editingRoom
            ? `Update room "${roomNumber.trim()}" (${status}) in the Google Sheets Rooms tab?`
            : `Create room "${roomNumber.trim()}" (${roomType}) in the Google Sheets Rooms tab?`
        }
        confirmLabel={editingRoom ? 'Update Room' : 'Add Room'}
        isLoading={isSubmitting}
        onConfirm={handleConfirmSaveRoom}
        onCancel={() => setIsConfirmSaveOpen(false)}
      />

      {/* Toggle Maintenance Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!roomToToggleMaintenance}
        title={
          roomToToggleMaintenance?.status === 'maintenance'
            ? 'Reactivate Room?'
            : 'Mark Room Under Maintenance?'
        }
        subtitle={roomToToggleMaintenance?.roomNumber}
        description={
          roomToToggleMaintenance?.status === 'maintenance'
            ? `Set "${roomToToggleMaintenance.roomNumber}" status back to Active in Google Sheets so guests can book it?`
            : `Set "${roomToToggleMaintenance?.roomNumber}" status to Maintenance in Google Sheets? New bookings will be blocked while under maintenance.`
        }
        confirmLabel={
          roomToToggleMaintenance?.status === 'maintenance' ? 'Reactivate Room' : 'Set Maintenance'
        }
        variant="amber"
        isLoading={isTogglingMaintenance}
        onConfirm={handleConfirmToggleMaintenance}
        onCancel={() => setRoomToToggleMaintenance(null)}
      />
    </div>
  );
};
