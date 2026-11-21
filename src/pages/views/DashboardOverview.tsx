import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  RefreshCw,
  BarChart2,
  Radio,
  Search,
  MessageSquare,
  FileText,
  AlertCircle,
  X,
  Phone,
  Calendar,
  RotateCcw,
  History,
  Cake,
  Send,
  ExternalLink,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import apiClient from '../../services/apiClient';
import { HamsCard } from '../../components/HamsCard';
import { renderSessionIcon } from '../../utils/sessionIcons';

interface BirthdayStudent {
  studentId: number;
  name: string;
  studentCode: string;
  floorId?: number;
  isActive?: boolean;
  phone: string;
  whatsappNumber: string;
  parentPhone?: string;
  room: string;
  dob: string;
  groupName?: string | null;
  status?: string | null;
  alreadySentToday: boolean;
}

interface WhatsAppTemplateItem {
  id: number;
  name: string;
  category: string;
  content: string;
  image_url?: string | null;
}

export const DashboardOverview: React.FC = () => {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [stats, setStats] = useState<any>(null);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('recent');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Today's Birthdays & WhatsApp Wish Modal State
  const [birthdayStudents, setBirthdayStudents] = useState<BirthdayStudent[]>([]);
  const [loadingBirthdays, setLoadingBirthdays] = useState(true);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
  const [birthdaySearch, setBirthdaySearch] = useState('');
  const [birthdayFilter, setBirthdayFilter] = useState<'active' | 'all'>('active');

  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [waModal, setWaModal] = useState<{
    isOpen: boolean;
    student: BirthdayStudent;
    mode: 'template' | 'manual';
    selectedTemplateId: number | null;
    phone: string;
    message: string;
    imageUrl: string | null;
    error?: string;
    success?: string;
  } | null>(null);
  const [sendingWa, setSendingWa] = useState(false);

  const isToday = selectedDate === todayStr;

  const computeTurningAge = (dobStr?: string): number | null => {
    if (!dobStr) return null;
    const year = parseInt(dobStr.slice(0, 4), 10);
    if (isNaN(year) || year < 1900) return null;
    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    return age > 0 && age < 120 ? age : null;
  };

  const applyTemplateVariables = (rawText: string, student: BirthdayStudent): string => {
    const todayDisplay = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const age = computeTurningAge(student.dob);
    const floorLabel = student.floorId ? `Floor ${student.floorId}` : 'Ground Floor';
    return (rawText || '')
      .replace(/\{name\}/gi, student.name || 'Student')
      .replace(/\{student_name\}/gi, student.name || 'Student')
      .replace(/\{code\}/gi, student.studentCode || '')
      .replace(/\{student_code\}/gi, student.studentCode || '')
      .replace(/\{bank_code\}/gi, student.studentCode || '')
      .replace(/\{room\}/gi, student.room || 'N/A')
      .replace(/\{floor\}/gi, floorLabel)
      .replace(/\{group\}/gi, student.groupName || '')
      .replace(/\{date\}/gi, todayDisplay)
      .replace(/\{age\}/gi, age ? String(age) : '');
  };

  const fetchBirthdaysAndTemplates = async () => {
    setLoadingBirthdays(true);
    try {
      const [bRes, tRes] = await Promise.all([
        apiClient.get('/whatsapp/birthday'),
        apiClient.get('/whatsapp/templates')
      ]);
      if (bRes.data?.success && bRes.data.data) {
        setBirthdayStudents(bRes.data.data.todaysBirthdays || []);
        setIsWhatsAppConnected(Boolean(bRes.data.data.isWhatsAppConnected));
      }
      if (tRes.data?.success && Array.isArray(tRes.data.data)) {
        setWaTemplates(tRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load today birthdays or templates:', e);
    } finally {
      setLoadingBirthdays(false);
    }
  };

  useEffect(() => {
    fetchBirthdaysAndTemplates();
  }, []);

  useEffect(() => {
    fetchStats(selectedSessionKey, true, selectedDate);

    // Live Real-Time Polling every 3 seconds (only active when viewing today's date)
    const interval = setInterval(() => {
      if (!waModal?.isOpen && selectedDate === new Date().toLocaleDateString('en-CA')) {
        fetchStats(selectedSessionKey, false, selectedDate);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedSessionKey, waModal?.isOpen, selectedDate]);

  const fetchStats = async (sessionKey = selectedSessionKey, isInitial = false, dateStr = selectedDate) => {
    if (isInitial) setLoading(true);
    try {
      const res = await apiClient.get(`/admin/dashboard?session_key=${sessionKey}&date=${dateStr}`);
      if (res.data.success) {
        setStats(res.data.data);
        const avail = res.data.data?.available_sessions || [];
        if (avail.length > 0 && !avail.some((s: any) => s.session_key === sessionKey)) {
          setSelectedSessionKey(avail[0].session_key);
        }
      } else {
        if (isInitial) setError(res.data.message || 'Failed to fetch dashboard data');
      }
    } catch (err: any) {
      if (isInitial) setError(err.message || 'Error communicating with backend');
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchStats(selectedSessionKey, true, selectedDate);
    fetchBirthdaysAndTemplates();
  };

  const openBirthdayWhatsAppModal = async (student: BirthdayStudent) => {
    setLoadingTemplates(true);
    let templatesList = waTemplates;
    try {
      const tRes = await apiClient.get('/whatsapp/templates');
      if (tRes.data?.success && Array.isArray(tRes.data.data)) {
        templatesList = tRes.data.data;
        setWaTemplates(templatesList);
      }
    } catch { }
    setLoadingTemplates(false);

    // Prefer a birthday-category template if admin created one, otherwise first template
    const preferredTemplate =
      templatesList.find(t => (t.category || '').toLowerCase().includes('birthday') || (t.name || '').toLowerCase().includes('birthday')) ||
      templatesList[0] ||
      null;

    const initialMode: 'template' | 'manual' = preferredTemplate ? 'template' : 'manual';
    const initialMsg = preferredTemplate
      ? applyTemplateVariables(preferredTemplate.content, student)
      : `🎂 Happy Birthday ${student.name}! Wishing you a wonderful year ahead filled with happiness, good health, and success. — AVD Hostel`;

    setWaModal({
      isOpen: true,
      student,
      mode: initialMode,
      selectedTemplateId: preferredTemplate ? preferredTemplate.id : null,
      phone: student.whatsappNumber || student.phone || '',
      message: initialMsg,
      imageUrl: preferredTemplate?.image_url || null,
      error: undefined,
      success: undefined
    });
  };

  const handleSelectTemplateInModal = (templateId: number) => {
    if (!waModal) return;
    const tpl = waTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    setWaModal({
      ...waModal,
      mode: 'template',
      selectedTemplateId: tpl.id,
      message: applyTemplateVariables(tpl.content, waModal.student),
      imageUrl: tpl.image_url || null,
      error: undefined,
      success: undefined
    });
  };

  const handleSendBirthdayWhatsApp = async () => {
    if (!waModal) return;
    const cleanPhone = waModal.phone.trim();
    const cleanMsg = waModal.message.trim();
    if (!cleanPhone) {
      setWaModal({ ...waModal, error: 'Please enter a valid WhatsApp phone number.' });
      return;
    }
    if (!cleanMsg) {
      setWaModal({ ...waModal, error: 'Please select a template or write a message before sending.' });
      return;
    }

    setSendingWa(true);
    setWaModal({ ...waModal, error: undefined, success: undefined });
    try {
      const res = await apiClient.post('/whatsapp/birthday/send-wish', {
        student_id: waModal.student.studentId,
        phone: cleanPhone,
        text: cleanMsg,
        image_url: waModal.mode === 'template' ? waModal.imageUrl : null,
        recipient_type: 'student'
      });

      if (res.data?.success) {
        setBirthdayStudents(prev =>
          prev.map(st =>
            st.studentId === waModal.student.studentId ? { ...st, alreadySentToday: true } : st
          )
        );
        setWaModal({
          ...waModal,
          success: res.data.message || 'WhatsApp birthday message sent successfully!'
        });
        setTimeout(() => {
          setWaModal(curr => (curr?.student.studentId === waModal.student.studentId ? null : curr));
        }, 1600);
      } else {
        setWaModal({ ...waModal, error: res.data?.message || 'Failed to send WhatsApp message.' });
      }
    } catch (e: any) {
      setWaModal({
        ...waModal,
        error: e?.response?.data?.message || e?.message || 'Failed to send WhatsApp message.'
      });
    } finally {
      setSendingWa(false);
    }
  };

  const formatDateShort = (dStr: string) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (loading && !stats) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Loading Live Dashboard...</div>
        <p style={{ fontSize: '14px', margin: 0 }}>Connecting to real-time attendance streams...</p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div style={{ padding: '32px' }}>
        <HamsCard padding="32px">
          <h3 style={{ color: '#ef4444', margin: '0 0 8px 0' }}>Dashboard Error</h3>
          <p style={{ color: '#64748b', margin: '0 0 16px 0' }}>{error}</p>
          <button
            onClick={() => fetchStats(selectedSessionKey, true)}
            style={{
              padding: '8px 18px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </HamsCard>
      </div>
    );
  }

  const currentSessionName = stats?.current_session?.name || 'Recent Attendance';
  const isRecent = stats?.current_session?.is_recent;

  const chartData = (stats?.weekly_stats || []).map((s: any) => {
    const presentCount = s.present || 0;
    const lateCount = s.late || 0;
    const leaveCount = s.leave || 0;
    const absentCount = s.absent !== undefined ? s.absent : (presentCount > 0 ? Math.max(0, (stats?.total_students || 0) - presentCount - leaveCount) : 0);
    return {
      name: new Date(s.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      present: presentCount,
      late: lateCount,
      leave: leaveCount,
      absent: absentCount,
    };
  });

  // Filter Today's Birthday Students
  const isHostelActiveBirthday = (st: BirthdayStudent) => {
    if (st.isActive === false) return false;
    const room = (st.room || '').trim().toLowerCase();
    const status = (st.status || '').trim().toLowerCase();
    if (!room || room === 'n/a' || room === 'alumni') return false;
    if (['alumni', 'left', 'cancel-admission', 'rejected-admission'].includes(status)) return false;
    return true;
  };

  const filteredBirthdays = birthdayStudents.filter(st => {
    if (birthdayFilter === 'active' && !isHostelActiveBirthday(st)) return false;
    const q = birthdaySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (st.name || '').toLowerCase().includes(q) ||
      (st.studentCode || '').toLowerCase().includes(q) ||
      (st.room || '').toLowerCase().includes(q) ||
      (st.phone || '').toLowerCase().includes(q) ||
      (st.whatsappNumber || '').toLowerCase().includes(q) ||
      (st.groupName || '').toLowerCase().includes(q)
    );
  });

  const activeBirthdayCount = birthdayStudents.filter(isHostelActiveBirthday).length;

  return (
    <div className="dashboard-content-wrapper">

      {/* Floor Leader Notice Banner */}
      {stats?.is_leader_view && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 20px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '14px',
          color: '#1e40af'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb'
          }}>
            <Users size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Floor Leader Dashboard</div>
            <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '1px' }}>
              Showing real-time attendance & 3-day absentee metrics for your assigned floors: <strong>{stats.assigned_floors?.map((f: any) => `Floor ${f}`).join(', ')}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Session & Date Filter Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        backgroundColor: '#ffffff',
        padding: '18px 22px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
      }}>
        {/* Tier 1: Session Live Indicator & Date Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          paddingBottom: '12px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          {/* Left: Active Session Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isToday
                ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
              color: '#ffffff',
              padding: '5px 13px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              boxShadow: isToday ? '0 2px 8px rgba(79, 70, 229, 0.2)' : 'none'
            }}>
              {isToday ? (
                <>
                  <Sparkles size={13} />
                  {isRecent ? 'RECENT SESSION' : 'SELECTED SESSION'}
                </>
              ) : (
                <>
                  <History size={13} />
                  HISTORICAL VIEW
                </>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                {isToday ? 'Showing Live:' : 'Session:'} <strong style={{ color: '#4f46e5' }}>{currentSessionName}</strong>
              </span>
              <span style={{
                fontSize: '12px',
                color: '#475569',
                backgroundColor: '#f1f5f9',
                padding: '3px 9px',
                borderRadius: '8px',
                fontWeight: 600
              }}>
                📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Right: Date Picker, Today Button, Live Status & Refresh */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {/* Date Input Box */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '10px',
            }}>
              <Calendar size={14} color="#4f46e5" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Quick Button to Jump Back to Today */}
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                title="Reset to current date"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <RotateCcw size={12} />
                Today
              </button>
            )}

            {/* Live Sync / Historical Badge */}
            {isToday ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#059669',
              }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                  animation: 'pulse 1.5s infinite',
                }}></span>
                LIVE SYNC
              </div>
            ) : (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 11px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#475569',
              }}>
                ARCHIVED
              </div>
            )}

            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              title="Refresh Data"
              style={{
                padding: '7px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Tier 2: Session Filter Chips with Icons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginRight: '2px' }}>
            Sessions:
          </span>

          {(stats?.available_sessions || []).map((sess: any) => {
            const isSelected = selectedSessionKey === sess.session_key;
            return (
              <button
                key={sess.session_key}
                onClick={() => setSelectedSessionKey(sess.session_key)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '10px',
                  border: isSelected ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                  backgroundColor: isSelected ? '#4f46e5' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isSelected ? '0 2px 6px rgba(79, 70, 229, 0.2)' : 'none'
                }}
              >
                {renderSessionIcon(
                  sess.icon_name,
                  sess.session_key,
                  14,
                  undefined,
                  { color: isSelected ? '#ffffff' : '#64748b' }
                )}
                <span>{sess.session_name}</span>
                {sess.present_today > 0 && (
                  <span style={{
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#e0e7ff',
                    color: isSelected ? '#ffffff' : '#4338ca',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}>
                    {sess.present_today}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        {/* Total Students */}
        <HamsCard padding="20px" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                TOTAL STUDENTS
              </span>
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a' }}>
                {stats?.total_students || 0}
              </span>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}>
              <Users size={22} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>Active in database</div>
        </HamsCard>

        {/* Present Today */}
        <HamsCard padding="20px" style={{ borderLeft: '4px solid #2A9D8F' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                PRESENT TODAY
              </span>
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#2A9D8F' }}>
                {stats?.present_today || 0}
              </span>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#e6f5f3', borderRadius: '12px', color: '#2A9D8F' }}>
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#2A9D8F', fontWeight: 600, marginTop: '10px' }}>
            In {currentSessionName} (Live)
          </div>
        </HamsCard>

        {/* Late Today */}
        <HamsCard padding="20px" style={{ borderLeft: '4px solid #E09F3E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                LATE TODAY
              </span>
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#E09F3E' }}>
                {stats?.late_today || 0}
              </span>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#fdf6ea', borderRadius: '12px', color: '#E09F3E' }}>
              <Clock size={22} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#E09F3E', fontWeight: 600, marginTop: '10px' }}>
            In {currentSessionName} (Live)
          </div>
        </HamsCard>

        {/* Leave Today */}
        <HamsCard padding="20px" style={{ borderLeft: '4px solid #7B73D1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                LEAVE TODAY
              </span>
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#7B73D1' }}>
                {stats?.leave_today || 0}
              </span>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f2f1fa', borderRadius: '12px', color: '#7B73D1' }}>
              <Calendar size={22} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#7B73D1', fontWeight: 600, marginTop: '10px' }}>
            In {currentSessionName} (Approved)
          </div>
        </HamsCard>

        {/* Absent Today */}
        <HamsCard padding="20px" style={{ borderLeft: '4px solid #E76F51' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                ABSENT TODAY
              </span>
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#E76F51' }}>
                {stats?.absent_today || 0}
              </span>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#fdf1ee', borderRadius: '12px', color: '#E76F51' }}>
              <XCircle size={22} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#E76F51', fontWeight: 600, marginTop: '10px' }}>
            In {currentSessionName} (Live)
          </div>
        </HamsCard>
      </div>

      {/* Main Grid: Chart & Floor Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
        gap: '18px',
      }}>
        {/* Attendance Trend Chart */}
        <HamsCard padding="18px">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Attendance Overview (Last 7 Days)
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Real-time records for <strong>{currentSessionName}</strong>
              </p>
            </div>
            <BarChart2 size={18} color="#4361ee" />
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            {chartData.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No records recorded in the past 7 days for this session.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} opacity={0.7} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={500} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} fontWeight={500} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)',
                      fontSize: '12px',
                      padding: '10px 14px'
                    }}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={30}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingBottom: '8px', color: '#475569' }}
                  />
                  <Bar dataKey="present" name="Present" fill="#2A9D8F" radius={[6, 6, 0, 0]} barSize={11} />
                  <Bar dataKey="late" name="Late" fill="#E09F3E" radius={[6, 6, 0, 0]} barSize={11} />
                  <Bar dataKey="leave" name="Leave" fill="#7B73D1" radius={[6, 6, 0, 0]} barSize={11} />
                  <Bar dataKey="absent" name="Absent" fill="#E76F51" radius={[6, 6, 0, 0]} barSize={11} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </HamsCard>

        {/* Live Floor Status */}
        <HamsCard padding="18px">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Live Floor Status
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Live count for <strong>{currentSessionName}</strong>
              </p>
            </div>
            <Radio size={18} color="#4f46e5" />
          </div>

          {((stats?.floor_status || []).length === 0) ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No floor data found
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: '10px',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {(stats?.floor_status || []).map((floor: any, i: number) => {
                const presentCount = floor.present_students ?? floor.present ?? 0;
                const totalCount = floor.total_students ?? floor.total ?? 0;
                const perc = totalCount > 0 ? (presentCount / totalCount) * 100 : (floor.percentage || 0);
                return (
                  <div
                    key={floor.floor_id ?? i}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {floor.floor_name || (Number(floor.floor_id) === 0 ? 'Ground Floor' : `Floor ${floor.floor_id}`)}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: presentCount > 0 ? '#10b981' : '#64748b',
                        whiteSpace: 'nowrap'
                      }}>
                        {presentCount}/{totalCount} <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b' }}>({perc.toFixed(0)}%)</span>
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, perc))}%`,
                          height: '100%',
                          backgroundColor: perc >= 80 ? '#10b981' : perc >= 40 ? '#3b82f6' : perc > 0 ? '#f59e0b' : '#cbd5e1',
                          borderRadius: '2px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </HamsCard>
      </div>

      {/* TODAY'S BIRTHDAYS SECTION */}
      <HamsCard padding="24px">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#fdf2f8',
                color: '#db2777',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #fbcfe8'
              }}>
                <Cake size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  Today&apos;s Birthdays
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: '12px',
                    backgroundColor: filteredBirthdays.length > 0 ? '#fce7f3' : '#f1f5f9',
                    color: filteredBirthdays.length > 0 ? '#be185d' : '#64748b'
                  }}>
                    {filteredBirthdays.length} Student{filteredBirthdays.length === 1 ? '' : 's'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: '12px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb'
                  }}>
                    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Students celebrating their birthday today. Send personalized wishes via WhatsApp using an admin template or a custom message.
                </p>
              </div>
            </div>
          </div>

          {/* Filters for Today's Birthdays */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setBirthdayFilter('active')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: birthdayFilter === 'active' ? '#ffffff' : 'transparent',
                  color: birthdayFilter === 'active' ? '#db2777' : '#64748b',
                  boxShadow: birthdayFilter === 'active' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Active Hostel ({activeBirthdayCount})
              </button>
              <button
                type="button"
                onClick={() => setBirthdayFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: birthdayFilter === 'all' ? '#ffffff' : 'transparent',
                  color: birthdayFilter === 'all' ? '#db2777' : '#64748b',
                  boxShadow: birthdayFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                All ({birthdayStudents.length})
              </button>
            </div>

            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by Name, ID, Room..."
                value={birthdaySearch}
                onChange={e => setBirthdaySearch(e.target.value)}
                style={{ width: '100%', height: '38px', paddingLeft: '36px', paddingRight: '12px', fontSize: '13px', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
              />
            </div>

            <span style={{
              padding: '6px 12px',
              borderRadius: '20px',
              backgroundColor: isWhatsAppConnected ? '#ecfdf5' : '#fffbeb',
              color: isWhatsAppConnected ? '#047857' : '#b45309',
              border: `1px solid ${isWhatsAppConnected ? '#a7f3d0' : '#fde68a'}`,
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isWhatsAppConnected ? '#10b981' : '#f59e0b' }} />
              {isWhatsAppConnected ? 'WhatsApp Connected' : 'WhatsApp Offline'}
            </span>
          </div>
        </div>

        {/* Today's Birthdays Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Code</th>
                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Student Name</th>
                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Floor &amp; Room</th>
                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Group</th>
                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>WhatsApp / Contact</th>
                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>DOB &amp; Age</th>
                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Wish Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingBirthdays ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    Loading today&apos;s birthdays...
                  </td>
                </tr>
              ) : filteredBirthdays.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                    🎂 No {birthdayFilter === 'active' ? 'active hostel ' : ''}student birthdays today ({new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}).
                    {birthdayFilter === 'active' && birthdayStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setBirthdayFilter('all')}
                        style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#db2777', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        View {birthdayStudents.length} alumni/inactive birthday(s)
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredBirthdays.map((st) => {
                  const age = computeTurningAge(st.dob);
                  const isActiveHostel = isHostelActiveBirthday(st);
                  return (
                    <tr key={st.studentId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#2563eb', whiteSpace: 'nowrap' }}>
                        {st.studentCode}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>🎂</span>
                          <div>
                            <div>{st.name}</div>
                            {!isActiveHostel && (
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                                {st.status || 'Alumni / Inactive'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {isActiveHostel ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              padding: '3px 9px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#334155'
                            }}>
                              {st.floorId ? `Floor ${st.floorId}` : 'Ground'}
                            </span>
                            <span style={{
                              padding: '3px 9px',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 800
                            }}>
                              Room {st.room}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>No Room</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {st.groupName ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            backgroundColor: '#eef2ff',
                            color: '#4f46e5',
                            border: '1px solid #c7d2fe',
                            fontSize: '12px',
                            fontWeight: 700
                          }}>
                            <Layers size={11} />
                            {st.groupName}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {st.whatsappNumber || st.phone ? (
                          <a
                            href={`tel:${st.whatsappNumber || st.phone}`}
                            style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                          >
                            <Phone size={13} /> {st.whatsappNumber || st.phone}
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                            {st.dob ? formatDateShort(st.dob) : 'Today'}
                          </span>
                          {age && (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '999px',
                              backgroundColor: '#fdf2f8',
                              color: '#be185d',
                              border: '1px solid #fbcfe8'
                            }}>
                              Turning {age}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {st.alreadySentToday ? (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: '#ecfdf5',
                            color: '#065f46',
                            border: '1px solid #a7f3d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={13} /> Wish Sent
                          </span>
                        ) : (
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: '#fdf2f8',
                            color: '#be185d',
                            border: '1px solid #fbcfe8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Cake size={13} /> Ready to Wish
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => openBirthdayWhatsAppModal(st)}
                          style={{
                            padding: '7px 14px',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '9px',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.28)'
                          }}
                        >
                          <MessageSquare size={14} />
                          Send WhatsApp
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </HamsCard>

      {/* SEND BIRTHDAY WHATSAPP POP-UP MODAL (TEMPLATE OR MANUAL MESSAGE) */}
      {waModal?.isOpen && createPortal(
        <div
          className="modal-backdrop"
          style={{ zIndex: 1200 }}
          onClick={(e) => { if (e.target === e.currentTarget && !sendingWa) setWaModal(null); }}
        >
          <div
            className="modal-content-card"
            style={{ maxWidth: '580px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '11px',
                  backgroundColor: '#ecfdf5',
                  color: '#16a34a',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Send Birthday WhatsApp Message
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    🎂 {waModal.student.name} (ID: {waModal.student.studentCode})
                    {waModal.student.room && waModal.student.room !== 'N/A' ? ` • Room ${waModal.student.room}` : ''}
                    {computeTurningAge(waModal.student.dob) ? ` • Turning ${computeTurningAge(waModal.student.dob)}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !sendingWa && setWaModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipient Phone Selector */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Recipient WhatsApp Number
                </label>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isWhatsAppConnected ? '#059669' : '#d97706'
                }}>
                  {isWhatsAppConnected ? '● Server WhatsApp Connected' : '● Server WhatsApp Disconnected'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={waModal.phone}
                  onChange={e => setWaModal({ ...waModal, phone: e.target.value, error: undefined })}
                  placeholder="Enter WhatsApp number..."
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '9px 12px',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                />
                {waModal.student.parentPhone && waModal.student.parentPhone !== waModal.phone && (
                  <button
                    type="button"
                    onClick={() => setWaModal({ ...waModal, phone: waModal.student.parentPhone || '' })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '9px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Use Parent ({waModal.student.parentPhone})
                  </button>
                )}
              </div>
            </div>

            {/* Mode Switcher: Admin WhatsApp Template vs Manual Message */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  const tpl = waTemplates.find(t => t.id === waModal.selectedTemplateId) || waTemplates[0] || null;
                  setWaModal({
                    ...waModal,
                    mode: 'template',
                    selectedTemplateId: tpl ? tpl.id : null,
                    message: tpl ? applyTemplateVariables(tpl.content, waModal.student) : waModal.message,
                    imageUrl: tpl?.image_url || null,
                    error: undefined
                  });
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: waModal.mode === 'template' ? '#ffffff' : 'transparent',
                  color: waModal.mode === 'template' ? '#16a34a' : '#64748b',
                  boxShadow: waModal.mode === 'template' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <FileText size={14} />
                Select WhatsApp Template
              </button>
              <button
                type="button"
                onClick={() => setWaModal({ ...waModal, mode: 'manual', imageUrl: null, error: undefined })}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: waModal.mode === 'manual' ? '#ffffff' : 'transparent',
                  color: waModal.mode === 'manual' ? '#4f46e5' : '#64748b',
                  boxShadow: waModal.mode === 'manual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <MessageSquare size={14} />
                Write Message Manually
              </button>
            </div>

            {/* Template Picker (when mode === 'template') */}
            {waModal.mode === 'template' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Choose Admin-Created WhatsApp Template ({waTemplates.length} available)
                </label>
                {loadingTemplates ? (
                  <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    Loading templates...
                  </div>
                ) : waTemplates.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: '12px', color: '#b45309', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    No WhatsApp templates created yet. Switch to <strong>Write Message Manually</strong> or create templates under WhatsApp → Templates.
                  </div>
                ) : (
                  <>
                    <select
                      value={waModal.selectedTemplateId ?? ''}
                      onChange={e => {
                        const idNum = Number(e.target.value);
                        if (idNum) handleSelectTemplateInModal(idNum);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#0f172a',
                        cursor: 'pointer'
                      }}
                    >
                      {waTemplates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ({tpl.category || 'general'}){tpl.image_url ? ' 🖼️' : ''}
                        </option>
                      ))}
                    </select>

                    {waModal.imageUrl && (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px 10px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '12px',
                        color: '#475569'
                      }}>
                        <ImageIcon size={15} color="#4f46e5" />
                        <span>Template includes an attached image (will be sent automatically with the message).</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Message Box (Editable Preview for Template OR Manual Editor) */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  {waModal.mode === 'template' ? 'Message Preview (Auto-filled for this student — editable)' : 'Write Custom WhatsApp Message'}
                </label>
                {waModal.mode === 'manual' && (
                  <button
                    type="button"
                    onClick={() =>
                      setWaModal({
                        ...waModal,
                        message: `🎂 Happy Birthday ${waModal.student.name}! Wishing you a joyful day and a bright, successful year ahead. — AVD Hostel`
                      })
                    }
                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Insert Birthday Greeting
                  </button>
                )}
              </div>
              <textarea
                rows={5}
                value={waModal.message}
                onChange={e => setWaModal({ ...waModal, message: e.target.value, error: undefined })}
                placeholder="Type your birthday WhatsApp message here..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Error / Success Alerts */}
            {waModal.error && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <AlertCircle size={16} />
                <span>{waModal.error}</span>
              </div>
            )}

            {waModal.success && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#065f46',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}>
                <CheckCircle2 size={16} />
                <span>{waModal.success}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              {waModal.phone.trim() ? (
                <a
                  href={`https://wa.me/${waModal.phone.replace(/\D/g, '').length === 10 ? '91' + waModal.phone.replace(/\D/g, '') : waModal.phone.replace(/\D/g, '')}?text=${encodeURIComponent(waModal.message)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '9px 14px',
                    borderRadius: '9px',
                    border: '1px solid #bbf7d0',
                    backgroundColor: '#f0fdf4',
                    color: '#15803d',
                    fontSize: '12px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <ExternalLink size={13} />
                  Open in WhatsApp Web
                </a>
              ) : <div />}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  disabled={sendingWa}
                  onClick={() => setWaModal(null)}
                  style={{
                    padding: '10px 18px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '9px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#475569'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingWa || !waModal.message.trim() || !waModal.phone.trim()}
                  onClick={handleSendBirthdayWhatsApp}
                  style={{
                    padding: '10px 20px',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '9px',
                    cursor: sendingWa ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: sendingWa || !waModal.message.trim() || !waModal.phone.trim() ? 0.65 : 1,
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  <Send size={14} />
                  {sendingWa ? 'Sending...' : 'Send WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

