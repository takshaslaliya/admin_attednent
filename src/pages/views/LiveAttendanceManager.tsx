import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Square,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  Edit2,
  Trash2,
  ArrowRight,
  Search,
  UserCheck,
  AlertCircle,
  FileText,
  Check,
  X,
  MessageSquare,
  Send,
  Users,
  Phone,
  Plus,
  Calendar,
  Sparkles,
  Eye,
  Printer,
  Layers,
  ShieldCheck
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useCustomDialog } from '../../context/ConfirmContext';
import { HamsCard } from '../../components/HamsCard';
import { ExpandableReasonTooltip } from '../../components/ExpandableReasonTooltip';
import { EditSessionModal } from '../../components/EditSessionModal';
import './LiveAttendanceManager.css';

interface ManualModalState {
  isOpen: boolean;
  student: any;
  status: 'Present' | 'Late';
  phase?: 1 | 2;
  description: string;
}

const formatISTTime = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    let d: Date;
    if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes('Z') && dateStr.includes(' ')) {
      d = new Date(dateStr.replace(' ', 'T') + 'Z');
      if (isNaN(d.getTime())) {
        d = new Date(dateStr);
      }
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase();
  } catch (e) {
    return '—';
  }
};

interface JustifyModalState {
  isOpen: boolean;
  student: any;
  reason: string;
  error?: string;
}

interface StatusAlertConfig {
  enabled: boolean;
  target: 'student' | 'parent' | 'both';
  student_message: string;
  parent_message: string;
}

interface AutoAlertsConfig {
  absent: StatusAlertConfig;
  late: StatusAlertConfig;
  leave: StatusAlertConfig;
  present: StatusAlertConfig;
}

const DEFAULT_ALERTS_CONFIG: AutoAlertsConfig = {
  absent: {
    enabled: true,
    target: 'both',
    student_message: 'Dear {name}, you were marked Absent for {session_name} on {date}. Please contact your floor leader.',
    parent_message: 'Respected Parent, your ward {name} (Room {room}) was marked Absent for {session_name} attendance on {date} at AVD Hostel.'
  },
  late: {
    enabled: false,
    target: 'both',
    student_message: 'Dear {name}, you were marked Late for {session_name} on {date}. Please ensure to be on time.',
    parent_message: 'Respected Parent, your ward {name} (Room {room}) arrived Late for {session_name} attendance on {date}.'
  },
  leave: {
    enabled: false,
    target: 'both',
    student_message: 'Dear {name}, your leave for {session_name} on {date} is recorded ({reason}).',
    parent_message: 'Respected Parent, your ward {name} (Room {room}) is on approved leave for {session_name} on {date}.'
  },
  present: {
    enabled: false,
    target: 'both',
    student_message: 'Dear {name}, your attendance for {session_name} on {date} was recorded successfully.',
    parent_message: 'Respected Parent, your ward {name} (Room {room}) was marked Present for {session_name} on {date}.'
  }
};

interface DayScheduleSlot {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
  lateTime?: string | null;
  phase2StartTime?: string | null;
  phase2EndTime?: string | null;
  phase2LateTime?: string | null;
}

const ALL_WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL_NAMES: Record<string, string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday'
};

export const LiveAttendanceManager: React.FC<{ sessionKey: string; onSessionDeleted?: () => void }> = ({
  sessionKey,
  onSessionDeleted,
}) => {
  const { admin } = useAuth();
  const confirm = useConfirm();
  const dialog = useCustomDialog();
  const isLeader = (admin?.role || '').toUpperCase() === 'LEADER' || (admin?.role || '').toLowerCase() === 'floor_leader';
  let permissions: any = admin?.session_permissions || {};
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch (e) { permissions = {}; }
  }
  const sKey = (sessionKey || '').toLowerCase();
  const sessionPerm = permissions?.[sKey] || permissions?.[sessionKey] || permissions?.['all'] || 'edit';
  const isViewOnly = isLeader && sessionPerm === 'view';

  const [sessionName, setSessionName] = useState('');
  const [isForAllStudents, setIsForAllStudents] = useState(true);
  const [startTime, setStartTime] = useState('21:00');
  const [endTime, setEndTime] = useState('21:30');
  const [lateTime, setLateTime] = useState<string | null>(null);

  // Multiple-Time Attendance (Two-Phase Attendance)
  const [hasMultipleAttendance, setHasMultipleAttendance] = useState(false);
  const [phase2StartTime, setPhase2StartTime] = useState('07:25');
  const [phase2EndTime, setPhase2EndTime] = useState('07:30');
  const [phase2LateTime, setPhase2LateTime] = useState<string | null>(null);
  const [iconName, setIconName] = useState('moon');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [linkedSessionKey, setLinkedSessionKey] = useState<string | null>(null);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);

  // Day-wise Schedule State
  const [daySchedules, setDaySchedules] = useState<DayScheduleSlot[]>([
    {
      id: 'slot_default',
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      startTime: '21:00',
      endTime: '21:30',
      lateTime: null,
      phase2StartTime: '07:25',
      phase2EndTime: '07:30',
      phase2LateTime: null
    }
  ]);

  const getAssignedDays = (excludeSlotId?: string) => {
    const set = new Set<string>();
    daySchedules.forEach(slot => {
      if (slot.id !== excludeSlotId) {
        slot.days.forEach(d => set.add(d));
      }
    });
    return set;
  };

  const handleAddDaySchedule = () => {
    const assigned = getAssignedDays();
    const unassignedDays = ALL_WEEK_DAYS.filter(d => !assigned.has(d));

    if (unassignedDays.length === 0) {
      alert('All 7 days already have schedule rules.');
      return;
    }

    const newSlot: DayScheduleSlot = {
      id: 'slot_' + Date.now(),
      days: unassignedDays,
      startTime: startTime || '21:00',
      endTime: endTime || '21:30',
      lateTime: lateTime || null,
      phase2StartTime: phase2StartTime || '07:25',
      phase2EndTime: phase2EndTime || '07:30',
      phase2LateTime: phase2LateTime || null
    };

    setDaySchedules(prev => [...prev, newSlot]);
  };

  const handleRemoveSlot = (slotId: string) => {
    if (daySchedules.length <= 1) {
      alert('At least one schedule rule must exist.');
      return;
    }
    setDaySchedules(prev => prev.filter(s => s.id !== slotId));
  };

  const handleToggleDayInSlot = (slotId: string, day: string) => {
    setDaySchedules(prev => prev.map(slot => {
      if (slot.id !== slotId) return slot;
      const exists = slot.days.includes(day);
      const newDays = exists ? slot.days.filter(d => d !== day) : [...slot.days, day];
      return { ...slot, days: newDays };
    }));
  };

  const handleSlotTimeChange = (
    slotId: string,
    field: 'startTime' | 'endTime' | 'lateTime' | 'phase2StartTime' | 'phase2EndTime' | 'phase2LateTime',
    value: any
  ) => {
    setDaySchedules(prev => prev.map(slot => {
      if (slot.id !== slotId) return slot;
      return { ...slot, [field]: value };
    }));
  };

  // Multi-Category WhatsApp Alerts Configuration
  const [alertsConfig, setAlertsConfig] = useState<AutoAlertsConfig>(DEFAULT_ALERTS_CONFIG);
  const [activeAlertCategory, setActiveAlertCategory] = useState<'absent' | 'late' | 'leave' | 'present'>('absent');
  const [autoMessage, setAutoMessage] = useState('');
  const [autoMessageStudent, setAutoMessageStudent] = useState('');
  const [autoMessageParent, setAutoMessageParent] = useState('');
  const [autoMessageTime, setAutoMessageTime] = useState('');
  const [sendingAlerts, setSendingAlerts] = useState(false);

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [activeTab, setActiveTab] = useState(isLeader ? 1 : 0);

  useEffect(() => {
    if (isLeader) {
      setActiveTab(1);
    }
  }, [isLeader]);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDateStr());
  const [floorFilter, setFloorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [absentDate, setAbsentDate] = useState(getTodayDateStr());
  const [absentFloorFilter, setAbsentFloorFilter] = useState('All');
  const [absentStatusFilter, setAbsentStatusFilter] = useState('All');
  const [absentSearchQuery, setAbsentSearchQuery] = useState('');
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [absentStudents, setAbsentStudents] = useState<any[]>([]);

  // Targets / Student Assignment state
  const [targetStudents, setTargetStudents] = useState<any[]>([]);
  const [targetFloors, setTargetFloors] = useState<any[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [targetFloorFilter, setTargetFloorFilter] = useState('All');
  const [savingTargets, setSavingTargets] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Modals state
  const [manualModal, setManualModal] = useState<ManualModalState | null>(null);
  const [justifyModal, setJustifyModal] = useState<JustifyModalState | null>(null);

  // Two-Phase / Multiple Attendance Report State
  const [isMultipleAttendance, setIsMultipleAttendance] = useState(false);
  const [twoPhaseSummary, setTwoPhaseSummary] = useState<any>(null);
  const [twoPhaseWindows, setTwoPhaseWindows] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'combined' | 'first' | 'second'>('combined');
  const [selectedStudentDetails, setSelectedStudentDetails] = useState<any | null>(null);

  useEffect(() => {
    fetchSchedule(false);
    fetchTargets();
  }, [sessionKey]);

  useEffect(() => {
    if (activeTab === 1) fetchAttendanceList();
    if (activeTab === 2) fetchAbsentList();
    if (activeTab === 3) fetchTargets();

    // Auto-poll live records and session configurations every 3 seconds
    const pollInterval = setInterval(() => {
      if (activeTab === 1 && !manualModal?.isOpen && !justifyModal?.isOpen) {
        fetchAttendanceList();
        fetchSchedule(true);
      }
      if (activeTab === 2 && !manualModal?.isOpen && !justifyModal?.isOpen) {
        fetchAbsentList();
        fetchSchedule(true);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [activeTab, attendanceDate, absentDate, sessionKey, manualModal?.isOpen, justifyModal?.isOpen]);

  const fetchSchedule = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const [res, allRes] = await Promise.all([
        apiClient.get(`/attendance/schedule?type=${sessionKey}`),
        apiClient.get('/admin/sessions')
      ]);

      const allSessions = allRes.data?.success && Array.isArray(allRes.data.data) ? allRes.data.data : [];
      if (allSessions.length > 0) {
        setAvailableSessions(allSessions);
      }
      const match = allSessions.find((s: any) => s.session_key?.toLowerCase() === sessionKey?.toLowerCase());

      if (match) {
        setSessionName(match.session_name);
        if (match.icon_name) {
          setIconName(match.icon_name);
        }
        if (match.is_for_all_students !== undefined) {
          setIsForAllStudents(Boolean(match.is_for_all_students));
        }
      } else {
        setSessionName(sessionKey.charAt(0).toUpperCase() + sessionKey.slice(1) + ' Attendance');
      }

      if (res.data.success && res.data.data) {
        const d = res.data.data;
        setStartTime((d.start_time || match?.start_time || '21:00').slice(0, 5));
        setEndTime((d.end_time || match?.end_time || '21:30').slice(0, 5));
        const lTime = d.late_time !== undefined ? d.late_time : match?.late_time;
        setLateTime(lTime ? String(lTime).slice(0, 5) : null);

        // Multiple Attendance: Check BOTH schedule data, slot items, AND session metadata
        const hasSlotMulti = Array.isArray(d.day_schedules) && d.day_schedules.some((s: any) => s.hasMultipleAttendance === true || s.hasMultipleAttendance === 1 || s.hasMultipleAttendance === '1');
        const isMulti = Boolean(
          (d.has_multiple_attendance && d.has_multiple_attendance !== '0' && d.has_multiple_attendance !== 0) ||
          (match?.has_multiple_attendance && match?.has_multiple_attendance !== '0' && match?.has_multiple_attendance !== 0) ||
          hasSlotMulti
        );

        setHasMultipleAttendance(isMulti);
        setIsMultipleAttendance(isMulti);

        const p2s = d.phase2_start_time || match?.phase2_start_time || '07:25';
        const p2e = d.phase2_end_time || match?.phase2_end_time || '07:30';
        const p2l = d.phase2_late_time !== undefined ? d.phase2_late_time : (match?.phase2_late_time !== undefined ? match?.phase2_late_time : null);

        setPhase2StartTime(String(p2s).slice(0, 5));
        setPhase2EndTime(String(p2e).slice(0, 5));
        setPhase2LateTime(p2l ? String(p2l).slice(0, 5) : null);

        setLinkedSessionKey(d.linked_session_key || null);
        const sMsg = d.auto_message_student || d.auto_message || '';
        const pMsg = d.auto_message_parent || '';
        setAutoMessage(sMsg);
        setAutoMessageStudent(sMsg);
        setAutoMessageParent(pMsg);
        setAutoMessageTime(d.auto_message_time ? d.auto_message_time.slice(0, 5) : '');
        if (d.is_for_all_students !== undefined) {
          setIsForAllStudents(Boolean(d.is_for_all_students));
        }

        if (d.day_schedules && Array.isArray(d.day_schedules) && d.day_schedules.length > 0) {
          const loadedSlots: DayScheduleSlot[] = d.day_schedules.map((s: any) => ({
            id: s.id || ('slot_' + Math.random().toString(36).slice(2, 7)),
            days: Array.isArray(s.days) ? s.days : [],
            startTime: (s.startTime || s.start_time || d.start_time || '21:00').slice(0, 5),
            endTime: (s.endTime || s.end_time || d.end_time || '21:30').slice(0, 5),
            lateTime: (s.lateTime !== undefined ? s.lateTime : (s.late_time !== undefined ? s.late_time : d.late_time))
              ? String(s.lateTime || s.late_time || d.late_time).slice(0, 5)
              : null,
            phase2StartTime: (s.phase2StartTime || s.phase2_start_time || p2s).slice(0, 5),
            phase2EndTime: (s.phase2EndTime || s.phase2_end_time || p2e).slice(0, 5),
            phase2LateTime: (s.phase2LateTime !== undefined ? s.phase2LateTime : (s.phase2_late_time !== undefined ? s.phase2_late_time : p2l))
              ? String(s.phase2LateTime || s.phase2_late_time || p2l).slice(0, 5)
              : null
          }));
          setDaySchedules(loadedSlots);
        } else {
          setDaySchedules([
            {
              id: 'slot_1',
              days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
              startTime: (d.start_time || '21:00').slice(0, 5),
              endTime: (d.end_time || '21:30').slice(0, 5),
              lateTime: d.late_time ? d.late_time.slice(0, 5) : null,
              phase2StartTime: String(p2s).slice(0, 5),
              phase2EndTime: String(p2e).slice(0, 5),
              phase2LateTime: p2l ? String(p2l).slice(0, 5) : null
            }
          ]);
        }

        if (d.auto_alerts_config) {
          const cfg = typeof d.auto_alerts_config === 'string' ? JSON.parse(d.auto_alerts_config) : d.auto_alerts_config;
          setAlertsConfig({
            absent: { ...DEFAULT_ALERTS_CONFIG.absent, ...(cfg.absent || {}) },
            late: { ...DEFAULT_ALERTS_CONFIG.late, ...(cfg.late || {}) },
            leave: { ...DEFAULT_ALERTS_CONFIG.leave, ...(cfg.leave || {}) },
            present: { ...DEFAULT_ALERTS_CONFIG.present, ...(cfg.present || {}) }
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTargets = async () => {
    try {
      const res = await apiClient.get(`/attendance/session/${sessionKey}/targets`);
      if (res.data.success) {
        setTargetStudents(res.data.students || []);
        setTargetFloors(res.data.floors || []);
        setSelectedTargetIds(res.data.assigned_student_ids || []);
        if (res.data.is_for_all_students !== undefined) {
          setIsForAllStudents(Boolean(res.data.is_for_all_students));
        }
      }
    } catch (e) {
      console.error('Failed to load targets', e);
    }
  };

  const toggleStudentTarget = (studentId: number) => {
    setSelectedTargetIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllTargets = () => {
    const visibleStudentIds = filteredTargetStudents.map(s => s.student_id);
    setSelectedTargetIds(prev => Array.from(new Set([...prev, ...visibleStudentIds])));
  };

  const handleClearAllTargets = () => {
    const visibleStudentIds = new Set(filteredTargetStudents.map(s => s.student_id));
    setSelectedTargetIds(prev => prev.filter(id => !visibleStudentIds.has(id)));
  };

  const saveAssignedTargets = async () => {
    setSavingTargets(true);
    try {
      const res = await apiClient.post(`/attendance/session/${sessionKey}/targets`, {
        assigned_student_ids: selectedTargetIds
      });

      if (res.data.success) {
        alert('Assigned students for this session saved successfully!');
        fetchTargets();
        if (activeTab === 1) fetchAttendanceList();
        if (activeTab === 2) fetchAbsentList();
      } else {
        alert(res.data.message || 'Failed to save assigned students');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save assigned students');
    } finally {
      setSavingTargets(false);
    }
  };

  const updateCategoryConfig = (
    cat: 'absent' | 'late' | 'leave' | 'present',
    updates: Partial<StatusAlertConfig>
  ) => {
    setAlertsConfig(prev => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        ...updates
      }
    }));
  };

  const saveSchedule = async () => {
    // Validate day schedules
    for (let i = 0; i < daySchedules.length; i++) {
      const slot = daySchedules[i];
      if (!slot.days || slot.days.length === 0) {
        alert(`Rule #${i + 1} has no days selected. Please select at least one day or remove the rule.`);
        return;
      }
      if (!slot.startTime || !slot.endTime) {
        alert(`Rule #${i + 1} is missing Start Time or End Time.`);
        return;
      }
    }

    const primarySlot = daySchedules[0];
    const sTime = primarySlot ? primarySlot.startTime : startTime;
    const eTime = primarySlot ? primarySlot.endTime : endTime;
    const lTime = primarySlot ? primarySlot.lateTime : lateTime;
    const p2StartTimeVal = hasMultipleAttendance ? (primarySlot?.phase2StartTime || phase2StartTime) : null;
    const p2EndTimeVal = hasMultipleAttendance ? (primarySlot?.phase2EndTime || phase2EndTime) : null;
    const p2LateTimeVal = hasMultipleAttendance ? (primarySlot?.phase2LateTime !== undefined ? primarySlot.phase2LateTime : phase2LateTime) : null;

    // Validate Multiple Attendance Windows (Two-Phase)
    if (hasMultipleAttendance) {
      for (let i = 0; i < daySchedules.length; i++) {
        const slot = daySchedules[i];
        const p2s = slot.phase2StartTime || phase2StartTime;
        const p2e = slot.phase2EndTime || phase2EndTime;
        if (!p2s || !p2e) {
          alert(`Rule #${i + 1}: Please specify both Start Time and End Time for the Second Attendance Window.`);
          return;
        }
        const [sh1, sm1] = slot.startTime.split(':').map(Number);
        const [eh1, em1] = slot.endTime.split(':').map(Number);
        const [sh2, sm2] = p2s.split(':').map(Number);
        const [eh2, em2] = p2e.split(':').map(Number);
        const w1Start = sh1 * 60 + sm1;
        const w1End = eh1 * 60 + em1;
        const w2Start = sh2 * 60 + sm2;
        const w2End = eh2 * 60 + em2;

        if (w1Start < w1End && w2Start < w1End) {
          alert(`Rule #${i + 1} Validation Error: Second Attendance Window Start Time (${p2s}) must start AFTER First Attendance Window End Time (${slot.endTime})!`);
          return;
        }
        if (w2End <= w2Start) {
          alert(`Rule #${i + 1} Validation Error: Second Attendance Window End Time (${p2e}) must be AFTER its Start Time (${p2s})!`);
          return;
        }
        const p2l = slot.phase2LateTime !== undefined && slot.phase2LateTime !== null ? slot.phase2LateTime : phase2LateTime;
        if (p2l) {
          const [lh2, lm2] = p2l.split(':').map(Number);
          const late2 = lh2 * 60 + lm2;
          if (late2 < w2Start || late2 > w2End) {
            alert(`Rule #${i + 1}: Second Attendance Window Late Cutoff must fall between Window 2 Start and End time.`);
            return;
          }
        }
      }
    }

    // Validate that autoMessageTime is after endTime
    if (autoMessageTime && autoMessageTime.trim()) {
      const effectiveEndTime = (hasMultipleAttendance && p2EndTimeVal) ? p2EndTimeVal : eTime;
      const [eh, em] = effectiveEndTime.split(':').map(Number);
      const [mh, mm] = autoMessageTime.split(':').map(Number);
      const [sh, sm] = sTime.split(':').map(Number);
      const eMins = eh * 60 + em;
      const mMins = mh * 60 + mm;
      const sMins = sh * 60 + sm;

      if (sMins <= eMins && mMins <= eMins) {
        alert(`Automated WhatsApp message time (${autoMessageTime}) must be set AFTER attendance End Time (${effectiveEndTime})!`);
        return;
      }
    }

    const daySchedulesToSave = hasMultipleAttendance
      ? daySchedules.map(slot => ({
        ...slot,
        hasMultipleAttendance: true,
        phase2StartTime: slot.phase2StartTime || p2StartTimeVal,
        phase2EndTime: slot.phase2EndTime || p2EndTimeVal,
        phase2LateTime: slot.phase2LateTime !== undefined ? slot.phase2LateTime : p2LateTimeVal
      }))
      : daySchedules.map(slot => ({
        ...slot,
        hasMultipleAttendance: false
      }));

    setSaving(true);
    try {
      const res = await apiClient.put('/attendance/schedule', {
        type: sessionKey,
        startTime: sTime,
        endTime: eTime,
        lateTime: lTime,
        hasMultipleAttendance: hasMultipleAttendance,
        phase2StartTime: p2StartTimeVal,
        phase2EndTime: p2EndTimeVal,
        phase2LateTime: p2LateTimeVal,
        daySchedules: daySchedulesToSave,
        linkedSessionKey: linkedSessionKey,
        autoMessage: alertsConfig.absent.student_message,
        autoMessageStudent: alertsConfig.absent.student_message,
        autoMessageParent: alertsConfig.absent.parent_message,
        autoMessageTime: autoMessageTime,
        autoAlertsConfig: alertsConfig
      });
      alert(res.data.message || 'Weekly day schedule and WhatsApp alert settings saved successfully!');
      fetchSchedule();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  const sendInstantSessionAlerts = async () => {
    const enabledCategories = (['absent', 'late', 'leave', 'present'] as const).filter(
      cat => alertsConfig[cat].enabled && (
        ((alertsConfig[cat].target === 'student' || alertsConfig[cat].target === 'both') && alertsConfig[cat].student_message.trim()) ||
        ((alertsConfig[cat].target === 'parent' || alertsConfig[cat].target === 'both') && alertsConfig[cat].parent_message.trim())
      )
    );

    if (enabledCategories.length === 0) {
      alert('Please enable at least one status category (Absent, Late, Leave, Present) and write a message template before sending.');
      return;
    }

    const catLabels = enabledCategories.map(c => c.toUpperCase()).join(', ');
    const isConfirmed = await confirm({
      title: 'Send WhatsApp Session Alerts',
      message: `Are you sure you want to dispatch WhatsApp status alerts for categories: [${catLabels}] for ${sessionName} on ${attendanceDate}?`,
      warningNote: 'Messages will be dispatched to students and parents safely with 1-2 second intervals.',
      confirmText: 'Dispatch WhatsApp Alerts',
      type: 'primary',
      icon: 'sparkles' as any
    });
    if (!isConfirmed) return;

    setSendingAlerts(true);
    try {
      const res = await apiClient.post(`/attendance/session/${sessionKey}/send-session-alerts`, {
        alertsConfig: alertsConfig,
        date: attendanceDate
      });

      alert(res.data.message || 'Alerts dispatch started successfully.');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to send alerts');
    } finally {
      setSendingAlerts(false);
    }
  };

  const stopAttendance = async () => {
    const isConfirmed = await confirm({
      title: 'Stop Active Attendance Window',
      message: `Are you sure you want to immediately stop and close the attendance session for "${sessionName}"?`,
      warningNote: 'Students will no longer be able to submit attendance for this session today.',
      confirmText: 'Yes, Stop Attendance',
      type: 'warning'
    });
    if (!isConfirmed) return;

    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setStartTime(curTime);
    setEndTime(curTime);
    setSaving(true);
    try {
      await apiClient.put('/attendance/schedule', {
        type: sessionKey,
        startTime: curTime,
        endTime: curTime,
        lateTime: lateTime,
        linkedSessionKey: linkedSessionKey,
        hasMultipleAttendance: hasMultipleAttendance,
        phase2StartTime: phase2StartTime,
        phase2EndTime: phase2EndTime,
        phase2LateTime: phase2LateTime
      });
      alert('Attendance stopped immediately.');
      fetchSchedule();
    } catch (e) {
      alert('Failed to stop attendance');
    } finally {
      setSaving(false);
    }
  };

  const editSession = async () => {
    const newName = await dialog.prompt({
      title: 'Rename Session',
      message: 'Enter new name for this session:',
      defaultValue: sessionName,
      confirmText: 'Save Name',
      cancelText: 'Cancel',
      type: 'primary'
    });
    if (!newName || !newName.trim()) return;
    try {
      await apiClient.put(`/admin/sessions/${sessionKey}`, { session_name: newName.trim() });
      setSessionName(newName.trim());
      dialog.alert({ title: 'Success', message: 'Session name updated successfully!', type: 'success' });
    } catch (e) {
      dialog.alert({ title: 'Error', message: 'Failed to rename session', type: 'danger' });
    }
  };

  const deleteSession = async () => {
    const isConfirmed = await confirm({
      title: 'Permanently Delete Session',
      message: `Are you sure you want to delete session "${sessionName}"?`,
      warningNote: 'All schedule rules and linked records for this session will be permanently deleted.',
      confirmText: 'Yes, Delete Session',
      type: 'danger',
      icon: 'trash'
    });
    if (!isConfirmed) return;

    try {
      await apiClient.delete(`/admin/sessions/${sessionKey}`);
      alert('Session deleted');
      if (onSessionDeleted) onSessionDeleted();
    } catch (e) {
      alert('Failed to delete session');
    }
  };

  const [deletingAttendance, setDeletingAttendance] = useState(false);

  const exportAttendanceCSV = () => {
    const token = localStorage.getItem('admin_token');
    const baseUrl = apiClient.defaults.baseURL || '/api';
    window.open(`${baseUrl}/attendance/export?type=${sessionKey}&date=${attendanceDate}&token=${token}`, '_blank');
  };

  const handleDeleteAllAttendance = async () => {
    const isConfirmed = await confirm({
      title: 'Permanently Delete All Session Records',
      message: `This will permanently delete all attendance records for "${sessionName || sessionKey}" on ${attendanceDate} for ALL students.`,
      warningNote: 'This action is irreversible and cannot be undone.',
      confirmText: 'Yes, Delete All Records',
      type: 'danger',
      icon: 'trash'
    });
    if (!isConfirmed) return;

    setDeletingAttendance(true);
    try {
      const res = await apiClient.delete(`/attendance/session/${sessionKey}/records?date=${attendanceDate}`);
      if (res.data.success) {
        alert(res.data.message || 'Attendance records deleted successfully.');
        fetchAttendanceList();
        if (activeTab === 2) fetchAbsentList();
      } else {
        alert(res.data.message || 'Failed to delete attendance records.');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to delete attendance records.');
    } finally {
      setDeletingAttendance(false);
    }
  };

  const fetchAttendanceList = async () => {
    try {
      const res = await apiClient.get(`/attendance/session/${sessionKey}/students?date=${attendanceDate}`);
      if (res.data.success) {
        setIsMultipleAttendance(Boolean(res.data.multiple_attendance));
        setTwoPhaseSummary(res.data.summary || null);
        setTwoPhaseWindows(res.data.windows || null);
        const rawList = res.data.data || [];
        const seen = new Set();
        const uniqueList = rawList.filter((s: any) => {
          const key = s.student_id || s.student_code;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setAttendanceStudents(uniqueList);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAbsentList = async () => {
    try {
      const res = await apiClient.get(`/attendance/session/${sessionKey}/absent-reasons?date=${absentDate}`);
      if (res.data.success) {
        const rawList = res.data.data || [];
        const seen = new Set();
        const uniqueList = rawList.filter((s: any) => {
          const key = s.student_id || s.student_code;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setAbsentStudents(uniqueList);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open Manual Mark Modal
  const openManualModal = (student: any, defaultPhase: 1 | 2 = 1) => {
    const isLate = defaultPhase === 2 ? student.phase2_is_late : (student.phase1_is_late || student.status === 'Late');
    const currentStatus = isLate ? 'Late' : 'Present';
    setManualModal({
      isOpen: true,
      student: student,
      status: currentStatus,
      phase: defaultPhase,
      description: (defaultPhase === 2 ? student.phase2_remarks : student.phase1_remarks) || student.remarks || ''
    });
  };

  // Submit Manual Mark
  const handleSaveManualAttendance = async () => {
    if (!manualModal?.student) return;
    setSubmittingAction(true);
    try {
      const targetPhase = manualModal.phase || 1;
      const res = await apiClient.post('/attendance/mark-manual', {
        session_key: sessionKey,
        student_code: manualModal.student.student_code,
        student_id: manualModal.student.student_id,
        date: attendanceDate,
        status: manualModal.status,
        is_late: manualModal.status === 'Late',
        phase: targetPhase,
        description: manualModal.description.trim()
      });

      if (res.data.success) {
        setManualModal(null);
        fetchAttendanceList();
        if (activeTab === 2) fetchAbsentList();
      } else {
        alert(res.data.message || 'Failed to mark attendance');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to mark manual attendance');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Delete / Remove Single Student Attendance Record
  const handleDeleteSingleStudent = async (student: any, phase?: 1 | 2) => {
    if (!student) return;
    const isConfirmed = await confirm({
      title: 'Remove Student Attendance',
      message: `Are you sure you want to remove ${phase ? `Phase ${phase}` : ''} attendance for "${student.name || student.student_code}" in "${sessionName || sessionKey}" on ${attendanceDate}?`,
      warningNote: 'This student will revert to Absent status for this session.',
      confirmText: 'Yes, Remove Record',
      type: 'danger',
      icon: 'trash'
    });
    if (!isConfirmed) return;

    setSubmittingAction(true);
    try {
      const stuCode = student.student_code || '';
      const stuId = student.student_id || student.id || '';
      const phaseParam = phase ? `&phase=${phase}` : '';
      const res = await apiClient.delete(
        `/attendance/session/${sessionKey}/records?date=${attendanceDate}&student_code=${encodeURIComponent(stuCode)}&student_id=${encodeURIComponent(stuId)}${phaseParam}`
      );
      if (res.data.success) {
        setManualModal(null);
        fetchAttendanceList();
        if (activeTab === 2) fetchAbsentList();
      } else {
        alert(res.data.message || 'Failed to remove attendance record.');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to remove attendance record.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExportClientCSV = () => {
    const headers = [
      'Student Code',
      'Student Name',
      'Floor',
      'Room',
      'Contact Phone',
      ...(isMultipleAttendance
        ? [
          '1st Window Time',
          '1st Window Status',
          '2nd Window Time',
          '2nd Window Status',
          'Overall Status'
        ]
        : ['Status', 'Time Marked (IST)']),
      'Notes / Remarks'
    ];

    const rows = filteredAttendance.map(s => {
      if (isMultipleAttendance) {
        return [
          s.student_code || '',
          `"${(s.name || '').replace(/"/g, '""')}"`,
          s.floor_id ?? '',
          s.room_number ?? '',
          s.phone_number || '',
          formatISTTime(s.phase1_marked_at),
          s.phase1_status || 'Absent',
          formatISTTime(s.phase2_marked_at),
          s.phase2_status || 'Absent',
          s.overall_status || 'Absent',
          `"${(s.remarks || s.reason || '').replace(/"/g, '""')}"`
        ];
      } else {
        const studentStatus = s.status || (Boolean(s.is_present && s.is_present !== 0 && s.is_present !== '0') ? (Boolean(s.is_late && s.is_late !== 0 && s.is_late !== '0') ? 'Late' : 'Present') : 'Absent');
        return [
          s.student_code || '',
          `"${(s.name || '').replace(/"/g, '""')}"`,
          s.floor_id ?? '',
          s.room_number ?? '',
          s.phone_number || '',
          studentStatus,
          formatISTTime(s.marked_at),
          `"${(s.remarks || s.reason || '').replace(/"/g, '""')}"`
        ];
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${sessionKey}_attendance_${attendanceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Open Justify Modal
  const openJustifyModal = (student: any) => {
    setJustifyModal({
      isOpen: true,
      student: student,
      reason: student.reason || '',
      error: undefined
    });
  };

  // Submit Justification (Description is Required)
  const handleSaveJustification = async () => {
    if (!justifyModal) return;
    const trimmedReason = justifyModal.reason.trim();
    if (!trimmedReason) {
      setJustifyModal({
        ...justifyModal,
        error: 'Description / justification is required!'
      });
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await apiClient.post('/attendance/session/absent-reason', {
        session_key: sessionKey,
        student_id: justifyModal.student.student_id,
        student_code: justifyModal.student.student_code,
        date: absentDate,
        reason: trimmedReason,
        is_justified: true
      });

      if (res.data.success) {
        setJustifyModal(null);
        fetchAbsentList();
        if (activeTab === 1) fetchAttendanceList();
      } else {
        alert(res.data.message || 'Failed to save reason');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to save reason');
    } finally {
      setSubmittingAction(false);
    }
  };

  const format12Hour = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const hour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  };

  const isWindowActive = () => {
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const sMins = sh * 60 + sm;
    const eMins = eh * 60 + em;

    const inWin1 = (eMins < sMins) ? (curMins >= sMins || curMins <= eMins) : (sMins !== eMins && curMins >= sMins && curMins <= eMins);

    if (hasMultipleAttendance && phase2StartTime && phase2EndTime) {
      const [sh2, sm2] = phase2StartTime.split(':').map(Number);
      const [eh2, em2] = phase2EndTime.split(':').map(Number);
      const s2Mins = sh2 * 60 + sm2;
      const e2Mins = eh2 * 60 + em2;
      const inWin2 = (e2Mins < s2Mins) ? (curMins >= s2Mins || curMins <= e2Mins) : (s2Mins !== e2Mins && curMins >= s2Mins && curMins <= e2Mins);
      return inWin1 || inWin2;
    }

    return inWin1;
  };

  const getActivePhaseLabel = () => {
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const inWin1 = curMins >= (sh * 60 + sm) && curMins <= (eh * 60 + em);
    if (inWin1) return 'Window 1 Active';
    if (hasMultipleAttendance && phase2StartTime && phase2EndTime) {
      const [sh2, sm2] = phase2StartTime.split(':').map(Number);
      const [eh2, em2] = phase2EndTime.split(':').map(Number);
      const inWin2 = curMins >= (sh2 * 60 + sm2) && curMins <= (eh2 * 60 + em2);
      if (inWin2) return 'Window 2 Active';
    }
    return isOpen ? 'OPEN' : 'CLOSED';
  };

  const isOpen = isWindowActive();

  // Filter attendance students
  const filteredAttendance = attendanceStudents.filter(s => {
    const matchesFloor = floorFilter === 'All' || String(s.floor_id) === String(floorFilter);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      String(s.student_code || '').toLowerCase().includes(q) ||
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.room_number || '').toLowerCase().includes(q) ||
      String(s.phone_number || '').toLowerCase().includes(q);

    if (!matchesFloor || !matchesSearch) return false;

    if (isMultipleAttendance) {
      if (statusFilter === 'All') return true;
      const overall = (s.overall_status || s.status || 'Absent').toLowerCase();
      const p1 = (s.phase1_status || 'Absent').toLowerCase();
      const p2 = (s.phase2_status || 'Absent').toLowerCase();
      const fStatus = statusFilter.toLowerCase();

      if (fStatus === 'complete') return overall === 'complete';
      if (fStatus === 'incomplete') return overall === 'incomplete';
      if (fStatus === 'present') {
        if (viewMode === 'first') return p1 === 'present';
        if (viewMode === 'second') return p2 === 'present';
        return overall === 'complete' || p1 === 'present' || p2 === 'present';
      }
      if (fStatus === 'late') {
        if (viewMode === 'first') return p1 === 'late';
        if (viewMode === 'second') return p2 === 'late';
        return Boolean(s.phase1_is_late || s.phase2_is_late || p1 === 'late' || p2 === 'late');
      }
      if (fStatus === 'absent') {
        if (viewMode === 'first') return p1 === 'absent';
        if (viewMode === 'second') return p2 === 'absent';
        return overall === 'absent';
      }
      if (fStatus === 'not eligible' || fStatus === 'not_eligible') {
        return p2 === 'not eligible' || !s.phase2_is_eligible;
      }
      if (fStatus === 'leave') {
        return overall === 'leave' || p1 === 'leave' || p2 === 'leave';
      }
      return true;
    }

    const studentStatus = s.status || (Boolean(s.is_present && s.is_present !== 0 && s.is_present !== '0') ? (Boolean(s.is_late && s.is_late !== 0 && s.is_late !== '0') ? 'Late' : 'Present') : 'Absent');
    const matchesStatus = statusFilter === 'All' || studentStatus.toLowerCase() === statusFilter.toLowerCase();
    return matchesStatus;
  });

  // Filter absent students
  const filteredAbsent = absentStudents.filter(s => {
    const matchesFloor = absentFloorFilter === 'All' || String(s.floor_id) === String(absentFloorFilter);
    const isJustified = Boolean(s.reason && s.reason.trim().length > 0);
    const matchesStatus = absentStatusFilter === 'All' ||
      (absentStatusFilter === 'Justified' && isJustified) ||
      (absentStatusFilter === 'Unjustified' && !isJustified);
    const matchesSearch = !absentSearchQuery ||
      String(s.student_code || '').toLowerCase().includes(absentSearchQuery.toLowerCase()) ||
      String(s.name || '').toLowerCase().includes(absentSearchQuery.toLowerCase()) ||
      String(s.room_number || '').toLowerCase().includes(absentSearchQuery.toLowerCase());
    return matchesFloor && matchesStatus && matchesSearch;
  });

  // Filter target assignment students
  const filteredTargetStudents = targetStudents.filter(s => {
    const matchesFloor = targetFloorFilter === 'All' || String(s.floor_id) === String(targetFloorFilter);
    const matchesSearch = !targetSearchQuery ||
      String(s.student_code || '').toLowerCase().includes(targetSearchQuery.toLowerCase()) ||
      String(s.name || '').toLowerCase().includes(targetSearchQuery.toLowerCase()) ||
      String(s.room_number || '').toLowerCase().includes(targetSearchQuery.toLowerCase());
    return matchesFloor && matchesSearch;
  });

  return (
    <div className="live-manager-container animate-fade-in">
      {/* Header */}
      <div className="live-manager-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{sessionName} Schedule</h2>
            {isForAllStudents ? (
              <span style={{
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0'
              }}>
                🌟 All Students Session
              </span>
            ) : (
              <span style={{
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#fffbeb',
                color: '#b45309',
                border: '1px solid #fde68a'
              }}>
                🎯 Selective Session ({selectedTargetIds.length} Assigned)
              </span>
            )}
            {isViewOnly && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                👁️ View Only Mode
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0 0' }}>Set the time window and manage student assignments & live attendance.</p>
        </div>
        {!isLeader && (
          <div className="header-action-group">
            <button
              className="header-action-btn edit"
              onClick={() => setIsEditModalOpen(true)}
              title="Edit Session Settings & Multiple-Time Attendance"
            >
              <Edit2 size={15} /> Edit Session
            </button>
            <button className="header-action-btn delete" onClick={deleteSession} title="Delete Session">
              <Trash2 size={15} /> Delete Session
            </button>
          </div>
        )}
      </div>

      {/* Edit Session Modal */}
      {isEditModalOpen && (
        <EditSessionModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          session={{
            session_key: sessionKey,
            session_name: sessionName,
            icon_name: iconName || 'moon',
            is_for_all_students: isForAllStudents,
            has_multiple_attendance: hasMultipleAttendance || isMultipleAttendance,
            start_time: startTime,
            end_time: endTime,
            late_time: lateTime,
            phase2_start_time: phase2StartTime,
            phase2_end_time: phase2EndTime,
            phase2_late_time: phase2LateTime
          }}
          onSessionUpdated={(updated) => {
            if (updated.session_name) setSessionName(updated.session_name);
            if (updated.icon_name) setIconName(updated.icon_name);
            if (updated.is_for_all_students !== undefined) setIsForAllStudents(Boolean(updated.is_for_all_students));
            if (updated.has_multiple_attendance !== undefined) {
              const multi = Boolean(updated.has_multiple_attendance);
              setHasMultipleAttendance(multi);
              setIsMultipleAttendance(multi);
            }
            if (updated.start_time) setStartTime(updated.start_time.slice(0, 5));
            if (updated.end_time) setEndTime(updated.end_time.slice(0, 5));
            if (updated.late_time !== undefined) setLateTime(updated.late_time ? updated.late_time.slice(0, 5) : null);
            if (updated.phase2_start_time) setPhase2StartTime(updated.phase2_start_time.slice(0, 5));
            if (updated.phase2_end_time) setPhase2EndTime(updated.phase2_end_time.slice(0, 5));
            if (updated.phase2_late_time !== undefined) setPhase2LateTime(updated.phase2_late_time ? updated.phase2_late_time.slice(0, 5) : null);
            setDaySchedules(prev => prev.map(slot => ({
              ...slot,
              startTime: updated.start_time ? updated.start_time.slice(0, 5) : slot.startTime,
              endTime: updated.end_time ? updated.end_time.slice(0, 5) : slot.endTime,
              lateTime: updated.late_time !== undefined ? (updated.late_time ? updated.late_time.slice(0, 5) : null) : slot.lateTime,
              hasMultipleAttendance: updated.has_multiple_attendance !== undefined ? Boolean(updated.has_multiple_attendance) : slot.hasMultipleAttendance,
              phase2StartTime: updated.phase2_start_time ? updated.phase2_start_time.slice(0, 5) : slot.phase2StartTime,
              phase2EndTime: updated.phase2_end_time ? updated.phase2_end_time.slice(0, 5) : slot.phase2EndTime,
              phase2LateTime: updated.phase2_late_time !== undefined ? (updated.phase2_late_time ? updated.phase2_late_time.slice(0, 5) : null) : slot.phase2LateTime
            })));
            fetchSchedule(true);
          }}
        />
      )}


      {/* Tabs (Hidden for Floor Leaders - Leaders only see View Attendance) */}
      {!isLeader && (
        <div className="tabs-navigation">
          <button
            className={`tab-nav-btn ${activeTab === 0 ? 'active' : ''}`}
            onClick={() => setActiveTab(0)}
          >
            Set Timing
          </button>
          <button
            className={`tab-nav-btn ${activeTab === 1 ? 'active' : ''}`}
            onClick={() => setActiveTab(1)}
          >
            View Attendance
          </button>
          <button
            className={`tab-nav-btn ${activeTab === 2 ? 'active' : ''}`}
            onClick={() => setActiveTab(2)}
          >
            Report Verification
          </button>
          <button
            className={`tab-nav-btn ${activeTab === 3 ? 'active' : ''}`}
            onClick={() => setActiveTab(3)}
            style={{ position: 'relative' }}
          >
            <span>Student Assignment</span>
            {!isForAllStudents && (
              <span style={{
                marginLeft: '6px',
                padding: '2px 7px',
                fontSize: '11px',
                fontWeight: 800,
                borderRadius: '10px',
                backgroundColor: '#f59e0b',
                color: '#ffffff'
              }}>
                {selectedTargetIds.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 0: TIMING CONTROLS */}
      {activeTab === 0 && (
        <>
          {/* Status banner */}
          <div className={`live-status-banner ${isOpen ? 'open' : 'closed'}`}>
            <div className="status-banner-icon">
              {isOpen ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </div>
            <div>
              <h3>Attendance is {isOpen ? 'OPEN' : 'CLOSED'} {hasMultipleAttendance ? `(${getActivePhaseLabel()})` : ''}</h3>
              {hasMultipleAttendance ? (
                <p>
                  1st Window: <strong>{format12Hour(startTime)} – {format12Hour(endTime)}</strong> &nbsp;•&nbsp;
                  2nd Window: <strong>{format12Hour(phase2StartTime)} – {format12Hour(phase2EndTime)}</strong>
                </p>
              ) : (
                isOpen && <p>Live Time Window: {format12Hour(startTime)} – {format12Hour(endTime)}</p>
              )}
            </div>
          </div>

          {/* MULTIPLE-TIME ATTENDANCE (TWO-PHASE) CONFIGURATION CARD */}
          <div style={{
            backgroundColor: hasMultipleAttendance ? '#f5f3ff' : '#ffffff',
            border: hasMultipleAttendance ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '22px 24px',
            boxShadow: hasMultipleAttendance ? '0 4px 16px rgba(139, 92, 246, 0.12)' : '0 2px 6px rgba(0,0,0,0.02)',
            transition: 'all 0.2s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: hasMultipleAttendance ? '#7c3aed' : '#f1f5f9',
                  color: hasMultipleAttendance ? '#ffffff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: hasMultipleAttendance ? '0 4px 10px rgba(124, 58, 237, 0.3)' : 'none'
                }}>
                  <Layers size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Enable Multiple-Time Attendance (Two-Phase Attendance)
                    </h4>
                    {hasMultipleAttendance && (
                      <span style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                        TWO-PHASE ACTIVE
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Configure two separate attendance windows for this session (e.g. Aarti 1st: 6:45–7:00 AM, 2nd: 7:25–7:30 AM). Only students who mark 1st attendance can mark 2nd attendance.
                  </p>
                </div>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: isViewOnly ? 'not-allowed' : 'pointer', gap: '10px' }}>
                <input
                  type="checkbox"
                  disabled={isViewOnly}
                  checked={hasMultipleAttendance}
                  onChange={e => setHasMultipleAttendance(e.target.checked)}
                  style={{ width: '22px', height: '22px', accentColor: '#7c3aed', cursor: isViewOnly ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  {hasMultipleAttendance ? 'Enabled for this session' : 'Disabled (Single Attendance)'}
                </span>
              </label>
            </div>

            {/* When multiple attendance is enabled, show the two windows configuration */}
            {hasMultipleAttendance && (
              <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid #ddd6fe' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Card 1: First Attendance Window */}
                  <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #818cf8', borderRadius: '14px', padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ backgroundColor: '#4f46e5', color: '#ffffff', fontSize: '12px', fontWeight: 800, padding: '3px 10px', borderRadius: '6px' }}>
                        1️⃣ First Attendance Window
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Initial Check-in</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="time-input-field">
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>START TIME</label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={e => {
                            setStartTime(e.target.value);
                            if (daySchedules.length > 0) handleSlotTimeChange(daySchedules[0].id, 'startTime', e.target.value);
                          }}
                          style={{ height: '42px', borderRadius: '8px' }}
                        />
                      </div>
                      <div className="time-input-field">
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>END TIME</label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={e => {
                            setEndTime(e.target.value);
                            if (daySchedules.length > 0) handleSlotTimeChange(daySchedules[0].id, 'endTime', e.target.value);
                          }}
                          style={{ height: '42px', borderRadius: '8px' }}
                        />
                      </div>
                    </div>

                    <div className="time-input-field">
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>LATE CUTOFF (OPTIONAL)</label>
                      <input
                        type="time"
                        value={lateTime || ''}
                        onChange={e => {
                          setLateTime(e.target.value || null);
                          if (daySchedules.length > 0) handleSlotTimeChange(daySchedules[0].id, 'lateTime', e.target.value || null);
                        }}
                        style={{ height: '42px', borderRadius: '8px' }}
                      />
                    </div>
                  </div>

                  {/* Card 2: Second Attendance Window */}
                  <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #c084fc', borderRadius: '14px', padding: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '12px', fontWeight: 800, padding: '3px 10px', borderRadius: '6px' }}>
                        2️⃣ Second Attendance Window
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Second Check-in</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="time-input-field">
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>START TIME</label>
                        <input
                          type="time"
                          value={phase2StartTime}
                          onChange={e => {
                            setPhase2StartTime(e.target.value);
                            if (daySchedules.length > 0) handleSlotTimeChange(daySchedules[0].id, 'phase2StartTime', e.target.value);
                          }}
                          style={{ height: '42px', borderRadius: '8px' }}
                        />
                      </div>
                      <div className="time-input-field">
                        <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>END TIME</label>
                        <input
                          type="time"
                          value={phase2EndTime}
                          onChange={e => {
                            setPhase2EndTime(e.target.value);
                            if (daySchedules.length > 0) handleSlotTimeChange(daySchedules[0].id, 'phase2EndTime', e.target.value);
                          }}
                          style={{ height: '42px', borderRadius: '8px' }}
                        />
                      </div>
                    </div>

                    <div className="time-input-field">
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>LATE CUTOFF (OPTIONAL)</label>
                      <input
                        type="time"
                        value={phase2LateTime || ''}
                        onChange={e => {
                          setPhase2LateTime(e.target.value || null);
                          if (daySchedules.length > 0) handleSlotTimeChange(daySchedules[0].id, 'phase2LateTime', e.target.value || null);
                        }}
                        style={{ height: '42px', borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px solid #ddd6fe', fontSize: '12px', color: '#6d28d9', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={18} color="#7c3aed" />
                  <span>
                    <strong>Strict Eligibility Rule:</strong> Window 2 must start after Window 1 ends. Students who miss the First Attendance Window are marked <strong>"Not Eligible"</strong> and strictly blocked by backend security from marking the Second Attendance Window.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="time-window-card">
            <div className="window-card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="header-icon-pill">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Weekly Day-Wise Time Schedule</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Configure specific attendance timings for different days of the week (e.g. Thursday 10:45–11:15, other days 10:30–11:05).
                  </p>
                </div>
              </div>
            </div>

            {/* List of Day Rule Slots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0' }}>
              {daySchedules.map((slot, index) => {
                const otherAssignedDays = getAssignedDays(slot.id);
                return (
                  <div
                    key={slot.id}
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '18px 20px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Rule Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          backgroundColor: '#4f46e5',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '4px 10px',
                          borderRadius: '8px'
                        }}>
                          Rule #{index + 1}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                          {slot.days.length} day{slot.days.length !== 1 ? 's' : ''} assigned ({slot.days.join(', ') || 'None'})
                        </span>
                      </div>
                      {daySchedules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(slot.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: 700
                          }}
                        >
                          <Trash2 size={14} /> Remove Rule
                        </button>
                      )}
                    </div>

                    {/* Days Selection row */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Active Days for this Time:
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {ALL_WEEK_DAYS.map(day => {
                          const isSelected = slot.days.includes(day);
                          const isAssignedElsewhere = otherAssignedDays.has(day);

                          return (
                            <button
                              key={day}
                              type="button"
                              disabled={isAssignedElsewhere}
                              onClick={() => handleToggleDayInSlot(slot.id, day)}
                              title={isAssignedElsewhere ? `Assigned to another rule` : `Click to toggle ${DAY_FULL_NAMES[day]}`}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: 700,
                                cursor: isAssignedElsewhere ? 'not-allowed' : 'pointer',
                                border: isSelected ? '1.5px solid #4f46e5' : '1.5px solid #cbd5e1',
                                backgroundColor: isSelected ? '#4f46e5' : (isAssignedElsewhere ? '#f1f5f9' : '#ffffff'),
                                color: isSelected ? '#ffffff' : (isAssignedElsewhere ? '#94a3b8' : '#334155'),
                                opacity: isAssignedElsewhere ? 0.5 : 1,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Pickers for this slot */}
                    {hasMultipleAttendance ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '6px' }}>
                        {/* 1st Attendance Window for this Rule */}
                        <div style={{
                          backgroundColor: '#ffffff',
                          border: '1.5px solid #818cf8',
                          borderRadius: '12px',
                          padding: '14px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{
                              backgroundColor: '#4f46e5',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}>
                              1️⃣ First Attendance Window
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Initial Check-in</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div className="time-input-field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>START TIME</label>
                              <input
                                type="time"
                                value={slot.startTime}
                                onChange={e => {
                                  handleSlotTimeChange(slot.id, 'startTime', e.target.value);
                                  if (index === 0) setStartTime(e.target.value);
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                              />
                            </div>
                            <div className="time-input-field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>END TIME</label>
                              <input
                                type="time"
                                value={slot.endTime}
                                onChange={e => {
                                  handleSlotTimeChange(slot.id, 'endTime', e.target.value);
                                  if (index === 0) setEndTime(e.target.value);
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                              />
                            </div>
                          </div>

                          <div className="time-input-field" style={{ margin: 0 }}>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>LATE CUTOFF (OPTIONAL)</label>
                            <input
                              type="time"
                              value={slot.lateTime || ''}
                              onChange={e => {
                                handleSlotTimeChange(slot.id, 'lateTime', e.target.value || null);
                                if (index === 0) setLateTime(e.target.value || null);
                              }}
                              style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                            />
                          </div>
                        </div>

                        {/* 2nd Attendance Window for this Rule */}
                        <div style={{
                          backgroundColor: '#ffffff',
                          border: '1.5px solid #c084fc',
                          borderRadius: '12px',
                          padding: '14px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <span style={{
                              backgroundColor: '#7c3aed',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}>
                              2️⃣ Second Attendance Window
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Second Check-in</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div className="time-input-field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>START TIME</label>
                              <input
                                type="time"
                                value={slot.phase2StartTime || phase2StartTime || '07:25'}
                                onChange={e => {
                                  handleSlotTimeChange(slot.id, 'phase2StartTime', e.target.value);
                                  if (index === 0) setPhase2StartTime(e.target.value);
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                              />
                            </div>
                            <div className="time-input-field" style={{ margin: 0 }}>
                              <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>END TIME</label>
                              <input
                                type="time"
                                value={slot.phase2EndTime || phase2EndTime || '07:30'}
                                onChange={e => {
                                  handleSlotTimeChange(slot.id, 'phase2EndTime', e.target.value);
                                  if (index === 0) setPhase2EndTime(e.target.value);
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                              />
                            </div>
                          </div>

                          <div className="time-input-field" style={{ margin: 0 }}>
                            <label style={{ fontSize: '10px', fontWeight: 800, color: '#475569' }}>LATE CUTOFF (OPTIONAL)</label>
                            <input
                              type="time"
                              value={slot.phase2LateTime !== undefined && slot.phase2LateTime !== null ? slot.phase2LateTime : (phase2LateTime || '')}
                              onChange={e => {
                                handleSlotTimeChange(slot.id, 'phase2LateTime', e.target.value || null);
                                if (index === 0) setPhase2LateTime(e.target.value || null);
                              }}
                              style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
                        <div className="time-input-field" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>START TIME</label>
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={e => handleSlotTimeChange(slot.id, 'startTime', e.target.value)}
                            style={{ width: '100%', height: '42px', borderRadius: '8px' }}
                          />
                        </div>

                        <div className="time-input-field" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>END TIME</label>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={e => handleSlotTimeChange(slot.id, 'endTime', e.target.value)}
                            style={{ width: '100%', height: '42px', borderRadius: '8px' }}
                          />
                        </div>

                        <div className="time-input-field" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>LATE CUTOFF (OPTIONAL)</label>
                          <input
                            type="time"
                            value={slot.lateTime || ''}
                            onChange={e => handleSlotTimeChange(slot.id, 'lateTime', e.target.value || null)}
                            style={{ width: '100%', height: '42px', borderRadius: '8px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Set New Time for remaining days button */}
              {ALL_WEEK_DAYS.some(d => !getAssignedDays().has(d)) ? (
                <button
                  type="button"
                  onClick={handleAddDaySchedule}
                  style={{
                    padding: '12px 20px',
                    border: '2px dashed #818cf8',
                    borderRadius: '14px',
                    backgroundColor: '#eff6ff',
                    color: '#4338ca',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Plus size={16} /> Set New Time for Remaining Days ({ALL_WEEK_DAYS.filter(d => !getAssignedDays().has(d)).join(', ')})
                </button>
              ) : (
                <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, textAlign: 'center', padding: '6px' }}>
                  ✓ All 7 days of the week have assigned timing rules.
                </div>
              )}
            </div>

            <div className="advanced-settings-header" style={{ marginTop: '20px' }}>Linked Attendance Settings</div>

            <div style={{ maxWidth: '400px' }}>
              <div className="time-input-field">
                <label>Linked Attendance (Auto-mark)</label>
                <select
                  value={linkedSessionKey || ''}
                  onChange={e => setLinkedSessionKey(e.target.value || null)}
                >
                  <option value="">None</option>
                  {availableSessions.filter(s => s.session_key !== sessionKey).map(s => (
                    <option key={s.session_key} value={s.session_key}>{s.session_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="timing-actions-row">
              <button
                className="btn-start-timing"
                onClick={saveSchedule}
                disabled={saving || isViewOnly}
                title={isViewOnly ? 'Disabled in View Only mode' : 'Start / Save Attendance'}
                style={isViewOnly ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                <Play size={18} /> {saving ? 'Saving...' : 'Start / Save Attendance'}
              </button>

              <button
                className="btn-stop-timing"
                onClick={stopAttendance}
                disabled={saving || isViewOnly}
                title={isViewOnly ? 'Disabled in View Only mode' : 'Stop immediately'}
                style={isViewOnly ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                <Square size={18} /> Stop Immediately
              </button>
            </div>

            <button className="btn-export-csv" onClick={exportAttendanceCSV}>
              <Download size={17} /> Export Today's Attendance (CSV)
            </button>
          </div>

          {/* AUTOMATED WHATSAPP ALERTS FOR MULTI-STATUS CATEGORIES */}
          <div className="time-window-card" style={{ marginTop: '20px' }}>
            <div className="window-card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="header-icon-pill" style={{ backgroundColor: '#25D366' }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    Automated & Instant WhatsApp Alerts (Multi-Status)
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Configure separate message templates & recipients (Student, Parent, or Both) for each status.
                  </p>
                </div>
              </div>

              {autoMessageTime && (
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: '#ecfdf5',
                  color: '#065f46',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Clock size={13} /> Auto-Send Scheduled at {format12Hour(autoMessageTime)}
                </span>
              )}
            </div>

            {/* Time schedule row & active delivery mode summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: '20px', marginBottom: '20px' }}>
              <div className="time-input-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                  <Clock size={15} /> Trigger Time (After End Time)
                </label>
                <input
                  type="time"
                  value={autoMessageTime}
                  onChange={e => setAutoMessageTime(e.target.value)}
                />
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                  Must be scheduled after attendance end time ({format12Hour(endTime)}).
                </div>
                {autoMessageTime && (
                  <button
                    type="button"
                    onClick={() => setAutoMessageTime('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '12px',
                      textAlign: 'left',
                      marginTop: '6px'
                    }}
                  >
                    ✕ Clear Time (Disable Auto-Send)
                  </button>
                )}
              </div>

              {/* Delivery Status Indicator Banner */}
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                  Active Alert Categories Summary:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {Object.entries(alertsConfig).filter(([_, cfg]) => cfg.enabled).length > 0 ? (
                    Object.entries(alertsConfig).filter(([_, cfg]) => cfg.enabled).map(([k, cfg]) => {
                      const colors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
                        absent: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', icon: '🔴' },
                        late: { bg: '#fffbeb', text: '#92400e', border: '#fde68a', icon: '🟡' },
                        leave: { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe', icon: '🏖️' },
                        present: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: '🟢' }
                      };
                      const colorInfo = colors[k] || colors.absent;
                      return (
                        <span
                          key={`summary_${k}`}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            backgroundColor: colorInfo.bg,
                            color: colorInfo.text,
                            border: `1px solid ${colorInfo.border}`,
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <span>{colorInfo.icon}</span>
                          <span style={{ textTransform: 'capitalize' }}>{k}</span>
                          <span style={{ fontSize: '11px', opacity: 0.8 }}>({cfg.target === 'both' ? 'Both' : (cfg.target === 'student' ? 'Student' : 'Parent')})</span>
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>
                      🛑 No alert categories enabled. Select categories below to enable alerts.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* MULTI-SELECT STATUS SELECTOR CARDS */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#1e293b', marginBottom: '10px' }}>
                Select Status Categories to Send WhatsApp Alerts:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {(['absent', 'late', 'leave', 'present'] as const).map((cat) => {
                  const isSelected = activeAlertCategory === cat;
                  const isEnabled = alertsConfig[cat].enabled;
                  const meta: Record<string, { label: string; icon: string; desc: string; activeColor: string; bgLight: string }> = {
                    absent: { label: 'Absent', icon: '🔴', desc: 'Students not marked present', activeColor: '#ef4444', bgLight: '#fef2f2' },
                    late: { label: 'Late', icon: '🟡', desc: 'Students marked after late cutoff', activeColor: '#f59e0b', bgLight: '#fffbeb' },
                    leave: { label: 'Approved Leave', icon: '🏖️', desc: 'Students with approved leave', activeColor: '#8b5cf6', bgLight: '#f5f3ff' },
                    present: { label: 'Present', icon: '🟢', desc: 'Successfully marked present', activeColor: '#10b981', bgLight: '#ecfdf5' }
                  };
                  const m = meta[cat];

                  return (
                    <div
                      key={`cat_card_${cat}`}
                      onClick={() => setActiveAlertCategory(cat)}
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: isSelected ? `2px solid ${m.activeColor}` : (isEnabled ? '1px solid #cbd5e1' : '1px solid #e2e8f0'),
                        backgroundColor: isSelected ? m.bgLight : (isEnabled ? '#ffffff' : '#f8fafc'),
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: isSelected ? `0 4px 12px ${m.activeColor}25` : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{m.icon}</span>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>{m.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateCategoryConfig(cat, { enabled: e.target.checked });
                          }}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                            accentColor: m.activeColor
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: '#64748b' }}>{m.desc}</span>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isEnabled ? '#dcfce7' : '#f1f5f9',
                          color: isEnabled ? '#15803d' : '#94a3b8'
                        }}>
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CONFIGURATION PANEL FOR SELECTED STATUS */}
            {(() => {
              const curCat = activeAlertCategory;
              const curCfg = alertsConfig[curCat];
              const curMeta: Record<string, { label: string; icon: string; color: string; bg: string }> = {
                absent: { label: 'Absent Students', icon: '🔴', color: '#ef4444', bg: '#fef2f2' },
                late: { label: 'Late Students', icon: '🟡', color: '#f59e0b', bg: '#fffbeb' },
                leave: { label: 'Approved Leave Students', icon: '🏖️', color: '#8b5cf6', bg: '#f5f3ff' },
                present: { label: 'Present Students', icon: '🟢', color: '#10b981', bg: '#ecfdf5' }
              };
              const curInfo = curMeta[curCat];

              return (
                <div style={{
                  padding: '18px',
                  borderRadius: '12px',
                  border: `1.5px solid ${curInfo.color}40`,
                  backgroundColor: '#ffffff',
                  marginBottom: '16px'
                }}>
                  {/* Category Sub-header & Target Options */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{curInfo.icon}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                          Configuring Template for {curInfo.label}
                        </h4>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Status: <strong style={{ color: curCfg.enabled ? '#15803d' : '#94a3b8' }}>{curCfg.enabled ? 'Enabled' : 'Disabled'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Target Selector: Student / Parent / Both */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Send To:</span>
                      <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                        {[
                          { key: 'student', label: '👦 Student' },
                          { key: 'parent', label: '👨‍👩‍👧 Parent' },
                          { key: 'both', label: '👥 Both' }
                        ].map(t => (
                          <button
                            key={`target_btn_${t.key}`}
                            type="button"
                            onClick={() => updateCategoryConfig(curCat, { target: t.key as any })}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              backgroundColor: curCfg.target === t.key ? '#ffffff' : 'transparent',
                              color: curCfg.target === t.key ? '#0f172a' : '#64748b',
                              boxShadow: curCfg.target === t.key ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Two Message Boxes: Student and Parent */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

                    {/* 1. Student Message Box */}
                    <div style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: curCfg.student_message.trim() ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                      backgroundColor: (curCfg.target === 'student' || curCfg.target === 'both') ? '#faf5ff' : '#f8fafc',
                      opacity: (curCfg.target === 'student' || curCfg.target === 'both') ? 1 : 0.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                          <Users size={16} color="#4f46e5" /> 1. Student WhatsApp Message
                        </label>
                        {(curCfg.target === 'student' || curCfg.target === 'both') && curCfg.student_message.trim() && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', backgroundColor: '#ede9fe', padding: '2px 6px', borderRadius: '4px' }}>
                            Active
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={4}
                        value={curCfg.student_message}
                        onChange={e => updateCategoryConfig(curCat, { student_message: e.target.value })}
                        placeholder={`e.g. Dear {name}, you were marked ${curInfo.label} for {session_name} on {date}.`}
                        style={{
                          width: '100%',
                          resize: 'vertical',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontFamily: 'inherit',
                          backgroundColor: '#ffffff'
                        }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Tags:</span>
                        {['{name}', '{session_name}', '{date}', '{floor}', '{room}', '{reason}', '{status}'].map(tag => (
                          <button
                            key={`tag_student_${curCat}_${tag}`}
                            type="button"
                            onClick={() => {
                              const next = curCfg.student_message + (curCfg.student_message ? ' ' : '') + tag;
                              updateCategoryConfig(curCat, { student_message: next });
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              color: '#4338ca'
                            }}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Parent Message Box */}
                    <div style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: curCfg.parent_message.trim() ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                      backgroundColor: (curCfg.target === 'parent' || curCfg.target === 'both') ? '#f0fdf4' : '#f8fafc',
                      opacity: (curCfg.target === 'parent' || curCfg.target === 'both') ? 1 : 0.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                          <Phone size={16} color="#10b981" /> 2. Parent WhatsApp Message
                        </label>
                        {(curCfg.target === 'parent' || curCfg.target === 'both') && curCfg.parent_message.trim() && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', backgroundColor: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                            Active
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={4}
                        value={curCfg.parent_message}
                        onChange={e => updateCategoryConfig(curCat, { parent_message: e.target.value })}
                        placeholder={`e.g. Respected Parent, your ward {name} (Room {room}) was marked ${curInfo.label} for {session_name} attendance on {date} at AVD Hostel.`}
                        style={{
                          width: '100%',
                          resize: 'vertical',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontFamily: 'inherit',
                          backgroundColor: '#ffffff'
                        }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Tags:</span>
                        {['{name}', '{session_name}', '{date}', '{floor}', '{room}', '{reason}', '{status}'].map(tag => (
                          <button
                            key={`tag_parent_${curCat}_${tag}`}
                            type="button"
                            onClick={() => {
                              const next = curCfg.parent_message + (curCfg.parent_message ? ' ' : '') + tag;
                              updateCategoryConfig(curCat, { parent_message: next });
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              color: '#059669'
                            }}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}

            {/* Bottom Controls */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9'
            }}>
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={15} color="#3b82f6" /> Messages are sent with a 1–2 second human interval to protect WhatsApp account from being blocked.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={sendInstantSessionAlerts}
                  disabled={sendingAlerts || isViewOnly || !Object.values(alertsConfig).some(c => c.enabled)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1.5px solid #25D366',
                    background: '#ecfdf5',
                    color: '#065f46',
                    fontWeight: 700,
                    cursor: (sendingAlerts || isViewOnly || !Object.values(alertsConfig).some(c => c.enabled)) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: (isViewOnly || !Object.values(alertsConfig).some(c => c.enabled)) ? 0.5 : 1
                  }}
                  title={isViewOnly ? 'Disabled in View Only mode' : undefined}
                >
                  <Send size={15} /> {sendingAlerts ? 'Sending Alerts...' : 'Send Session Alerts Now'}
                </button>

                <button
                  type="button"
                  onClick={saveSchedule}
                  disabled={saving || isViewOnly}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: (saving || isViewOnly) ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                    opacity: isViewOnly ? 0.5 : 1
                  }}
                  title={isViewOnly ? 'Disabled in View Only mode' : undefined}
                >
                  {saving ? 'Saving...' : 'Save Schedule & Alerts'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB 1: VIEW ATTENDANCE */}
      {activeTab === 1 && (
        <HamsCard padding="24px">
          {/* TWO-PHASE ATTENDANCE SUMMARY CARDS (When Multiple-Time Attendance is Enabled) */}
          {isMultipleAttendance && twoPhaseSummary && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📊</span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    Two-Phase Daily Attendance Summary & Performance
                  </h3>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  Date: <strong>{attendanceDate}</strong> • Mode: <strong>Multiple-Time Attendance</strong>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {/* 1. Total Assigned Students */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      TOTAL ASSIGNED
                    </span>
                    <Users size={16} color="#6366f1" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                    {twoPhaseSummary.total_assigned || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Active enrolled students
                  </div>
                </div>

                {/* 2. First Attendance Window */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      1ST ATTENDANCE
                    </span>
                    <span style={{ backgroundColor: '#2563eb', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                      {twoPhaseSummary.first_attendance_percentage || 0}%
                    </span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af', margin: '4px 0' }}>
                    {twoPhaseSummary.first_attendance_present || 0} <span style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>/ {twoPhaseSummary.total_assigned || 0}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#3b82f6', display: 'flex', gap: '8px' }}>
                    <span>Absent: <strong>{twoPhaseSummary.first_attendance_absent || 0}</strong></span>
                    <span>•</span>
                    <span>Late: <strong>{twoPhaseSummary.first_attendance_late || 0}</strong></span>
                  </div>
                </div>

                {/* 3. Second Attendance Window */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#f5f3ff',
                  border: '1.5px solid #ddd6fe',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2ND ATTENDANCE
                    </span>
                    <span style={{ backgroundColor: '#7c3aed', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                      {twoPhaseSummary.second_attendance_percentage || 0}%
                    </span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#5b21b6', margin: '4px 0' }}>
                    {twoPhaseSummary.second_attendance_present || 0} <span style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa' }}>/ {twoPhaseSummary.total_assigned || 0}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#7c3aed', display: 'flex', gap: '8px' }}>
                    <span>Absent: <strong>{twoPhaseSummary.second_attendance_absent || 0}</strong></span>
                    <span>•</span>
                    <span>Late: <strong>{twoPhaseSummary.second_attendance_late || 0}</strong></span>
                  </div>
                </div>

                {/* 4. Complete (Both Present) */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#ecfdf5',
                  border: '1.5px solid #a7f3d0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      BOTH COMPLETED
                    </span>
                    <CheckCircle2 size={16} color="#10b981" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#065f46', margin: '4px 0' }}>
                    {twoPhaseSummary.both_present_count || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669' }}>
                    Attended Window 1 & 2
                  </div>
                </div>

                {/* 5. First Only (Incomplete) */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#fffbeb',
                  border: '1.5px solid #fde68a',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      INCOMPLETE (1ST ONLY)
                    </span>
                    <Clock size={16} color="#f59e0b" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400e', margin: '4px 0' }}>
                    {twoPhaseSummary.first_only_count || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#b45309' }}>
                    Missed 2nd attendance
                  </div>
                </div>

                {/* 6. Missed 1st (Not Eligible / Absent) */}
                <div style={{
                  padding: '16px',
                  borderRadius: '14px',
                  backgroundColor: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      MISSED 1ST ATTENDANCE
                    </span>
                    <XCircle size={16} color="#ef4444" />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#991b1b', margin: '4px 0' }}>
                    {twoPhaseSummary.missed_first_count || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#dc2626' }}>
                    Not eligible for 2nd window
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TWO-PHASE VIEW MODE SWITCHER (COMBINED / 1ST / 2ND) */}
          {isMultipleAttendance && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  VIEW MODE:
                </span>
                <div style={{ display: 'inline-flex', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '8px', gap: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setViewMode('combined')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: viewMode === 'combined' ? '#4f46e5' : 'transparent',
                      color: viewMode === 'combined' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    👥 Combined Attendance
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('first')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: viewMode === 'first' ? '#4f46e5' : 'transparent',
                      color: viewMode === 'first' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    1️⃣ First Attendance ({twoPhaseWindows?.first?.start_time ? format12Hour(twoPhaseWindows.first.start_time) : ''})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('second')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: viewMode === 'second' ? '#4f46e5' : 'transparent',
                      color: viewMode === 'second' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    2️⃣ Second Attendance ({twoPhaseWindows?.second?.start_time ? format12Hour(twoPhaseWindows.second.start_time) : ''})
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportClientCSV}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Export complete 2-phase attendance report to CSV / Excel"
                >
                  <Download size={14} /> Export Table CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Print or Save as PDF"
                >
                  <Printer size={14} /> Print / PDF
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <input
              type="date"
              value={attendanceDate}
              onChange={e => setAttendanceDate(e.target.value)}
              style={{ width: '160px' }}
            />

            <select value={floorFilter} onChange={e => setFloorFilter(e.target.value)} style={{ width: '130px' }}>
              <option value="All">All Floors</option>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(fl => (
                <option key={fl} value={String(fl)}>Floor {fl}</option>
              ))}
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '160px' }}>
              <option value="All">All Statuses</option>
              {isMultipleAttendance ? (
                <>
                  <option value="Complete">Complete (Both Present)</option>
                  <option value="Incomplete">Incomplete (1st Only)</option>
                  <option value="Present">Present</option>
                  <option value="Late">Late Arrivals</option>
                  <option value="Absent">Absent</option>
                  <option value="Not Eligible">Not Eligible (Missed 1st)</option>
                  <option value="Leave">On Leave</option>
                </>
              ) : (
                <>
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                  <option value="Leave">Leave</option>
                </>
              )}
            </select>

            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by ID, Name, Room, or Phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>

            {!isMultipleAttendance && (
              <button
                className="btn-export-csv"
                onClick={handleExportClientCSV}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <Download size={14} /> Export CSV
              </button>
            )}

            {!isLeader && (
              <button
                type="button"
                onClick={handleDeleteAllAttendance}
                disabled={deletingAttendance}
                title="Delete all attendance records for this session on this date"
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: deletingAttendance ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.25)',
                  transition: 'all 0.2s',
                  opacity: deletingAttendance ? 0.7 : 1
                }}
              >
                <Trash2 size={14} /> {deletingAttendance ? 'Deleting...' : 'Delete Attendance'}
              </button>
            )}

            <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              Live Sync ({filteredAttendance.length})
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 14px' }}>Code</th>
                  <th style={{ padding: '12px 14px' }}>Name</th>
                  <th style={{ padding: '12px 14px' }}>Floor / Room</th>
                  <th style={{ padding: '12px 14px' }}>Phone</th>

                  {isMultipleAttendance ? (
                    viewMode === 'combined' ? (
                      <>
                        <th style={{ padding: '12px 14px' }}>1st Attendance</th>
                        <th style={{ padding: '12px 14px' }}>2nd Attendance</th>
                        <th style={{ padding: '12px 14px' }}>Overall Status</th>
                      </>
                    ) : viewMode === 'first' ? (
                      <>
                        <th style={{ padding: '12px 14px' }}>1st Window Time</th>
                        <th style={{ padding: '12px 14px' }}>1st Status</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: '12px 14px' }}>2nd Window Time</th>
                        <th style={{ padding: '12px 14px' }}>2nd Status</th>
                      </>
                    )
                  ) : (
                    <>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} color="#64748b" /> Time (IST)
                        </div>
                      </th>
                    </>
                  )}

                  <th style={{ padding: '12px 14px' }}>Notes / Remarks</th>
                  {!isViewOnly && (
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map(s => (
                  <tr key={`att_${s.student_id || s.student_code}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#3b82f6' }}>{s.student_code}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{s.name}</span>
                        {s.tags && s.tags.length > 0 && s.tags.map((tag: any) => (
                          <span
                            key={tag.id || tag.tag_id}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: `${tag.color || '#4f46e5'}20`,
                              color: tag.color || '#4f46e5',
                              border: `1px solid ${tag.color || '#4f46e5'}50`
                            }}
                          >
                            🏷️ {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '13px' }}>
                      Floor {s.floor_id} {s.room_number ? `(Rm ${s.room_number})` : ''}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}>
                      {s.phone_number || '—'}
                    </td>

                    {/* TWO-PHASE ATTENDANCE COLUMNS */}
                    {isMultipleAttendance ? (
                      viewMode === 'combined' ? (
                        <>
                          {/* 1st Window */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: 'fit-content',
                                backgroundColor: s.phase1_status === 'Present' ? '#ecfdf5' : (s.phase1_status === 'Late' ? '#fef3c7' : (s.phase1_status === 'Leave' ? '#ede9fe' : '#fef2f2')),
                                color: s.phase1_status === 'Present' ? '#166534' : (s.phase1_status === 'Late' ? '#92400e' : (s.phase1_status === 'Leave' ? '#6d28d9' : '#991b1b'))
                              }}>
                                {s.phase1_status === 'Leave' ? '🏖️ Leave' : s.phase1_status}
                              </span>
                              {s.phase1_marked_at && (
                                <span style={{ fontSize: '11px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={11} /> {formatISTTime(s.phase1_marked_at)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2nd Window */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                width: 'fit-content',
                                backgroundColor: s.phase2_status === 'Present' ? '#ecfdf5' : (s.phase2_status === 'Late' ? '#fef3c7' : (s.phase2_status === 'Not Eligible' ? '#f1f5f9' : (s.phase2_status === 'Leave' ? '#ede9fe' : '#fef2f2'))),
                                color: s.phase2_status === 'Present' ? '#166534' : (s.phase2_status === 'Late' ? '#92400e' : (s.phase2_status === 'Not Eligible' ? '#64748b' : (s.phase2_status === 'Leave' ? '#6d28d9' : '#991b1b')))
                              }}>
                                {s.phase2_status === 'Not Eligible' ? '🚫 Not Eligible' : (s.phase2_status === 'Leave' ? '🏖️ Leave' : s.phase2_status)}
                              </span>
                              {s.phase2_marked_at && (
                                <span style={{ fontSize: '11px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={11} /> {formatISTTime(s.phase2_marked_at)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Overall Status */}
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: s.overall_status === 'Complete' ? '#ecfdf5' : (s.overall_status === 'Incomplete' ? '#fffbeb' : (s.overall_status === 'Leave' ? '#ede9fe' : '#fef2f2')),
                              color: s.overall_status === 'Complete' ? '#166534' : (s.overall_status === 'Incomplete' ? '#b45309' : (s.overall_status === 'Leave' ? '#6d28d9' : '#991b1b')),
                              border: s.overall_status === 'Complete' ? '1px solid #bbf7d0' : (s.overall_status === 'Incomplete' ? '1px solid #fde68a' : '1px solid #fecaca')
                            }}>
                              {s.overall_status === 'Complete' ? '✓ Complete' : (s.overall_status === 'Incomplete' ? '⚠️ Incomplete' : (s.overall_status === 'Leave' ? '🏖️ Leave' : '❌ Absent'))}
                            </span>
                          </td>
                        </>
                      ) : viewMode === 'first' ? (
                        <>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {s.phase1_marked_at ? (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                                <Clock size={12} color="#64748b" style={{ display: 'inline', marginRight: '4px' }} />
                                {formatISTTime(s.phase1_marked_at)}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: s.phase1_status === 'Present' ? '#ecfdf5' : (s.phase1_status === 'Late' ? '#fef3c7' : (s.phase1_status === 'Leave' ? '#ede9fe' : '#fef2f2')),
                              color: s.phase1_status === 'Present' ? '#166534' : (s.phase1_status === 'Late' ? '#92400e' : (s.phase1_status === 'Leave' ? '#6d28d9' : '#991b1b'))
                            }}>
                              {s.phase1_status}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            {s.phase2_marked_at ? (
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                                <Clock size={12} color="#64748b" style={{ display: 'inline', marginRight: '4px' }} />
                                {formatISTTime(s.phase2_marked_at)}
                              </span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: s.phase2_status === 'Present' ? '#ecfdf5' : (s.phase2_status === 'Late' ? '#fef3c7' : (s.phase2_status === 'Not Eligible' ? '#f1f5f9' : '#fef2f2')),
                              color: s.phase2_status === 'Present' ? '#166534' : (s.phase2_status === 'Late' ? '#92400e' : (s.phase2_status === 'Not Eligible' ? '#64748b' : '#991b1b'))
                            }}>
                              {s.phase2_status === 'Not Eligible' ? '🚫 Not Eligible' : s.phase2_status}
                            </span>
                          </td>
                        </>
                      )
                    ) : (
                      /* SINGLE ATTENDANCE COLUMNS */
                      <>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: s.status === 'Present' ? '#ecfdf5' : (s.status === 'Late' ? '#fef3c7' : (s.status === 'Leave' ? '#ede9fe' : '#fef2f2')),
                            color: s.status === 'Present' ? '#166534' : (s.status === 'Late' ? '#92400e' : (s.status === 'Leave' ? '#6d28d9' : '#991b1b')),
                            border: s.status === 'Leave' ? '1px solid #ddd6fe' : undefined,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {s.status === 'Leave' ? '🏖️ Leave' : s.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          {s.marked_at && (s.status === 'Present' || s.status === 'Late') ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#1e293b',
                              backgroundColor: '#f8fafc',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}>
                              <Clock size={12} color="#64748b" />
                              {formatISTTime(s.marked_at)}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>—</span>
                          )}
                        </td>
                      </>
                    )}

                    <td style={{ padding: '12px 14px', maxWidth: '200px' }}>
                      <ExpandableReasonTooltip
                        text={s.remarks || s.reason || ''}
                        maxLength={32}
                        color="#475569"
                      />
                    </td>

                    {!isViewOnly && (
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          {/* View Full Student Attendance Details (Section 6) */}
                          {isMultipleAttendance && (
                            <button
                              type="button"
                              onClick={() => setSelectedStudentDetails(s)}
                              title="View Student Attendance Details"
                              style={{
                                padding: '6px 10px',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Eye size={13} /> Details
                            </button>
                          )}

                          <button
                            onClick={() => openManualModal(s, isMultipleAttendance && viewMode === 'second' ? 2 : 1)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: s.status === 'Absent' ? '#e0e7ff' : '#f1f5f9',
                              color: s.status === 'Absent' ? '#4338ca' : '#334155',
                              border: '1px solid ' + (s.status === 'Absent' ? '#c7d2fe' : '#cbd5e1'),
                              borderRadius: '8px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <UserCheck size={13} />
                            {s.status === 'Absent' ? 'Manual' : 'Edit'}
                          </button>

                          {(s.status === 'Present' || s.status === 'Late' || s.is_present || s.phase1_marked || s.phase2_marked) && (
                            <button
                              onClick={() => handleDeleteSingleStudent(s)}
                              disabled={submittingAction}
                              title="Remove Attendance Record"
                              style={{
                                padding: '6px 9px',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: submittingAction ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={isViewOnly ? 7 : 8} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No students match the criteria for {attendanceDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </HamsCard>
      )}

      {/* TAB 2: ABSENT / REPORT VERIFICATION */}
      {activeTab === 2 && (
        <HamsCard padding="24px">
          {/* Filters Bar for Absent / Justifications */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
            <input
              type="date"
              value={absentDate}
              onChange={e => setAbsentDate(e.target.value)}
              style={{ width: '160px' }}
            />

            <select
              value={absentFloorFilter}
              onChange={e => setAbsentFloorFilter(e.target.value)}
              style={{ width: '130px' }}
            >
              <option value="All">All Floors</option>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(fl => (
                <option key={fl} value={String(fl)}>Floor {fl}</option>
              ))}
            </select>

            <select
              value={absentStatusFilter}
              onChange={e => setAbsentStatusFilter(e.target.value)}
              style={{ width: '140px' }}
            >
              <option value="All">All Status</option>
              <option value="Justified">Justified</option>
              <option value="Unjustified">Unjustified</option>
            </select>

            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search absent by ID, Name, or Room..."
                value={absentSearchQuery}
                onChange={e => setAbsentSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>

            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
              Absent Records ({filteredAbsent.length})
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '12px 14px' }}>Code</th>
                <th style={{ padding: '12px 14px' }}>Name</th>
                <th style={{ padding: '12px 14px' }}>Floor / Room</th>
                <th style={{ padding: '12px 14px' }}>Justification Reason</th>
                {!isViewOnly && <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAbsent.map(s => (
                <tr key={`abs_${s.student_id || s.student_code}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#3b82f6' }}>{s.student_code}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{s.name}</span>
                      {s.tags && s.tags.length > 0 && s.tags.map((tag: any) => (
                        <span
                          key={tag.id || tag.tag_id}
                          style={{
                            padding: '2px 7px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: `${tag.color || '#4f46e5'}20`,
                            color: tag.color || '#4f46e5',
                            border: `1px solid ${tag.color || '#4f46e5'}50`
                          }}
                        >
                          🏷️ {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '13px' }}>
                    Floor {s.floor_id} {s.room_number ? `(Rm ${s.room_number})` : ''}
                  </td>
                  <td style={{ padding: '12px 14px', maxWidth: '240px' }}>
                    {s.reason ? (
                      <ExpandableReasonTooltip
                        text={s.reason}
                        maxLength={35}
                        color="#047857"
                        prefixBadge={<Check size={14} color="#047857" />}
                      />
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>Unjustified</span>
                    )}
                  </td>
                  {!isViewOnly && (
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => openJustifyModal(s)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: '#3b82f6',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <FileText size={14} /> Justify
                        </button>

                        <button
                          onClick={() => openManualModal({ ...s, status: 'Absent' })}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#e0e7ff',
                            color: '#4338ca',
                            border: '1px solid #c7d2fe',
                            borderRadius: '8px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Mark Manual
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredAbsent.length === 0 && (
                <tr>
                  <td colSpan={isViewOnly ? 4 : 5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No absent students match the criteria for {absentDate}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </HamsCard>
      )}

      {/* TAB 3: STUDENT ASSIGNMENT / TARGET MANAGEMENT */}
      {activeTab === 3 && (
        <HamsCard padding="24px">
          {/* Information & Mode Banner */}
          <div style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: isForAllStudents ? '#f0fdf4' : '#fffbeb',
            border: isForAllStudents ? '1px solid #bbf7d0' : '1px solid #fde68a',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: isForAllStudents ? '#dcfce7' : '#fef3c7',
                color: isForAllStudents ? '#15803d' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px'
              }}>
                {isForAllStudents ? '🌟' : '🎯'}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: isForAllStudents ? '#15803d' : '#92400e' }}>
                  {isForAllStudents ? 'Hostel-Wide Session (All Students Active)' : 'Selective Session (Specific Students Only)'}
                </h4>
                <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: isForAllStudents ? '#166534' : '#b45309' }}>
                  {isForAllStudents
                    ? 'This session is set for all hostel students by default. You can assign specific students below if this session becomes selective.'
                    : 'Only students selected below can mark attendance for this session. Absentee WhatsApp alerts will ONLY go to these assigned students.'}
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#ffffff',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontWeight: 700,
              fontSize: '13px',
              color: '#334155'
            }}>
              <Users size={16} color="#4f46e5" />
              <span>Assigned: <strong style={{ color: '#4f46e5' }}>{selectedTargetIds.length}</strong> / {targetStudents.length} Students</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
            paddingBottom: '16px',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
              <select
                value={targetFloorFilter}
                onChange={(e) => setTargetFloorFilter(e.target.value)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="All">All Floors</option>
                {targetFloors.map((fl: any) => (
                  <option key={`target_fl_${fl.floor_id}`} value={String(fl.floor_id)}>
                    {fl.floor_name || `Floor ${fl.floor_id}`}
                  </option>
                ))}
              </select>

              <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '380px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter students by name, ID, room..."
                  value={targetSearchQuery}
                  onChange={(e) => setTargetSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleSelectAllTargets}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ✓ Select All ({filteredTargetStudents.length})
              </button>

              <button
                type="button"
                onClick={handleClearAllTargets}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ✕ Deselect All
              </button>
            </div>

            <button
              type="button"
              disabled={savingTargets || isViewOnly}
              onClick={saveAssignedTargets}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: (savingTargets || isViewOnly) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.2s',
                opacity: isViewOnly ? 0.5 : 1
              }}
              title={isViewOnly ? 'Disabled in View Only mode' : undefined}
            >
              <Check size={16} />
              <span>{savingTargets ? 'Saving Assignments...' : `Save Assigned Students (${selectedTargetIds.length})`}</span>
            </button>
          </div>

          {/* Student Targeting Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 14px', width: '40px' }}>Assign</th>
                  <th style={{ padding: '12px 14px' }}>Student Code</th>
                  <th style={{ padding: '12px 14px' }}>Student Name</th>
                  <th style={{ padding: '12px 14px' }}>Floor</th>
                  <th style={{ padding: '12px 14px' }}>Room No.</th>
                  <th style={{ padding: '12px 14px' }}>Contact Phone</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Session Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTargetStudents.map(student => {
                  const isAssigned = selectedTargetIds.includes(student.student_id);
                  return (
                    <tr
                      key={`target_row_${student.student_id}`}
                      onClick={() => !isViewOnly && toggleStudentTarget(student.student_id)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isAssigned ? '#f5f3ff' : '#ffffff',
                        cursor: isViewOnly ? 'default' : 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          disabled={isViewOnly}
                          onChange={() => !isViewOnly && toggleStudentTarget(student.student_id)}
                          style={{
                            width: '18px',
                            height: '18px',
                            accentColor: '#4f46e5',
                            cursor: isViewOnly ? 'default' : 'pointer'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                        {student.student_code}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {student.name}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        Floor {student.floor_id}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        {student.room_number ? `Room ${student.room_number}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'monospace' }}>
                        {student.phone_number || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {isAssigned ? (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '20px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✓ Assigned
                          </span>
                        ) : (
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '20px',
                            backgroundColor: '#f1f5f9',
                            color: '#94a3b8',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
                            Not Assigned
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredTargetStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No students found matching the selected filter/search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </HamsCard>
      )}

      {/* MODAL 1: MANUAL ATTENDANCE POP-UP (REGULAR OR LATE + DESCRIPTION) */}
      {manualModal?.isOpen && createPortal(
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setManualModal(null); }}>
          <div className="modal-content-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Mark Manual Attendance
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {manualModal.student.name} ({manualModal.student.student_code}) • Floor {manualModal.student.floor_id} • Room {manualModal.student.room_number || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setManualModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Attendance Window Selector (When Multiple Attendance is Active) */}
            {isMultipleAttendance && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Select Attendance Window / Phase:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setManualModal({ ...manualModal, phase: 1 })}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: (manualModal.phase || 1) === 1 ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      backgroundColor: (manualModal.phase || 1) === 1 ? '#eef2ff' : '#ffffff',
                      color: (manualModal.phase || 1) === 1 ? '#4338ca' : '#475569',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    1️⃣ First Window ({twoPhaseWindows?.first?.start_time ? format12Hour(twoPhaseWindows.first.start_time) : ''})
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualModal({ ...manualModal, phase: 2 })}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: manualModal.phase === 2 ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                      backgroundColor: manualModal.phase === 2 ? '#f5f3ff' : '#ffffff',
                      color: manualModal.phase === 2 ? '#6d28d9' : '#475569',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    2️⃣ Second Window ({twoPhaseWindows?.second?.start_time ? format12Hour(twoPhaseWindows.second.start_time) : ''})
                  </button>
                </div>
              </div>
            )}

            {/* Attendance Status Type: Regular or Late */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Select Attendance Status:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setManualModal({ ...manualModal, status: 'Present' })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '14px',
                    borderRadius: '10px',
                    border: manualModal.status === 'Present' ? '2px solid #10b981' : '1px solid #e2e8f0',
                    backgroundColor: manualModal.status === 'Present' ? '#ecfdf5' : '#ffffff',
                    color: manualModal.status === 'Present' ? '#065f46' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: 700,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <CheckCircle2 size={22} color={manualModal.status === 'Present' ? '#10b981' : '#94a3b8'} />
                  <span>Regular (Present)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManualModal({ ...manualModal, status: 'Late' })}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '14px',
                    borderRadius: '10px',
                    border: manualModal.status === 'Late' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                    backgroundColor: manualModal.status === 'Late' ? '#fffbeb' : '#ffffff',
                    color: manualModal.status === 'Late' ? '#92400e' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: 700,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Clock size={22} color={manualModal.status === 'Late' ? '#f59e0b' : '#94a3b8'} />
                  <span>Late</span>
                </button>
              </div>
            </div>

            {/* Description / Remarks */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Description / Remarks (Optional):
              </label>
              <textarea
                rows={3}
                value={manualModal.description}
                onChange={e => setManualModal({ ...manualModal, description: e.target.value })}
                placeholder="E.g. In room sick, Bluetooth connection issue, Warden permission granted..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              {(manualModal.student.status === 'Present' || manualModal.student.status === 'Late' || manualModal.student.is_present || manualModal.student.phase1_marked || manualModal.student.phase2_marked) ? (
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => handleDeleteSingleStudent(manualModal.student, manualModal.phase)}
                  style={{
                    padding: '10px 16px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    cursor: submittingAction ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: '#dc2626',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={15} /> Remove Record
                </button>
              ) : <div />}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setManualModal(null)}
                  style={{
                    padding: '10px 18px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
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
                  disabled={submittingAction}
                  onClick={handleSaveManualAttendance}
                  style={{
                    padding: '10px 20px',
                    background: manualModal.status === 'Late' ? '#d97706' : '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: submittingAction ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submittingAction ? 'Saving...' : `Mark as ${manualModal.status}`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: INDIVIDUAL STUDENT ATTENDANCE DETAILS (Section 6 of requirements) */}
      {selectedStudentDetails && createPortal(
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSelectedStudentDetails(null); }}>
          <div className="modal-content-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {selectedStudentDetails.name}
                  </h3>
                  <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, backgroundColor: '#eff6ff', color: '#2563eb', fontFamily: 'monospace' }}>
                    {selectedStudentDetails.student_code}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Floor {selectedStudentDetails.floor_id} • Room {selectedStudentDetails.room_number || 'N/A'} • Phone: {selectedStudentDetails.phone_number || '—'}
                </p>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  Session: <strong>{sessionName}</strong> • Date: <strong>{attendanceDate}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentDetails(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {/* Window 1 Card */}
              <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: '#4f46e5', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>1st Attendance</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                      Window: {format12Hour(twoPhaseWindows?.first?.start_time || startTime)} – {format12Hour(twoPhaseWindows?.first?.end_time || endTime)}
                    </span>
                  </div>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    backgroundColor: selectedStudentDetails.phase1_status === 'Present' ? '#ecfdf5' : (selectedStudentDetails.phase1_status === 'Late' ? '#fef3c7' : '#fef2f2'),
                    color: selectedStudentDetails.phase1_status === 'Present' ? '#166534' : (selectedStudentDetails.phase1_status === 'Late' ? '#92400e' : '#991b1b')
                  }}>
                    {selectedStudentDetails.phase1_status}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <div>
                    <strong>Marking Time:</strong> {formatISTTime(selectedStudentDetails.phase1_marked_at)}
                  </div>
                  <div>
                    <strong>Punctuality:</strong> {selectedStudentDetails.phase1_is_late ? '⚠️ Late Arrival' : (selectedStudentDetails.phase1_marked ? '✅ On-Time' : '—')}
                  </div>
                </div>
              </div>

              {/* Window 2 Card */}
              <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: '#7c3aed', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>2nd Attendance</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                      Window: {format12Hour(twoPhaseWindows?.second?.start_time || phase2StartTime)} – {format12Hour(twoPhaseWindows?.second?.end_time || phase2EndTime)}
                    </span>
                  </div>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    backgroundColor: selectedStudentDetails.phase2_status === 'Present' ? '#ecfdf5' : (selectedStudentDetails.phase2_status === 'Late' ? '#fef3c7' : (selectedStudentDetails.phase2_status === 'Not Eligible' ? '#f1f5f9' : '#fef2f2')),
                    color: selectedStudentDetails.phase2_status === 'Present' ? '#166534' : (selectedStudentDetails.phase2_status === 'Late' ? '#92400e' : (selectedStudentDetails.phase2_status === 'Not Eligible' ? '#64748b' : '#991b1b'))
                  }}>
                    {selectedStudentDetails.phase2_status}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#475569', marginBottom: '6px' }}>
                  <div>
                    <strong>Marking Time:</strong> {formatISTTime(selectedStudentDetails.phase2_marked_at)}
                  </div>
                  <div>
                    <strong>Punctuality:</strong> {selectedStudentDetails.phase2_is_late ? '⚠️ Late Arrival' : (selectedStudentDetails.phase2_marked ? '✅ On-Time' : '—')}
                  </div>
                </div>
                <div style={{ fontSize: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', color: selectedStudentDetails.phase2_is_eligible ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                  {selectedStudentDetails.phase2_is_eligible ? (
                    <span>✓ Eligible for 2nd attendance (Successfully marked 1st attendance)</span>
                  ) : (
                    <span>🚫 Not eligible (Missed 1st attendance window — barred from marking 2nd attendance)</span>
                  )}
                </div>
              </div>

              {/* Overall Status Card */}
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1.5px solid ' + (selectedStudentDetails.overall_status === 'Complete' ? '#bbf7d0' : (selectedStudentDetails.overall_status === 'Incomplete' ? '#fde68a' : '#fecaca')),
                backgroundColor: selectedStudentDetails.overall_status === 'Complete' ? '#f0fdf4' : (selectedStudentDetails.overall_status === 'Incomplete' ? '#fffbeb' : '#fef2f2')
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Overall Attendance Status</span>
                    <h4 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 800, color: selectedStudentDetails.overall_status === 'Complete' ? '#15803d' : (selectedStudentDetails.overall_status === 'Incomplete' ? '#b45309' : '#b91c1c') }}>
                      {selectedStudentDetails.overall_status === 'Complete' ? '🌟 Complete (Attended Both Windows)' : (selectedStudentDetails.overall_status === 'Incomplete' ? '⚠️ Incomplete (Attended 1st Window Only)' : '❌ Absent (Missed Attendance)')}
                    </h4>
                  </div>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: 800,
                    backgroundColor: selectedStudentDetails.overall_status === 'Complete' ? '#15803d' : (selectedStudentDetails.overall_status === 'Incomplete' ? '#b45309' : '#b91c1c'),
                    color: '#ffffff'
                  }}>
                    {selectedStudentDetails.overall_status}
                  </span>
                </div>
                {selectedStudentDetails.remarks && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                    Remarks: {selectedStudentDetails.remarks}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!isViewOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    const stu = selectedStudentDetails;
                    setSelectedStudentDetails(null);
                    openManualModal(stu, 1);
                  }}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#e0e7ff',
                    color: '#4338ca',
                    border: '1px solid #c7d2fe',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <UserCheck size={14} /> Mark Manual Attendance
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedStudentDetails(null)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: JUSTIFICATION POP-UP (DESCRIPTION REQUIRED) */}
      {justifyModal?.isOpen && createPortal(
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setJustifyModal(null); }}>
          <div className="modal-content-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Justify Absence / Late
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {justifyModal.student.name} ({justifyModal.student.student_code}) • Floor {justifyModal.student.floor_id} • Room {justifyModal.student.room_number || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setJustifyModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {justifyModal.error && (
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
                {justifyModal.error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Why did the student arrive late or stay absent? <span style={{ color: '#ef4444' }}>* (Required)</span>
              </label>
              <textarea
                rows={4}
                value={justifyModal.reason}
                onChange={e => setJustifyModal({ ...justifyModal, reason: e.target.value, error: undefined })}
                placeholder="Give proper detailed reason for absence / late arrival (e.g. Medical emergency at hospital, College sports event, On approved weekend leave)..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: justifyModal.error ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setJustifyModal(null)}
                style={{
                  padding: '10px 18px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
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
                disabled={submittingAction}
                onClick={handleSaveJustification}
                style={{
                  padding: '10px 20px',
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: submittingAction ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {submittingAction ? 'Saving...' : 'Submit Justification'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

