import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  PlusCircle,
  Edit2,
  Eye,
  BarChart3,
  Search,
  CheckCircle2,
  Calendar,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Filter,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { HamsCard } from '../../components/HamsCard';
import { renderSessionIcon } from '../../utils/sessionIcons';
import { EditSessionModal } from '../../components/EditSessionModal';

export const SessionsManagementView: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'multiple' | 'single'>('all');
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/sessions');
      if (res.data.success && Array.isArray(res.data.data)) {
        setSessions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleToggleMultiple = async (session: any) => {
    const sKey = session.session_key;
    const currentMultiple = Boolean(session.has_multiple_attendance);
    const newMultiple = !currentMultiple;

    setTogglingKey(sKey);
    try {
      const res = await apiClient.patch(`/admin/sessions/${sKey}/toggle-multiple-attendance`, {
        enabled: newMultiple
      });

      if (res.data.success) {
        setSessions(prev => prev.map(s => s.session_key === sKey ? { ...s, ...res.data.data } : s));
      } else {
        alert(res.data.message || 'Failed to toggle multiple-time attendance');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to toggle multiple-time attendance');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleSessionUpdated = (updatedSession: any) => {
    setSessions(prev => prev.map(s => s.session_key === updatedSession.session_key ? { ...s, ...updatedSession } : s));
    fetchSessions();
  };

  const format12H = (timeStr?: string | null) => {
    if (!timeStr) return '—';
    const parts = String(timeStr).trim().split(':');
    if (parts.length < 2) return timeStr;
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    const nameMatch = (s.session_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (s.session_key || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!nameMatch) return false;

    if (modeFilter === 'multiple') {
      return Boolean(s.has_multiple_attendance);
    }
    if (modeFilter === 'single') {
      return !Boolean(s.has_multiple_attendance);
    }
    return true;
  });

  const totalSessions = sessions.length;
  const multipleCount = sessions.filter(s => s.has_multiple_attendance).length;
  const singleCount = totalSessions - multipleCount;

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ padding: '8px', borderRadius: '12px', backgroundColor: '#e0e7ff', color: '#4338ca' }}>
              <Layers size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                Attendance Session Management
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Manage all existing attendance sessions, enable Multiple-Time (Two-Phase) Attendance, and update window timings.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/session_add')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
            }}
          >
            <PlusCircle size={16} />
            <span>Create New Session</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <HamsCard padding="18px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Total Sessions
            </span>
            <span style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#475569' }}>
              <Clock size={16} />
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>{totalSessions}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Active configured routine sessions
          </div>
        </HamsCard>

        <HamsCard padding="18px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>
              Multiple-Time (2-Phase)
            </span>
            <span style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#7c3aed' }}>
              <Sparkles size={16} />
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#7c3aed' }}>{multipleCount}</div>
          <div style={{ fontSize: '12px', color: '#7e22ce', marginTop: '4px' }}>
            Two-window attendance configured
          </div>
        </HamsCard>

        <HamsCard padding="18px">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
              Single Attendance
            </span>
            <span style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#dbeafe', color: '#2563eb' }}>
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#2563eb' }}>{singleCount}</div>
          <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '4px' }}>
            Standard single window sessions
          </div>
        </HamsCard>
      </div>

      {/* Filter and Search Bar */}
      <HamsCard padding="18px">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search session by name or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} color="#64748b" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Filter:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setModeFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid #cbd5e1',
                  backgroundColor: modeFilter === 'all' ? '#0f172a' : '#ffffff',
                  color: modeFilter === 'all' ? '#ffffff' : '#475569',
                  cursor: 'pointer'
                }}
              >
                All ({totalSessions})
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('multiple')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid #ddd6fe',
                  backgroundColor: modeFilter === 'multiple' ? '#7c3aed' : '#ffffff',
                  color: modeFilter === 'multiple' ? '#ffffff' : '#7c3aed',
                  cursor: 'pointer'
                }}
              >
                2-Phase ({multipleCount})
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('single')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid #bfdbfe',
                  backgroundColor: modeFilter === 'single' ? '#2563eb' : '#ffffff',
                  color: modeFilter === 'single' ? '#ffffff' : '#2563eb',
                  cursor: 'pointer'
                }}
              >
                Single ({singleCount})
              </button>
            </div>
          </div>
        </div>
      </HamsCard>

      {/* Sessions Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        {filteredSessions.length === 0 ? (
          <HamsCard padding="36px">
            <div style={{ textAlign: 'center', color: '#64748b' }}>
              <Clock size={40} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, color: '#334155' }}>
                No Sessions Found
              </h3>
              <p style={{ margin: 0, fontSize: '13px' }}>
                No attendance sessions matched your search criteria.
              </p>
            </div>
          </HamsCard>
        ) : (
          filteredSessions.map((s) => {
            const isMultiple = Boolean(s.has_multiple_attendance);
            const isTogglingThis = togglingKey === s.session_key;

            return (
              <HamsCard key={s.session_key} padding="22px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Top Row: Icon, Name, Mode Badge, Target Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '14px',
                          backgroundColor: isMultiple ? '#f5f3ff' : '#eff6ff',
                          color: isMultiple ? '#7c3aed' : '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: isMultiple ? '1px solid #ddd6fe' : '1px solid #bfdbfe'
                        }}
                      >
                        {renderSessionIcon(s.icon_name, s.session_key, 22, '')}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                            {s.session_name}
                          </h3>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              backgroundColor: '#f1f5f9',
                              color: '#475569'
                            }}
                          >
                            {s.session_key}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          {s.is_for_all_students ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', backgroundColor: '#f0fdf4', padding: '1px 8px', borderRadius: '6px' }}>
                              🌟 All Students
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', backgroundColor: '#fef3c7', padding: '1px 8px', borderRadius: '6px' }}>
                              🎯 Selective Group
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Multiple-Time Attendance Badge & Quick Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isMultiple ? (
                        <div
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            backgroundColor: '#ede9fe',
                            color: '#6d28d9',
                            border: '1.5px solid #c4b5fd',
                            fontSize: '12px',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Sparkles size={14} />
                          <span>Multiple-Time Attendance (2-Phase) Active</span>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            border: '1.5px solid #e2e8f0',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Clock size={14} />
                          <span>Single Attendance Session</span>
                        </div>
                      )}

                      {/* Enable/Disable Multiple Attendance Quick Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleMultiple(s)}
                        disabled={isTogglingThis}
                        title={isMultiple ? "Click to switch to single attendance" : "Click to enable two-phase attendance"}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '10px',
                          border: isMultiple ? '1px solid #fecaca' : '1px solid #c4b5fd',
                          backgroundColor: isMultiple ? '#fef2f2' : '#f5f3ff',
                          color: isMultiple ? '#dc2626' : '#6d28d9',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: isTogglingThis ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isMultiple ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        <span>{isMultiple ? 'Disable 2-Phase' : 'Enable 2-Phase'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Windows Breakdown Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMultiple ? '1fr 1fr' : '1fr',
                      gap: '12px',
                      backgroundColor: '#f8fafc',
                      padding: '14px',
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    {/* Window 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#3b82f6', color: '#ffffff', fontSize: '10px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          1
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
                          {isMultiple ? 'First Attendance Window' : 'Configured Timing Window'}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginLeft: '24px' }}>
                        {format12H(s.start_time)} – {format12H(s.end_time)}
                      </div>
                      {s.late_time && (
                        <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, marginLeft: '24px' }}>
                          Late arrival after {format12H(s.late_time)}
                        </div>
                      )}
                    </div>

                    {/* Window 2 (if multiple enabled) */}
                    {isMultiple && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#8b5cf6', color: '#ffffff', fontSize: '10px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            2
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#4c1d95' }}>
                            Second Attendance Window
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#4c1d95', marginLeft: '24px' }}>
                          {format12H(s.phase2_start_time)} – {format12H(s.phase2_end_time)}
                        </div>
                        {s.phase2_late_time && (
                          <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginLeft: '24px' }}>
                            Late arrival after {format12H(s.phase2_late_time)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Actions Row (Section 4 Requirements) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      All student assignments and past attendance timestamps are strictly preserved.
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* 1. View Session */}
                      <button
                        type="button"
                        onClick={() => navigate(`/session/${s.session_key}`)}
                        title="View Live Session & Manage Attendance"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={15} />
                        <span>View Session</span>
                      </button>

                      {/* 2. Edit Session */}
                      <button
                        type="button"
                        onClick={() => setEditingSession(s)}
                        title="Edit Session Name, Timings & Multiple-Time Attendance"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #c7d2fe',
                          backgroundColor: '#eef2ff',
                          color: '#4338ca',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <Edit2 size={15} />
                        <span>Edit Session</span>
                      </button>

                      {/* 3. View Attendance Report */}
                      <button
                        type="button"
                        onClick={() => navigate(`/attendance-reports?session=${s.session_key}`)}
                        title="View Historical & Daily Attendance Report for this session"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid #bbf7d0',
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <BarChart3 size={15} />
                        <span>View Attendance Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              </HamsCard>
            );
          })
        )}
      </div>

      {/* Edit Session Modal */}
      {editingSession && (
        <EditSessionModal
          isOpen={Boolean(editingSession)}
          onClose={() => setEditingSession(null)}
          session={editingSession}
          onSessionUpdated={handleSessionUpdated}
        />
      )}
    </div>
  );
};
