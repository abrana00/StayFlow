import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  FolderOpen,
  Hotel,
  Loader2,
  LogOut,
  RefreshCw,
  Smartphone,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  AuthUser,
  DriveSpreadsheetSummary,
  GoogleSheetStorageStatus,
  PropertySettings,
  SMSLogEntry,
} from '../../types';
import { ConfirmDialog } from '../ConfirmDialog';

interface SettingsScreenProps {
  settings: PropertySettings;
  currentUser: AuthUser;
  googleEmail?: string | null;
  onSettingsUpdated: (newSettings: PropertySettings) => void;
  onStorageChanged: () => void;
  onDisconnectGoogle: () => Promise<void> | void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  currentUser,
  googleEmail,
  onSettingsUpdated,
  onStorageChanged,
  onDisconnectGoogle,
}) => {
  const [propertyName, setPropertyName] = useState(settings.propertyName);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [defaultCheckInTime, setDefaultCheckInTime] = useState(settings.defaultCheckInTime);
  const [defaultCheckOutTime, setDefaultCheckOutTime] = useState(settings.defaultCheckOutTime);

  // Pre-saved Messaging Templates
  const [confirmationTemplate, setConfirmationTemplate] = useState(
    settings.messaging?.confirmationTemplate || ''
  );
  const [cancellationTemplate, setCancellationTemplate] = useState(
    settings.messaging?.cancellationTemplate || ''
  );
  const [updateTemplate, setUpdateTemplate] = useState(
    settings.messaging?.updateTemplate || ''
  );
  const [welcomeTemplate, setWelcomeTemplate] = useState(
    settings.messaging?.welcomeTemplate || ''
  );
  const [wifiTemplate, setWifiTemplate] = useState(
    settings.messaging?.wifiTemplate || ''
  );

  const [smsLogs, setSmsLogs] = useState<SMSLogEntry[]>([]);
  const [storageStatus, setStorageStatus] = useState<GoogleSheetStorageStatus | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation dialogs
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  // Sheet Switcher Modal
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [driveSheets, setDriveSheets] = useState<DriveSpreadsheetSummary[]>([]);
  const [isLoadingDriveSheets, setIsLoadingDriveSheets] = useState(false);
  const [pendingSwitchSheet, setPendingSwitchSheet] = useState<DriveSpreadsheetSummary | null>(null);
  const [isSwitchingSheet, setIsSwitchingSheet] = useState(false);

  // Create New Sheet Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('StayFlow Hotel Data');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  useEffect(() => {
    setPropertyName(settings.propertyName);
    setTimezone(settings.timezone);
    setDefaultCheckInTime(settings.defaultCheckInTime);
    setDefaultCheckOutTime(settings.defaultCheckOutTime);
    setConfirmationTemplate(settings.messaging?.confirmationTemplate || '');
    setCancellationTemplate(settings.messaging?.cancellationTemplate || '');
    setUpdateTemplate(settings.messaging?.updateTemplate || '');
    setWelcomeTemplate(settings.messaging?.welcomeTemplate || '');
    setWifiTemplate(settings.messaging?.wifiTemplate || '');
  }, [settings]);

  const fetchLogsAndStorage = async () => {
    setIsLoadingStorage(true);
    try {
      const [logs, storage] = await Promise.all([
        api.getSMSLogs(),
        api.getStorageStatus(),
      ]);
      setSmsLogs(logs);
      setStorageStatus(storage);
    } catch (err: any) {
      console.error('Failed to load settings metadata:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Unable to fetch Google Sheets status.',
      });
    } finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    fetchLogsAndStorage();
  }, []);

  const handleSyncNow = async () => {
    await fetchLogsAndStorage();
    onStorageChanged();
    setFeedback({
      type: 'success',
      message: 'Synchronized data directly from Google Sheets.',
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleOpenSwitchSheet = async () => {
    setIsSwitchModalOpen(true);
    setIsLoadingDriveSheets(true);
    try {
      const sheets = await api.listDriveSpreadsheets();
      setDriveSheets(sheets);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to list Google Sheets from Drive.',
      });
      setIsSwitchModalOpen(false);
    } finally {
      setIsLoadingDriveSheets(false);
    }
  };

  const handleConfirmSwitchSheet = async () => {
    if (!pendingSwitchSheet) return;
    setIsSwitchingSheet(true);
    try {
      const res = await api.selectSpreadsheet(pendingSwitchSheet.id);
      setStorageStatus(res.status);
      setPendingSwitchSheet(null);
      setIsSwitchModalOpen(false);
      onStorageChanged();
      await fetchLogsAndStorage();
      setFeedback({
        type: 'success',
        message: res.message || `Switched storage to "${res.status.title}".`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to switch Google Sheet.',
      });
    } finally {
      setIsSwitchingSheet(false);
    }
  };

  const handleConfirmCreateSheet = async () => {
    setIsCreatingSheet(true);
    try {
      const title = newSheetTitle.trim() || 'StayFlow Hotel Data';
      const res = await api.createSpreadsheet(title);
      setStorageStatus(res.status);
      setConfirmCreateOpen(false);
      setIsCreateModalOpen(false);
      onStorageChanged();
      await fetchLogsAndStorage();
      setFeedback({
        type: 'success',
        message: res.message || `Created new Google Sheet "${res.status.title}".`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to create Google Sheet.',
      });
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleRequestSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmSaveOpen(true);
  };

  const handleConfirmSaveAll = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await api.updateSettings({
        propertyName,
        timezone,
        defaultCheckInTime,
        defaultCheckOutTime,
        messaging: {
          mode: 'native-sms',
          confirmationTemplate,
          cancellationTemplate,
          updateTemplate,
          welcomeTemplate,
          wifiTemplate,
        },
      });

      onSettingsUpdated(res.settings);
      setConfirmSaveOpen(false);
      setFeedback({
        type: 'success',
        message: 'All property settings and SMS templates saved to Google Sheets.',
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Error saving settings: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {feedback && (
        <div
          className={`rounded-2xl border p-4 text-xs font-semibold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Card 1: Google Sheets Storage (Primary Database) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Google Sheets Storage
              </h3>
              <p className="text-xs text-slate-500 truncate">
                All rooms, room types, reservations, users, and settings persist in{' '}
                <strong className="font-semibold text-slate-700">
                  {storageStatus?.title || 'StayFlow Hotel Data'}
                </strong>
                {googleEmail ? ` · ${googleEmail}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {storageStatus?.spreadsheetUrl && (
              <a
                href={storageStatus.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Google Sheet</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isLoadingStorage}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingStorage ? 'animate-spin text-blue-600' : ''}`} />
              <span>Sync Now</span>
            </button>
          </div>
        </div>

        {storageStatus && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                <span className="text-[11px] text-slate-500 block">Rooms Tab</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {storageStatus.counts.rooms}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                <span className="text-[11px] text-slate-500 block">Bookings Tab</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {storageStatus.counts.bookings}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                <span className="text-[11px] text-slate-500 block">RoomTypes Tab</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {storageStatus.counts.roomTypes}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                <span className="text-[11px] text-slate-500 block">Users Tab</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {storageStatus.counts.users}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-xs">
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] text-slate-500 truncate">
                  Spreadsheet ID:{' '}
                  <code className="font-mono font-semibold text-slate-700">
                    {storageStatus.spreadsheetId}
                  </code>
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  Last synced: {new Date(storageStatus.lastSyncedAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {currentUser.role === 'admin' && (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenSwitchSheet}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
                      <span>Switch Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSheetTitle('StayFlow Hotel Data');
                        setIsCreateModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <FilePlus2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Create New Sheet</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setConfirmDisconnectOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Switch Google Account</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <form onSubmit={handleRequestSaveAll} className="space-y-6">
        {/* Card 2: Property Settings */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Hotel className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Property Details</h3>
              <p className="text-xs text-slate-500">Configure your hotel branding and check-in schedule</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Hotel / Property Name
              </label>
              <input
                type="text"
                required
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Check-in Time
              </label>
              <input
                type="time"
                value={defaultCheckInTime}
                onChange={(e) => setDefaultCheckInTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-hidden tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Check-out Time
              </label>
              <input
                type="time"
                value={defaultCheckOutTime}
                onChange={(e) => setDefaultCheckOutTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-hidden tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Pre-Saved Native SMS Templates */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Pre-Saved SMS Templates
              </h3>
              <p className="text-xs text-slate-500">
                Opens your mobile or desktop SMS app directly with guest number & message filled in
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs text-slate-600">
            Supported tags:{' '}
            <code className="font-mono font-semibold text-slate-800">&#123;guestName&#125;</code>,{' '}
            <code className="font-mono font-semibold text-slate-800">&#123;roomNumber&#125;</code>,{' '}
            <code className="font-mono font-semibold text-slate-800">&#123;checkInDate&#125;</code>,{' '}
            <code className="font-mono font-semibold text-slate-800">&#123;checkOutDate&#125;</code>,{' '}
            <code className="font-mono font-semibold text-slate-800">&#123;bookingReference&#125;</code>,{' '}
            <code className="font-mono font-semibold text-slate-800">&#123;checkInTime&#125;</code>.
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                1. Booking Confirmation Template
              </label>
              <textarea
                rows={2}
                value={confirmationTemplate}
                onChange={(e) => setConfirmationTemplate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                2. Welcome & Arrival Instructions
              </label>
              <textarea
                rows={2}
                value={welcomeTemplate}
                onChange={(e) => setWelcomeTemplate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                3. Wi-Fi & Room Access Template
              </label>
              <textarea
                rows={2}
                value={wifiTemplate}
                onChange={(e) => setWifiTemplate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                4. Reservation Update Template
              </label>
              <textarea
                rows={2}
                value={updateTemplate}
                onChange={(e) => setUpdateTemplate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                5. Cancellation Notification Template
              </label>
              <textarea
                rows={2}
                value={cancellationTemplate}
                onChange={(e) => setCancellationTemplate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 font-medium text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-hidden resize-none"
              />
            </div>
          </div>
        </div>

        {/* Card 4: Dispatched Messages History */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="text-base font-bold text-slate-900">Recent SMS Outbox</h3>
            </div>
            <button
              type="button"
              onClick={fetchLogsAndStorage}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>

          <div className="overflow-x-auto max-h-56 calendar-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Recipient</th>
                  <th className="px-3 py-2">Message Content</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {smsLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No SMS messages dispatched yet.
                    </td>
                  </tr>
                ) : (
                  smsLogs.slice(0, 10).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">
                        {log.guestName}{' '}
                        <span className="font-mono text-[11px] font-normal text-slate-500">
                          ({log.recipientPhone || 'No number'})
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate">{log.content}</td>
                      <td className="px-3 py-2.5 font-semibold text-blue-600 capitalize">{log.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sticky Save Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Switch Google Sheet Picker Modal */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">Switch Google Sheet</h4>
                <p className="text-xs text-slate-500">
                  Select a Google Spreadsheet from your Google Drive to use as StayFlow storage
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingDriveSheets ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span>Loading spreadsheets from Google Drive...</span>
                </div>
              ) : driveSheets.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No Google Spreadsheets found in your Google Drive.
                </div>
              ) : (
                driveSheets.map((sheet) => {
                  const isCurrent = sheet.id === storageStatus?.spreadsheetId;
                  return (
                    <button
                      key={sheet.id}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => setPendingSwitchSheet(sheet)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                        isCurrent
                          ? 'border-emerald-200 bg-emerald-50/70 cursor-default'
                          : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {sheet.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 block truncate">
                            {sheet.id}
                          </span>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="text-[11px] font-bold text-emerald-700 shrink-0">Active</span>
                      ) : (
                        <span className="text-xs font-semibold text-blue-600 shrink-0">Select</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create New Google Sheet Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900">Create New Google Sheet</h4>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <label className="block font-semibold text-slate-700">Spreadsheet Name</label>
              <input
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                placeholder="StayFlow Hotel Data"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Creates a new Google Sheet in your Google Drive initialized with 24 rooms, 2 room types, default admin credentials, and zero dummy bookings.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmCreateOpen(true)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation: Save Property Settings */}
      <ConfirmDialog
        isOpen={confirmSaveOpen}
        title="Save Settings to Google Sheets?"
        subtitle={storageStatus?.title || 'StayFlow Hotel Data'}
        description={`This will update the Settings tab in your connected Google Sheet with property name "${propertyName}", check-in/out schedule, and all 5 SMS templates.`}
        confirmLabel="Save to Google Sheets"
        isLoading={isSaving}
        onConfirm={handleConfirmSaveAll}
        onCancel={() => setConfirmSaveOpen(false)}
      />

      {/* Explicit Confirmation: Switch Active Google Sheet */}
      <ConfirmDialog
        isOpen={!!pendingSwitchSheet}
        title="Switch Active Google Sheet?"
        subtitle={pendingSwitchSheet?.name}
        description={`StayFlow will load rooms, bookings, users, and settings from "${pendingSwitchSheet?.name}" and initialize any missing StayFlow tabs (Rooms, RoomTypes, Bookings, Users, Settings, SMSLogs) without adding dummy bookings.`}
        confirmLabel="Switch Spreadsheet"
        variant="amber"
        isLoading={isSwitchingSheet}
        onConfirm={handleConfirmSwitchSheet}
        onCancel={() => setPendingSwitchSheet(null)}
      />

      {/* Explicit Confirmation: Create New Google Sheet */}
      <ConfirmDialog
        isOpen={confirmCreateOpen}
        title="Create New Google Sheet in Drive?"
        subtitle={newSheetTitle.trim() || 'StayFlow Hotel Data'}
        description={`This will create a brand-new Google Spreadsheet named "${
          newSheetTitle.trim() || 'StayFlow Hotel Data'
        }" in your Google Drive and switch StayFlow to store data there.`}
        confirmLabel="Create Spreadsheet"
        isLoading={isCreatingSheet}
        onConfirm={handleConfirmCreateSheet}
        onCancel={() => setConfirmCreateOpen(false)}
      />

      {/* Explicit Confirmation: Switch Google Account */}
      <ConfirmDialog
        isOpen={confirmDisconnectOpen}
        title="Switch Google Account?"
        subtitle={googleEmail || undefined}
        description="This will clear your current in-memory Google session and return you to the Google Sheets connection screen."
        confirmLabel="Switch Account"
        variant="amber"
        onConfirm={async () => {
          setConfirmDisconnectOpen(false);
          await onDisconnectGoogle();
        }}
        onCancel={() => setConfirmDisconnectOpen(false)}
      />
    </div>
  );
};
