import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  DollarSign,
  Edit2,
  Hotel,
  Layers,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { Room, RoomTypeConfig } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface RoomTypesModalProps {
  roomTypes: RoomTypeConfig[];
  rooms: Room[];
  onClose: () => void;
  onRoomTypesUpdated: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Blue', value: 'blue', bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50 border-blue-200' },
  { label: 'Emerald', value: 'emerald', bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50 border-emerald-200' },
  { label: 'Purple', value: 'purple', bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50 border-purple-200' },
  { label: 'Amber', value: 'amber', bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50 border-amber-200' },
  { label: 'Rose', value: 'rose', bg: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50 border-rose-200' },
  { label: 'Cyan', value: 'cyan', bg: 'bg-cyan-500', text: 'text-cyan-700', light: 'bg-cyan-50 border-cyan-200' },
];

export const RoomTypesModal: React.FC<RoomTypesModalProps> = ({
  roomTypes,
  rooms,
  onClose,
  onRoomTypesUpdated,
}) => {
  const [editingType, setEditingType] = useState<RoomTypeConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultPrice, setDefaultPrice] = useState(120);
  const [color, setColor] = useState('blue');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleStartAdd = () => {
    setEditingType(null);
    setName('');
    setDescription('');
    setDefaultPrice(150);
    setColor('purple');
    setErrorMessage('');
    setSuccessMessage('');
    setIsAddingNew(true);
  };

  const handleStartEdit = (type: RoomTypeConfig) => {
    setIsAddingNew(false);
    setEditingType(type);
    setName(type.name);
    setDescription(type.description || '');
    setDefaultPrice(type.defaultPrice || 120);
    setColor(type.color || 'blue');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingType(null);
    setErrorMessage('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Room type name is required.');
      return;
    }

    setErrorMessage('');
    setIsConfirmSaveOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (editingType) {
        await api.updateRoomType(editingType.id, {
          name: name.trim(),
          description: description.trim(),
          defaultPrice: Number(defaultPrice),
          color,
        });
        setSuccessMessage(`Room type "${name.trim()}" updated successfully.`);
      } else {
        await api.createRoomType({
          name: name.trim(),
          description: description.trim(),
          defaultPrice: Number(defaultPrice),
          color,
        });
        setSuccessMessage(`New room type "${name.trim()}" created successfully.`);
      }

      setIsConfirmSaveOpen(false);
      onRoomTypesUpdated();
      handleCancelForm();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setIsConfirmSaveOpen(false);
      setErrorMessage(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deletionModalType, setDeletionModalType] = useState<RoomTypeConfig | null>(null);
  const [reassignTargetTypeId, setReassignTargetTypeId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (type: RoomTypeConfig) => {
    if (roomTypes.length <= 1) {
      setErrorMessage('You must have at least one room type in the hotel system.');
      return;
    }

    const assignedRooms = rooms.filter(
      (r) => r.roomType.toLowerCase() === type.name.toLowerCase()
    );

    const otherTypes = roomTypes.filter((t) => t.id !== type.id);
    if (otherTypes.length > 0) {
      setReassignTargetTypeId(otherTypes[0].id);
    }
    setDeletionModalType(type);
  };

  const handleConfirmDelete = async () => {
    if (!deletionModalType) return;

    const assignedRooms = rooms.filter(
      (r) => r.roomType.toLowerCase() === deletionModalType.name.toLowerCase()
    );

    setIsDeleting(true);
    try {
      const targetId = assignedRooms.length > 0 ? reassignTargetTypeId : undefined;
      const res = await api.deleteRoomType(deletionModalType.id, targetId);
      setSuccessMessage(res.message || `Room type "${deletionModalType.name}" deleted.`);
      onRoomTypesUpdated();
      if (editingType?.id === deletionModalType.id) {
        handleCancelForm();
      }
      setDeletionModalType(null);
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete room type.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border-t sm:border border-slate-100 max-h-[92vh] flex flex-col">
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Manage Room Types
              </h3>
              <p className="text-xs text-slate-500">
                All room types are fully editable (name, standard rate, accent color, and description)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {successMessage && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2 shrink-0">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Body: List + Add/Edit Form */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* Add / Edit Form Panel */}
          {(isAddingNew || editingType) && (
            <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/40 p-4 sm:p-5 mb-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-900 uppercase tracking-wider">
                  {editingType ? `Edit Room Type: ${editingType.name}` : 'Create New Room Type'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Type Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Deluxe, Penthouse, Studio..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Default Price / Night ($)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Color Theme Accent
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                            color === c.value
                              ? `${c.light} ${c.text} ring-2 ring-blue-500 ring-offset-1`
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${c.bg}`} />
                          <span>{c.label}</span>
                          {color === c.value && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spacious luxury room with balcony view..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200/50">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 font-bold text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>{editingType ? 'Update Room Type' : 'Save Room Type'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Current Room Types List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Current Room Types ({roomTypes.length})
              </span>

              {!isAddingNew && !editingType && (
                <button
                  onClick={handleStartAdd}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/70 px-2.5 py-1 rounded-xl transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Room Type</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
              {roomTypes.map((type) => {
                const assignedCount = rooms.filter(
                  (r) => r.roomType.toLowerCase() === type.name.toLowerCase()
                ).length;
                const colorConfig = COLOR_OPTIONS.find((c) => c.value === type.color) || COLOR_OPTIONS[0];

                return (
                  <div
                    key={type.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${colorConfig.light} ${colorConfig.text}`}
                      >
                        <Hotel className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-slate-900">
                            {type.name}
                          </h4>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${colorConfig.light} ${colorConfig.text}`}
                          >
                            {assignedCount} {assignedCount === 1 ? 'room' : 'rooms'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {type.description || 'Standard room inventory category.'}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 font-medium">
                          <span className="flex items-center font-bold text-slate-900">
                            <DollarSign className="h-3 w-3 text-emerald-600 -mr-0.5" />
                            {type.defaultPrice || 120}
                            <span className="text-[10px] font-normal text-slate-400">/nt default</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <button
                        onClick={() => handleStartEdit(type)}
                        className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                        title="Edit name, price, or color"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleDelete(type)}
                        disabled={roomTypes.length <= 1}
                        className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition shadow-2xs ${
                          roomTypes.length <= 1
                            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                            : 'border-slate-200 bg-white text-rose-600 hover:bg-rose-50 active:bg-rose-100'
                        }`}
                        title={
                          roomTypes.length <= 1
                            ? 'Cannot delete the only remaining room type in the hotel system.'
                            : assignedCount > 0
                            ? `Delete "${type.name}" (will allow reassigning ${assignedCount} room(s))`
                            : `Delete "${type.name}"`
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Editing a room type name will automatically update all existing rooms assigned to it.</span>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Done
          </button>
        </div>

        {/* Deletion & Reassignment Confirmation Modal */}
        {deletionModalType && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shrink-0">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">
                    Delete Room Type
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {deletionModalType.name}
                  </p>
                </div>
              </div>

              {(() => {
                const assignedRooms = rooms.filter(
                  (r) => r.roomType.toLowerCase() === deletionModalType.name.toLowerCase()
                );
                const otherTypes = roomTypes.filter((t) => t.id !== deletionModalType.id);

                return (
                  <div className="space-y-4 text-xs">
                    {assignedRooms.length > 0 ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 font-medium leading-relaxed">
                          There are currently <strong className="font-bold">{assignedRooms.length} room(s)</strong> assigned to this room type.
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1.5">
                            Reassign these {assignedRooms.length} room(s) to:
                          </label>
                          <select
                            value={reassignTargetTypeId}
                            onChange={(e) => setReassignTargetTypeId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                          >
                            {otherTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} (${t.defaultPrice || 120}/nt)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-600 font-medium">
                        Are you sure you want to delete <strong className="font-bold text-slate-900">{deletionModalType.name}</strong>? No rooms are currently assigned to this room type.
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setDeletionModalType(null)}
                        disabled={isDeleting}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        disabled={isDeleting || (assignedRooms.length > 0 && !reassignTargetTypeId)}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-rose-700 transition"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>
                              {assignedRooms.length > 0 ? 'Reassign & Delete' : 'Confirm Delete'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        <ConfirmDialog
          isOpen={isConfirmSaveOpen}
          title={editingType ? 'Update Room Type in Google Sheets?' : 'Create Room Type in Google Sheets?'}
          subtitle={`${name.trim()} ($${defaultPrice}/nt)`}
          description={
            editingType
              ? `Save changes to room type "${name.trim()}" in Google Sheets? Any rooms assigned to "${editingType.name}" will automatically update if renamed.`
              : `Add new room type "${name.trim()}" to the Google Sheets RoomTypes tab?`
          }
          confirmLabel={editingType ? 'Update Room Type' : 'Create Room Type'}
          isLoading={isSubmitting}
          onConfirm={handleConfirmSave}
          onCancel={() => setIsConfirmSaveOpen(false)}
        />
      </div>
    </div>
  );
};
