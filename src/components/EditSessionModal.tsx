import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Moon,
  Sun,
  Users,
  Code,
  Book,
  Coffee,
  Activity,
  Calendar,
  Bell,
  Flame,
  Sparkles,
  Smartphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Save
} from 'lucide-react';
import apiClient from '../services/apiClient';

const ICONS = [
  { name: 'moon', icon: Moon, label: 'Night' },
  { name: 'sun', icon: Sun, label: 'Morning' },
  { name: 'users', icon: Users, label: 'Sabha' },
  { name: 'bell', icon: Bell, label: 'Aarti / Bell' },
  { name: 'flame', icon: Flame, label: 'Aarti / Deep' },
  { name: 'code', icon: Code, label: 'Coding' },
  { name: 'book', icon: Book, label: 'Study' },
  { name: 'coffee', icon: Coffee, label: 'Break' },
  { name: 'activity', icon: Activity, label: 'Sports' },
  { name: 'calendar', icon: Calendar, label: 'Event' },
  { name: 'smartphone', icon: Smartphone, label: 'Mobile' },
  { name: 'sparkles', icon: Sparkles, label: 'Special' },
];

interface EditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
  onSessionUpdated: (updatedSession: any) => void;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionUpdated
}) => {
  if (!isOpen || !session) return null;

  const [sessionName, setSessionName] = useState(session.session_name || '');
  const [selectedIcon, setSelectedIcon] = useState(session.icon_name || 'moon');
  const [isForAllStudents, setIsForAllStudents] = useState(
    session.is_for_all_students !== 0 && session.is_for_all_students !== false
  );
  const [enableMultipleAttendance, setEnableMultipleAttendance] = useState(
    Boolean(session.has_multiple_attendance)
  );

  // Time window states
  const [win1StartTime, setWin1StartTime] = useState(
    session.start_time ? String(session.start_time).slice(0, 5) : '06:45'
  );
  const [win1EndTime, setWin1EndTime] = useState(
    session.end_time ? String(session.end_time).slice(0, 5) : '07:00'
  );
  const [win1LateTime, setWin1LateTime] = useState(
    session.late_time ? String(session.late_time).slice(0, 5) : '06:55'
  );

  const [win2StartTime, setWin2StartTime] = useState(
    session.phase2_start_time ? String(session.phase2_start_time).slice(0, 5) : '07:25'
  );
  const [win2EndTime, setWin2EndTime] = useState(
    session.phase2_end_time ? String(session.phase2_end_time).slice(0, 5) : '07:30'
  );
  const [win2LateTime, setWin2LateTime] = useState(
    session.phase2_late_time ? String(session.phase2_late_time).slice(0, 5) : '07:28'
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Re-sync when session changes
  useEffect(() => {
    if (session) {
      setSessionName(session.session_name || '');
      setSelectedIcon(session.icon_name || 'moon');
      setIsForAllStudents(session.is_for_all_students !== 0 && session.is_for_all_students !== false);
      setEnableMultipleAttendance(Boolean(session.has_multiple_attendance));
      setWin1StartTime(session.start_time ? String(session.start_time).slice(0, 5) : '06:45');
      setWin1EndTime(session.end_time ? String(session.end_time).slice(0, 5) : '07:00');
      setWin1LateTime(session.late_time ? String(session.late_time).slice(0, 5) : '');
      setWin2StartTime(session.phase2_start_time ? String(session.phase2_start_time).slice(0, 5) : '07:25');
      setWin2EndTime(session.phase2_end_time ? String(session.phase2_end_time).slice(0, 5) : '07:30');
      setWin2LateTime(session.phase2_late_time ? String(session.phase2_late_time).slice(0, 5) : '');
      setErrorMsg('');
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!sessionName.trim()) {
      setErrorMsg('Session name is required.');
      return;
    }

    if (!win1StartTime || !win1EndTime) {
      setErrorMsg('Please specify start and end time for attendance.');
      return;
    }

    if (enableMultipleAttendance) {
      if (!win2StartTime || !win2EndTime) {
        setErrorMsg('Please specify start and end time for the Second Attendance window.');
        return;
      }

      const [h1End, m1End] = win1EndTime.split(':').map(Number);
      const [h2Start, m2Start] = win2StartTime.split(':').map(Number);
      const [h2End, m2End] = win2EndTime.split(':').map(Number);

      const end1Mins = h1End * 60 + m1End;
      const start2Mins = h2Start * 60 + m2Start;
      const end2Mins = h2End * 60 + m2End;

      if (start2Mins <= end1Mins) {
        setErrorMsg(`Second Attendance start time (${win2StartTime}) must start AFTER First Attendance end time (${win1EndTime}).`);
        return;
      }

      if (end2Mins <= start2Mins) {
        setErrorMsg(`Second Attendance end time (${win2EndTime}) must be after Second Attendance start time (${win2StartTime}).`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        session_name: sessionName.trim(),
        icon_name: selectedIcon,
        is_for_all_students: isForAllStudents,
        has_multiple_attendance: enableMultipleAttendance,
        start_time: win1StartTime,
        end_time: win1EndTime,
        late_time: win1LateTime || null,
        phase2_start_time: enableMultipleAttendance ? win2StartTime : null,
        phase2_end_time: enableMultipleAttendance ? win2EndTime : null,
        phase2_late_time: enableMultipleAttendance ? (win2LateTime || null) : null
      };

      const res = await apiClient.put(`/admin/sessions/${session.session_key}`, payload);

      if (res.data.success) {
        onSessionUpdated(res.data.data || { ...session, ...payload });
        onClose();
      } else {
        setErrorMsg(res.data.message || 'Failed to update session');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update session settings');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="modal-content-card"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '28px',
          width: '100%',
          maxWidth: '640px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                Edit Session Settings
              </h2>
              <span
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  fontFamily: 'monospace'
                }}
              >
                {session.session_key}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Modify session configuration, enable Multiple-Time Attendance, and update window timings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Data Preservation Assurance Note */}
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.4 }}>
            <strong>Preserving Historical Data:</strong> The original session ID, existing student assignments, and all previously recorded attendance timestamps remain 100% intact.
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '18px',
              color: '#b91c1c',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Session Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Session Name</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Aarti Attendance, Night Attendance"
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none'
              }}
              required
            />
          </div>

          {/* Icon Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Session Icon</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = selectedIcon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedIcon(item.name)}
                    title={item.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '10px 4px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#eef2ff' : '#f8fafc',
                      color: isSelected ? '#4f46e5' : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <IconComponent size={20} />
                    <span style={{ fontSize: '10px', fontWeight: 700 }}>{item.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Scope */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Applicable Students</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsForAllStudents(true)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: isForAllStudents ? '2px solid #10b981' : '1px solid #e2e8f0',
                  backgroundColor: isForAllStudents ? '#ecfdf5' : '#f8fafc',
                  color: isForAllStudents ? '#065f46' : '#64748b',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                🌟 All Registered Students
                <div style={{ fontSize: '11px', fontWeight: 500, marginTop: '2px', color: '#64748b' }}>
                  Open to all hostel students
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsForAllStudents(false)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: !isForAllStudents ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                  backgroundColor: !isForAllStudents ? '#fffbeb' : '#f8fafc',
                  color: !isForAllStudents ? '#92400e' : '#64748b',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                🎯 Selective Student Group
                <div style={{ fontSize: '11px', fontWeight: 500, marginTop: '2px', color: '#64748b' }}>
                  Assigned via student list
                </div>
              </button>
            </div>
          </div>

          {/* Multiple-Time Attendance Toggle Card */}
          <div
            style={{
              padding: '16px',
              borderRadius: '14px',
              border: enableMultipleAttendance ? '2px solid #8b5cf6' : '1.5px solid #e2e8f0',
              backgroundColor: enableMultipleAttendance ? '#f5f3ff' : '#f8fafc',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                    Enable Multiple-Time Attendance
                  </h4>
                  {enableMultipleAttendance && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: '#8b5cf6',
                        color: '#ffffff',
                        textTransform: 'uppercase'
                      }}
                    >
                      2-Phase
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Configure two attendance windows (e.g. Aarti at 6:45 AM & 7:25 AM). Only students who attended Window 1 can mark Window 2.
                </p>
              </div>

              <label
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '48px',
                  height: '26px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <input
                  type="checkbox"
                  checked={enableMultipleAttendance}
                  onChange={(e) => setEnableMultipleAttendance(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: enableMultipleAttendance ? '#8b5cf6' : '#cbd5e1',
                    borderRadius: '34px',
                    transition: '0.2s ease'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: '20px',
                      width: '20px',
                      left: enableMultipleAttendance ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.2s ease'
                    }}
                  />
                </span>
              </label>
            </div>
          </div>

          {/* First Attendance Window */}
          <div
            style={{
              padding: '16px',
              borderRadius: '14px',
              border: '1.5px solid #e2e8f0',
              backgroundColor: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800
                }}
              >
                1
              </span>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                {enableMultipleAttendance ? 'First Attendance Window' : 'Attendance Window'}
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Start Time
                </label>
                <input
                  type="time"
                  value={win1StartTime}
                  onChange={(e) => setWin1StartTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  End Time
                </label>
                <input
                  type="time"
                  value={win1EndTime}
                  onChange={(e) => setWin1EndTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Late After (Optional)
                </label>
                <input
                  type="time"
                  value={win1LateTime}
                  onChange={(e) => setWin1LateTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                />
              </div>
            </div>
          </div>

          {/* Second Attendance Window (Conditional) */}
          {enableMultipleAttendance && (
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                border: '1.5px solid #ddd6fe',
                backgroundColor: '#faf5ff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800
                  }}
                >
                  2
                </span>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#4c1d95' }}>
                  Second Attendance Window
                </h4>
                <span style={{ fontSize: '11px', color: '#6b21a8', marginLeft: 'auto', fontWeight: 600 }}>
                  Must start after {win1EndTime || '07:00'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b21a8', display: 'block', marginBottom: '4px' }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={win2StartTime}
                    onChange={(e) => setWin2StartTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #c4b5fd',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b21a8', display: 'block', marginBottom: '4px' }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={win2EndTime}
                    onChange={(e) => setWin2EndTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #c4b5fd',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#6b21a8', display: 'block', marginBottom: '4px' }}>
                    Late After (Optional)
                  </label>
                  <input
                    type="time"
                    value={win2LateTime}
                    onChange={(e) => setWin2LateTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #c4b5fd',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Save size={16} />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
