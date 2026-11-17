import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { AuthUser, ManagedUser, UserRole, UserStatus } from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface UsersManagementProps {
  currentUser: AuthUser;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('manager');
  const [status, setStatus] = useState<UserStatus>('active');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete & Mutate Confirmation Modals
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [userToToggleStatus, setUserToToggleStatus] = useState<ManagedUser | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load user accounts.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setRole('manager');
    setStatus('active');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: ManagedUser) => {
    setEditingUser(u);
    setFullName(u.fullName);
    setUsername(u.username);
    setPassword('');
    setShowPassword(false);
    setRole(u.role);
    setStatus(u.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }

    if (!editingUser) {
      if (!username.trim()) {
        setFormError('Username is required.');
        return;
      }
      if (password.length < 6) {
        setFormError('Password must be at least 6 characters long.');
        return;
      }
    } else if (password && password.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    setFormError('');
    setIsConfirmSaveOpen(true);
  };

  const handleConfirmSaveUser = async () => {
    setIsSubmitting(true);
    try {
      if (editingUser) {
        const updates: any = {
          fullName: fullName.trim(),
          role,
          status,
        };
        if (password) updates.password = password;
        const res = await api.updateUser(editingUser.id, updates);
        setFeedback({ type: 'success', message: res.message });
      } else {
        const res = await api.createUser({
          username: username.trim(),
          password,
          fullName: fullName.trim(),
          role,
        });
        setFeedback({ type: 'success', message: res.message });
      }
      setIsConfirmSaveOpen(false);
      setIsModalOpen(false);
      await loadUsers();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setIsConfirmSaveOpen(false);
      setFormError(err.message || 'Failed to save user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (u: ManagedUser) => {
    setUserToToggleStatus(u);
  };

  const handleConfirmToggleStatus = async () => {
    if (!userToToggleStatus) return;
    const u = userToToggleStatus;
    const nextStatus: UserStatus = u.status === 'active' ? 'disabled' : 'active';
    setIsTogglingStatus(true);
    try {
      const res = await api.updateUser(u.id, { status: nextStatus });
      setUserToToggleStatus(null);
      setFeedback({ type: 'success', message: res.message });
      await loadUsers();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setUserToToggleStatus(null);
      setFeedback({ type: 'error', message: err.message || 'Failed to update status.' });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteUser(userToDelete.id);
      setFeedback({ type: 'success', message: res.message });
      setUserToDelete(null);
      await loadUsers();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete user.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalManagers = users.filter((u) => u.role === 'manager').length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`rounded-2xl border p-4 text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Staff Accounts</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 tabular-nums">{users.length}</div>
          <p className="mt-1 text-xs text-slate-500">Stored in Google Sheets Users tab</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Administrators & Managers</span>
            <Shield className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 tabular-nums">
            {totalAdmins} <span className="text-sm font-medium text-slate-400">/ {totalManagers}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {totalAdmins} Admin · {totalManagers} Staff Manager{totalManagers === 1 ? '' : 's'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Active Access</span>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 tabular-nums">{activeCount}</div>
          <p className="mt-1 text-xs text-slate-500">Authorized to log in</p>
        </div>
      </div>

      {/* Main User Directory Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">User Access Directory</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Only Administrators can add, modify, disable, or delete staff accounts. Public sign-up is disabled.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition shrink-0 whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add New User</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading user accounts...</span>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {users.map((u) => {
                const isPrimaryAdmin = u.username.toLowerCase() === 'bilalrana';
                const isSelf = u.id === currentUser.id;
                return (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{u.fullName}</p>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">@{u.username}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          u.status === 'active' ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {u.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {u.role === 'admin' ? 'Administrator' : 'Staff Manager'}
                      </span>
                      <span>·</span>
                      <span>Created {new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>

                      {!isPrimaryAdmin && !isSelf && (
                        <button
                          onClick={() => setUserToDelete(u)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Full Name</th>
                    <th className="px-4 py-3.5">Username</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Created</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isPrimaryAdmin = u.username.toLowerCase() === 'bilalrana';
                    const isSelf = u.id === currentUser.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">
                                {u.fullName}
                                {isSelf && (
                                  <span className="ml-2 text-[11px] font-normal text-blue-600">(You)</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-slate-700">@{u.username}</td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold ${
                              u.role === 'admin' ? 'text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <Shield className="h-3.5 w-3.5" />
                            {u.role === 'admin' ? 'Administrator' : 'Staff Manager'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => !isPrimaryAdmin && handleToggleStatus(u)}
                            disabled={isPrimaryAdmin}
                            className={`text-xs font-semibold ${
                              u.status === 'active'
                                ? 'text-emerald-700 hover:underline'
                                : 'text-slate-400 hover:underline'
                            } ${isPrimaryAdmin ? 'cursor-default no-underline' : 'cursor-pointer'}`}
                            title={isPrimaryAdmin ? 'Primary admin is always active' : 'Click to toggle active/disabled'}
                          >
                            {u.status === 'active' ? 'Active' : 'Disabled'}
                          </button>
                        </td>

                        <td className="px-4 py-3.5 text-slate-500 tabular-nums">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                              title="Edit details or reset password"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                              <span>Edit</span>
                            </button>

                            {!isPrimaryAdmin && !isSelf && (
                              <button
                                onClick={() => setUserToDelete(u)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                                title="Delete user account"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                  {editingUser ? <KeyRound className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingUser ? `Edit User: @${editingUser.username}` : 'Add New Staff User'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingUser
                      ? 'Update profile, access role, or set a new password'
                      : 'Create login credentials for hotel staff management'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sarah Ahmed"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. frontdesk01"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-sm font-mono font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? 'Enter new password to reset' : 'Minimum 6 characters'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 pr-10 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    disabled={editingUser?.username.toLowerCase() === 'bilalrana'}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-hidden disabled:bg-slate-100"
                  >
                    <option value="manager">Staff Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                {editingUser && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as UserStatus)}
                      disabled={editingUser.username.toLowerCase() === 'bilalrana'}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-hidden disabled:bg-slate-100"
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>{editingUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete User Account</h4>
                <p className="text-xs text-slate-500">
                  {userToDelete.fullName} (@{userToDelete.username})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              This will permanently revoke access and remove <strong className="text-slate-900">@{userToDelete.username}</strong> from the Google Sheets user directory.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Delete User</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save User Confirmation Modal */}
      <ConfirmDialog
        isOpen={isConfirmSaveOpen}
        title={editingUser ? 'Save Staff Account Changes?' : 'Create Staff Account in Google Sheets?'}
        subtitle={`@${editingUser ? editingUser.username : username.trim()} · ${
          role === 'admin' ? 'Administrator' : 'Staff Manager'
        }`}
        description={
          editingUser
            ? `Update "${fullName.trim()}" (@${editingUser.username}) in the Google Sheets Users tab?`
            : `Provision login access for "${fullName.trim()}" (@${username.trim()}) in the Google Sheets Users tab?`
        }
        confirmLabel={editingUser ? 'Save Changes' : 'Create User'}
        isLoading={isSubmitting}
        onConfirm={handleConfirmSaveUser}
        onCancel={() => setIsConfirmSaveOpen(false)}
      />

      {/* Toggle Status Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!userToToggleStatus}
        title={
          userToToggleStatus?.status === 'active' ? 'Disable Staff Account?' : 'Enable Staff Account?'
        }
        subtitle={userToToggleStatus ? `@${userToToggleStatus.username}` : undefined}
        description={
          userToToggleStatus?.status === 'active'
            ? `Disable @${userToToggleStatus.username} in Google Sheets? They will no longer be able to sign in.`
            : `Re-enable @${userToToggleStatus?.username} in Google Sheets so they can sign in?`
        }
        confirmLabel={userToToggleStatus?.status === 'active' ? 'Disable Account' : 'Enable Account'}
        variant="amber"
        isLoading={isTogglingStatus}
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setUserToToggleStatus(null)}
      />
    </div>
  );
};
