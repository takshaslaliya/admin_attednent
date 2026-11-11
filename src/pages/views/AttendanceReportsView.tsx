import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
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
  Tag,
  Printer,
  Copy,
  Layers,
  FileText
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

export interface MonthBreakdownItem {
  year: number;
  period: string;
  month_key: string;
  total_days: number;
  leave_days: number;
  sessions: Record<string, {
    conducted: number;
    attended: number;
    percentage: number;
  }>;
  overall_conducted: number;
  overall_attended: number;
  overall_percentage: number;
}

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
  total_leaves?: number;
  attendance_percentage: number;
  late_arrivals: number;
  on_time_count: number;
  last_attendance_date: string | null;
  last_attendance_time: string | null;
  monthly_breakdown?: MonthBreakdownItem[];
  attendance_history: Array<{
    date: string;
    session_type: string;
    status: 'present' | 'late' | 'absent' | 'leave';
    marked_time?: string | null;
    source: string;
  }>;
}

interface SummaryData {
  total_registered_students: number;
  total_students_present: number;
  total_students_absent: number;
  total_students_leave?: number;
  total_leave_instances?: number;
  overall_attendance_percentage: number;
  total_late_arrivals: number;
  total_on_time_count: number;
  total_sessions_conducted: number;
  monthly_breakdown?: MonthBreakdownItem[];
  daily_trends: Array<{
    date: string;
    present: number;
    absent: number;
    late: number;
    on_time: number;
    leave?: number;
  }>;
  punctuality_breakdown: {
    on_time: number;
    late: number;
    absent: number;
    leave?: number;
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
  // Multi-Session Selection State
  const [selectedSessions, setSelectedSessions] = useState<string[]>(['all']);

  // Date Filter Modes & Dates
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

  // Main Screen Table View Mode ('students' table or 'month_matrix' spreadsheet)
  const [mainTableViewMode, setMainTableViewMode] = useState<'students' | 'month_matrix'>('students');

  // Matrix Filter State (matching Image 2 & 3)
  const [matrixStudentFilter, setMatrixStudentFilter] = useState('all');
  const [matrixRoomFilter, setMatrixRoomFilter] = useState('all');

  // Search & Filtering inside Table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'on_time' | 'low' | 'leave'>('all');
  const [sortBy, setSortBy] = useState<'pct_desc' | 'pct_asc' | 'name_asc' | 'name_desc' | 'room_asc' | 'late_desc'>('pct_desc');

  // Chart Series Visibility Toggles
  const [chartSeries, setChartSeries] = useState<{
    present: boolean;
    absent: boolean;
    late: boolean;
    leave: boolean;
  }>({
    present: true,
    absent: true,
    late: true,
    leave: true,
  });

  // Bulk Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  // Modals & Preview Configuration
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewRecipient, setPreviewRecipient] = useState<'parent' | 'student'>('parent');
  const [activePreviewTab, setActivePreviewTab] = useState<'report_card' | 'message_text'>('report_card');
  const [customNote, setCustomNote] = useState('');
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [sendProgress, setSendProgress] = useState<string>('');
  const [attachReportImage, setAttachReportImage] = useState<boolean>(true);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [exportingStudent, setExportingStudent] = useState<StudentDetail | null>(null);

  // References for capturing visual report card images & deduplicating rapid multi-session requests
  const reportCardRef = useRef<HTMLDivElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);
  const latestRequestIdRef = useRef<number>(0);

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

  // Computed Session Values
  const sessionType = useMemo(() => {
    if (selectedSessions.includes('all') || selectedSessions.length === 0) return 'all';
    return selectedSessions.join(',');
  }, [selectedSessions]);

  const sessionLabel = useMemo(() => {
    if (selectedSessions.includes('all')) return 'All Sessions';
    return selectedSessions
      .map((k) => SESSION_OPTIONS.find((s) => s.key === k)?.label || k.toUpperCase())
      .join(' + ');
  }, [selectedSessions]);

  const activeSessionKeys = useMemo(() => {
    if (selectedSessions.includes('all')) {
      return ['aarti', 'sabha', 'lunch', 'dinner', 'night'];
    }
    return selectedSessions;
  }, [selectedSessions]);

  // Multi-Session Toggle Handler
  const handleToggleSession = (key: string) => {
    if (key === 'all') {
      setSelectedSessions(['all']);
      return;
    }
    setSelectedSessions((prev) => {
      if (prev.includes('all')) {
        return [key];
      }
      if (prev.includes(key)) {
        const filtered = prev.filter((k) => k !== key);
        return filtered.length === 0 ? ['all'] : filtered;
      }
      const updated = [...prev, key];
      const individualKeys = SESSION_OPTIONS.filter((o) => o.key !== 'all').map((o) => o.key);
      const hasAll = individualKeys.every((k) => updated.includes(k));
      return hasAll ? ['all'] : updated;
    });
  };

  // Header class selector for spreadsheet columns
  const getSessionHeaderClass = (key: string) => {
    if (key === 'aarti') return 'th-cat-aarti';
    if (key === 'sabha') return 'th-cat-sabha';
    if (key === 'dates') return 'th-cat-dates';
    if (key === 'year') return 'th-cat-year';
    return 'th-cat-other';
  };

  // Available Rooms for filter dropdown
  const availableRooms = useMemo(() => {
    const rooms = new Set<string>();
    students.forEach((s) => {
      if (s.room_number && s.room_number !== 'N/A') {
        rooms.add(String(s.room_number));
      }
    });
    return Array.from(rooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

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
    const reqId = ++latestRequestIdRef.current;
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
      if (reqId !== latestRequestIdRef.current) return;

      if (res.data?.success && res.data?.data) {
        setSummary(res.data.data.summary);
        setStudents(res.data.data.students || []);
        // By default, select all students for easy preview & reporting
        setSelectedStudentIds((res.data.data.students || []).map((s: StudentDetail) => s.student_id));
      } else {
        setError(res.data?.message || 'Failed to generate report');
      }
    } catch (err: any) {
      if (reqId !== latestRequestIdRef.current) return;
      console.error('Error generating report:', err);
      setError(err.response?.data?.message || err.message || 'Error communicating with attendance server');
    } finally {
      if (reqId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Auto-generate report when dates/session change
  useEffect(() => {
    if (startDate && endDate) {
      handleGenerateReport();
    }
  }, [sessionType]);

  // Robust Monthly Breakdown Fallback Helpers
  const getStudentBreakdown = (student: StudentDetail | null | undefined): MonthBreakdownItem[] => {
    if (!student) return [];
    if (student.monthly_breakdown && student.monthly_breakdown.length > 0) {
      return student.monthly_breakdown;
    }

    const map = new Map<string, {
      year: number;
      period: string;
      month_key: string;
      dates: Set<string>;
      leaves: number;
      sessions: Record<string, { conducted: number; attended: number }>;
    }>();

    (student.attendance_history || []).forEach((h) => {
      const ym = h.date.slice(0, 7);
      if (!map.has(ym)) {
        const [y, m] = ym.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        const period = d.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
        map.set(ym, {
          year: Number(y),
          period,
          month_key: ym,
          dates: new Set(),
          leaves: 0,
          sessions: {}
        });
      }
      const entry = map.get(ym)!;
      entry.dates.add(h.date);
      if (h.status === 'leave') entry.leaves++;
      const st = h.session_type.toLowerCase();
      if (!entry.sessions[st]) entry.sessions[st] = { conducted: 0, attended: 0 };
      entry.sessions[st].conducted++;
      if (h.status === 'present' || h.status === 'late') entry.sessions[st].attended++;
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, v]) => {
        const sessRecord: Record<string, { conducted: number; attended: number; percentage: number }> = {};
        let totalC = 0;
        let totalA = 0;
        for (const [sKey, sVal] of Object.entries(v.sessions)) {
          totalC += sVal.conducted;
          totalA += sVal.attended;
          sessRecord[sKey] = {
            conducted: sVal.conducted,
            attended: sVal.attended,
            percentage: sVal.conducted > 0 ? Math.round((sVal.attended / sVal.conducted) * 100) : 0
          };
        }
        return {
          year: v.year,
          period: v.period,
          month_key: v.month_key,
          total_days: v.dates.size,
          leave_days: v.leaves,
          sessions: sessRecord,
          overall_conducted: totalC,
          overall_attended: totalA,
          overall_percentage: totalC > 0 ? Math.round((totalA / totalC) * 100) : 0
        };
      });
  };

  const getSummaryBreakdown = (): MonthBreakdownItem[] => {
    if (summary?.monthly_breakdown && summary.monthly_breakdown.length > 0) {
      return summary.monthly_breakdown;
    }

    const map = new Map<string, {
      year: number;
      period: string;
      month_key: string;
      total_days: number;
      leave_days: number;
      sessions: Record<string, { conducted: number; attended: number }>;
    }>();

    students.forEach((stu) => {
      const sBreakdown = getStudentBreakdown(stu);
      sBreakdown.forEach((sb) => {
        if (!map.has(sb.month_key)) {
          map.set(sb.month_key, {
            year: sb.year,
            period: sb.period,
            month_key: sb.month_key,
            total_days: 0,
            leave_days: 0,
            sessions: {}
          });
        }
        const agg = map.get(sb.month_key)!;
        agg.total_days += sb.total_days;
        agg.leave_days += sb.leave_days;
        for (const [sk, sv] of Object.entries(sb.sessions)) {
          if (!agg.sessions[sk]) agg.sessions[sk] = { conducted: 0, attended: 0 };
          agg.sessions[sk].conducted += sv.conducted;
          agg.sessions[sk].attended += sv.attended;
        }
      });
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, v]) => {
        const sessRecord: Record<string, { conducted: number; attended: number; percentage: number }> = {};
        let totalC = 0;
        let totalA = 0;
        for (const [sKey, sVal] of Object.entries(v.sessions)) {
          totalC += sVal.conducted;
          totalA += sVal.attended;
          sessRecord[sKey] = {
            conducted: sVal.conducted,
            attended: sVal.attended,
            percentage: sVal.conducted > 0 ? Math.round((sVal.attended / sVal.conducted) * 100) : 0
          };
        }
        return {
          year: v.year,
          period: v.period,
          month_key: v.month_key,
          total_days: v.total_days,
          leave_days: v.leave_days,
          sessions: sessRecord,
          overall_conducted: totalC,
          overall_attended: totalA,
          overall_percentage: totalC > 0 ? Math.round((totalA / totalC) * 100) : 0
        };
      });
  };

  // Displayed Rows for the Main Screen Month-Wise Matrix (matching spreadsheet in Image 2 & 3)
  const displayedMatrixRows = useMemo(() => {
    if (matrixStudentFilter !== 'all') {
      const stu = students.find((s) => s.name === matrixStudentFilter || String(s.student_id) === matrixStudentFilter);
      return getStudentBreakdown(stu);
    }
    if (matrixRoomFilter !== 'all') {
      const roomStudents = students.filter((s) => String(s.room_number) === matrixRoomFilter);
      if (roomStudents.length === 1) {
        return getStudentBreakdown(roomStudents[0]);
      }
      const map = new Map<string, MonthBreakdownItem>();
      roomStudents.forEach((stu) => {
        const sBreakdown = getStudentBreakdown(stu);
        sBreakdown.forEach((sb) => {
          if (!map.has(sb.month_key)) {
            map.set(sb.month_key, { ...sb, sessions: { ...sb.sessions } });
          } else {
            const item = map.get(sb.month_key)!;
            item.total_days += sb.total_days;
            item.leave_days += sb.leave_days;
            item.overall_conducted += sb.overall_conducted;
            item.overall_attended += sb.overall_attended;
            for (const [sk, sv] of Object.entries(sb.sessions)) {
              if (!item.sessions[sk]) {
                item.sessions[sk] = { ...sv };
              } else {
                item.sessions[sk].conducted += sv.conducted;
                item.sessions[sk].attended += sv.attended;
              }
            }
          }
        });
      });
      return Array.from(map.values()).map((item) => {
        for (const [_, sv] of Object.entries(item.sessions)) {
          sv.percentage = sv.conducted > 0 ? Math.round((sv.attended / sv.conducted) * 100) : 0;
        }
        item.overall_percentage = item.overall_conducted > 0 ? Math.round((item.overall_attended / item.overall_conducted) * 100) : 0;
        return item;
      });
    }
    return getSummaryBreakdown();
  }, [matrixStudentFilter, matrixRoomFilter, students, summary]);

  // Filtered & Sorted Students
  const filteredStudents = useMemo(() => {
    return students
      .filter((stu) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = stu.name.toLowerCase().includes(q);
          const matchPhone = stu.phone_number?.includes(q) || stu.parent_phone?.includes(q);
          const matchRoom = String(stu.room_number).toLowerCase().includes(q);
          const matchCode = String(stu.student_code).toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchRoom && !matchCode) return false;
        }

        if (statusFilter === 'present') return stu.sessions_attended > 0;
        if (statusFilter === 'absent') return stu.sessions_attended === 0;
        if (statusFilter === 'late') return stu.late_arrivals > 0;
        if (statusFilter === 'on_time') return stu.on_time_count > 0;
        if (statusFilter === 'low') return stu.attendance_percentage < 75;
        if (statusFilter === 'leave') return (stu.total_leaves || 0) > 0;

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
    setActivePreviewTab('report_card');
    const key = recipient === 'parent' ? 'parent_report' : 'student_report';
    setActiveTemplateText(templates[key] || (recipient === 'parent' ? DEFAULT_PARENT_TEMPLATE : DEFAULT_STUDENT_TEMPLATE));
    if (selectedStudentIds.length > 0) {
      setPreviewStudentId(selectedStudentIds[0]);
    }
    setPreviewModalOpen(true);
  };

  // Direct View Report for a specific student row
  const handleViewStudentReport = (stu: StudentDetail) => {
    setSelectedStudentIds([stu.student_id]);
    setPreviewStudentId(stu.student_id);
    setActivePreviewTab('report_card');
    setPreviewRecipient('parent');
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

  // Wait two animation frames so React renders offscreen card before canvas capture
  const waitForDomPaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  // Render and capture high-DPI visual report card as PNG base64
  const captureReportCardImage = async (targetEl?: HTMLElement | null, scale = 2): Promise<string | null> => {
    const el = targetEl || reportCardRef.current;
    if (!el) return null;
    try {
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Failed to capture report card canvas:', err);
      return null;
    }
  };

  // Render & capture personalized report card PNG for a specific student via offscreen exporter
  const captureStudentSpecificImage = async (stu: StudentDetail): Promise<string | null> => {
    setExportingStudent(stu);
    await waitForDomPaint();
    return await captureReportCardImage(exportCardRef.current, 1.75);
  };

  // Download visual report card image as PNG file
  const handleDownloadReportImage = async () => {
    setIsExportingImage(true);
    try {
      const imgData = await captureReportCardImage();
      if (!imgData) {
        alert('Could not render report card image. Please ensure the card is visible.');
        return;
      }
      const stuName = (currentPreviewStudent?.name || 'Student').replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.download = `Attendance_Report_${stuName}_${startDate}_to_${endDate}.png`;
      link.href = imgData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Error generating image: ' + err.message);
    } finally {
      setIsExportingImage(false);
    }
  };

  // Copy visual report card image to clipboard
  const handleCopyReportImage = async () => {
    if (!reportCardRef.current) return;
    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(reportCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (blob && (navigator.clipboard as any)?.write) {
          try {
            await (navigator.clipboard as any).write([
              new (window as any).ClipboardItem({ 'image/png': blob })
            ]);
            alert('Visual report card image copied to clipboard! You can paste it directly into WhatsApp or documents.');
          } catch (clipErr) {
            console.warn('Clipboard write failed, downloading file instead:', clipErr);
            const link = document.createElement('a');
            link.download = `Attendance_Report_${(currentPreviewStudent?.name || 'Student').replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        } else {
          alert('Clipboard image copy not supported in this browser. Downloading PNG image instead.');
          const link = document.createElement('a');
          link.download = `Attendance_Report_${(currentPreviewStudent?.name || 'Student').replace(/\s+/g, '_')}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
        setIsExportingImage(false);
      }, 'image/png');
    } catch (err: any) {
      alert('Error exporting image: ' + err.message);
      setIsExportingImage(false);
    }
  };

  // Print official report card
  const handlePrintReport = () => {
    window.print();
  };

  // Dispatch Notifications (generates personalized per-student PNG images in safe batches)
  const handleSendNotifications = async () => {
    if (selectedStudentIds.length === 0) return;
    setSendingNotifications(true);
    setSendProgress('');

    const baseIdempotencyKey = `send_${previewRecipient}_${sessionType}_${startDate}_${Date.now()}`;

    try {
      const BATCH_SIZE = attachReportImage ? 8 : selectedStudentIds.length;
      const totalSelected = selectedStudentIds.length;
      const combinedResults: any[] = [];
      let totalSent = 0;
      let totalFailed = 0;

      for (let startIdx = 0; startIdx < totalSelected; startIdx += BATCH_SIZE) {
        const batchIds = selectedStudentIds.slice(startIdx, startIdx + BATCH_SIZE);
        const batchNumber = Math.floor(startIdx / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalSelected / BATCH_SIZE);

        let studentImagesMap: Record<number, string> | undefined = undefined;
        if (attachReportImage) {
          studentImagesMap = {};
          for (let j = 0; j < batchIds.length; j++) {
            const sid = batchIds[j];
            const stuObj = students.find((s) => s.student_id === sid);
            if (!stuObj) continue;
            setSendProgress(`Rendering report image ${startIdx + j + 1}/${totalSelected}...`);
            const imgData = await captureStudentSpecificImage(stuObj);
            if (imgData) {
              studentImagesMap[sid] = imgData;
            }
          }
        }

        setSendProgress(
          totalBatches > 1
            ? `Sending batch ${batchNumber}/${totalBatches}...`
            : `Sending reports (${totalSelected})...`
        );

        const payload: any = {
          recipient_type: previewRecipient,
          student_ids: batchIds,
          report_params: {
            session_type: sessionType,
            start_date: startDate,
            end_date: endDate
          },
          custom_note: customNote.trim() || undefined,
          custom_template: activeTemplateText,
          idempotency_key: `${baseIdempotencyKey}_b${batchNumber}`,
          student_images: studentImagesMap
        };

        const res = await apiClient.post('/attendance/reports/send-notifications', payload);
        if (res.data?.success) {
          totalSent += Number(res.data.stats?.sent || 0);
          totalFailed += Number(res.data.stats?.failed || 0);
          if (Array.isArray(res.data.results)) {
            combinedResults.push(...res.data.results);
          }
        } else {
          throw new Error(res.data?.message || 'Failed to dispatch batch notifications');
        }
      }

      setDeliveryResults({
        success: true,
        message: `Processed ${totalSelected} notifications: ${totalSent} successful, ${totalFailed} failed.`,
        stats: {
          total: totalSelected,
          sent: totalSent,
          failed: totalFailed
        },
        results: combinedResults
      });
      setPreviewModalOpen(false);
      setDeliveryStatusModalOpen(true);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error sending report notifications');
    } finally {
      setExportingStudent(null);
      setSendProgress('');
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

  // Export Month Matrix CSV
  const handleExportMatrixCSV = () => {
    if (!displayedMatrixRows || displayedMatrixRows.length === 0) return;

    const sessionHeaderNames = activeSessionKeys.map((k) => {
      const opt = SESSION_OPTIONS.find((o) => o.key === k);
      return opt ? opt.label : k.toUpperCase();
    });

    const headers = [
      'Year',
      'Period',
      'Total Days',
      'Leave Days',
      ...sessionHeaderNames.flatMap((sn) => [`${sn} Conducted`, `${sn} Attended`, `${sn} %`]),
      'Overall Conducted',
      'Overall Attended',
      'Overall %'
    ];

    const rows = displayedMatrixRows.map((r) => [
      r.year,
      `"${r.period}"`,
      r.total_days,
      r.leave_days,
      ...activeSessionKeys.flatMap((k) => {
        const s = r.sessions[k] || { conducted: 0, attended: 0, percentage: 0 };
        return [s.conducted, s.attended, `${s.percentage}%`];
      }),
      r.overall_conducted,
      r.overall_attended,
      `${r.overall_percentage}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Month_Wise_Attendance_Matrix_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Donut chart colors: On-Time, Late, Absent, On Leave
  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#0ea5e9'];

  const punctualityData = summary
    ? [
      { name: 'On-Time', value: summary.punctuality_breakdown.on_time },
      { name: 'Late', value: summary.punctuality_breakdown.late },
      { name: 'Absent', value: summary.punctuality_breakdown.absent },
      { name: 'On Leave', value: summary.punctuality_breakdown.leave || 0 },
    ].filter((p) => p.value > 0)
    : [];

  const selectedStudentsList = useMemo(() => {
    return students.filter((s) => selectedStudentIds.includes(s.student_id));
  }, [students, selectedStudentIds]);

  // Ensure previewStudentId points to an active selected student
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

  // Performance Rating calculation
  const getRatingBadge = (pct: number) => {
    if (pct >= 90) return { label: '🌟 Excellent', color: '#15803d', bg: '#dcfce7' };
    if (pct >= 75) return { label: '✓ Good Performance', color: '#047857', bg: '#ecfdf5' };
    if (pct >= 50) return { label: '⚠️ Average / Improvement Needed', color: '#b45309', bg: '#fef3c7' };
    return { label: '🚨 Needs Immediate Attention', color: '#b91c1c', bg: '#fee2e2' };
  };

  // Shared Visual Official Report Card Body (used for both live preview and per-student PNG image capture)
  const renderOfficialReportCardBody = (student: StudentDetail | null) => (
    <>
      <div className="report-card-header">
        <div className="report-card-logo-area">
          <div className="report-card-emblem">🏛️</div>
          <div className="report-card-title-group">
            <h2>SHREE SWAMINARAYAN GURUKUL HOSTEL</h2>
            <p>Official Attendance &amp; Punctuality Report Card</p>
          </div>
        </div>
        <div className="report-card-meta-badge">
          <span className="report-date-pill">Period: {startDate} to {endDate}</span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            Sessions: {sessionLabel}
          </span>
        </div>
      </div>

      {student && (
        <>
          <div className="report-card-student-box">
            <div className="report-student-name-block">
              <h3 className="report-student-name">{student.name}</h3>
              <div className="report-student-code">
                Student ID / Code: <strong>{student.student_code}</strong>
              </div>
            </div>
            <div className="report-field-item">
              <span className="report-field-k">Room Number</span>
              <span className="report-field-v">Room {student.room_number || 'N/A'}</span>
            </div>
            <div className="report-field-item">
              <span className="report-field-k">Floor</span>
              <span className="report-field-v">Floor {student.floor_id || 'N/A'}</span>
            </div>
            <div className="report-field-item">
              <span className="report-field-k">Student Phone</span>
              <span className="report-field-v">{student.phone_number || '—'}</span>
            </div>
            <div className="report-field-item">
              <span className="report-field-k">Parent / Guardian Phone</span>
              <span className="report-field-v">{student.parent_phone || '—'}</span>
            </div>
            <div className="report-field-item" style={{ gridColumn: 'span 2' }}>
              <span className="report-field-k">Performance Rating</span>
              <div>
                {(() => {
                  const r = getRatingBadge(student.attendance_percentage);
                  return (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '6px', background: r.bg, color: r.color, fontWeight: 700, fontSize: '0.85rem' }}>
                      {r.label} ({student.attendance_percentage}%)
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="report-card-kpi-grid">
            <div className="report-kpi-pill">
              <div className="report-kpi-pill-val">{student.sessions_conducted}</div>
              <div className="report-kpi-pill-lbl">Conducted</div>
            </div>
            <div className="report-kpi-pill">
              <div className="report-kpi-pill-val" style={{ color: '#15803d' }}>
                {student.sessions_attended}
              </div>
              <div className="report-kpi-pill-lbl">Attended</div>
            </div>
            <div className="report-kpi-pill">
              <div className="report-kpi-pill-val" style={{ color: student.total_absences > 0 ? '#b91c1c' : '#64748b' }}>
                {student.total_absences}
              </div>
              <div className="report-kpi-pill-lbl">Absences</div>
            </div>
            <div className="report-kpi-pill">
              <div className="report-kpi-pill-val" style={{ color: '#0284c7' }}>
                {student.total_leaves || 0}
              </div>
              <div className="report-kpi-pill-lbl">Leaves</div>
            </div>
            <div className="report-kpi-pill">
              <div className="report-kpi-pill-val" style={{ color: '#059669' }}>
                {student.on_time_count}
              </div>
              <div className="report-kpi-pill-lbl">On-Time</div>
            </div>
            <div className="report-kpi-pill">
              <div className="report-kpi-pill-val" style={{ color: '#b45309' }}>
                {student.late_arrivals}
              </div>
              <div className="report-kpi-pill-lbl">Late</div>
            </div>
            <div className="report-kpi-pill" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
              <div className="report-kpi-pill-val" style={{ color: '#4338ca' }}>
                {student.attendance_percentage}%
              </div>
              <div className="report-kpi-pill-lbl" style={{ color: '#4338ca', fontWeight: 700 }}>Attendance Rate</div>
            </div>
          </div>

          <div className="report-matrix-section">
            <div className="report-matrix-title">
              <FileSpreadsheet size={16} style={{ color: '#4f46e5' }} />
              <span>Month-Wise Attendance Breakdown</span>
            </div>

            <div className="report-matrix-table-wrap">
              <table className="report-matrix-table">
                <thead>
                  <tr>
                    <th className="th-cat-year">Year</th>
                    <th className="th-cat-year">Period</th>
                    <th className="th-cat-dates">Total Days</th>
                    <th className="th-cat-dates">Leave Days</th>
                    {activeSessionKeys.map((sKey) => {
                      const sOpt = SESSION_OPTIONS.find((o) => o.key === sKey);
                      const sName = sOpt ? sOpt.label : sKey.toUpperCase();
                      if (sKey === 'aarti') {
                        return (
                          <React.Fragment key={sKey}>
                            <th className="th-cat-aarti">Aarti Attended</th>
                            <th className="th-cat-aarti">Aarti %</th>
                          </React.Fragment>
                        );
                      }
                      if (sKey === 'sabha') {
                        return (
                          <React.Fragment key={sKey}>
                            <th className="th-cat-sabha">Total Sabha</th>
                            <th className="th-cat-sabha">Attended Sabha</th>
                            <th className="th-cat-sabha">Sabha %</th>
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={sKey}>
                          <th className={getSessionHeaderClass(sKey)}>Total {sName}</th>
                          <th className={getSessionHeaderClass(sKey)}>Attended</th>
                          <th className={getSessionHeaderClass(sKey)}>{sName} %</th>
                        </React.Fragment>
                      );
                    })}
                    <th className="th-cat-year">Overall %</th>
                  </tr>
                </thead>
                <tbody>
                  {getStudentBreakdown(student).map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, background: '#fefce8' }}>{row.year}</td>
                      <td style={{ fontWeight: 600, background: '#fefce8' }}>{row.period}</td>
                      <td style={{ background: '#f0f9ff' }}>{row.total_days}</td>
                      <td style={{ background: '#f0f9ff', color: row.leave_days > 0 ? '#0284c7' : '#64748b', fontWeight: 600 }}>
                        {row.leave_days}
                      </td>
                      {activeSessionKeys.map((sKey) => {
                        const sData = row.sessions[sKey] || { conducted: 0, attended: 0, percentage: 0 };
                        const sPct = sData.percentage;
                        const pctColor = sPct >= 75 ? '#15803d' : sPct >= 50 ? '#d97706' : '#b91c1c';

                        if (sKey === 'aarti') {
                          return (
                            <React.Fragment key={sKey}>
                              <td style={{ background: '#fffbeb', fontWeight: 700, color: '#9a3412' }}>{sData.attended}</td>
                              <td style={{ background: '#fffbeb', fontWeight: 800, color: pctColor }}>{sPct}%</td>
                            </React.Fragment>
                          );
                        }
                        if (sKey === 'sabha') {
                          return (
                            <React.Fragment key={sKey}>
                              <td style={{ background: '#f0fdf4' }}>{sData.conducted}</td>
                              <td style={{ background: '#f0fdf4', fontWeight: 700, color: '#166534' }}>{sData.attended}</td>
                              <td style={{ background: '#f0fdf4', fontWeight: 800, color: pctColor }}>{sPct}%</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={sKey}>
                            <td style={{ background: '#faf5ff' }}>{sData.conducted}</td>
                            <td style={{ background: '#faf5ff', fontWeight: 700, color: '#6b21a8' }}>{sData.attended}</td>
                            <td style={{ background: '#faf5ff', fontWeight: 800, color: pctColor }}>{sPct}%</td>
                          </React.Fragment>
                        );
                      })}
                      <td style={{ fontWeight: 800, color: row.overall_percentage >= 75 ? '#15803d' : '#d97706', background: '#f8fafc' }}>
                        {row.overall_percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {customNote && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '10px 14px', borderRadius: '8px', fontSize: '0.825rem', color: '#92400e' }}>
              <strong>Admin Remark:</strong> {customNote}
            </div>
          )}

          <div className="report-card-footer">
            <div className="report-footer-disclaimer">
              <div>This is an official system-generated attendance report from the Hostel Attendance &amp; Management System (HAMS).</div>
              <div style={{ marginTop: '2px', color: '#94a3b8' }}>
                Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • HSH Integrated Engine
              </div>
            </div>
            <div className="report-signature-box">
              <div className="report-signature-line"></div>
              <div className="report-signature-text">Hostel Administrator / Rector</div>
            </div>
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="attendance-reports-container">
      {/* Offscreen Report Card Renderer for guaranteed per-student PNG image capture */}
      {exportingStudent && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-99999px',
            top: 0,
            width: '860px',
            pointerEvents: 'none',
            zIndex: -1,
            background: '#ffffff'
          }}
        >
          <div ref={exportCardRef} className="official-report-card">
            {renderOfficialReportCardBody(exportingStudent)}
          </div>
        </div>
      )}

      {/* 1. Control & Filter Panel */}
      <section className="reports-control-panel">
        <div className="control-panel-header">
          <div className="control-panel-title">
            <Sparkles size={24} style={{ color: '#4f46e5' }} />
            <div>
              <h3>Attendance Reports & Analytics</h3>
              <span>Fetch live HSH verified records for the last 6 months with multi-session support</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              onClick={mainTableViewMode === 'students' ? handleExportCSV : handleExportMatrixCSV}
              disabled={students.length === 0}
              title="Download formatted CSV report"
            >
              <Download size={16} />
              <span>{mainTableViewMode === 'students' ? 'Export Student CSV' : 'Export Matrix CSV'}</span>
            </button>
          </div>
        </div>

        {/* Multi-Session Type Selector Pills */}
        <div className="filter-input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <label>Session Type (Click multiple sessions to combine)</label>
            <div style={{ fontSize: '0.785rem', color: '#4f46e5', fontWeight: 700, background: '#eef2ff', padding: '2px 10px', borderRadius: '12px' }}>
              Selected: {sessionLabel}
            </div>
          </div>
          <div className="session-pills-row">
            {SESSION_OPTIONS.map((opt) => {
              const isAll = opt.key === 'all';
              const isSelected = isAll ? selectedSessions.includes('all') : (!selectedSessions.includes('all') && selectedSessions.includes(opt.key));
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`session-pill-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleToggleSession(opt.key)}
                  title={isAll ? 'Select all sessions' : `Toggle ${opt.label}`}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                  {isSelected && <Check size={14} style={{ marginLeft: '2px' }} />}
                </button>
              );
            })}
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

      {/* 2. Attendance Summary KPI Cards (Total Students & Avg. Overall Attendance Only) */}
      {summary && (
        <section className="summary-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {/* Total Students */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Total Students</span>
              <div className="kpi-icon-wrap" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                <Users size={22} />
              </div>
            </div>
            <div className="kpi-card-value">{summary.total_registered_students}</div>
            <div className="kpi-card-subtext">Active enrolled students</div>
          </div>

          {/* Avg. Overall Attendance Percentage */}
          <div className="kpi-card">
            <div className="kpi-card-header">
              <span className="kpi-card-title">Avg. Overall Attendance</span>
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
        </section>
      )}

      {/* 3. Interactive Charts */}
      {summary && summary.daily_trends.length > 0 && (
        <section className="charts-grid">
          {/* Daily Attendance Trend */}
          <div className="chart-card">
            <div className="chart-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4>Daily Attendance Performance ({startDate} to {endDate})</h4>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Present, Absent, Late Arrivals & Approved Leaves across selected period
                </span>
              </div>

              {/* Series Visibility Toggles */}
              <div className="chart-series-pills">
                <button
                  type="button"
                  className={`chart-series-pill ${chartSeries.present ? 'active present' : ''}`}
                  onClick={() => setChartSeries((p) => ({ ...p, present: !p.present }))}
                  title="Toggle Present line"
                >
                  <span className="dot" style={{ background: '#4f46e5' }}></span>
                  <span>Present</span>
                </button>
                <button
                  type="button"
                  className={`chart-series-pill ${chartSeries.absent ? 'active absent' : ''}`}
                  onClick={() => setChartSeries((p) => ({ ...p, absent: !p.absent }))}
                  title="Toggle Absent line"
                >
                  <span className="dot" style={{ background: '#f43f5e' }}></span>
                  <span>Absent</span>
                </button>
                <button
                  type="button"
                  className={`chart-series-pill ${chartSeries.late ? 'active late' : ''}`}
                  onClick={() => setChartSeries((p) => ({ ...p, late: !p.late }))}
                  title="Toggle Late Arrivals line"
                >
                  <span className="dot" style={{ background: '#f59e0b' }}></span>
                  <span>Late</span>
                </button>
                <button
                  type="button"
                  className={`chart-series-pill ${chartSeries.leave ? 'active leave' : ''}`}
                  onClick={() => setChartSeries((p) => ({ ...p, leave: !p.leave }))}
                  title="Toggle Approved Leave line"
                >
                  <span className="dot" style={{ background: '#0ea5e9' }}></span>
                  <span>Leave</span>
                </button>
              </div>
            </div>

            <div style={{ height: 280, width: '100%', marginTop: '4px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.daily_trends}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorLeave" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Legend />
                  {chartSeries.present && (
                    <Area type="monotone" dataKey="present" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPresent)" name="Present" />
                  )}
                  {chartSeries.absent && (
                    <Area type="monotone" dataKey="absent" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAbsent)" name="Absent" />
                  )}
                  {chartSeries.late && (
                    <Area type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorLate)" name="Late Arrivals" />
                  )}
                  {chartSeries.leave && (
                    <Area type="monotone" dataKey="leave" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorLeave)" name="On Leave" />
                  )}
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
            title="Preview attendance report card & message before sending"
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

      {/* 5. Main Screen View Switcher: Student Table vs Month-Wise Matrix */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
        <div className="view-mode-tabs">
          <button
            type="button"
            className={`view-mode-tab-btn ${mainTableViewMode === 'students' ? 'active' : ''}`}
            onClick={() => setMainTableViewMode('students')}
          >
            <Users size={16} />
            <span>👥 Student-Wise Attendance Table</span>
          </button>
          <button
            type="button"
            className={`view-mode-tab-btn ${mainTableViewMode === 'month_matrix' ? 'active' : ''}`}
            onClick={() => setMainTableViewMode('month_matrix')}
          >
            <FileSpreadsheet size={16} />
            <span>📅 Month-Wise Attendance Matrix (Spreadsheet View)</span>
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Showing period: <strong style={{ color: '#0f172a' }}>{startDate} to {endDate}</strong> • Sessions: <strong style={{ color: '#4f46e5' }}>{sessionLabel}</strong>
        </div>
      </div>

      {/* 6A. Student-Wise Attendance Table View */}
      {mainTableViewMode === 'students' && (
        <>
          {/* Search & Filters Bar */}
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
              <button
                className={`status-pill-btn ${statusFilter === 'leave' ? 'active' : ''}`}
                onClick={() => setStatusFilter('leave')}
              >
                On Leave
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
                                style={{ height: '30px', padding: '0 8px', fontSize: '0.75rem', background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca', fontWeight: 600 }}
                                onClick={() => handleViewStudentReport(stu)}
                                title="View official attendance report card"
                              >
                                <Eye size={14} />
                                <span>View Report</span>
                              </button>
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
        </>
      )}

      {/* 6B. Month-Wise Attendance Matrix (Spreadsheet View matching Images 2 & 3) */}
      {mainTableViewMode === 'month_matrix' && (
        <section className="table-card" style={{ padding: '20px' }}>
          {/* Header Controls with Dark Pills matching User's Uploaded Screenshot */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* fullName filter pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#0f172a', color: '#ffffff', padding: '6px 16px', borderRadius: '9999px', fontSize: '0.825rem', fontWeight: 600, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                <Filter size={14} style={{ color: '#94a3b8' }} />
                <span>fullName</span>
                <select
                  style={{ background: 'transparent', color: '#ffffff', border: 'none', outline: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.825rem' }}
                  value={matrixStudentFilter}
                  onChange={(e) => setMatrixStudentFilter(e.target.value)}
                >
                  <option value="all" style={{ color: '#0f172a' }}>All (Hostel-Wide Aggregate)</option>
                  {students.map((s) => (
                    <option key={s.student_id} value={s.name} style={{ color: '#0f172a' }}>
                      {s.name} (Room {s.room_number || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>

              {/* room filter pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#0f172a', color: '#ffffff', padding: '6px 16px', borderRadius: '9999px', fontSize: '0.825rem', fontWeight: 600, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                <Home size={14} style={{ color: '#94a3b8' }} />
                <span>room</span>
                <select
                  style={{ background: 'transparent', color: '#ffffff', border: 'none', outline: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.825rem' }}
                  value={matrixRoomFilter}
                  onChange={(e) => setMatrixRoomFilter(e.target.value)}
                >
                  <option value="all" style={{ color: '#0f172a' }}>All</option>
                  {availableRooms.map((r) => (
                    <option key={r} value={r} style={{ color: '#0f172a' }}>
                      Room {r}
                    </option>
                  ))}
                </select>
              </div>

              {(matrixStudentFilter !== 'all' || matrixRoomFilter !== 'all') && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.75rem' }}
                  onClick={() => {
                    setMatrixStudentFilter('all');
                    setMatrixRoomFilter('all');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="btn-secondary" onClick={handleExportMatrixCSV} title="Export spreadsheet to CSV">
                <Download size={14} />
                <span>Export Matrix CSV</span>
              </button>
            </div>
          </div>

          {/* Month-Wise Matrix Spreadsheet Table */}
          <div className="report-matrix-table-wrap">
            <table className="report-matrix-table">
              <thead>
                {/* Header Category Row matching User's Color-Coded Sheet */}
                <tr>
                  <th className="th-cat-year" colSpan={1}>Year</th>
                  <th className="th-cat-year" colSpan={1}>Period</th>
                  <th className="th-cat-dates" colSpan={2}>Dates</th>
                  {activeSessionKeys.map((sKey) => {
                    const sOpt = SESSION_OPTIONS.find((o) => o.key === sKey);
                    const sName = sOpt ? sOpt.label : sKey.toUpperCase();
                    if (sKey === 'aarti') {
                      return (
                        <React.Fragment key={sKey}>
                          <th className="th-cat-aarti">AartiAttendance</th>
                          <th className="th-cat-aarti">AartiPercentage</th>
                        </React.Fragment>
                      );
                    }
                    if (sKey === 'sabha') {
                      return (
                        <React.Fragment key={sKey}>
                          <th className="th-cat-sabha">Sabhas</th>
                          <th className="th-cat-sabha">SabhaAttendance</th>
                          <th className="th-cat-sabha">SabhaPercentage</th>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={sKey}>
                        <th className={getSessionHeaderClass(sKey)}>{sName} Conducted</th>
                        <th className={getSessionHeaderClass(sKey)}>{sName} Attended</th>
                        <th className={getSessionHeaderClass(sKey)}>{sName} %</th>
                      </React.Fragment>
                    );
                  })}
                  <th className="th-cat-year" colSpan={2}>Overall Attendance</th>
                </tr>

                {/* Sub-Header Column Labels */}
                <tr>
                  <th className="th-cat-year">Year</th>
                  <th className="th-cat-year">Period</th>
                  <th className="th-cat-dates">Total Days</th>
                  <th className="th-cat-dates">Leave Days</th>
                  {activeSessionKeys.map((sKey) => {
                    const sOpt = SESSION_OPTIONS.find((o) => o.key === sKey);
                    const sName = sOpt ? sOpt.label : sKey.toUpperCase();
                    if (sKey === 'aarti') {
                      return (
                        <React.Fragment key={sKey}>
                          <th className="th-cat-aarti">Aarti Attended</th>
                          <th className="th-cat-aarti">Aarti %</th>
                        </React.Fragment>
                      );
                    }
                    if (sKey === 'sabha') {
                      return (
                        <React.Fragment key={sKey}>
                          <th className="th-cat-sabha">Total Sabha</th>
                          <th className="th-cat-sabha">Attended Sabha</th>
                          <th className="th-cat-sabha">Sabha %</th>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={sKey}>
                        <th className={getSessionHeaderClass(sKey)}>Total {sName}</th>
                        <th className={getSessionHeaderClass(sKey)}>Attended</th>
                        <th className={getSessionHeaderClass(sKey)}>{sName} %</th>
                      </React.Fragment>
                    );
                  })}
                  <th className="th-cat-year">Conducted</th>
                  <th className="th-cat-year">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {displayedMatrixRows.length === 0 ? (
                  <tr>
                    <td colSpan={6 + activeSessionKeys.length * 3} style={{ padding: '36px', color: '#64748b' }}>
                      No month-wise attendance data found for the selected period.
                    </td>
                  </tr>
                ) : (
                  displayedMatrixRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, background: '#fefce8' }}>{row.year}</td>
                      <td style={{ fontWeight: 600, background: '#fefce8' }}>{row.period}</td>
                      <td style={{ background: '#f0f9ff' }}>{row.total_days.toLocaleString()}</td>
                      <td style={{ background: '#f0f9ff', color: row.leave_days > 0 ? '#0284c7' : '#64748b', fontWeight: 600 }}>
                        {row.leave_days.toLocaleString()}
                      </td>
                      {activeSessionKeys.map((sKey) => {
                        const sData = row.sessions[sKey] || { conducted: 0, attended: 0, percentage: 0 };
                        const sPct = sData.percentage;
                        const pctColor = sPct >= 75 ? '#15803d' : sPct >= 50 ? '#d97706' : '#b91c1c';

                        if (sKey === 'aarti') {
                          return (
                            <React.Fragment key={sKey}>
                              <td style={{ background: '#fffbeb', fontWeight: 700, color: '#9a3412' }}>
                                {sData.attended.toLocaleString()}
                              </td>
                              <td style={{ background: '#fffbeb', fontWeight: 800, color: pctColor }}>
                                {sPct}%
                              </td>
                            </React.Fragment>
                          );
                        }

                        if (sKey === 'sabha') {
                          return (
                            <React.Fragment key={sKey}>
                              <td style={{ background: '#f0fdf4' }}>{sData.conducted.toLocaleString()}</td>
                              <td style={{ background: '#f0fdf4', fontWeight: 700, color: '#166534' }}>
                                {sData.attended.toLocaleString()}
                              </td>
                              <td style={{ background: '#f0fdf4', fontWeight: 800, color: pctColor }}>
                                {sPct}%
                              </td>
                            </React.Fragment>
                          );
                        }

                        return (
                          <React.Fragment key={sKey}>
                            <td style={{ background: '#faf5ff' }}>{sData.conducted.toLocaleString()}</td>
                            <td style={{ background: '#faf5ff', fontWeight: 700, color: '#6b21a8' }}>
                              {sData.attended.toLocaleString()}
                            </td>
                            <td style={{ background: '#faf5ff', fontWeight: 800, color: pctColor }}>
                              {sPct}%
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td style={{ fontWeight: 600, background: '#f8fafc' }}>
                        {row.overall_conducted.toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 800, color: row.overall_percentage >= 75 ? '#15803d' : '#d97706', background: '#f8fafc' }}>
                        {row.overall_percentage}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {displayedMatrixRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL / AVERAGE</td>
                    <td style={{ fontWeight: 800 }}>
                      {displayedMatrixRows.reduce((acc, r) => acc + r.total_days, 0).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 800, color: '#0284c7' }}>
                      {displayedMatrixRows.reduce((acc, r) => acc + r.leave_days, 0).toLocaleString()}
                    </td>
                    {activeSessionKeys.map((sKey) => {
                      const totalAtt = displayedMatrixRows.reduce((acc, r) => acc + (r.sessions[sKey]?.attended || 0), 0);
                      const totalCond = displayedMatrixRows.reduce((acc, r) => acc + (r.sessions[sKey]?.conducted || 0), 0);
                      const avgPct = totalCond > 0 ? Math.round((totalAtt / totalCond) * 100) : 0;

                      if (sKey === 'aarti') {
                        return (
                          <React.Fragment key={sKey}>
                            <td style={{ fontWeight: 800, color: '#9a3412' }}>{totalAtt.toLocaleString()}</td>
                            <td style={{ fontWeight: 800 }}>{avgPct}%</td>
                          </React.Fragment>
                        );
                      }
                      if (sKey === 'sabha') {
                        return (
                          <React.Fragment key={sKey}>
                            <td style={{ fontWeight: 800 }}>{totalCond.toLocaleString()}</td>
                            <td style={{ fontWeight: 800, color: '#166534' }}>{totalAtt.toLocaleString()}</td>
                            <td style={{ fontWeight: 800 }}>{avgPct}%</td>
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={sKey}>
                          <td style={{ fontWeight: 800 }}>{totalCond.toLocaleString()}</td>
                          <td style={{ fontWeight: 800, color: '#6b21a8' }}>{totalAtt.toLocaleString()}</td>
                          <td style={{ fontWeight: 800 }}>{avgPct}%</td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{ fontWeight: 800 }}>
                      {displayedMatrixRows.reduce((acc, r) => acc + r.overall_conducted, 0).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 800, color: '#4f46e5' }}>
                      {(() => {
                        const allCond = displayedMatrixRows.reduce((acc, r) => acc + r.overall_conducted, 0);
                        const allAtt = displayedMatrixRows.reduce((acc, r) => acc + r.overall_attended, 0);
                        return allCond > 0 ? Math.round((allAtt / allCond) * 100) : 0;
                      })()}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* 7. Dedicated View Report & Pre-Send Preview Modal (Report Card & Image & Template) */}
      {previewModalOpen &&
        createPortal(
          <div className="modal-overlay" onClick={() => setPreviewModalOpen(false)}>
            <div className="modal-content" style={{ maxWidth: '1000px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Eye size={22} style={{ color: '#4f46e5' }} />
                  <div>
                    <h3>Attendance Report & Notification Center</h3>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Official visual report card preview, image export & dispatch options
                    </span>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setPreviewModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Target Recipient Selector */}
                <div style={{ display: 'flex', gap: '16px', background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="recipient"
                      value="parent"
                      checked={previewRecipient === 'parent'}
                      onChange={() => setPreviewRecipient('parent')}
                    />
                    <span>👨‍👩‍👧 Send to Parent (Dispatches to Parent / Father Phone)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
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

                {/* Scope Summary Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div style={{ background: '#e0e7ff', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#4338ca', fontWeight: 700 }}>SELECTED RECIPIENTS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e1b4b' }}>
                      {selectedStudentIds.length} Students
                    </div>
                  </div>
                  <div style={{ background: '#ecfdf5', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700 }}>DATE PERIOD</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#064e3b' }}>
                      {startDate} to {endDate}
                    </div>
                  </div>
                  <div style={{ background: '#fef3c7', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>SESSION CATEGORY</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#78350f' }}>
                      {sessionLabel}
                    </div>
                  </div>
                </div>

                {/* Main Modal Tab Navigation: Report Card vs WhatsApp Text */}
                <div className="preview-main-tabs">
                  <button
                    type="button"
                    className={`preview-tab-btn ${activePreviewTab === 'report_card' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('report_card')}
                  >
                    <Layers size={16} />
                    <span>📊 Official Attendance Report Card & Image</span>
                  </button>
                  <button
                    type="button"
                    className={`preview-tab-btn ${activePreviewTab === 'message_text' ? 'active' : ''}`}
                    onClick={() => setActivePreviewTab('message_text')}
                  >
                    <FileText size={16} />
                    <span>💬 WhatsApp Notification Message Preview</span>
                  </button>
                </div>

                {/* ========================================================= */}
                {/* TAB 1: OFFICIAL REPORT CARD PREVIEW & IMAGE EXPORT */}
                {/* ========================================================= */}
                {activePreviewTab === 'report_card' && (
                  <div>
                    {/* Student Selector Toolbar */}
                    {selectedStudentsList.length > 0 && (
                      <div className="report-card-toolbar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <Users size={16} style={{ color: '#4f46e5' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                            Previewing Student:
                          </span>
                          <select
                            className="student-preview-select"
                            value={previewStudentId || ''}
                            onChange={(e) => setPreviewStudentId(Number(e.target.value))}
                            style={{ minWidth: '240px' }}
                          >
                            {selectedStudentsList.map((stu) => (
                              <option key={stu.student_id} value={stu.student_id}>
                                {stu.name} — Room {stu.room_number || 'N/A'} ({stu.attendance_percentage}%)
                              </option>
                            ))}
                          </select>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', padding: '0 4px' }}>
                              {currentPreviewIndex + 1} / {selectedStudentsList.length}
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
                          </div>
                        </div>

                        {/* Image Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-card-action btn-download-img"
                            onClick={handleDownloadReportImage}
                            disabled={isExportingImage}
                            title="Download crisp report card PNG image"
                          >
                            <Download size={14} />
                            <span>Download PNG</span>
                          </button>
                          <button
                            type="button"
                            className="btn-card-action btn-copy-img"
                            onClick={handleCopyReportImage}
                            disabled={isExportingImage}
                            title="Copy visual report card image to clipboard"
                          >
                            <Copy size={14} />
                            <span>Copy Image</span>
                          </button>
                          <button
                            type="button"
                            className="btn-card-action btn-copy-img"
                            onClick={handlePrintReport}
                            title="Print this official report"
                          >
                            <Printer size={14} />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Official Report Card (Wrapped for display & html2canvas export) */}
                    <div ref={reportCardRef} className="official-report-card">
                      {renderOfficialReportCardBody(currentPreviewStudent)}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* TAB 2: WHATSAPP MESSAGE TEXT TEMPLATE PREVIEW & EDITOR */}
                {/* ========================================================= */}
                {activePreviewTab === 'message_text' && (
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
                            session_name: sessionLabel,
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
                )}

                {/* Pre-Send Attachment Option (Always visible on both tabs) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={attachReportImage}
                      onChange={(e) => setAttachReportImage(e.target.checked)}
                    />
                    <span>🖼️ Attach Personalized Report Card Image (PNG) with WhatsApp Notification</span>
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Each student/parent receives their own individual visual PNG report card
                  </span>
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
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
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
                      <span>{sendProgress || 'Sending Reports...'}</span>
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
                              ) : h.status === 'leave' ? (
                                <span style={{ color: '#0284c7', fontWeight: 700, background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                                  🏖️ Approved Leave
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
                                {h.source === 'hsh_api'
                                  ? 'External HSH API'
                                  : h.source === 'leave_portal'
                                    ? 'Official Leave Portal'
                                    : 'Local BLE Scanner'}
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
