import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  Send, 
  Eye, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  X, 
  Phone, 
  Home, 
  ArrowUpDown,
  History,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Edit3,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Tag
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import apiClient from '../../services/apiClient';
import { HamsCard } from '../../components/HamsCard';
import './AttendanceReportsView.css';

interface StudentDetail {
  student_id: number;
  student_code: string;
  name: string;
  phone_number: string;
  parent_phone: string;
  room_number: string;
  floor_id: number;
  sessions_conducted: number;
  sessions_attended: number;
  total_absences: number;
  attendance_percentage: number;
  late_arrivals: number;
  on_time_count: number;
  last_attendance_date: string | null;
  last_attendance_time: string | null;
  attendance_history: Array<{
    date: string;
    session_type: string;
    status: 'present' | 'late' | 'absent';
    marked_time?: string | null;
    source: string;
  }>;
}

interface SummaryData {
  total_registered_students: number;
  total_students_present: number;
  total_students_absent: number;
  overall_attendance_percentage: number;
  total_late_arrivals: number;
  total_on_time_count: number;
  total_sessions_conducted: number;
  daily_trends: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    on_time: number;
  }>;
  punctuality_breakdown: {
    on_time: number;
    late: number;
    absent: number;
  };
}

const SESSION_OPTIONS = [
  { key: 'all', label: 'All Sessions', emoji: '✨' },
  { key: 'aarti', label: 'Aarti', emoji: '🪔' },
  { key: 'sabha', label: 'Sabha', emoji: '📖' },
  { key: 'lunch', label: 'Lunch', emoji: '🍲' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'night', label: 'Night', emoji: '🌙' },
];

const PRESET_DATE_RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: '3months', label: 'Last 3 Months' },
  { key: '6months', label: 'Last 6 Months' },
];

export const DEFAULT_PARENT_TEMPLATE = `🏛️ *SHREE SWAMINARAYAN GURUKUL HOSTEL*
📋 *Official Attendance Report*
━━━━━━━━━━━━━━━━━━━━━━━━━
Respected Parent/Guardian of *{student_name}*,

Here is the attendance report for the period *{start_date}* to *{end_date}*:

👤 *Student Name:* {student_name}
🚪 *Room Number:* {room_number}
⏰ *Session Category:* {session_name}

📊 *Attendance Performance:*
• Total Sessions Conducted: *{sessions_conducted}*
• Sessions Attended: *{sessions_attended}*
• Total Absences: *{total_absences}*
• On-Time Arrivals: *{on_time_count}*
• Late Arrivals: *{late_arrivals}*
• Attendance Rate: *{attendance_percentage}%* ({performance_rating})
• Last Recorded Attendance: *{last_attendance_date}*
{admin_note}
━━━━━━━━━━━━━━━━━━━━━━━━━
_For queries, please contact the Hostel Warden / Administration._
_Hostel Attendance & Management System (HAMS)_`;

export const DEFAULT_STUDENT_TEMPLATE = `🏛️ *SHREE SWAMINARAYAN GURUKUL HOSTEL*
📋 *Official Attendance Report*
━━━━━━━━━━━━━━━━━━━━━━━━━
Dear *{student_name}*,

Here is the attendance report for the period *{start_date}* to *{end_date}*:

👤 *Student Name:* {student_name}
🚪 *Room Number:* {room_number}
⏰ *Session Category:* {session_name}

📊 *Attendance Performance:*
• Total Sessions Conducted: *{sessions_conducted}*
• Sessions Attended: *{sessions_attended}*
• Total Absences: *{total_absences}*
• On-Time Arrivals: *{on_time_count}*
• Late Arrivals: *{late_arrivals}*
• Attendance Rate: *{attendance_percentage}%* ({performance_rating})
• Last Recorded Attendance: *{last_attendance_date}*
{admin_note}
━━━━━━━━━━━━━━━━━━━━━━━━━
_Hostel Attendance & Management System (HAMS)_`;

const TEMPLATE_VARIABLES = [
  { tag: '{student_name}', label: 'Student Name' },
  { tag: '{room_number}', label: 'Room No' },
  { tag: '{student_code}', label: 'Code' },
  { tag: '{session_name}', label: 'Session' },
  { tag: '{start_date}', label: 'Start Date' },
  { tag: '{end_date}', label: 'End Date' },
  { tag: '{sessions_conducted}', label: 'Conducted' },
  { tag: '{sessions_attended}', label: 'Attended' },
  { tag: '{total_absences}', label: 'Absent' },
  { tag: '{on_time_count}', label: 'On-Time' },
  { tag: '{late_arrivals}', label: 'Late' },
  { tag: '{attendance_percentage}', label: 'Percentage' },
  { tag: '{performance_rating}', label: 'Rating' },
  { tag: '{last_attendance_date}', label: 'Last Date' },
  { tag: '{admin_note}', label: 'Admin Note' },
];

function renderClientTemplate(
  template: string,
  student: StudentDetail | null | undefined,
  meta: {
    start_date: string;
    end_date: string;
    session_name: string;
    total_conducted: number;
    admin_note?: string;
  }
): string {
  const tmpl = template || DEFAULT_PARENT_TEMPLATE;
  if (!student) {
    return tmpl
      .replace(/{student_name}/g, '[Student Name]')
      .replace(/{room_number}/g, '[Room Number]')
      .replace(/{student_code}/g, '[Code]')
      .replace(/{session_name}/g, meta.session_name)
      .replace(/{start_date}/g, meta.start_date)
      .replace(/{end_date}/g, meta.end_date)
      .replace(/{sessions_conducted}/g, String(meta.total_conducted))
      .replace(/{sessions_attended}/g, '[Attended Count]')
      .replace(/{total_absences}/g, '[Absences Count]')
      .replace(/{on_time_count}/g, '[On-Time Count]')
      .replace(/{late_arrivals}/g, '[Late Count]')
      .replace(/{attendance_percentage}/g, '[Rate]')
      .replace(/{performance_rating}/g, '[Performance Rating]')
      .replace(/{last_attendance_date}/g, '[Last Date & Time]')
      .replace(/{admin_note}/g, meta.admin_note ? `\n💬 *Admin Remark:* ${meta.admin_note}\n` : '');
  }

  let perfRating = 'Excellent';
  const pct = student.attendance_percentage;
  if (pct < 50) perfRating = 'Needs Immediate Attention';
  else if (pct < 75) perfRating = 'Average / Improvement Needed';
  else if (pct < 90) perfRating = 'Good';

  const lastAttended = student.last_attendance_date
    ? `${student.last_attendance_date} ${student.last_attendance_time || ''}`.trim()
    : 'No Record';

  const adminNoteText = meta.admin_note ? `\n💬 *Admin Remark:* ${meta.admin_note}\n` : '';

  return tmpl
    .replace(/{student_name}/g, student.name || '[Student Name]')
    .replace(/{room_number}/g, String(student.room_number || 'N/A'))
    .replace(/{student_code}/g, String(student.student_code || ''))
    .replace(/{session_name}/g, meta.session_name)
    .replace(/{start_date}/g, meta.start_date)
    .replace(/{end_date}/g, meta.end_date)
    .replace(/{sessions_conducted}/g, String(student.sessions_conducted ?? meta.total_conducted))
    .replace(/{sessions_attended}/g, String(student.sessions_attended ?? 0))
    .replace(/{total_absences}/g, String(student.total_absences ?? 0))
    .replace(/{on_time_count}/g, String(student.on_time_count ?? 0))
    .replace(/{late_arrivals}/g, String(student.late_arrivals ?? 0))
    .replace(/{attendance_percentage}/g, String(student.attendance_percentage ?? 0))
    .replace(/{performance_rating}/g, perfRating)
    .replace(/{last_attendance_date}/g, lastAttended)
    .replace(/{admin_note}/g, adminNoteText);
}

export const AttendanceReportsView: React.FC = () => {
  // Filters & State
  const [sessionType, setSessionType] = useState('all');
  const [filterMode, setFilterMode] = useState<'preset' | 'month' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState('30days');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');

  // Available metadata
  const [availableMonths, setAvailableMonths] = useState<Array<{ value: string; label: string }>>([]);
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');

  // Report Data
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filtering inside Table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'on_time' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'pct_desc' | 'pct_asc' | 'name_asc' | 'name_desc' | 'room_asc' | 'late_desc'>('pct_desc');

  // Bulk Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  // Modals
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewRecipient, setPreviewRecipient] = useState<'parent' | 'student'>('parent');
  const [customNote, setCustomNote] = useState('');
  const [sendingNotifications, setSendingNotifications] = useState(false);

  // Delivery Status Modal
  const [deliveryStatusModalOpen, setDeliveryStatusModalOpen] = useState(false);
  const [deliveryResults, setDeliveryResults] = useState<any>(null);

  // Student History Drawer/Modal
  const [historyModalStudent, setHistoryModalStudent] = useState<StudentDetail | null>(null);

  // Customizable Message Templates State
  const [templates, setTemplates] = useState<Record<string, string>>({
    parent_report: DEFAULT_PARENT_TEMPLATE,
    student_report: DEFAULT_STUDENT_TEMPLATE
  });
  const [activeTemplateText, setActiveTemplateText] = useState<string>(DEFAULT_PARENT_TEMPLATE);
  const [isEditingTemplate, setIsEditingTemplate] = useState<boolean>(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize bounds, presets & templates on mount
  useEffect(() => {
    fetchSessionConfig();
    fetchTemplates();
    applyPresetRange('30days');
  }, []);

  // Fetch templates from database
  const fetchTemplates = async () => {
    try {
      const res = await apiClient.get('/attendance/reports/templates');
      if (res.data?.success && res.data?.data) {
        setTemplates((prev) => ({
          ...prev,
          ...res.data.data
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch attendance report templates, using defaults:', e);
    }
  };

  // Sync active template when preview recipient or saved templates change
  useEffect(() => {
    const key = previewRecipient === 'parent' ? 'parent_report' : 'student_report';
    setActiveTemplateText(templates[key] || (previewRecipient === 'parent' ? DEFAULT_PARENT_TEMPLATE : DEFAULT_STUDENT_TEMPLATE));
  }, [previewRecipient, templates]);

  // Fetch session config & available 6-month bounds from backend
  const fetchSessionConfig = async () => {
    try {
      const res = await apiClient.get('/attendance/reports/sessions');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setMinDate(d.min_date);
        setMaxDate(d.max_date);
        setAvailableMonths(d.available_months || []);
        if (d.available_months?.length > 0) {
          setSelectedMonth(d.available_months[0].value);
        }
      }
    } catch (e) {
      console.warn('Failed to load session config, using defaults:', e);
    }
  };

  const applyPresetRange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    let start = end;

    if (presetKey === 'today') {
      start = end;
    } else if (presetKey === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      start = y.toISOString().slice(0, 10);
      setEndDate(start);
      setStartDate(start);
      return;
    } else if (presetKey === '7days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      start = d.toISOString().slice(0, 10);
    } else if (presetKey === '30days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      start = d.toISOString().slice(0, 10);
    } else if (presetKey === '3months') {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 3);
      start = d.toISOString().slice(0, 10);
    } else if (presetKey === '6months') {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      start = d.toISOString().slice(0, 10);
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleMonthChange = (monthVal: string) => {
    setSelectedMonth(monthVal);
    const [y, m] = monthVal.split('-').map(Number);
    if (y && m) {
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Generate Report
  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        session_type: sessionType,
        start_date: startDate,
        end_date: endDate,
        floor_id: floorFilter
      };

      const res = await apiClient.post('/attendance/reports/generate', payload);
      if (res.data?.success && res.data?.data) {
        setSummary(res.data.data.summary);
        setStudents(res.data.data.students || []);
        // By default, select all students for easy preview & reporting
        setSelectedStudentIds((res.data.data.students || []).map((s: StudentDetail) => s.student_id));
      } else {
        setError(res.data?.message || 'Failed to generate report');
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.response?.data?.message || err.message || 'Error communicating with attendance server');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate report when dates/session are first set
  useEffect(() => {
    if (startDate && endDate) {
      handleGenerateReport();
    }
  }, [sessionType]);

  // Filtered & Sorted Students
  const filteredStudents = useMemo(() => {
    return students
      .filter((stu) => {
        // Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = stu.name.toLowerCase().includes(q);
          const matchPhone = stu.phone_number?.includes(q) || stu.parent_phone?.includes(q);
          const matchRoom = String(stu.room_number).toLowerCase().includes(q);
          const matchCode = String(stu.student_code).toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchRoom && !matchCode) return false;
        }

        // Status Filter
        if (statusFilter === 'present') return stu.sessions_attended > 0;
        if (statusFilter === 'absent') return stu.sessions_attended === 0;
        if (statusFilter === 'late') return stu.late_arrivals > 0;
        if (statusFilter === 'on_time') return stu.on_time_count > 0;
        if (statusFilter === 'low') return stu.attendance_percentage < 75;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'pct_desc') return b.attendance_percentage - a.attendance_percentage;
        if (sortBy === 'pct_asc') return a.attendance_percentage - b.attendance_percentage;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'room_asc') return String(a.room_number).localeCompare(String(b.room_number));
        if (sortBy === 'late_desc') return b.late_arrivals - a.late_arrivals;
        return 0;
      });
  }, [students, searchQuery, statusFilter, sortBy]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.student_id));
    }
  };

  const handleToggleStudent = (id: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Open Preview Modal
  const handleOpenPreview = (recipient: 'parent' | 'student') => {
    setPreviewRecipient(recipient);
    setIsEditingTemplate(false);
    setSaveSuccessMessage(null);
    const key = recipient === 'parent' ? 'parent_report' : 'student_report';
    setActiveTemplateText(templates[key] || (recipient === 'parent' ? DEFAULT_PARENT_TEMPLATE : DEFAULT_STUDENT_TEMPLATE));
    if (selectedStudentIds.length > 0) {
      setPreviewStudentId(selectedStudentIds[0]);
    }
    setPreviewModalOpen(true);
  };

  // Insert variable tag into template textarea at cursor
  const handleInsertVariable = (tag: string) => {
    if (!textareaRef.current) {
      setActiveTemplateText((prev) => prev + tag);
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = activeTemplateText;
    const updated = current.substring(0, start) + tag + current.substring(end);
    setActiveTemplateText(updated);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // Save modified template to backend database
  const handleSaveTemplate = async () => {
    setIsSavingTemplate(true);
    setSaveSuccessMessage(null);
    const templateKey = previewRecipient === 'parent' ? 'parent_report' : 'student_report';
    try {
      const res = await apiClient.post('/attendance/reports/templates', {
        template_key: templateKey,
        content: activeTemplateText
      });
      if (res.data?.success) {
        setTemplates((prev) => ({
          ...prev,
          [templateKey]: activeTemplateText
        }));
        setSaveSuccessMessage('Template saved successfully! All student previews have been updated.');
        setIsEditingTemplate(false);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
      } else {
        alert(res.data?.message || 'Failed to save template');
      }
    } catch (err: any) {
      console.error('Failed to save template:', err);
      alert(err.response?.data?.message || err.message || 'Error saving template to server');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Reset template back to standard default
  const handleResetTemplate = () => {
    const defaultText = previewRecipient === 'parent' ? DEFAULT_PARENT_TEMPLATE : DEFAULT_STUDENT_TEMPLATE;
    setActiveTemplateText(defaultText);
  };

  // Dispatch Notifications
  const handleSendNotifications = async () => {
    if (selectedStudentIds.length === 0) return;
    setSendingNotifications(true);

    const idempotencyKey = `send_${previewRecipient}_${sessionType}_${startDate}_${Date.now()}`;

    try {
      const payload = {
        recipient_type: previewRecipient,
        student_ids: selectedStudentIds,
        report_params: {
          session_type: sessionType,
          start_date: startDate,
          end_date: endDate
        },
        custom_note: customNote.trim() || undefined,
        custom_template: activeTemplateText,
        idempotency_key: idempotencyKey
      };

      const res = await apiClient.post('/attendance/reports/send-notifications', payload);
      if (res.data?.success) {
        setDeliveryResults(res.data);
        setPreviewModalOpen(false);
        setDeliveryStatusModalOpen(true);
      } else {
        alert(res.data?.message || 'Failed to dispatch notifications');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error sending report notifications');
    } finally {
      setSendingNotifications(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!students || students.length === 0) return;

    const headers = [
      'Student Name',
      'Student Code',
      'Room Number',
      'Phone Number',
      'Parent Phone',
      'Sessions Conducted',
      'Sessions Attended',
      'Absences',
      'Late Arrivals',
      'On-Time Count',
      'Attendance Percentage',
      'Last Attendance Date'
    ];

    const rows = students.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.student_code}"`,
      `"${s.room_number || ''}"`,
      `"${s.phone_number || ''}"`,
      `"${s.parent_phone || ''}"`,
      s.sessions_conducted,
      s.sessions_attended,
      s.total_absences,
      s.late_arrivals,
      s.on_time_count,
      `${s.attendance_percentage}%`,
      `"${s.last_attendance_date || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${sessionType}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Donut chart colors
  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  const punctualityData = summary
    ? [
        { name: 'On-Time', value: summary.punctuality_breakdown.on_time },
        { name: 'Late', value: summary.punctuality_breakdown.late },
        { name: 'Absent', value: summary.punctuality_breakdown.absent },
      ]
    : [];

  const selectedStudentsList = useMemo(() => {
    return students.filter((s) => selectedStudentIds.includes(s.student_id));
  }, [students, selectedStudentIds]);

  // Ensure previewStudentId is pointing to an active selected student
  useEffect(() => {
    if (selectedStudentsList.length > 0) {
      if (!previewStudentId || !selectedStudentsList.some((s) => s.student_id === previewStudentId)) {
        setPreviewStudentId(selectedStudentsList[0].student_id);
      }
    } else {
      setPreviewStudentId(null);
    }
  }, [selectedStudentsList, previewModalOpen]);

  const currentPreviewStudent = useMemo(() => {
    if (!previewStudentId) return selectedStudentsList[0] || null;
    return selectedStudentsList.find((s) => s.student_id === previewStudentId) || selectedStudentsList[0] || null;
  }, [selectedStudentsList, previewStudentId]);

  const currentPreviewIndex = useMemo(() => {
    if (!currentPreviewStudent) return 0;
    const idx = selectedStudentsList.findIndex((s) => s.student_id === currentPreviewStudent.student_id);
    return idx >= 0 ? idx : 0;
  }, [selectedStudentsList, currentPreviewStudent]);

  const handlePrevStudent = () => {
    if (selectedStudentsList.length === 0) return;
    const newIdx = (currentPreviewIndex - 1 + selectedStudentsList.length) % selectedStudentsList.length;
    setPreviewStudentId(selectedStudentsList[newIdx].student_id);
  };

  const handleNextStudent = () => {
    if (selectedStudentsList.length === 0) return;
    const newIdx = (currentPreviewIndex + 1) % selectedStudentsList.length;
    setPreviewStudentId(selectedStudentsList[newIdx].student_id);
  };

  return (
    <div className="attendance-reports-container">
      {/* 1. Control & Filter Panel */}
      <section className="reports-control-panel">
        <div className="control-panel-header">
          <div className="control-panel-title">
            <Sparkles size={24} style={{ color: '#4f46e5' }} />
            <div>
              <h3>Attendance Reports & Analytics</h3>
              <span>Fetch live HSH verified records for the last 6 months</span>
            </div>
          </div>
          <button
            className="btn-secondary"
            onClick={handleExportCSV}
            disabled={students.length === 0}
            title="Download formatted CSV report"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Session Type Selector Pills */}
        <div className="filter-input-group">
          <label>Session Type</label>
          <div className="session-pills-row">
            {SESSION_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`session-pill-btn ${sessionType === opt.key ? 'active' : ''}`}
                onClick={() => setSessionType(opt.key)}
              >
                <span>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date Mode and Filters */}
        <div className="filters-grid">
          <div className="filter-input-group">
            <label>Date Filter Mode</label>
            <select
              className="filter-select"
              value={filterMode}
              onChange={(e) => {
                const mode = e.target.value as any;
                setFilterMode(mode);
                if (mode === 'preset') applyPresetRange('30days');
                else if (mode === 'month' && availableMonths.length > 0) handleMonthChange(availableMonths[0].value);
              }}
            >
              <option value="preset">⚡ Quick Presets (7d / 30d / 6m)</option>
              <option value="month">📅 Month Selector (Last 6 Months)</option>
              <option value="custom">🛠️ Custom Date Range</option>
            </select>
          </div>

          {filterMode === 'preset' && (
            <div className="filter-input-group">
              <label>Period Preset</label>
              <select
                className="filter-select"
                value={selectedPreset}
                onChange={(e) => applyPresetRange(e.target.value)}
              >
                {PRESET_DATE_RANGES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'month' && (
            <div className="filter-input-group">
              <label>Select Month</label>
              <select
                className="filter-select"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'custom' && (
            <>
              <div className="filter-input-group">
                <label>Start Date</label>
                <input
                  type="date"
                  className="filter-date-input"
                  value={startDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="filter-input-group">
                <label>End Date</label>
                <input
                  type="date"
                  className="filter-date-input"
                  value={endDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="filter-input-group">
            <label>Floor Filter</label>
            <select
              className="filter-select"
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              <option value="all">All Floors</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((f) => (
                <option key={f} value={f}>
                  Floor {f}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-input-group">
            <label>&nbsp;</label>
            <button
              className="generate-btn"
              onClick={handleGenerateReport}
              disabled={loading || !startDate || !endDate}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  <Calendar size={16} />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* 2. Attendance Summary KPI Cards */}
      {summary && (
        <section className="summary-kpi-grid">
          {/* Total Registered Students */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Total Registered</span>
              <div className="kpi-icon-wrap" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                <Users size={22} />
              </div>
            </div>
            <div className="kpi-card-value">{summary.total_registered_students}</div>
            <div className="kpi-card-subtext">Active enrolled students</div>
          </div>

          {/* Total Students Present */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Students Present</span>
              <div className="kpi-icon-wrap" style={{ background: '#dcfce7', color: '#15803d' }}>
                <CheckCircle2 size={22} />
              </div>
            </div>
            <div className="kpi-card-value">{summary.total_students_present}</div>
            <div className="kpi-card-subtext" style={{ color: '#16a34a' }}>
              {summary.total_registered_students > 0
                ? `${((summary.total_students_present / summary.total_registered_students) * 100).toFixed(1)}% attended ≥1 session`
                : ''}
            </div>
          </div>

          {/* Total Students Absent */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Students Absent</span>
              <div className="kpi-icon-wrap" style={{ background: '#ffe4e6', color: '#be123c' }}>
                <XCircle size={22} />
              </div>
            </div>
            <div className="kpi-card-value">{summary.total_students_absent}</div>
            <div className="kpi-card-subtext" style={{ color: '#e11d48' }}>
              Zero sessions recorded
            </div>
          </div>

          {/* Overall Attendance Percentage */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Overall Attendance</span>
              <div className="kpi-icon-wrap" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                <TrendingUp size={22} />
              </div>
            </div>
            <div className="kpi-card-value" style={{ color: summary.overall_attendance_percentage >= 75 ? '#15803d' : '#d97706' }}>
              {summary.overall_attendance_percentage}%
            </div>
            <div className="kpi-card-subtext">
              Across {summary.total_sessions_conducted} conducted session(s)
            </div>
          </div>

          {/* Total Late Arrivals */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Late Arrivals</span>
              <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#b45309' }}>
                <Clock size={22} />
              </div>
            </div>
            <div className="kpi-card-value">{summary.total_late_arrivals}</div>
            <div className="kpi-card-subtext" style={{ color: '#d97706' }}>
              Arrivals after scheduled cutoff
            </div>
          </div>

          {/* On-Time Attendance */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">On-Time Count</span>
              <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
                <ShieldCheck size={22} />
              </div>
            </div>
            <div className="kpi-card-value">{summary.total_on_time_count}</div>
            <div className="kpi-card-subtext" style={{ color: '#059669' }}>
              Punctual entries
            </div>
          </div>
        </section>
      )}

      {/* 3. Interactive Charts */}
      {summary && summary.daily_trends.length > 0 && (
        <section className="charts-grid">
          {/* Daily Attendance Trend */}
          <div className="chart-card">
            <div className="chart-card-header">
              <h4>Daily Attendance Performance ({startDate} to {endDate})</h4>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Present vs Absent across selected period</span>
            </div>
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.daily_trends}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="present" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorPresent)" name="Present" />
                  <Area type="monotone" dataKey="absent" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorAbsent)" name="Absent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Punctuality Breakdown Donut */}
          <div className="chart-card">
            <div className="chart-card-header">
              <h4>Punctuality Breakdown</h4>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total attendance slots</span>
            </div>
            <div style={{ height: 260, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={punctualityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {punctualityData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* 4. Action & Bulk Notification Bar */}
      <section className="action-selection-bar">
        <div className="selection-info">
          <button className="btn-secondary" onClick={handleSelectAll}>
            {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
              <>
                <CheckSquare size={16} />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <Square size={16} />
                <span>Select All ({filteredStudents.length})</span>
              </>
            )}
          </button>
          <div className="select-count-badge">
            {selectedStudentIds.length} of {students.length} students selected
          </div>
        </div>

        <div className="action-buttons-group">
          {/* View Report Preview Option */}
          <button
            className="btn-secondary"
            onClick={() => handleOpenPreview('parent')}
            disabled={selectedStudentIds.length === 0}
            title="Preview attendance report before sending"
          >
            <Eye size={16} />
            <span>View Report</span>
          </button>

          {/* Send to Parent */}
          <button
            className="btn-parent-notify"
            onClick={() => handleOpenPreview('parent')}
            disabled={selectedStudentIds.length === 0}
            title="Send report directly to student's parent via WhatsApp"
          >
            <Send size={16} />
            <span>Send to Parent</span>
          </button>

          {/* Send to Student */}
          <button
            className="btn-student-notify"
            onClick={() => handleOpenPreview('student')}
            disabled={selectedStudentIds.length === 0}
            title="Send report directly to student via WhatsApp & Push"
          >
            <Send size={16} />
            <span>Send to Student</span>
          </button>
        </div>
      </section>

      {/* 5. Search & Filters Bar */}
      <section className="search-filter-row">
        <div className="search-box-wrap">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            className="search-input-field"
            placeholder="Search by student name, phone number, room, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-pills-wrap">
          <button
            className={`status-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Students ({students.length})
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'present' ? 'active' : ''}`}
            onClick={() => setStatusFilter('present')}
          >
            Present (≥1)
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'absent' ? 'active' : ''}`}
            onClick={() => setStatusFilter('absent')}
          >
            Absent (0)
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'late' ? 'active' : ''}`}
            onClick={() => setStatusFilter('late')}
          >
            Late Arrivals
          </button>
          <button
            className={`status-pill-btn ${statusFilter === 'low' ? 'active' : ''}`}
            onClick={() => setStatusFilter('low')}
          >
            Low Attendance (&lt;75%)
          </button>
        </div>

        <select
          className="filter-select"
          style={{ width: 'auto', minWidth: '180px' }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="pct_desc">Attendance % (High to Low)</option>
          <option value="pct_asc">Attendance % (Low to High)</option>
          <option value="name_asc">Student Name (A - Z)</option>
          <option value="name_desc">Student Name (Z - A)</option>
          <option value="room_asc">Room Number (Ascending)</option>
          <option value="late_desc">Late Arrivals (Highest First)</option>
        </select>
      </section>

      {/* 6. Student-Wise Attendance Table */}
      <section className="table-card">
        <div className="table-responsive">
          <table className="attendance-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Student</th>
                <th>Room</th>
                <th>Phone Number</th>
                <th style={{ textAlign: 'center' }}>Conducted</th>
                <th style={{ textAlign: 'center' }}>Attended</th>
                <th style={{ textAlign: 'center' }}>Absent</th>
                <th style={{ textAlign: 'center' }}>Late</th>
                <th style={{ textAlign: 'center' }}>On-Time</th>
                <th style={{ textAlign: 'center' }}>Attendance %</th>
                <th>Last Attendance</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <div>Loading attendance data for selected period...</div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No students match your selected filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => {
                  const isSelected = selectedStudentIds.includes(stu.student_id);
                  const pct = stu.attendance_percentage;
                  let badgeClass = 'pct-badge-high';
                  if (pct < 50) badgeClass = 'pct-badge-low';
                  else if (pct < 75) badgeClass = 'pct-badge-mid';

                  return (
                    <tr key={stu.student_id} style={isSelected ? { background: '#f8fafc' } : {}}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudent(stu.student_id)}
                        />
                      </td>
                      <td>
                        <div className="student-info-cell">
                          <div className="student-avatar">
                            {stu.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="student-name-text">{stu.name}</div>
                            <div className="student-code-text">Code: {stu.student_code}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{stu.room_number || 'N/A'}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.825rem' }}>{stu.phone_number || '—'}</div>
                        {stu.parent_phone && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Parent: {stu.parent_phone}</div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{stu.sessions_conducted}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#15803d' }}>
                        {stu.sessions_attended}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: stu.total_absences > 0 ? '#b91c1c' : '#64748b' }}>
                        {stu.total_absences}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {stu.late_arrivals > 0 ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                            {stu.late_arrivals}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#059669' }}>
                        {stu.on_time_count}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`pct-badge ${badgeClass}`}>{pct}%</span>
                      </td>
                      <td>
                        {stu.last_attendance_date ? (
                          <div style={{ fontSize: '0.8rem' }}>
                            <div>{stu.last_attendance_date}</div>
                            {stu.last_attendance_time && (
                              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{stu.last_attendance_time}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Never</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn-secondary"
                            style={{ height: '30px', padding: '0 8px', fontSize: '0.75rem' }}
                            onClick={() => setHistoryModalStudent(stu)}
                            title="View student session history"
                          >
                            <History size={14} />
                            <span>History</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. Dedicated View Report & Pre-Send Preview Modal */}
      {previewModalOpen &&
        createPortal(
          <div className="modal-overlay" onClick={() => setPreviewModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Eye size={22} style={{ color: '#4f46e5' }} />
                  <div>
                    <h3>Attendance Report Preview</h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Review statistics & recipient target before dispatching
                    </span>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setPreviewModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Target Recipient Selector */}
                <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="recipient"
                      value="parent"
                      checked={previewRecipient === 'parent'}
                      onChange={() => setPreviewRecipient('parent')}
                    />
                    <span>👨‍👩‍👧 Send to Parent (Dispatches to Parent / Father Phone)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="recipient"
                      value="student"
                      checked={previewRecipient === 'student'}
                      onChange={() => setPreviewRecipient('student')}
                    />
                    <span>📱 Send to Student (Dispatches to Student Mobile & Push)</span>
                  </label>
                </div>

                {/* Scope Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#e0e7ff', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#4338ca', fontWeight: 700 }}>SELECTED RECIPIENTS</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b' }}>
                      {selectedStudentIds.length} Students
                    </div>
                  </div>
                  <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700 }}>DATE PERIOD</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#064e3b' }}>
                      {startDate} to {endDate}
                    </div>
                  </div>
                  <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700 }}>SESSION CATEGORY</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#78350f' }}>
                      {sessionType.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Message Template Preview & Interactive Editor */}
                <div>
                  <div className="template-section-header">
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
                      WhatsApp Notification Message Preview:
                    </div>
                    <div className="template-editor-tabs">
                      <button
                        type="button"
                        className={`template-tab-btn ${!isEditingTemplate ? 'active' : ''}`}
                        onClick={() => setIsEditingTemplate(false)}
                      >
                        <Eye size={13} />
                        <span>Live Preview</span>
                      </button>
                      <button
                        type="button"
                        className={`template-tab-btn ${isEditingTemplate ? 'active' : ''}`}
                        onClick={() => setIsEditingTemplate(true)}
                      >
                        <Edit3 size={13} />
                        <span>Edit Template</span>
                      </button>
                    </div>
                  </div>

                  {saveSuccessMessage && (
                    <div className="save-success-banner" style={{ marginBottom: '10px' }}>
                      <Check size={16} />
                      <span>{saveSuccessMessage}</span>
                    </div>
                  )}

                  {!isEditingTemplate ? (
                    <>
                      {/* Student Selector Bar for Live Preview */}
                      {selectedStudentsList.length > 0 && (
                        <div className="student-preview-bar">
                          <div className="student-preview-select-wrap">
                            <Users size={15} style={{ color: '#4f46e5' }} />
                            <span style={{ fontSize: '0.785rem', fontWeight: 700, color: '#475569' }}>
                              Previewing Student:
                            </span>
                            <select
                              className="student-preview-select"
                              value={previewStudentId || ''}
                              onChange={(e) => setPreviewStudentId(Number(e.target.value))}
                            >
                              {selectedStudentsList.map((stu) => (
                                <option key={stu.student_id} value={stu.student_id}>
                                  {stu.name} — Room {stu.room_number || 'N/A'} ({stu.attendance_percentage}%)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="student-preview-nav-btn"
                              onClick={handlePrevStudent}
                              disabled={selectedStudentsList.length <= 1}
                              title="Previous student"
                            >
                              <ChevronLeft size={13} />
                              <span>Prev</span>
                            </button>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                              {currentPreviewIndex + 1} of {selectedStudentsList.length}
                            </span>
                            <button
                              type="button"
                              className="student-preview-nav-btn"
                              onClick={handleNextStudent}
                              disabled={selectedStudentsList.length <= 1}
                              title="Next student"
                            >
                              <span>Next</span>
                              <ChevronRight size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ height: '30px', padding: '0 10px', fontSize: '0.75rem' }}
                              onClick={() => setIsEditingTemplate(true)}
                              title="Customize this template"
                            >
                              <Edit3 size={13} />
                              <span>Edit Template</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Formatted Live Message Card for Selected Student */}
                      <div className="message-preview-card">
                        {renderClientTemplate(activeTemplateText, currentPreviewStudent, {
                          start_date: startDate,
                          end_date: endDate,
                          session_name: sessionType.toUpperCase(),
                          total_conducted: summary?.total_sessions_conducted || 0,
                          admin_note: customNote
                        })}
                      </div>
                    </>
                  ) : (
                    /* Interactive Template Editor Box */
                    <div className="template-editor-box">
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Modify the notification template below. Click any dynamic tag to insert it at your cursor. Saving permanently updates the template in the database and reflects immediately across all student previews.
                      </div>

                      <div>
                        <div className="variable-pills-label" style={{ marginBottom: '4px' }}>
                          Click tag to insert at cursor:
                        </div>
                        <div className="variable-pills-container">
                          {TEMPLATE_VARIABLES.map((v) => (
                            <button
                              key={v.tag}
                              type="button"
                              className="variable-pill-btn"
                              onClick={() => handleInsertVariable(v.tag)}
                              title={`Insert ${v.label}`}
                            >
                              + {v.tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        ref={textareaRef}
                        className="template-textarea"
                        value={activeTemplateText}
                        onChange={(e) => setActiveTemplateText(e.target.value)}
                        rows={10}
                        placeholder="Compose attendance report notification template..."
                      />

                      <div className="template-editor-actions">
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-save-template"
                            onClick={handleSaveTemplate}
                            disabled={isSavingTemplate}
                          >
                            {isSavingTemplate ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Save size={14} />
                                <span>Save Template</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ height: '34px', fontSize: '0.8rem' }}
                            onClick={handleResetTemplate}
                            title="Reset to default format"
                          >
                            <RotateCcw size={14} />
                            <span>Reset to Default</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ height: '34px', fontSize: '0.8rem' }}
                          onClick={() => {
                            const key = previewRecipient === 'parent' ? 'parent_report' : 'student_report';
                            setActiveTemplateText(templates[key] || DEFAULT_PARENT_TEMPLATE);
                            setIsEditingTemplate(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional Custom Note */}
                <div className="filter-input-group">
                  <label>Add Optional Admin Remark / Note</label>
                  <input
                    type="text"
                    className="filter-date-input"
                    placeholder="e.g. Please ensure punctual presence for upcoming examinations."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                  />
                </div>

                {/* Preview Selected Students Table */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Selected Recipients ({selectedStudentsList.length}):
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table className="attendance-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Room</th>
                          <th>Target Phone ({previewRecipient})</th>
                          <th style={{ textAlign: 'center' }}>Attended</th>
                          <th style={{ textAlign: 'center' }}>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudentsList.map((s) => {
                          const targetPhone = previewRecipient === 'parent' ? s.parent_phone : s.phone_number;
                          return (
                            <tr key={s.student_id}>
                              <td>{s.name}</td>
                              <td>{s.room_number || 'N/A'}</td>
                              <td>
                                {targetPhone ? (
                                  <span style={{ color: '#16a34a', fontWeight: 600 }}>{targetPhone}</span>
                                ) : (
                                  <span style={{ color: '#dc2626', fontWeight: 600 }}>Missing Phone!</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>{s.sessions_attended} / {s.sessions_conducted}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.attendance_percentage}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setPreviewModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className={previewRecipient === 'parent' ? 'btn-parent-notify' : 'btn-student-notify'}
                  onClick={handleSendNotifications}
                  disabled={sendingNotifications || selectedStudentIds.length === 0}
                >
                  {sendingNotifications ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Sending Reports...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Confirm & Send to {selectedStudentIds.length} {previewRecipient === 'parent' ? 'Parents' : 'Students'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 8. Notification Delivery Status Modal */}
      {deliveryStatusModalOpen && deliveryResults &&
        createPortal(
          <div className="modal-overlay" onClick={() => setDeliveryStatusModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={22} style={{ color: '#10b981' }} />
                  <div>
                    <h3>Notification Delivery Status</h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Execution breakdown and real-time delivery confirmations
                    </span>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setDeliveryStatusModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Stats cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL DISPATCHED</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                      {deliveryResults.stats?.total || 0}
                    </div>
                  </div>
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 600 }}>SUCCESSFUL</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#065f46' }}>
                      {deliveryResults.stats?.sent || 0}
                    </div>
                  </div>
                  <div style={{ background: '#fee2e2', border: '1px solid #fecaca', padding: '14px', borderRadius: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>FAILED / SKIPPED</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b' }}>
                      {deliveryResults.stats?.failed || 0}
                    </div>
                  </div>
                </div>

                {/* Per-recipient detailed delivery logs */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Recipient Delivery Logs:
                  </div>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table className="attendance-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Recipient Phone</th>
                          <th>Status</th>
                          <th>Details / Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(deliveryResults.results || []).map((r: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{r.student_name}</td>
                            <td>{r.recipient_phone || '—'}</td>
                            <td>
                              <span className={`status-indicator ${r.status}`}>
                                {r.status === 'sent' ? '✓ Delivered' : '✗ Failed'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: r.status === 'sent' ? '#047857' : '#b91c1c' }}>
                              {r.error_message || 'Sent successfully via WhatsApp'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="generate-btn" onClick={() => setDeliveryStatusModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 9. Student Session-By-Session History Modal */}
      {historyModalStudent &&
        createPortal(
          <div className="modal-overlay" onClick={() => setHistoryModalStudent(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <History size={22} style={{ color: '#4f46e5' }} />
                  <div>
                    <h3>{historyModalStudent.name} — Attendance History</h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Room {historyModalStudent.room_number || 'N/A'} • Period: {startDate} to {endDate}
                    </span>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setHistoryModalStudent(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Mini Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Conducted</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{historyModalStudent.sessions_conducted}</div>
                  </div>
                  <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#047857' }}>Attended</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#047857' }}>{historyModalStudent.sessions_attended}</div>
                  </div>
                  <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Late</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#b45309' }}>{historyModalStudent.late_arrivals}</div>
                  </div>
                  <div style={{ background: '#e0e7ff', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#4338ca' }}>Rate</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4338ca' }}>{historyModalStudent.attendance_percentage}%</div>
                  </div>
                </div>

                {/* History Session Records */}
                <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table className="attendance-table" style={{ fontSize: '0.825rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Session</th>
                        <th>Status</th>
                        <th>Marked Time</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyModalStudent.attendance_history.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                            No session records found for this period.
                          </td>
                        </tr>
                      ) : (
                        historyModalStudent.attendance_history.map((h, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{h.date}</td>
                            <td style={{ textTransform: 'capitalize' }}>{h.session_type}</td>
                            <td>
                              {h.status === 'present' ? (
                                <span style={{ color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                                  ✓ Present (On-Time)
                                </span>
                              ) : h.status === 'late' ? (
                                <span style={{ color: '#b45309', fontWeight: 700, background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                                  ⏰ Late Arrival
                                </span>
                              ) : (
                                <span style={{ color: '#be123c', fontWeight: 700, background: '#ffe4e6', padding: '2px 8px', borderRadius: '4px' }}>
                                  ✗ Absent
                                </span>
                              )}
                            </td>
                            <td>{h.marked_time || '—'}</td>
                            <td>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {h.source === 'hsh_api' ? 'External HSH API' : 'Local BLE Scanner'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setHistoryModalStudent(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
export default AttendanceReportsView;
