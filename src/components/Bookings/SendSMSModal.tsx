import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { Booking, MessagingConfig, Room, SMSLogEntry } from '../../types';

interface SendSMSModalProps {
  booking: Booking;
  room?: Room;
  messaging?: MessagingConfig;
  defaultCheckInTime?: string;
  propertyName?: string;
  onClose: () => void;
  onSMSSent?: (log: SMSLogEntry) => void;
}

export const SendSMSModal: React.FC<SendSMSModalProps> = ({
  booking,
  room,
  messaging,
  defaultCheckInTime = '14:00',
  propertyName = 'our hotel',
  onClose,
  onSMSSent,
}) => {
  const roomName = room ? room.roomNumber : 'Room';

  const interpolate = (template: string) =>
    template
      .replace(/\{guestName\}/g, booking.guestName)
      .replace(/\{roomNumber\}/g, roomName)
      .replace(/\{checkInDate\}/g, booking.checkInDate)
      .replace(/\{checkOutDate\}/g, booking.checkOutDate)
      .replace(/\{bookingReference\}/g, booking.bookingReference)
      .replace(/\{checkInTime\}/g, defaultCheckInTime);

  // Pre-saved templates from Settings (with defaults if unset)
  const preSavedTemplates = useMemo(() => {
    const conf =
      messaging?.confirmationTemplate ||
      'Hello {guestName}, your room booking is confirmed! Room: {roomNumber}. Check-in: {checkInDate}. Check-out: {checkOutDate}. Booking Ref: {bookingReference}. Thank you for choosing us!';
    const welcome =
      messaging?.welcomeTemplate ||
      'Welcome {guestName}! Check-in for {roomNumber} is ready from {checkInTime}. Front desk is available 24/7. Ref: {bookingReference}. Have a wonderful stay!';
    const wifi =
      messaging?.wifiTemplate ||
      'Hi {guestName}, here are your stay details for {roomNumber}: High-Speed Wi-Fi: "Azure-Guest", Password: "welcomeguest". Front Desk: Dial 0.';
    const upd =
      messaging?.updateTemplate ||
      'Hello {guestName}, your reservation {bookingReference} has been updated. Room: {roomNumber}. New dates: {checkInDate} to {checkOutDate}. See you soon!';
    const cancel =
      messaging?.cancellationTemplate ||
      'Hello {guestName}, your booking {bookingReference} for {roomNumber} ({checkInDate} to {checkOutDate}) has been cancelled. Please contact us if you need further assistance.';

    return {
      confirmation: {
        title: 'Booking Confirmation',
        body: interpolate(conf),
        tag: 'Recommended on Booking',
      },
      welcome: {
        title: 'Welcome & Check-in Details',
        body: interpolate(welcome),
        tag: 'Arrival Day',
      },
      wifi: {
        title: 'Wi-Fi & Room Access',
        body: interpolate(wifi),
        tag: 'Stay Info',
      },
      update: {
        title: 'Booking Updated',
        body: interpolate(upd),
        tag: 'Date / Room Change',
      },
      cancellation: {
        title: 'Booking Cancellation',
        body: interpolate(cancel),
        tag: 'Cancellation',
      },
      custom: {
        title: 'Custom Message',
        body: `Hello ${booking.guestName}, this is regarding your stay at ${propertyName} for ${roomName}.`,
        tag: 'Freeform',
      },
    };
  }, [booking, roomName, messaging, defaultCheckInTime, propertyName]);

  const defaultTemplateKey = booking.bookingStatus === 'cancelled' ? 'cancellation' : 'confirmation';

  const [selectedKey, setSelectedKey] = useState<keyof typeof preSavedTemplates>(defaultTemplateKey);
  const [recipientPhone, setRecipientPhone] = useState(booking.guestPhone || '');
  const [messageBody, setMessageBody] = useState(preSavedTemplates[defaultTemplateKey].body);
  const [copied, setCopied] = useState(false);
  const [launched, setLaunched] = useState(false);

  const handleTemplateSelect = (key: keyof typeof preSavedTemplates) => {
    setSelectedKey(key);
    setMessageBody(preSavedTemplates[key].body);
  };

  // Launch native mobile SMS window with platform-specific standard format
  const handleOpenNativeSMS = async () => {
    // Keep numbers and leading '+', remove spaces, dashes, parentheses
    const cleanPhone = recipientPhone.trim().replace(/[^\d+]/g, '');

    // Device detection:
    // iOS & macOS Safari requires `sms:+1234567890&body=...` (or `;body=`)
    // Android & Windows Phone Link requires `sms:+1234567890?body=...`
    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const separator = isIOS ? '&' : '?';
    const smsUrl = cleanPhone
      ? `sms:${cleanPhone}${separator}body=${encodeURIComponent(messageBody)}`
      : `sms:${separator}body=${encodeURIComponent(messageBody)}`;

    try {
      const res = await api.sendSMS({
        bookingId: booking.id,
        recipientPhone: cleanPhone,
        guestName: booking.guestName,
        messageType: selectedKey as any,
        content: messageBody,
      });

      if (onSMSSent) onSMSSent(res.log);
    } catch (err) {
      console.error('Error logging SMS:', err);
    }

    setLaunched(true);

    // Trigger device native SMS app reliably via anchor element click
    const link = document.createElement('a');
    link.href = smsUrl;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const whatsappUrl = useMemo(() => {
    const cleanDigits = recipientPhone.replace(/[^\d]/g, '');
    return cleanDigits
      ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(messageBody)}`
      : `https://wa.me/?text=${encodeURIComponent(messageBody)}`;
  }, [recipientPhone, messageBody]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border-t sm:border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Direct Mobile SMS & Messaging
              </h3>
              <p className="text-xs text-slate-500">
                Pre-saved templates that open your device's native SMS app directly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {launched && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs text-emerald-800 flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Device SMS app opened! If your phone prompt did not trigger automatically, you can also use <strong>Copy Message</strong> below.
            </span>
          </div>
        )}

        {/* Pre-saved Template Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Choose Pre-Saved Template
            </label>
            <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Auto-filled with guest & room details
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(preSavedTemplates) as Array<keyof typeof preSavedTemplates>).map((key) => {
              const item = preSavedTemplates[key];
              const isSelected = selectedKey === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleTemplateSelect(key)}
                  className={`rounded-2xl border p-2.5 text-left transition-all relative ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200/90 bg-white hover:bg-slate-50/80 text-slate-700'
                  }`}
                >
                  <span className="block font-bold text-xs truncate">{item.title}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5 truncate">{item.tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recipient Phone (Optional) */}
        <div className="mt-4 space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Recipient Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="tel"
              placeholder="e.g. +1 555-234-5678 (leave blank if guest has no phone)"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-hidden"
            />
          </div>
          {!recipientPhone && (
            <p className="text-[11px] text-amber-600">
              Note: Guest does not have a phone number saved. You can type one here or copy the message.
            </p>
          )}
        </div>

        {/* Message Editor */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Message Text (Editable)</label>
            <span className="text-[10px] text-slate-400 font-mono">{messageBody.length} chars</span>
          </div>
          <textarea
            rows={4}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden leading-relaxed resize-none"
          />
        </div>

        {/* Quick Actions Bar */}
        <div className="mt-5 space-y-2.5">
          {/* Primary: Open Mobile SMS App */}
          <button
            type="button"
            onClick={handleOpenNativeSMS}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-3 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] transition"
          >
            <Smartphone className="h-4 w-4" />
            <span>Open in Mobile SMS App</span>
          </button>

          {/* Secondary Actions: Copy to Clipboard & WhatsApp */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-500" />
                  <span>Copy Message</span>
                </>
              )}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Open in WhatsApp</span>
            </a>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Works natively on iOS, Android, macOS & Windows</span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
