import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';

interface TestResult {
  testNumber: number;
  title: string;
  description: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

interface SelfTestSuiteModalProps {
  onClose: () => void;
  onRefreshData: () => void;
}

export const SelfTestSuiteModal: React.FC<SelfTestSuiteModalProps> = ({
  onClose,
  onRefreshData,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [allPassed, setAllPassed] = useState<boolean | null>(null);
  const [totalDuration, setTotalDuration] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setErrorMsg(null);

    try {
      const res = await api.runAutomatedTests();
      setTestResults(res.tests);
      setAllPassed(res.allPassed);
      setTotalDuration(res.totalDurationMs);
      onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute test suite.');
    } finally {
      setIsRunning(false);
    }
  };

  const default10Tests = [
    {
      num: 1,
      title: 'Booking Creation (Regular Room 01: June 10 - June 15)',
      desc: 'Create booking for Regular Room 01 with optional phone number handling.',
    },
    {
      num: 2,
      title: 'Conflict Rejection (Same Room: June 12 - June 14)',
      desc: 'Try booking the same room from June 12 to June 14. Must be rejected.',
    },
    {
      num: 3,
      title: 'Room Independence (Regular Room 02: June 12 - June 14)',
      desc: 'Try booking Regular Room 02 for the same dates. Must be accepted.',
    },
    {
      num: 4,
      title: 'Cancellation Date Release',
      desc: 'Cancel the first booking. Its dates must become available again immediately.',
    },
    {
      num: 5,
      title: 'Dynamic Room Addition',
      desc: 'Add a new room from Rooms Management. Must appear in inventory and calendar.',
    },
    {
      num: 6,
      title: 'Edit Dates Conflict Validation',
      desc: 'Edit booking dates with server-side availability check before saving.',
    },
    {
      num: 7,
      title: 'Admin Authentication & User Access Control',
      desc: 'Confirm default administrator credentials and salted password hashing.',
    },
    {
      num: 8,
      title: 'Native SMS & Pre-Saved Templates',
      desc: 'Direct device SMS launcher with pre-saved templates without third-party billing.',
    },
    {
      num: 9,
      title: 'Google Sheets Persistence Check',
      desc: 'Verify Google Sheets storage retains rooms, bookings, and users.',
    },
    {
      num: 10,
      title: 'Atomic Mutex Concurrency Lock',
      desc: 'Two users attempting to book simultaneously: mutex guarantees only one succeeds.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 shadow-2xl relative my-0 sm:my-8 border-t sm:border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-500/20 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                10-Point Automated Verification Suite
              </h3>
              <p className="text-xs text-slate-500">
                Live verification of booking integrity, mutex locks, native SMS, and room persistence
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

        {allPassed === true && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-extrabold text-sm">All 10 Verification Tests Passed Successfully!</p>
                <p className="text-xs text-emerald-700">
                  Execution completed in {totalDuration}ms without failures.
                </p>
              </div>
            </div>
            <span className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
              10 / 10 PASS
            </span>
          </div>
        )}

        {allPassed === false && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-extrabold text-sm">One or more tests failed.</p>
                <p className="text-xs text-rose-700">Please review diagnostic details below.</p>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {default10Tests.map((t) => {
            const result = testResults.find((r) => r.testNumber === t.num);
            const isFinished = !!result;
            const passed = result?.passed;

            return (
              <div
                key={t.num}
                className={`rounded-2xl border p-3.5 text-xs transition-colors ${
                  isFinished
                    ? passed
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-rose-200 bg-rose-50/40'
                    : 'border-slate-200/80 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-bold text-[10px]">
                      {t.num}
                    </span>
                    <span className="font-bold text-slate-900">{t.title}</span>
                  </div>

                  <div>
                    {isFinished ? (
                      passed ? (
                        <span className="flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> PASS ({result.durationMs}ms)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md text-[10px]">
                          <XCircle className="h-3 w-3" /> FAIL
                        </span>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">Pending Run</span>
                    )}
                  </div>
                </div>

                <p className="mt-1 text-[11px] text-slate-500 pl-7">{t.desc}</p>

                {result && (
                  <div className="mt-2 pl-7 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
                    {result.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-500 font-medium">
            {testResults.length > 0 ? (
              <span>Tested on {new Date().toLocaleTimeString()}</span>
            ) : (
              <span>Click run to verify all booking & database guarantees</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={runTests}
              disabled={isRunning}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 transition"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Executing 10 Scenarios...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Run Automated Validation Tests</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
