import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarClock,
  Plus,
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Edit2,
  Trash2,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Download,
  Radio
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import './OneDayAttendanceView.css';

interface OneDaySession {
  id: number;
  title: string;
  description?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  late_time?: string | null;
  marking_method: 'one_tap' | 'passcode';
  passcode?: string | null;
  target_type: 'all' | 'floors' | 'students';
  target_floors?: any;
  target_students?: any;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  total_assigned: number;
  total_present: number;
  total_absent: number;
  total_late: number;
  total_on_time: number;
  attendance_percentage: number;
  live_status: 'upcoming' | 'live' | 'expired' | 'completed' | 'cancelled';
}

interface StudentReportItem {
  student_id: number;
  student_code: string;
  name: string;
  phone_number: string;
  room_number: string;
  floor_id: number;
  is_marked: boolean;
  status: 'present' | 'late' | 'absent';
  is_late: boolean;
  marked_at: string | null;
  marked_time: string | null;
  marking_method: string | null;
  ip_address: string | null;
}

interface SessionReportData {
  session: OneDaySession;
  summary: {
    total_assigned: number;
    total_present: number;
    total_absent: number;
    total_on_time: number;
    total_late: number;
    attendance_percentage: number;
  };
  students: StudentReportItem[];
}

export const OneDayAttendanceView: React.FC = () => {
  // Session list state
  const [sessions, setSessions] = useState<OneDaySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab & Search filters
  const [filterTab, setFilterTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<OneDaySession | null>(null);
  const [savingSession, setSavingSession] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('11:00');
  const [formLateTime, setFormLateTime] = useState('');

  // Report view state (when viewing individual session report)
  const [activeReportSessionId, setActiveReportSessionId] = useState<number | null>(null);
  const [reportData, setReportData] = useState<SessionReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'present' | 'absent' | 'on_time' | 'late'>('all');

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/one-day-attendance/sessions');
      if (res.data?.success) {
        setSessions(res.data.data || []);
      } else {
        setError(res.data?.message || 'Failed to load sessions');
      }
    } catch (err: any) {
      console.error('Error fetching one-day sessions:', err);
      setError(err.response?.data?.message || err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingSession(null);
    setFormTitle('');
    setFormDescription('');
    const today = new Date().toISOString().slice(0, 10);
    setFormDate(today);
    setFormStartTime('09:00');
    setFormEndTime('11:00');
    setFormLateTime('');
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sess: OneDaySession) => {
    setEditingSession(sess);
    setFormTitle(sess.title);
    setFormDescription(sess.description || '');
    setFormDate(sess.session_date);
    setFormStartTime(sess.start_time?.slice(0, 5) || '09:00');
    setFormEndTime(sess.end_time?.slice(0, 5) || '11:00');
    setFormLateTime(sess.late_time ? sess.late_time.slice(0, 5) : '');
    setModalOpen(true);
  };

  // Save session (Create or Update)
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Please enter a session title');
      return;
    }
    if (!formDate) {
      alert('Please select an attendance date');
      return;
    }
    if (formStartTime >= formEndTime) {
      alert('Start time must be earlier than end time');
      return;
    }

    setSavingSession(true);
    try {
      const payload: any = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        session_date: formDate,
        start_time: formStartTime,
        end_time: formEndTime,
        late_time: formLateTime ? formLateTime : null,
        marking_method: 'bluetooth',
        passcode: null,
        target_type: 'all',
        target_floors: null,
        target_students: null
      };

      if (editingSession) {
        const res = await apiClient.put(`/one-day-attendance/sessions/${editingSession.id}`, payload);
        if (res.data?.success) {
          setModalOpen(false);
          fetchSessions();
        } else {
          alert(res.data?.message || 'Failed to update session');
        }
      } else {
        const res = await apiClient.post('/one-day-attendance/sessions', payload);
        if (res.data?.success) {
          setModalOpen(false);
          fetchSessions();
        } else {
          alert(res.data?.message || 'Failed to create session');
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error saving session');
    } finally {
      setSavingSession(false);
    }
  };

  // Toggle session status
  const handleToggleStatus = async (sess: OneDaySession) => {
    const nextStatus = sess.status === 'active' ? 'completed' : 'active';
    const confirmMsg = sess.status === 'active'
      ? `Close this session? Students will no longer be able to mark attendance.`
      : `Reactivate this session?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await apiClient.patch(`/one-day-attendance/sessions/${sess.id}/status`, { status: nextStatus });
      if (res.data?.success) {
        fetchSessions();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update status');
    }
  };

  // Delete session
  const handleDeleteSession = async (sess: OneDaySession) => {
    if (!window.confirm(`Are you sure you want to delete session "${sess.title}"? All associated attendance records will be removed.`)) {
      return;
    }

    try {
      const res = await apiClient.delete(`/one-day-attendance/sessions/${sess.id}`);
      if (res.data?.success) {
        fetchSessions();
        if (activeReportSessionId === sess.id) {
          setActiveReportSessionId(null);
          setReportData(null);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to delete session');
    }
  };

  // Open Individual Session Report
  const handleOpenReport = async (sessionId: number) => {
    setActiveReportSessionId(sessionId);
    setReportLoading(true);
    setReportData(null);
    try {
      const res = await apiClient.get(`/one-day-attendance/sessions/${sessionId}/report`);
      if (res.data?.success) {
        setReportData(res.data.data);
      } else {
        alert(res.data?.message || 'Failed to load report');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error loading report');
    } finally {
      setReportLoading(false);
    }
  };

  // Export report to CSV
  const handleExportCSV = () => {
    if (!reportData || !reportData.students || reportData.students.length === 0) return;

    const headers = [
      'Student Name',
      'Student Code',
      'Room Number',
      'Floor',
      'Phone Number',
      'Attendance Status',
      'Marked Time',
      'Is Late',
      'Marking Method',
      'IP Address'
    ];

    const rows = reportData.students.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.student_code}"`,
      `"${s.room_number}"`,
      s.floor_id,
      `"${s.phone_number}"`,
      s.status.toUpperCase(),
      `"${s.marked_at || ''}"`,
      s.is_late ? 'YES' : 'NO',
      `"${s.marking_method || ''}"`,
      `"${s.ip_address || ''}"`
    ]);

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `OneDay_Attendance_${reportData.session.title.replace(/\s+/g, '_')}_${reportData.session.session_date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF
  const handlePrintPDF = () => {
    window.print();
  };

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Tab filter
      if (filterTab === 'live' && s.live_status !== 'live') return false;
      if (filterTab === 'upcoming' && s.live_status !== 'upcoming') return false;
      if (filterTab === 'completed' && s.live_status !== 'completed' && s.live_status !== 'expired') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.session_date.includes(q)
        );
      }
      return true;
    });
  }, [sessions, filterTab, searchQuery]);

  // Filtered report students list
  const filteredReportStudents = useMemo(() => {
    if (!reportData) return [];
    return reportData.students.filter((s) => {
      // Status filter
      if (reportStatusFilter === 'present' && !s.is_marked) return false;
      if (reportStatusFilter === 'absent' && s.is_marked) return false;
      if (reportStatusFilter === 'on_time' && (!s.is_marked || s.is_late)) return false;
      if (reportStatusFilter === 'late' && (!s.is_marked || !s.is_late)) return false;

      // Search
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase().trim();
        return (
          s.name.toLowerCase().includes(q) ||
          s.student_code.toLowerCase().includes(q) ||
          String(s.room_number).toLowerCase().includes(q) ||
          s.phone_number.includes(q)
        );
      }
      return true;
    });
  }, [reportData, reportStatusFilter, reportSearch]);

  // Overall KPI metrics across all sessions
  const overallKPIs = useMemo(() => {
    const totalSessions = sessions.length;
    const activeToday = sessions.filter(s => s.live_status === 'live').length;
    const totalMarked = sessions.reduce((acc, s) => acc + (s.total_present || 0), 0);
    const avgPercentage = totalSessions > 0
      ? Number((sessions.reduce((acc, s) => acc + s.attendance_percentage, 0) / totalSessions).toFixed(1))
      : 0;

    return { totalSessions, activeToday, totalMarked, avgPercentage };
  }, [sessions]);

  return (
    <div className="oda-container">
      {/* If an individual session report is opened, render report view */}
      {activeReportSessionId && reportData ? (
        <section className="report-view-card">
          {/* Report Top Header */}
          <div className="report-view-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                className="report-back-btn"
                onClick={() => {
                  setActiveReportSessionId(null);
                  setReportData(null);
                }}
              >
                <ChevronLeft size={16} />
                <span>All Sessions</span>
              </button>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                  {reportData.session.title} — Session Report
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  📅 {reportData.session.session_date} • ⏰ {reportData.session.start_time.slice(0, 5)} to {reportData.session.end_time.slice(0, 5)}
                  {reportData.session.late_time && ` • Late Cutoff: ${reportData.session.late_time.slice(0, 5)}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={handleExportCSV}>
                <Download size={15} />
                <span>Export CSV</span>
              </button>
              <button className="btn-secondary" onClick={handlePrintPDF}>
                <Printer size={15} />
                <span>Print / PDF</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleOpenReport(activeReportSessionId)}
                title="Refresh report data"
              >
                <RefreshCw size={15} className={reportLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="oda-kpi-grid">
            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Assigned Students</span>
                <Users size={20} style={{ color: '#4f46e5' }} />
              </div>
              <div className="oda-kpi-value">{reportData.summary.total_assigned}</div>
              <div className="oda-kpi-sub">Total eligible students</div>
            </div>

            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Present</span>
                <CheckCircle2 size={20} style={{ color: '#10b981' }} />
              </div>
              <div className="oda-kpi-value" style={{ color: '#15803d' }}>
                {reportData.summary.total_present}
              </div>
              <div className="oda-kpi-sub" style={{ color: '#16a34a' }}>
                {reportData.summary.attendance_percentage}% attendance rate
              </div>
            </div>

            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Absent</span>
                <XCircle size={20} style={{ color: '#ef4444' }} />
              </div>
              <div className="oda-kpi-value" style={{ color: '#b91c1c' }}>
                {reportData.summary.total_absent}
              </div>
              <div className="oda-kpi-sub" style={{ color: '#be123c' }}>
                Did not mark attendance
              </div>
            </div>

            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">On-Time</span>
                <ShieldCheck size={20} style={{ color: '#059669' }} />
              </div>
              <div className="oda-kpi-value" style={{ color: '#059669' }}>
                {reportData.summary.total_on_time}
              </div>
              <div className="oda-kpi-sub">Marked before late cutoff</div>
            </div>

            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Late Arrivals</span>
                <Clock size={20} style={{ color: '#d97706' }} />
              </div>
              <div className="oda-kpi-value" style={{ color: '#d97706' }}>
                {reportData.summary.total_late}
              </div>
              <div className="oda-kpi-sub">Marked after cutoff</div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="search-box-wrap" style={{ maxWidth: '380px' }}>
              <Search size={16} className="search-icon-inside" />
              <input
                type="text"
                className="search-input-field"
                placeholder="Search by student name, code, room, or phone..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
              />
            </div>

            <div className="oda-tab-pills">
              <button
                className={`oda-tab-pill ${reportStatusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setReportStatusFilter('all')}
              >
                All ({reportData.students.length})
              </button>
              <button
                className={`oda-tab-pill ${reportStatusFilter === 'present' ? 'active' : ''}`}
                onClick={() => setReportStatusFilter('present')}
              >
                Present ({reportData.summary.total_present})
              </button>
              <button
                className={`oda-tab-pill ${reportStatusFilter === 'absent' ? 'active' : ''}`}
                onClick={() => setReportStatusFilter('absent')}
              >
                Absent ({reportData.summary.total_absent})
              </button>
              <button
                className={`oda-tab-pill ${reportStatusFilter === 'on_time' ? 'active' : ''}`}
                onClick={() => setReportStatusFilter('on_time')}
              >
                On-Time ({reportData.summary.total_on_time})
              </button>
              <button
                className={`oda-tab-pill ${reportStatusFilter === 'late' ? 'active' : ''}`}
                onClick={() => setReportStatusFilter('late')}
              >
                Late ({reportData.summary.total_late})
              </button>
            </div>
          </div>

          {/* Student Table */}
          <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Room</th>
                  <th>Floor</th>
                  <th>Phone Number</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Marked Time</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {filteredReportStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No student records match the active search/filters.
                    </td>
                  </tr>
                ) : (
                  filteredReportStudents.map((stu) => (
                    <tr key={stu.student_id}>
                      <td>
                        <div className="student-info-cell">
                          <div className="student-avatar">{stu.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="student-name-text">{stu.name}</div>
                            <div className="student-code-text">Code: {stu.student_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{stu.room_number || 'N/A'}</span>
                      </td>
                      <td>Floor {stu.floor_id}</td>
                      <td>{stu.phone_number || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {stu.is_marked ? (
                          stu.is_late ? (
                            <span className="status-pill-badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                              ⏰ Late
                            </span>
                          ) : (
                            <span className="status-pill-badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                              ✓ Present
                            </span>
                          )
                        ) : (
                          <span className="status-pill-badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>
                            ✗ Absent
                          </span>
                        )}
                      </td>
                      <td>
                        {stu.marked_time ? (
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{stu.marked_time}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Not Marked</span>
                        )}
                      </td>
                      <td>
                        {stu.marking_method ? (
                          <span style={{ textTransform: 'capitalize', fontSize: '0.8rem', color: '#475569' }}>
                            {stu.marking_method.replace('_', ' ')}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* Regular Dashboard View */
        <>
          {/* 1. Header Control Card */}
          <section className="oda-header-card">
            <div className="oda-header-left">
              <div className="oda-header-icon-box">
                <CalendarClock size={26} />
              </div>
              <div>
                <h2 className="oda-header-title">One-Day Attendance Management</h2>
                <p className="oda-header-sub">
                  Create single-day on-demand attendance sessions, configure time windows, and track student submissions.
                </p>
              </div>
            </div>

            <button className="btn-create-session" onClick={handleOpenCreateModal}>
              <Plus size={18} />
              <span>Create New Session</span>
            </button>
          </section>

          {/* 2. Overview Stats Cards */}
          <section className="oda-kpi-grid">
            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Total Sessions</span>
                <CalendarClock size={20} style={{ color: '#4f46e5' }} />
              </div>
              <div className="oda-kpi-value">{overallKPIs.totalSessions}</div>
              <div className="oda-kpi-sub">All created one-day sessions</div>
            </div>

            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Active Today</span>
                <Clock size={20} style={{ color: '#10b981' }} />
              </div>
              <div className="oda-kpi-value" style={{ color: '#15803d' }}>
                {overallKPIs.activeToday}
              </div>
              <div className="oda-kpi-sub">Live right now</div>
            </div>

            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Total Attendance Logged</span>
                <CheckCircle2 size={20} style={{ color: '#0284c7' }} />
              </div>
              <div className="oda-kpi-value" style={{ color: '#0369a1' }}>
                {overallKPIs.totalMarked}
              </div>
              <div className="oda-kpi-sub">Student submissions</div>
            </div>

            <div className="oda-kpi-card">
              <div className="oda-kpi-top">
                <span className="oda-kpi-title">Avg Attendance Rate</span>
                <TrendingUp size={20} style={{ color: '#8b5cf6' }} />
              </div>
              <div className="oda-kpi-value" style={{ color: '#6d28d9' }}>
                {overallKPIs.avgPercentage}%
              </div>
              <div className="oda-kpi-sub">Across all sessions</div>
            </div>
          </section>

          {/* 3. Filters and Search Bar */}
          <section className="oda-filter-bar">
            <div className="oda-tab-pills">
              <button
                className={`oda-tab-pill ${filterTab === 'all' ? 'active' : ''}`}
                onClick={() => setFilterTab('all')}
              >
                All Sessions ({sessions.length})
              </button>
              <button
                className={`oda-tab-pill ${filterTab === 'live' ? 'active' : ''}`}
                onClick={() => setFilterTab('live')}
              >
                🟢 Live Now ({sessions.filter(s => s.live_status === 'live').length})
              </button>
              <button
                className={`oda-tab-pill ${filterTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setFilterTab('upcoming')}
              >
                🟡 Upcoming ({sessions.filter(s => s.live_status === 'upcoming').length})
              </button>
              <button
                className={`oda-tab-pill ${filterTab === 'completed' ? 'active' : ''}`}
                onClick={() => setFilterTab('completed')}
              >
                ⚪ Completed / Past ({sessions.filter(s => s.live_status === 'completed' || s.live_status === 'expired').length})
              </button>
            </div>

            <div className="search-box-wrap" style={{ maxWidth: '340px' }}>
              <Search size={16} className="search-icon-inside" />
              <input
                type="text"
                className="search-input-field"
                placeholder="Search session name or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </section>

          {/* 4. Sessions Grid */}
          <section>
            {loading && sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <div>Loading one-day attendance sessions...</div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <CalendarClock size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                <h4 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>No Sessions Found</h4>
                <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.85rem' }}>
                  {searchQuery ? 'No sessions match your search.' : 'Click "Create New Session" above to configure your first one-day attendance session.'}
                </p>
                {!searchQuery && (
                  <button className="btn-create-session" onClick={handleOpenCreateModal}>
                    <Plus size={16} />
                    <span>Create Session</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="oda-sessions-grid">
                {filteredSessions.map((sess) => {
                  const isLive = sess.live_status === 'live';
                  let statusBadgeClass = 'expired';
                  let statusText = 'Closed';
                  if (sess.status === 'cancelled') {
                    statusBadgeClass = 'cancelled';
                    statusText = 'Cancelled';
                  } else if (isLive) {
                    statusBadgeClass = 'live';
                    statusText = 'Live Now';
                  } else if (sess.live_status === 'upcoming') {
                    statusBadgeClass = 'upcoming';
                    statusText = 'Upcoming';
                  }

                  return (
                    <div
                      key={sess.id}
                      className={`oda-session-card ${isLive ? 'live-border' : ''}`}
                    >
                      <div className="oda-card-header">
                        <div>
                          <span className={`oda-badge ${statusBadgeClass}`}>
                            {isLive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803d', display: 'inline-block' }}></span>}
                            {statusText}
                          </span>
                          <h4 className="oda-card-title" style={{ marginTop: '8px' }}>
                            {sess.title}
                          </h4>
                          {sess.description && (
                            <p className="oda-card-desc">{sess.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Details Box */}
                      <div className="oda-details-grid">
                        <div className="oda-detail-item">
                          <Calendar size={14} style={{ color: '#4f46e5' }} />
                          <span><strong>{sess.session_date}</strong></span>
                        </div>
                        <div className="oda-detail-item">
                          <Clock size={14} style={{ color: '#0284c7' }} />
                          <span>{sess.start_time.slice(0, 5)} - {sess.end_time.slice(0, 5)}</span>
                        </div>
                        <div className="oda-detail-item">
                          <Users size={14} style={{ color: '#059669' }} />
                          <span>Audience: <strong>All Students</strong></span>
                        </div>
                        <div className="oda-detail-item">
                          <Radio size={14} style={{ color: '#0d9488' }} />
                          <span>Bluetooth (ESP32)</span>
                        </div>
                      </div>

                      {/* Mini Stats Progress Bar */}
                      <div className="oda-card-stats">
                        <div className="oda-stat-item">
                          <div className="oda-stat-label">Assigned</div>
                          <div className="oda-stat-value">{sess.total_assigned}</div>
                        </div>
                        <div className="oda-stat-item">
                          <div className="oda-stat-label" style={{ color: '#15803d' }}>Present</div>
                          <div className="oda-stat-value" style={{ color: '#15803d' }}>{sess.total_present}</div>
                        </div>
                        <div className="oda-stat-item">
                          <div className="oda-stat-label" style={{ color: '#b91c1c' }}>Absent</div>
                          <div className="oda-stat-value" style={{ color: '#b91c1c' }}>{sess.total_absent}</div>
                        </div>
                        <div className="oda-stat-item">
                          <div className="oda-stat-label" style={{ color: '#4f46e5' }}>Rate</div>
                          <div className="oda-stat-value" style={{ color: '#4f46e5' }}>{sess.attendance_percentage}%</div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="oda-card-actions">
                        <button
                          className="btn-view-report"
                          onClick={() => handleOpenReport(sess.id)}
                          title="Open detailed attendance report"
                        >
                          <FileSpreadsheet size={15} />
                          <span>View Report</span>
                        </button>
                        <button
                          className="btn-action-icon"
                          onClick={() => handleOpenEditModal(sess)}
                          title="Edit session details"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-action-icon"
                          onClick={() => handleToggleStatus(sess)}
                          title={sess.status === 'active' ? 'Close session' : 'Reactivate session'}
                        >
                          {sess.status === 'active' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                        </button>
                        <button
                          className="btn-action-icon danger"
                          onClick={() => handleDeleteSession(sess)}
                          title="Delete session"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Create / Edit Session Modal */}
      {modalOpen &&
        createPortal(
          <div className="modal-overlay" onClick={() => setModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CalendarClock size={22} style={{ color: '#4f46e5' }} />
                  <div>
                    <h3>{editingSession ? 'Edit Attendance Session' : 'Create One-Day Attendance Session'}</h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Configure date, active time window, target students, and marking rules
                    </span>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveSession}>
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                  {/* Session Title */}
                  <div className="oda-form-group">
                    <label>Session Name *</label>
                    <input
                      type="text"
                      className="oda-input"
                      placeholder="e.g. Special Assembly / Blood Donation Camp / Semester Exam Attendance"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  {/* Description / Instructions */}
                  <div className="oda-form-group">
                    <label>Instructions / Description (Visible to Students)</label>
                    <textarea
                      className="oda-textarea"
                      placeholder="Provide special instructions or purpose of attendance for students..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>

                  {/* Date & Times Row */}
                  <div className="oda-modal-grid">
                    <div className="oda-form-group">
                      <label>Attendance Date *</label>
                      <input
                        type="date"
                        className="oda-input"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="oda-form-group">
                      <label>Late Cutoff Time (Optional)</label>
                      <input
                        type="time"
                        className="oda-input"
                        value={formLateTime}
                        onChange={(e) => setFormLateTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="oda-modal-grid">
                    <div className="oda-form-group">
                      <label>Session Start Time *</label>
                      <input
                        type="time"
                        className="oda-input"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        required
                      />
                    </div>
                    <div className="oda-form-group">
                      <label>Session End Time *</label>
                      <input
                        type="time"
                        className="oda-input"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Bluetooth Verification Method - Strictly Enforced */}
                  <div className="oda-form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Radio size={15} color="#0d9488" /> Attendance Verification Method
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: '#f0fdfa',
                      border: '1.5px solid #99f6e4',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      color: '#0f766e',
                      fontSize: '0.88rem',
                      fontWeight: 600
                    }}>
                      <Radio size={18} style={{ color: '#0d9488', flexShrink: 0 }} />
                      <div>
                        <div>ESP32 Bluetooth LE Verification</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#475569', marginTop: '2px' }}>
                          Attendance is taken strictly via classroom ESP32 device scanning. No manual or passcode bypass.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Target Audience - All Students Strictly Enforced */}
                  <div className="oda-form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={15} color="#0284c7" /> Eligible Student Audience
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: '#f0f9ff',
                      border: '1.5px solid #bae6fd',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      color: '#0369a1',
                      fontSize: '0.88rem',
                      fontWeight: 600
                    }}>
                      <Users size={18} style={{ color: '#0284c7', flexShrink: 0 }} />
                      <div>
                        <div>All Enrolled Active Students (Hostel-wide)</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#475569', marginTop: '2px' }}>
                          Every active student is eligible to mark attendance. No specific floor or student restrictions.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-create-session" disabled={savingSession}>
                    {savingSession ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>{editingSession ? 'Update Session' : 'Create Session'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default OneDayAttendanceView;

