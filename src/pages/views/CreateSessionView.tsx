import React, { useState } from 'react';
import { Moon, Sun, Users, Code, Book, Coffee, Activity, Calendar, Bell, Flame, Sparkles, Smartphone, PlusCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { HamsCard } from '../../components/HamsCard';
import { OutOfRangeMessageFields } from '../../components/OutOfRangeMessageFields';

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

export const CreateSessionView: React.FC<{ onAdded?: () => void }> = ({ onAdded }) => {
  const [sessionName, setSessionName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('moon');
  const [isForAllStudents, setIsForAllStudents] = useState(true);
  const [enableMultipleAttendance, setEnableMultipleAttendance] = useState(false);

  // Time window states
  const [win1StartTime, setWin1StartTime] = useState('06:45');
  const [win1EndTime, setWin1EndTime] = useState('07:00');
  const [win1LateTime, setWin1LateTime] = useState('06:55');

  const [win2StartTime, setWin2StartTime] = useState('07:25');
  const [win2EndTime, setWin2EndTime] = useState('07:30');
  const [win2LateTime, setWin2LateTime] = useState('07:28');

  const [outOfRangeMessage, setOutOfRangeMessage] = useState('');
  const [outOfRangeMessage2, setOutOfRangeMessage2] = useState('');

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim()) return;

    if (enableMultipleAttendance) {
      if (!win1StartTime || !win1EndTime || !win2StartTime || !win2EndTime) {
        alert('Please fill in start and end times for both attendance windows.');
        return;
      }
      const [h1End, m1End] = win1EndTime.split(':').map(Number);
      const [h2Start, m2Start] = win2StartTime.split(':').map(Number);
      const [h2End, m2End] = win2EndTime.split(':').map(Number);

      const end1Mins = h1End * 60 + m1End;
      const start2Mins = h2Start * 60 + m2Start;
      const end2Mins = h2End * 60 + m2End;

      if (start2Mins <= end1Mins) {
        alert(`Validation Error: Second Attendance start time (${win2StartTime}) must be AFTER First Attendance end time (${win1EndTime}).`);
        return;
      }
      if (end2Mins <= start2Mins) {
        alert(`Validation Error: Second Attendance end time (${win2EndTime}) must be after Second Attendance start time (${win2StartTime}).`);
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
        out_of_range_message: outOfRangeMessage.trim() || null,
        out_of_range_message_phase2: enableMultipleAttendance ? (outOfRangeMessage2.trim() || null) : null
      };

      if (enableMultipleAttendance) {
        payload.start_time = win1StartTime;
        payload.end_time = win1EndTime;
        payload.late_time = win1LateTime || null;
        payload.phase2_start_time = win2StartTime;
        payload.phase2_end_time = win2EndTime;
        payload.phase2_late_time = win2LateTime || null;
      }

      const res = await apiClient.post('/admin/sessions', payload);

      if (res.data.success) {
        alert('New attendance session created successfully!');
        setSessionName('');
        setIsForAllStudents(true);
        setEnableMultipleAttendance(false);
        setOutOfRangeMessage('');
        setOutOfRangeMessage2('');
        if (onAdded) onAdded();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Add New Attendance Session</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
          Create custom sessions (e.g., Sabha, Morning, Aarti, Coding, Sports)
        </p>
      </div>

      <HamsCard padding="32px">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
              SESSION NAME
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="e.g. Sabha Attendance, Coding Session"
              required
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>
              CHOOSE ICON
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {ICONS.map(item => {
                const IconComp = item.icon;
                const isSelected = selectedIcon === item.name;
                return (
                  <div
                    key={item.name}
                    onClick={() => setSelectedIcon(item.name)}
                    style={{
                      padding: '16px 12px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
                      color: isSelected ? '#4f46e5' : '#475569',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <IconComp size={24} />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Students Checkbox / Toggle */}
          <div style={{
            padding: '16px',
            backgroundColor: isForAllStudents ? '#f8fafc' : '#fffbeb',
            border: isForAllStudents ? '1px solid #e2e8f0' : '1px solid #fde68a',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            cursor: 'pointer'
          }} onClick={() => setIsForAllStudents(!isForAllStudents)}>
            <input
              type="checkbox"
              id="is_for_all_students"
              checked={isForAllStudents}
              onChange={(e) => setIsForAllStudents(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: '#4f46e5',
                cursor: 'pointer',
                marginTop: '2px'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={{ flex: 1 }}>
              <label
                htmlFor="is_for_all_students"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: isForAllStudents ? '#1e293b' : '#92400e',
                  cursor: 'pointer',
                  display: 'block'
                }}
              >
                {isForAllStudents ? 'Mandatory for All Students (Hostel-wide)' : 'Selective / Assigned Students Only'}
              </label>
              <p style={{ fontSize: '12px', color: isForAllStudents ? '#64748b' : '#b45309', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                {isForAllStudents
                  ? 'Every student in the hostel is expected to attend this session. Live records and absentee messages will track all students.'
                  : 'Only specifically assigned students will be required to attend. Floor leaders and admins can assign students to this session, and absentee WhatsApp messages will go ONLY to assigned students.'}
              </p>
            </div>
          </div>

          {/* Enable Multiple-Time Attendance Toggle */}
          <div style={{
            padding: '16px',
            backgroundColor: enableMultipleAttendance ? '#f0fdf4' : '#f8fafc',
            border: enableMultipleAttendance ? '1.5px solid #22c55e' : '1px solid #e2e8f0',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            transition: 'all 0.2s ease'
          }}>
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer' }}
              onClick={() => setEnableMultipleAttendance(!enableMultipleAttendance)}
            >
              <input
                type="checkbox"
                id="enable_multiple_attendance"
                checked={enableMultipleAttendance}
                onChange={(e) => setEnableMultipleAttendance(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  accentColor: '#16a34a',
                  cursor: 'pointer',
                  marginTop: '2px'
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="enable_multiple_attendance"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: enableMultipleAttendance ? '#15803d' : '#1e293b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Clock size={16} /> Enable Multiple-Time Attendance (Two-Phase Attendance)
                </label>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  Take attendance twice on the same day for this session (e.g. Aarti at 6:45 AM - 7:00 AM, and again at 7:25 AM - 7:30 AM). Only students who complete the first window can mark the second.
                </p>
              </div>
            </div>

            {enableMultipleAttendance && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #dcfce7'
              }}>
                {/* First Attendance Window */}
                <div style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #bbf7d0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#166534', fontWeight: 800, fontSize: '13px' }}>
                    <span style={{ backgroundColor: '#dcfce7', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>1</span>
                    FIRST ATTENDANCE WINDOW
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>START TIME</label>
                        <input
                          type="time"
                          value={win1StartTime}
                          onChange={(e) => setWin1StartTime(e.target.value)}
                          required={enableMultipleAttendance}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>END TIME</label>
                        <input
                          type="time"
                          value={win1EndTime}
                          onChange={(e) => setWin1EndTime(e.target.value)}
                          required={enableMultipleAttendance}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>LATE ARRIVAL CUTOFF (OPTIONAL)</label>
                      <input
                        type="time"
                        value={win1LateTime}
                        onChange={(e) => setWin1LateTime(e.target.value)}
                        placeholder="e.g. 06:55"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Second Attendance Window */}
                <div style={{
                  padding: '16px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #fed7aa',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#9a3412', fontWeight: 800, fontSize: '13px' }}>
                    <span style={{ backgroundColor: '#ffedd5', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>2</span>
                    SECOND ATTENDANCE WINDOW
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>START TIME</label>
                        <input
                          type="time"
                          value={win2StartTime}
                          onChange={(e) => setWin2StartTime(e.target.value)}
                          required={enableMultipleAttendance}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>END TIME</label>
                        <input
                          type="time"
                          value={win2EndTime}
                          onChange={(e) => setWin2EndTime(e.target.value)}
                          required={enableMultipleAttendance}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>LATE ARRIVAL CUTOFF (OPTIONAL)</label>
                      <input
                        type="time"
                        value={win2LateTime}
                        onChange={(e) => setWin2LateTime(e.target.value)}
                        placeholder="e.g. 07:28"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <OutOfRangeMessageFields
            twoPhase={enableMultipleAttendance}
            message={outOfRangeMessage}
            onMessageChange={setOutOfRangeMessage}
            messagePhase2={outOfRangeMessage2}
            onMessagePhase2Change={setOutOfRangeMessage2}
          />

          <button
            type="submit"
            disabled={loading || !sessionName.trim()}
            style={{
              padding: '14px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
            }}
          >
            <PlusCircle size={18} /> {loading ? 'Creating...' : 'Create Session'}
          </button>
        </form>
      </HamsCard>
    </div>
  );
};
