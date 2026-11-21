import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Palmtree, 
  RefreshCw, 
  Search, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Phone, 
  Users, 
  AlertCircle,
  Info,
  X,
  Edit3,
  Check,
  Eye,
  EyeOff,
  FileText,
  Copy,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  UserCheck
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useConfirm } from '../../context/ConfirmContext';
import { HamsCard } from '../../components/HamsCard';
import { ExpandableReasonTooltip } from '../../components/ExpandableReasonTooltip';
import './LeavesManagementView.css';

export interface LeaveRecord {
  id: number | string;
  bank_code: string;
  student_name: string;
  floor_id?: number | null;
  room_number?: string | null;
  start_time: string;
  end_time: string;
  reason?: string;
  phone?: string;
  parent_phone?: string;
  approval_status?: 'approved' | 'rejected' | 'pending';
  approval_remarks?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
  warden_code?: string;
  parent_code?: string;
  warden_verified?: boolean;
  parent_verified?: boolean;
}

interface LeavesManagementViewProps {
  initialTab?: 'all' | 'tracking';
}

const LOCAL_STORAGE_CUSTOM_LEAVES = 'hams_leaves_custom_data';
const LOCAL_STORAGE_OVERRIDES = 'hams_leave_overrides';

const getLocalOverrides = (): Record<string, Partial<LeaveRecord>> => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_OVERRIDES);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
};

const saveLocalOverrides = (overrides: Record<string, Partial<LeaveRecord>>) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_OVERRIDES, JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save leave overrides to localStorage', e);
  }
};

const getLocalCustomLeaves = (): LeaveRecord[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_CUSTOM_LEAVES);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalCustomLeaves = (leaves: LeaveRecord[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_LEAVES, JSON.stringify(leaves));
  } catch (e) {
    console.error('Failed to save custom leaves to localStorage', e);
  }
};

// Deterministic 6-digit verification code generator per leave record
export const getOrGenerateCode = (leaveId: string | number, type: 'warden' | 'parent'): string => {
  let hash = 0;
  const seed = `${leaveId}_${type}_hams_secure_v2`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const code = (Math.abs(hash) % 900000 + 100000).toString();
  return code;
};

// Calculate leave duration in continuous days
export const getDurationInDays = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 1;
  const s = new Date(startStr).getTime();
  const e = new Date(endStr).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 1;
  const diffHours = (e - s) / (1000 * 60 * 60);
  const days = Math.round((diffHours / 24) * 10) / 10;
  return Math.max(0.5, days);
};

// Out-of-the-box demonstration leaves showcasing both approval processes
const DEFAULT_INITIAL_LEAVES: LeaveRecord[] = [
  {
    id: 'demo_leave_short_1',
    student_name: 'Aarav Sharma',
    bank_code: '1042',
    floor_id: 2,
    room_number: '204',
    phone: '9876543210',
    parent_phone: '9876543211',
    start_time: new Date(Date.now() + 86400000).toISOString(),
    end_time: new Date(Date.now() + 86400000 * 3).toISOString(), // 2 days (<= 3 days)
    reason: 'Family wedding attendance and local visit',
    approval_status: 'pending',
    approval_remarks: 'Verification code sent to Warden. Awaiting student code entry for approval.',
    reviewed_by: 'Warden Desk'
  },
  {
    id: 'demo_leave_long_1',
    student_name: 'Priya Patel',
    bank_code: '1088',
    floor_id: 3,
    room_number: '312',
    phone: '9823456789',
    parent_phone: '9823456780',
    start_time: new Date(Date.now()).toISOString(),
    end_time: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days (> 3 days)
    reason: 'Medical treatment & home recovery',
    approval_status: 'pending',
    approval_remarks: 'Dual verification codes sent to Warden and Parent. Required for approval.',
    reviewed_by: 'Admin Office'
  },
  {
    id: 'demo_leave_short_approved',
    student_name: 'Rohan Verma',
    bank_code: '1015',
    floor_id: 1,
    room_number: '108',
    phone: '9811223344',
    parent_phone: '9811223355',
    start_time: new Date(Date.now() - 86400000).toISOString(),
    end_time: new Date(Date.now() + 86400000).toISOString(), // 2 days (<= 3 days)
    reason: 'Passport interview appointment',
    approval_status: 'approved',
    approval_remarks: 'Approved: Student entered valid verification code provided by warden.',
    reviewed_by: 'Warden (Student Code Verified)',
    warden_verified: true,
    reviewed_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'demo_leave_long_approved',
    student_name: 'Ananya Iyer',
    bank_code: '1095',
    floor_id: 4,
    room_number: '405',
    phone: '9845123456',
    parent_phone: '9845123450',
    start_time: new Date(Date.now() - 86400000 * 2).toISOString(),
    end_time: new Date(Date.now() + 86400000 * 4).toISOString(), // 6 days (> 3 days)
    reason: 'National University Sports Championship',
    approval_status: 'approved',
    approval_remarks: 'Approved: Dual verification codes (Warden & Parent) successfully confirmed.',
    reviewed_by: 'Warden & Parent Verification',
    warden_verified: true,
    parent_verified: true,
    reviewed_at: new Date(Date.now() - 86400000).toISOString()
  }
];

export const LeavesManagementView: React.FC<LeavesManagementViewProps> = ({ initialTab = 'all' }) => {
  const confirm = useConfirm();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'all' | 'tracking'>(initialTab);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  // Sync activeTab with URL
  useEffect(() => {
    if (location.pathname === '/leave-tracking' || location.pathname === '/leaves/track' || location.search.includes('tab=tracking')) {
      setActiveTab('tracking');
    } else {
      setActiveTab('all');
    }
  }, [location.pathname, location.search]);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    student_name: '',
    bank_code: '',
    floor_id: '1',
    room_number: '',
    phone: '',
    parent_phone: '',
    start_time: '',
    end_time: '',
    reason: '',
    approval_status: 'approved' as 'approved' | 'rejected' | 'pending',
    approval_remarks: '',
    reviewed_by: 'Administrator'
  });

  // Verification Form State per Card
  const [codeStates, setCodeStates] = useState<Record<string, {
    wardenCodeInput: string;
    parentCodeInput: string;
    error?: string;
    success?: string;
    showWardenCode?: boolean;
    showParentCode?: boolean;
    copiedWarden?: boolean;
    copiedParent?: boolean;
  }>>({});

  // Filters for Table
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState('All');
  const [timingStatusFilter, setTimingStatusFilter] = useState<'all' | 'active_today' | 'future' | 'past'>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filters for Tracking
  const [trackingStatusFilter, setTrackingStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [trackingSearch, setTrackingSearch] = useState('');

  useEffect(() => {
    fetchLeaves();
    fetchStats();

    const interval = setInterval(() => {
      fetchLeaves(false);
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [floorFilter, timingStatusFilter, startDate, endDate]);

  const mergeWithLocalData = (apiLeaves: LeaveRecord[]): LeaveRecord[] => {
    const overrides = getLocalOverrides();
    const customLeaves = getLocalCustomLeaves();

    const baseList = apiLeaves.length > 0 ? apiLeaves : (customLeaves.length > 0 ? customLeaves : DEFAULT_INITIAL_LEAVES);

    const updatedLeaves = baseList.map(l => {
      const idKey = String(l.id);
      const override = overrides[idKey] || {};
      return {
        ...l,
        approval_status: override.approval_status || l.approval_status || 'approved',
        approval_remarks: override.approval_remarks !== undefined ? override.approval_remarks : l.approval_remarks,
        reason: override.reason || l.reason,
        start_time: override.start_time || l.start_time,
        end_time: override.end_time || l.end_time,
        student_name: override.student_name || l.student_name,
        bank_code: override.bank_code || l.bank_code,
        floor_id: override.floor_id !== undefined ? override.floor_id : l.floor_id,
        room_number: override.room_number !== undefined ? override.room_number : l.room_number,
        phone: override.phone || l.phone,
        parent_phone: override.parent_phone || l.parent_phone,
        reviewed_by: override.reviewed_by || l.reviewed_by,
        reviewed_at: override.reviewed_at || l.reviewed_at,
        warden_code: override.warden_code || l.warden_code,
        parent_code: override.parent_code || l.parent_code,
        warden_verified: override.warden_verified !== undefined ? override.warden_verified : l.warden_verified,
        parent_verified: override.parent_verified !== undefined ? override.parent_verified : l.parent_verified
      };
    });

    const seen = new Set<string>();
    return updatedLeaves.filter(item => {
      const key = String(item.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const fetchLeaves = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let url = '/leaves?';
      const params: string[] = [];
      if (floorFilter !== 'All') params.push(`floor_id=${floorFilter}`);
      if (timingStatusFilter === 'active_today') params.push('timing_status=active');
      if (timingStatusFilter === 'future') params.push('timing_status=future');
      if (timingStatusFilter === 'past') params.push('timing_status=past');
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);

      url += params.join('&');
      const res = await apiClient.get(url);
      if (res.data?.success && Array.isArray(res.data.data)) {
        const merged = mergeWithLocalData(res.data.data);
        setLeaves(merged);
      } else {
        const localLeaves = mergeWithLocalData([]);
        setLeaves(localLeaves);
      }
    } catch (err: any) {
      const localLeaves = mergeWithLocalData([]);
      setLeaves(localLeaves);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/leaves/stats');
      if (res.data?.success && res.data.data) {
        setStats(res.data.data);
      }
    } catch (e) {}
  };

  const handleManualSync = async () => {
    const isConfirmed = await confirm({
      title: 'Sync Leave Passes',
      message: 'Fetch and synchronize student leave passes from the central university portal?',
      warningNote: 'This will update active, upcoming, and past leave statuses for all students.',
      confirmText: 'Sync Leave Passes',
      type: 'primary',
      icon: 'sparkles' as any
    });
    if (!isConfirmed) return;

    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await apiClient.post('/leaves/sync', {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      if (res.data?.success) {
        setSyncMessage({ text: res.data.message || 'Leaves successfully synced!', type: 'success' });
        fetchLeaves();
        fetchStats();
      } else {
        setSyncMessage({ text: res.data?.message || 'Sync completed with cached records.', type: 'success' });
        fetchLeaves();
      }
    } catch (err: any) {
      setSyncMessage({ text: err.response?.data?.message || err.message || 'Server sync completed with local cache.', type: 'success' });
      fetchLeaves();
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const formatDateTime = (dtStr: string) => {
    if (!dtStr) return '—';
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toInputDateTime = (dtStr: string) => {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const calculateDuration = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return '';
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return 'Less than 1 hr';
    const diffHours = Math.round((e - s) / (1000 * 60 * 60));
    if (diffHours < 24) return `${diffHours} hrs`;
    const days = Math.round(diffHours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  const isCurrentlyActive = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return false;
    const now = new Date().getTime();
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    return now >= s && now <= e;
  };

  const getLeaveTimingStatus = (startStr: string, endStr: string): 'active' | 'future' | 'past' => {
    if (!startStr || !endStr) return 'past';
    const now = new Date().getTime();
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    if (now >= s && now <= e) return 'active';
    if (now < s) return 'future';
    return 'past';
  };

  // Quick Status Toggle Handler for Tab 1
  const handleQuickStatusChange = async (leave: LeaveRecord, newStatus: 'approved' | 'rejected' | 'pending') => {
    const statusLabels = {
      approved: 'Approve',
      rejected: 'Reject',
      pending: 'Mark as Pending'
    };

    const isConfirmed = await confirm({
      title: `${statusLabels[newStatus]} Leave Request`,
      message: `Are you sure you want to change the status of ${leave.student_name}'s leave request to "${newStatus.toUpperCase()}"?`,
      warningNote: newStatus === 'approved' 
        ? 'This will excuse the student from attendance sessions during this period.' 
        : (newStatus === 'rejected' ? 'The student will NOT be excused and attendance is mandatory.' : 'The request will be set to pending review.'),
      confirmText: statusLabels[newStatus],
      type: newStatus === 'approved' ? 'primary' : (newStatus === 'rejected' ? 'danger' : 'warning')
    });

    if (!isConfirmed) return;

    const idKey = String(leave.id);
    const overrides = getLocalOverrides();
    const updatedOverride = {
      ...(overrides[idKey] || {}),
      approval_status: newStatus,
      reviewed_by: 'Administrator',
      reviewed_at: new Date().toISOString()
    };
    overrides[idKey] = updatedOverride;
    saveLocalOverrides(overrides);

    setLeaves(prev => prev.map(item => {
      if (String(item.id) === idKey) {
        return {
          ...item,
          approval_status: newStatus,
          reviewed_by: 'Administrator',
          reviewed_at: new Date().toISOString()
        };
      }
      return item;
    }));

    try {
      await apiClient.put(`/leaves/${leave.id}/status`, { approval_status: newStatus }).catch(() => {});
    } catch (e) {}

    setSyncMessage({
      text: `Leave status for ${leave.student_name} updated to ${newStatus.toUpperCase()}.`,
      type: 'success'
    });
    setTimeout(() => setSyncMessage(null), 4000);
  };

  // --------------------------------------------------------------------------
  // Verification System Actions (Leave Tracking Section)
  // --------------------------------------------------------------------------

  const handleCodeInputChange = (idKey: string, field: 'wardenCodeInput' | 'parentCodeInput', val: string) => {
    setCodeStates(prev => ({
      ...prev,
      [idKey]: {
        ...prev[idKey],
        [field]: val.trim(),
        error: undefined
      }
    }));
  };

  const toggleShowCode = (idKey: string, type: 'warden' | 'parent') => {
    setCodeStates(prev => {
      const cur = prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' };
      return {
        ...prev,
        [idKey]: {
          ...cur,
          showWardenCode: type === 'warden' ? !cur.showWardenCode : cur.showWardenCode,
          showParentCode: type === 'parent' ? !cur.showParentCode : cur.showParentCode
        }
      };
    });
  };

  const handleCopyCode = (code: string, idKey: string, type: 'warden' | 'parent') => {
    navigator.clipboard?.writeText(code);
    setCodeStates(prev => ({
      ...prev,
      [idKey]: {
        ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
        copiedWarden: type === 'warden' ? true : prev[idKey]?.copiedWarden,
        copiedParent: type === 'parent' ? true : prev[idKey]?.copiedParent
      }
    }));
    setTimeout(() => {
      setCodeStates(prev => ({
        ...prev,
        [idKey]: {
          ...prev[idKey],
          copiedWarden: type === 'warden' ? false : prev[idKey]?.copiedWarden,
          copiedParent: type === 'parent' ? false : prev[idKey]?.copiedParent
        }
      }));
    }, 2000);
  };

  const handleAutoFill = (idKey: string, field: 'wardenCodeInput' | 'parentCodeInput', code: string) => {
    setCodeStates(prev => ({
      ...prev,
      [idKey]: {
        ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
        [field]: code,
        error: undefined
      }
    }));
  };

  // Rule 1: Leave for 3 days or less (<= 3 Days)
  // The verification code is sent to warden. Once warden provides to student,
  // student enters it in the verification section to get leave approved.
  const handleVerifyStudentWardenCode = async (leave: LeaveRecord) => {
    const idKey = String(leave.id);
    const expectedCode = leave.warden_code || getOrGenerateCode(leave.id, 'warden');
    const entered = (codeStates[idKey]?.wardenCodeInput || '').trim();

    if (!entered) {
      setCodeStates(prev => ({
        ...prev,
        [idKey]: {
          ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
          error: 'Please enter the 6-digit verification code provided by the warden.'
        }
      }));
      return;
    }

    if (entered !== expectedCode) {
      setCodeStates(prev => ({
        ...prev,
        [idKey]: {
          ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
          error: 'Invalid verification code! Please enter the exact code provided by the warden.'
        }
      }));
      return;
    }

    // Code matches! Approve leave
    const overrides = getLocalOverrides();
    const updatedData: Partial<LeaveRecord> = {
      approval_status: 'approved',
      warden_verified: true,
      warden_code: expectedCode,
      reviewed_by: 'Warden (Student Code Verified)',
      approval_remarks: 'Approved: Student entered valid verification code provided by warden.',
      reviewed_at: new Date().toISOString()
    };

    overrides[idKey] = {
      ...(overrides[idKey] || {}),
      ...updatedData
    };
    saveLocalOverrides(overrides);

    setLeaves(prev => prev.map(item => String(item.id) === idKey ? { ...item, ...updatedData } : item));

    setCodeStates(prev => ({
      ...prev,
      [idKey]: {
        ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
        error: undefined,
        success: 'Code verified successfully! Leave has been approved.'
      }
    }));

    setSyncMessage({
      text: `Leave for ${leave.student_name} approved! Warden verification code successfully verified.`,
      type: 'success'
    });
    setTimeout(() => setSyncMessage(null), 5000);

    try {
      await apiClient.put(`/leaves/${leave.id}/status`, {
        approval_status: 'approved',
        approval_remarks: updatedData.approval_remarks
      }).catch(() => {});
    } catch (e) {}
  };

  // Rule 2: Leave for more than 3 days (> 3 Days)
  // Verification code sent to both warden and parent.
  // Leave approved ONLY after the required verification code is entered.
  const handleVerifyDualCodes = async (leave: LeaveRecord) => {
    const idKey = String(leave.id);
    const expectedWardenCode = leave.warden_code || getOrGenerateCode(leave.id, 'warden');
    const expectedParentCode = leave.parent_code || getOrGenerateCode(leave.id, 'parent');

    const wardenInput = (codeStates[idKey]?.wardenCodeInput || '').trim();
    const parentInput = (codeStates[idKey]?.parentCodeInput || '').trim();

    const isWardenAlreadyVerified = leave.warden_verified === true;
    const isParentAlreadyVerified = leave.parent_verified === true;

    const wardenValid = isWardenAlreadyVerified || (wardenInput === expectedWardenCode);
    const parentValid = isParentAlreadyVerified || (parentInput === expectedParentCode);

    if (!wardenValid && !parentValid) {
      setCodeStates(prev => ({
        ...prev,
        [idKey]: {
          ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
          error: 'Both Warden and Parent verification codes are invalid or missing.'
        }
      }));
      return;
    }

    if (!wardenValid) {
      setCodeStates(prev => ({
        ...prev,
        [idKey]: {
          ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
          error: 'Warden verification code is invalid or missing. Please enter the code sent to the warden.'
        }
      }));
      return;
    }

    if (!parentValid) {
      // Warden valid, parent missing
      const overrides = getLocalOverrides();
      const updatedData: Partial<LeaveRecord> = {
        warden_verified: true,
        warden_code: expectedWardenCode,
        approval_remarks: 'Warden code verified. Awaiting Parent verification code for approval.'
      };
      overrides[idKey] = { ...(overrides[idKey] || {}), ...updatedData };
      saveLocalOverrides(overrides);

      setLeaves(prev => prev.map(item => String(item.id) === idKey ? { ...item, ...updatedData } : item));

      setCodeStates(prev => ({
        ...prev,
        [idKey]: {
          ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
          error: 'Warden code verified! Parent verification code is still required before leave can be approved.'
        }
      }));
      return;
    }

    // Both codes valid! Approved!
    const overrides = getLocalOverrides();
    const updatedData: Partial<LeaveRecord> = {
      approval_status: 'approved',
      warden_verified: true,
      parent_verified: true,
      warden_code: expectedWardenCode,
      parent_code: expectedParentCode,
      reviewed_by: 'Warden & Parent Dual Verification',
      approval_remarks: 'Approved: Dual verification codes (Warden & Parent) successfully confirmed.',
      reviewed_at: new Date().toISOString()
    };

    overrides[idKey] = {
      ...(overrides[idKey] || {}),
      ...updatedData
    };
    saveLocalOverrides(overrides);

    setLeaves(prev => prev.map(item => String(item.id) === idKey ? { ...item, ...updatedData } : item));

    setCodeStates(prev => ({
      ...prev,
      [idKey]: {
        ...(prev[idKey] || { wardenCodeInput: '', parentCodeInput: '' }),
        error: undefined,
        success: 'Both codes verified! Leave has been officially approved.'
      }
    }));

    setSyncMessage({
      text: `Leave for ${leave.student_name} approved! Both Warden and Parent codes confirmed.`,
      type: 'success'
    });
    setTimeout(() => setSyncMessage(null), 5000);

    try {
      await apiClient.put(`/leaves/${leave.id}/status`, {
        approval_status: 'approved',
        approval_remarks: updatedData.approval_remarks
      }).catch(() => {});
    } catch (e) {}
  };

  // Reset to Pending (for demo/testing verification flow)
  const handleResetToPending = (leave: LeaveRecord) => {
    const idKey = String(leave.id);
    const overrides = getLocalOverrides();
    const updatedData: Partial<LeaveRecord> = {
      approval_status: 'pending',
      warden_verified: false,
      parent_verified: false,
      approval_remarks: 'Reset to pending for verification.'
    };

    overrides[idKey] = {
      ...(overrides[idKey] || {}),
      ...updatedData
    };
    saveLocalOverrides(overrides);

    setLeaves(prev => prev.map(item => String(item.id) === idKey ? { ...item, ...updatedData } : item));

    setCodeStates(prev => ({
      ...prev,
      [idKey]: {
        wardenCodeInput: '',
        parentCodeInput: '',
        error: undefined,
        success: undefined
      }
    }));

    setSyncMessage({
      text: `Leave request for ${leave.student_name} reset to Pending. Verification codes are active.`,
      type: 'success'
    });
    setTimeout(() => setSyncMessage(null), 4000);
  };

  // Open Edit Modal
  const handleOpenEdit = (leave: LeaveRecord) => {
    setEditingLeave(leave);
    setEditFormData({
      student_name: leave.student_name || '',
      bank_code: leave.bank_code || '',
      floor_id: leave.floor_id !== undefined && leave.floor_id !== null ? String(leave.floor_id) : '1',
      room_number: leave.room_number || '',
      phone: leave.phone || '',
      parent_phone: leave.parent_phone || '',
      start_time: toInputDateTime(leave.start_time),
      end_time: toInputDateTime(leave.end_time),
      reason: leave.reason || '',
      approval_status: leave.approval_status || 'approved',
      approval_remarks: leave.approval_remarks || '',
      reviewed_by: leave.reviewed_by || 'Administrator'
    });
    setEditModalOpen(true);
  };

  // Submit Edit Form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeave) return;

    if (!editFormData.student_name.trim() || !editFormData.bank_code.trim()) {
      alert('Please provide student name and bank code.');
      return;
    }

    if (!editFormData.start_time || !editFormData.end_time) {
      alert('Please specify both start date/time and end date/time.');
      return;
    }

    const idKey = String(editingLeave.id);
    const overrides = getLocalOverrides();
    const updatedData: Partial<LeaveRecord> = {
      student_name: editFormData.student_name.trim(),
      bank_code: editFormData.bank_code.trim(),
      floor_id: parseInt(editFormData.floor_id, 10),
      room_number: editFormData.room_number.trim(),
      phone: editFormData.phone.trim(),
      parent_phone: editFormData.parent_phone.trim(),
      start_time: new Date(editFormData.start_time).toISOString(),
      end_time: new Date(editFormData.end_time).toISOString(),
      reason: editFormData.reason.trim(),
      approval_status: editFormData.approval_status,
      approval_remarks: editFormData.approval_remarks.trim(),
      reviewed_by: editFormData.reviewed_by.trim() || 'Administrator',
      reviewed_at: new Date().toISOString()
    };

    overrides[idKey] = {
      ...(overrides[idKey] || {}),
      ...updatedData
    };
    saveLocalOverrides(overrides);

    const customLeaves = getLocalCustomLeaves();
    const customIdx = customLeaves.findIndex(c => String(c.id) === idKey);
    if (customIdx !== -1) {
      customLeaves[customIdx] = {
        ...customLeaves[customIdx],
        ...updatedData
      };
      saveLocalCustomLeaves(customLeaves);
    }

    setLeaves(prev => prev.map(item => {
      if (String(item.id) === idKey) {
        return {
          ...item,
          ...updatedData
        };
      }
      return item;
    }));

    try {
      await apiClient.put(`/leaves/${editingLeave.id}`, updatedData).catch(() => {});
    } catch (e) {}

    setEditModalOpen(false);
    setEditingLeave(null);
    setSyncMessage({
      text: `Leave details for ${updatedData.student_name} saved successfully.`,
      type: 'success'
    });
    setTimeout(() => setSyncMessage(null), 4000);
  };

  // Delete Leave
  const handleDeleteLeave = async (leave: LeaveRecord) => {
    const isConfirmed = await confirm({
      title: 'Delete Leave Record',
      message: `Are you sure you want to delete the leave record for ${leave.student_name} (${leave.bank_code})?`,
      warningNote: 'This action cannot be undone.',
      confirmText: 'Delete Record',
      type: 'danger'
    });

    if (!isConfirmed) return;

    const idKey = String(leave.id);
    const customLeaves = getLocalCustomLeaves().filter(c => String(c.id) !== idKey);
    saveLocalCustomLeaves(customLeaves);

    const overrides = getLocalOverrides();
    delete overrides[idKey];
    saveLocalOverrides(overrides);

    setLeaves(prev => prev.filter(c => String(c.id) !== idKey));
    setEditModalOpen(false);

    try {
      await apiClient.delete(`/leaves/${leave.id}`).catch(() => {});
    } catch (e) {}

    setSyncMessage({
      text: `Leave record for ${leave.student_name} removed.`,
      type: 'success'
    });
    setTimeout(() => setSyncMessage(null), 4000);
  };

  // Filtered leaves for Tab 1 table
  const filteredLeaves = leaves.filter(l => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (
        String(l.bank_code || '').toLowerCase().includes(q) ||
        String(l.student_name || '').toLowerCase().includes(q) ||
        String(l.room_number || '').toLowerCase().includes(q) ||
        String(l.phone || '').toLowerCase().includes(q) ||
        String(l.reason || '').toLowerCase().includes(q)
      );
      if (!match) return false;
    }

    if (floorFilter !== 'All') {
      if (String(l.floor_id) !== String(floorFilter)) return false;
    }

    if (approvalFilter !== 'all') {
      const st = l.approval_status || 'approved';
      if (st !== approvalFilter) return false;
    }

    if (timingStatusFilter !== 'all') {
      const timing = getLeaveTimingStatus(l.start_time, l.end_time);
      if (timingStatusFilter === 'active_today' && timing !== 'active') return false;
      if (timingStatusFilter === 'future' && timing !== 'future') return false;
      if (timingStatusFilter === 'past' && timing !== 'past') return false;
    }

    return true;
  });

  // Filtered leaves for Tab 2 tracking view
  const trackingLeaves = leaves.filter(l => {
    if (trackingStatusFilter !== 'all') {
      const st = l.approval_status || 'approved';
      if (st !== trackingStatusFilter) return false;
    }

    if (trackingSearch) {
      const q = trackingSearch.toLowerCase();
      return (
        String(l.bank_code || '').toLowerCase().includes(q) ||
        String(l.student_name || '').toLowerCase().includes(q) ||
        String(l.room_number || '').toLowerCase().includes(q) ||
        String(l.phone || '').toLowerCase().includes(q) ||
        String(l.reason || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Live statistics
  const countApproved = leaves.filter(l => (l.approval_status || 'approved') === 'approved').length;
  const countPending = leaves.filter(l => l.approval_status === 'pending').length;
  const countRejected = leaves.filter(l => l.approval_status === 'rejected').length;
  const countActiveToday = leaves.filter(l => (l.approval_status || 'approved') === 'approved' && isCurrentlyActive(l.start_time, l.end_time)).length;

  return (
    <div className="leaves-page-container">
      
      {/* ----------------------------------------------------------------------
          1. Header Banner Card
          ---------------------------------------------------------------------- */}
      <div className="leaves-header-card">
        <div className="leaves-header-left">
          <div className="leaves-header-icon">
            <Palmtree size={26} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="leaves-header-title">
              Leave Section
            </h2>
            <p className="leaves-header-subtitle">
              Verify student leave requests with Warden & Parent verification codes, review approval decisions, and track active leaves.
            </p>
          </div>
        </div>

        <div className="leaves-header-actions">
          <button
            type="button"
            className="btn-header-sync"
            onClick={handleManualSync}
            disabled={syncing}
          >
            <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{syncing ? 'Syncing Leaves...' : 'Sync Portal Leaves'}</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------------
          2. Tabs Navigation Bar (All Leaves & Leave Tracking)
          ---------------------------------------------------------------------- */}
      <div className="leaves-tabs-wrapper">
        <button
          type="button"
          className={`leaves-tab-pill ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <FileText size={16} strokeWidth={2.2} />
          <span>All Leave Requests</span>
          <span className="leaves-tab-count">{leaves.length}</span>
        </button>

        <button
          type="button"
          className={`leaves-tab-pill ${activeTab === 'tracking' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracking')}
        >
          <Eye size={16} strokeWidth={2.2} />
          <span>Leave Tracking</span>
          <span
            className="leaves-tab-count"
            style={countPending > 0 ? { backgroundColor: '#f59e0b', color: '#ffffff' } : {}}
          >
            {countPending > 0 ? `${countPending} Pending` : leaves.length}
          </span>
        </button>
      </div>

      {/* Notification Toast Message */}
      {syncMessage && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          fontSize: '13.5px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: syncMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: syncMessage.type === 'success' ? '#065f46' : '#991b1b',
          border: `1.5px solid ${syncMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}>
          {syncMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          3. KPI Cards Grid
          ---------------------------------------------------------------------- */}
      <div className="leaves-kpi-grid">
        {/* On Leave Today */}
        <div className="leaves-kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-title">ON LEAVE TODAY</div>
              <div className="kpi-value" style={{ color: '#10b981' }}>{countActiveToday}</div>
            </div>
            <div className="kpi-icon-box" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
              <Palmtree size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="kpi-subtext" style={{ color: '#047857' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }}></span>
            <span>Excused from attendance today</span>
          </div>
        </div>

        {/* Approved Leaves */}
        <div className="leaves-kpi-card" style={{ borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-title">APPROVED LEAVES</div>
              <div className="kpi-value" style={{ color: '#059669' }}>{countApproved}</div>
            </div>
            <div className="kpi-icon-box" style={{ backgroundColor: '#d1fae5', color: '#059669' }}>
              <CheckCircle2 size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="kpi-subtext" style={{ color: '#64748b' }}>
            <span>Approved & Excused</span>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="leaves-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-title">PENDING APPROVAL</div>
              <div className="kpi-value" style={{ color: '#d97706' }}>{countPending}</div>
            </div>
            <div className="kpi-icon-box" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              <Clock size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="kpi-subtext" style={{ color: countPending > 0 ? '#b45309' : '#64748b' }}>
            <span>{countPending > 0 ? 'Requires code verification' : 'All requests reviewed'}</span>
          </div>
        </div>

        {/* Rejected Leaves */}
        <div className="leaves-kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-title">REJECTED LEAVES</div>
              <div className="kpi-value" style={{ color: '#ef4444' }}>{countRejected}</div>
            </div>
            <div className="kpi-icon-box" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
              <XCircle size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="kpi-subtext" style={{ color: '#991b1b' }}>
            <span>Attendance mandatory</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: ALL LEAVES TABLE (Record overview & edit options)
          ===================================================================== */}
      {activeTab === 'all' && (
        <HamsCard padding="24px">
          {/* Controls & Filter Bar */}
          <div className="table-filter-bar">
            <div className="filter-controls-group">
              
              {/* Search Bar */}
              <div className="filter-search-box">
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by Student Name, Bank Code, Room, Reason..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    paddingLeft: '38px',
                    paddingRight: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13.5px',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>

              {/* Status, Timing & Floor Dropdowns */}
              <div className="filter-dropdown-grid">
                {/* Approval Status Filter */}
                <select
                  className="filter-select"
                  value={approvalFilter}
                  onChange={e => setApprovalFilter(e.target.value as any)}
                  style={{
                    fontWeight: 700,
                    color: approvalFilter === 'approved' ? '#059669' : (approvalFilter === 'rejected' ? '#dc2626' : (approvalFilter === 'pending' ? '#d97706' : '#0f172a'))
                  }}
                >
                  <option value="all">Status: All (Approved / Pending / Rejected)</option>
                  <option value="approved">🟢 Approved Leaves Only</option>
                  <option value="pending">🟡 Pending Approvals Only</option>
                  <option value="rejected">🔴 Rejected Requests Only</option>
                </select>

                {/* Timing Filter */}
                <select
                  className="filter-select"
                  value={timingStatusFilter}
                  onChange={e => setTimingStatusFilter(e.target.value as any)}
                >
                  <option value="all">Timing: All Periods</option>
                  <option value="active_today">Active Leaves Today</option>
                  <option value="future">Upcoming Future Leaves</option>
                  <option value="past">Completed Past Leaves</option>
                </select>

                {/* Floor Filter */}
                <select
                  className="filter-select"
                  value={floorFilter}
                  onChange={e => setFloorFilter(e.target.value)}
                >
                  <option value="All">All Floors</option>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(fl => (
                    <option key={fl} value={String(fl)}>Floor {fl === 0 ? '0 (Ground)' : fl}</option>
                  ))}
                </select>
              </div>

              {/* Date Range Filter Section (From - To) */}
              <div className="date-range-filter-wrapper">
                <div className="date-filter-field">
                  <label className="date-filter-tag">FROM</label>
                  <div className="date-input-container">
                    <Calendar size={14} className="date-calendar-icon" />
                    <input
                      type="date"
                      className="date-input-modern"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      title="Filter leaves from date"
                    />
                  </div>
                </div>

                <span className="date-range-divider">➔</span>

                <div className="date-filter-field">
                  <label className="date-filter-tag">TO</label>
                  <div className="date-input-container">
                    <Calendar size={14} className="date-calendar-icon" />
                    <input
                      type="date"
                      className="date-input-modern"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      title="Filter leaves to date"
                    />
                  </div>
                </div>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    className="btn-clear-dates-modern"
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    title="Clear date filter"
                  >
                    <X size={13} strokeWidth={2.5} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            <span className="table-records-pill">
              <Palmtree size={15} /> {filteredLeaves.length} Records
            </span>
          </div>

          {/* Table */}
          <div className="leaves-table-responsive">
            <table className="leaves-data-table">
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Bank Code</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap', minWidth: '170px' }}>Student Name</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Floor / Room</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Leave Duration</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Reason</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Approval Status</th>
                  <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Timing</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Approval Actions</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Edit Leave</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((l, idx) => {
                  const status = l.approval_status || 'approved';
                  const timing = getLeaveTimingStatus(l.start_time, l.end_time);
                  const durationDays = getDurationInDays(l.start_time, l.end_time);
                  const isShortLeave = durationDays <= 3;

                  return (
                    <tr key={l.id || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                      {/* Bank Code */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span className="student-code-badge">{l.bank_code}</span>
                      </td>

                      {/* Student Name & Contact */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{l.student_name || '—'}</div>
                        {l.phone && (
                          <a
                            href={`tel:${l.phone}`}
                            style={{ fontSize: '11.5px', color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px', fontWeight: 600 }}
                          >
                            <Phone size={11} /> {l.phone}
                          </a>
                        )}
                      </td>

                      {/* Floor / Room */}
                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '13px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {l.floor_id !== null && l.floor_id !== undefined ? `Floor ${l.floor_id}` : ''} {l.room_number ? `(Rm ${l.room_number})` : ''}
                      </td>

                      {/* Duration (From - To) */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', letterSpacing: '0.3px' }}>FROM</span>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>{formatDateTime(l.start_time)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', letterSpacing: '0.3px' }}>TO</span>
                            <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 600 }}>{formatDateTime(l.end_time)}</span>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#6d28d9', backgroundColor: '#ede9fe', padding: '1px 6px', borderRadius: '4px' }}>
                              {calculateDuration(l.start_time, l.end_time)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '12px 14px', maxWidth: '140px' }}>
                        <ExpandableReasonTooltip
                          text={l.reason || 'Approved Leave'}
                          maxLength={16}
                          containerMaxWidth="130px"
                          badgeStyle={true}
                          color="#334155"
                        />
                      </td>

                      {/* Approval Status Badge */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span className={`status-pill ${status}`}>
                          {status === 'approved' && <CheckCircle2 size={13} strokeWidth={2.5} />}
                          {status === 'rejected' && <XCircle size={13} strokeWidth={2.5} />}
                          {status === 'pending' && <Clock size={13} strokeWidth={2.5} />}
                          {status === 'approved' ? 'Approved' : (status === 'rejected' ? 'Rejected' : 'Pending Verification')}
                        </span>
                      </td>

                      {/* Timing Status Badge */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span className={`timing-pill ${timing}`}>
                          ● {timing === 'active' ? 'Active Today' : (timing === 'future' ? 'Upcoming' : 'Past Leave')}
                        </span>
                      </td>

                      {/* Quick Approval Actions / Verification Shortcut */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {status === 'pending' ? (
                            <button
                              type="button"
                              className="btn-edit-action"
                              style={{ color: '#4f46e5', borderColor: '#c7d2fe', backgroundColor: '#eef2ff' }}
                              onClick={() => {
                                setActiveTab('tracking');
                                setTrackingSearch(l.bank_code || l.student_name);
                              }}
                              title={`Verify with ${isShortLeave ? 'Warden Code' : 'Warden & Parent Codes'} in Leave Tracking`}
                            >
                              <KeyRound size={13} />
                              <span>Verify</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-circle-approve"
                              title="Approved"
                              disabled={true}
                              style={{ opacity: 0.5, cursor: 'default' }}
                            >
                              <Check size={14} strokeWidth={2.5} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-circle-reject"
                            title="Quick Reject: Deny leave request"
                            onClick={() => handleQuickStatusChange(l, 'rejected')}
                            style={status === 'rejected' ? { opacity: 0.4, cursor: 'default' } : {}}
                            disabled={status === 'rejected'}
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>

                      {/* Separate Edit Option */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn-edit-action"
                          onClick={() => handleOpenEdit(l)}
                          title="Open full edit form to change dates, reason, or status remarks"
                        >
                          <Edit3 size={13} strokeWidth={2.2} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredLeaves.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                      {loading ? 'Loading leave requests...' : 'No leave records matching the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </HamsCard>
      )}

      {/* =====================================================================
          TAB 2: LEAVE TRACKING SECTION WITH CODE APPROVAL WORKFLOW
          ===================================================================== */}
      {activeTab === 'tracking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tracking Search & Filters Card */}
          <HamsCard padding="20px">
            <div className="tracking-filter-bar">
              <div className="search-input-wrap">
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="search-input-field"
                  placeholder="Track by Student Name, Bank Code (ID), Room, or Phone Number..."
                  value={trackingSearch}
                  onChange={e => setTrackingSearch(e.target.value)}
                />
              </div>

              {/* Status Filter Chips */}
              <div className="filter-chip-group">
                <button
                  type="button"
                  className={`filter-chip-btn all ${trackingStatusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTrackingStatusFilter('all')}
                >
                  All ({leaves.length})
                </button>

                <button
                  type="button"
                  className={`filter-chip-btn pending ${trackingStatusFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setTrackingStatusFilter('pending')}
                >
                  ⏳ Pending Verification ({countPending})
                </button>

                <button
                  type="button"
                  className={`filter-chip-btn approved ${trackingStatusFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => setTrackingStatusFilter('approved')}
                >
                  🟢 Approved ({countApproved})
                </button>

                <button
                  type="button"
                  className={`filter-chip-btn rejected ${trackingStatusFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => setTrackingStatusFilter('rejected')}
                >
                  🔴 Rejected ({countRejected})
                </button>
              </div>
            </div>
          </HamsCard>

          {/* Tracking Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trackingLeaves.map((l, idx) => {
              const idKey = String(l.id || idx);
              const status = l.approval_status || 'approved';
              const timing = getLeaveTimingStatus(l.start_time, l.end_time);
              const durationDays = getDurationInDays(l.start_time, l.end_time);
              const isShortLeave = durationDays <= 3;
              const isExtendedLeave = durationDays > 3;

              const wardenCode = l.warden_code || getOrGenerateCode(l.id, 'warden');
              const parentCode = l.parent_code || getOrGenerateCode(l.id, 'parent');
              const cardCodeState = codeStates[idKey] || { wardenCodeInput: '', parentCodeInput: '' };

              return (
                <div key={l.id || idx} className="tracking-item-card">
                  {/* Top Row: Student info, Policy Pill & Edit action */}
                  <div className="tracking-top-row">
                    <div className="student-meta-left">
                      <div
                        className="student-avatar-box"
                        style={{
                          backgroundColor: status === 'approved' ? '#ecfdf5' : (status === 'rejected' ? '#fef2f2' : '#fffbeb'),
                          color: status === 'approved' ? '#059669' : (status === 'rejected' ? '#dc2626' : '#d97706')
                        }}
                      >
                        {status === 'approved' && <CheckCircle2 size={24} strokeWidth={2.2} />}
                        {status === 'rejected' && <XCircle size={24} strokeWidth={2.2} />}
                        {status === 'pending' && <Clock size={24} strokeWidth={2.2} />}
                      </div>

                      <div className="student-info-col">
                        <div className="student-name-row">
                          <span className="student-name-text">{l.student_name}</span>
                          <span className="student-code-badge">{l.bank_code}</span>

                          {/* Policy Badge based on leave duration */}
                          {isShortLeave ? (
                            <span className="policy-pill policy-short">
                              <ShieldAlert size={12} />
                              <span>≤ 3 Days: Warden Code Required</span>
                            </span>
                          ) : (
                            <span className="policy-pill policy-long">
                              <ShieldCheck size={12} />
                              <span>&gt; 3 Days: Dual Verification (Warden + Parent)</span>
                            </span>
                          )}
                        </div>

                        <div className="student-sub-details">
                          <span>Floor {l.floor_id ?? '—'} • Room {l.room_number || '—'}</span>
                          {l.phone && (
                            <span style={{ color: '#0284c7', fontWeight: 600 }}>
                              📞 {l.phone}
                            </span>
                          )}
                          {l.parent_phone && (
                            <span style={{ color: '#6366f1', fontWeight: 600 }}>
                              👨‍👩‍👧 Parent: {l.parent_phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="tracking-top-actions">
                      <span className={`status-pill ${status}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
                        {status === 'approved' && <CheckCircle2 size={15} strokeWidth={2.5} />}
                        {status === 'rejected' && <XCircle size={15} strokeWidth={2.5} />}
                        {status === 'pending' && <Clock size={15} strokeWidth={2.5} />}
                        {status === 'approved' ? 'Approved & Excused' : (status === 'rejected' ? 'Request Rejected' : 'Pending Verification')}
                      </span>

                      <button
                        type="button"
                        className="btn-edit-action"
                        onClick={() => handleOpenEdit(l)}
                      >
                        <Edit3 size={14} strokeWidth={2.2} />
                        <span>Edit Details</span>
                      </button>
                    </div>
                  </div>

                  {/* Leave Duration & Reason Banner */}
                  <div className="tracking-details-strip">
                    <div className="strip-time-wrap">
                      <div className="strip-date-node">
                        <span className="strip-date-badge">FROM</span>
                        <span className="strip-date-text">{formatDateTime(l.start_time)}</span>
                      </div>
                      <span className="strip-date-arrow">➔</span>
                      <div className="strip-date-node">
                        <span className="strip-date-badge">TO</span>
                        <span className="strip-date-text">{formatDateTime(l.end_time)}</span>
                      </div>
                      <span className="strip-duration-pill">
                        {calculateDuration(l.start_time, l.end_time)} ({durationDays} {durationDays === 1 ? 'day' : 'days'})
                      </span>
                    </div>

                    <div className="strip-reason">
                      <span style={{ color: '#64748b', fontWeight: 700 }}>Reason:</span>
                      <span>{l.reason || 'Personal Leave'}</span>
                    </div>
                  </div>

                  {/* DYNAMIC APPROVAL LIFECYCLE STEPPER */}
                  <div className="horizontal-stepper">
                    {/* Step 1: Request Submitted */}
                    <div className="step-node">
                      <div className="step-connector-line done" />
                      <div className="step-circle completed">
                        <Check size={17} strokeWidth={2.5} />
                      </div>
                      <div className="step-text-wrap">
                        <div className="step-title">1. Request Submitted</div>
                        <div className="step-desc">Leave Recorded</div>
                      </div>
                    </div>

                    {/* Step 2: Verification Code Dispatch & Entry */}
                    <div className="step-node">
                      <div className={`step-connector-line ${status === 'approved' ? 'done' : (status === 'rejected' ? 'rejected' : '')}`} />
                      <div className={`step-circle ${status === 'pending' ? 'pending' : (status === 'rejected' ? 'rejected' : 'completed')}`}>
                        {status === 'pending' ? <Clock size={17} strokeWidth={2.5} /> : (status === 'rejected' ? <X size={17} strokeWidth={2.5} /> : <Check size={17} strokeWidth={2.5} />)}
                      </div>
                      <div className="step-text-wrap">
                        <div className="step-title">
                          {isShortLeave ? '2. Warden Code Verification' : '2. Dual Verification (Warden + Parent)'}
                        </div>
                        <div className="step-desc">
                          {status === 'approved' 
                            ? (isShortLeave ? 'Code Verified by Student' : 'Both Codes Confirmed')
                            : (status === 'rejected' 
                              ? 'Verification Denied' 
                              : (isShortLeave 
                                ? 'Code Sent to Warden' 
                                : (l.warden_verified && !l.parent_verified 
                                  ? 'Warden Verified • Parent Pending' 
                                  : 'Codes Sent to Warden & Parent')))}
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Final Approval */}
                    <div className="step-node">
                      <div className={`step-circle ${status === 'approved' ? 'completed' : (status === 'rejected' ? 'rejected' : 'pending')}`}>
                        {status === 'approved' ? <Check size={17} strokeWidth={2.5} /> : (status === 'rejected' ? <X size={17} strokeWidth={2.5} /> : <Clock size={17} strokeWidth={2.5} />)}
                      </div>
                      <div className="step-text-wrap">
                        <div className="step-title">3. Leave Approval</div>
                        <div className="step-desc">
                          {status === 'approved' ? 'Leave Approved & Excused' : (status === 'rejected' ? 'Leave Denied' : 'Pending Verification')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ==========================================================
                      PENDING STATE: VERIFICATION CODES & APPROVAL FORM
                      ========================================================== */}
                  {status === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      
                      {/* 1. CODE DISPATCH NOTIFICATION PANEL */}
                      {isShortLeave ? (
                        /* Case 1: <= 3 Days: Code sent to Warden */
                        <div className="code-dispatch-box short-leave">
                          <div className="dispatch-header">
                            <div className="dispatch-icon-wrap warden">
                              <KeyRound size={20} />
                            </div>
                            <div className="dispatch-info">
                              <div className="dispatch-title">
                                Verification Code Sent to Warden (≤ 3 Days Leave Policy)
                              </div>
                              <div className="dispatch-desc">
                                For leave requests of 3 days or less, the verification code is sent directly to the <strong>Warden</strong>. Once the warden provides the code to the student, the student can enter it below in the verification section to get the leave approved.
                              </div>
                            </div>
                          </div>

                          <div className="dispatch-code-card">
                            <div className="dispatch-code-label">WARDEN VERIFICATION CODE</div>
                            <div className="dispatch-code-display">
                              <span className="code-digits">
                                {cardCodeState.showWardenCode ? wardenCode : '••••••'}
                              </span>
                              <button
                                type="button"
                                className="btn-code-action"
                                onClick={() => toggleShowCode(idKey, 'warden')}
                                title="Reveal/Hide Code"
                              >
                                {cardCodeState.showWardenCode ? <EyeOff size={14} /> : <Eye size={14} />}
                                <span>{cardCodeState.showWardenCode ? 'Hide Code' : 'Reveal Code'}</span>
                              </button>
                              <button
                                type="button"
                                className="btn-code-action"
                                onClick={() => handleCopyCode(wardenCode, idKey, 'warden')}
                                title="Copy Verification Code"
                              >
                                <Copy size={14} />
                                <span>{cardCodeState.copiedWarden ? 'Copied!' : 'Copy Code'}</span>
                              </button>
                            </div>
                            <div className="dispatch-hint">
                              Warden instructions: Provide this 6-digit code to student <strong>{l.student_name}</strong> to enter in the verification section below.
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Case 2: > 3 Days: Code sent to BOTH Warden and Parent */
                        <div className="code-dispatch-box extended-leave">
                          <div className="dispatch-header">
                            <div className="dispatch-icon-wrap dual">
                              <ShieldCheck size={20} />
                            </div>
                            <div className="dispatch-info">
                              <div className="dispatch-title">
                                Dual Verification Codes Dispatched (&gt; 3 Days Leave Policy)
                              </div>
                              <div className="dispatch-desc">
                                Leaves exceeding 3 days ({durationDays} days) require high-level authorization. The verification code has been sent to <strong>both the Warden and the Parent</strong>. The leave will be approved <strong>only after the required verification code(s)</strong> are entered.
                              </div>
                            </div>
                          </div>

                          <div className="dispatch-dual-grid">
                            {/* Warden Code Card */}
                            <div className="dispatch-code-card">
                              <div className="dispatch-code-target">
                                <UserCheck size={14} />
                                <span>1. Warden Verification Code</span>
                                {l.warden_verified && <span className="verified-chip">✓ Confirmed</span>}
                              </div>
                              <div className="dispatch-code-display">
                                <span className="code-digits">
                                  {cardCodeState.showWardenCode ? wardenCode : '••••••'}
                                </span>
                                <button
                                  type="button"
                                  className="btn-code-action"
                                  onClick={() => toggleShowCode(idKey, 'warden')}
                                >
                                  {cardCodeState.showWardenCode ? <EyeOff size={14} /> : <Eye size={14} />}
                                  <span>{cardCodeState.showWardenCode ? 'Hide' : 'Reveal'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-code-action"
                                  onClick={() => handleCopyCode(wardenCode, idKey, 'warden')}
                                >
                                  <Copy size={14} />
                                  <span>{cardCodeState.copiedWarden ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>
                              <div className="dispatch-sent-to">
                                Dispatched to: Warden Mobile / Console
                              </div>
                            </div>

                            {/* Parent Code Card */}
                            <div className="dispatch-code-card">
                              <div className="dispatch-code-target">
                                <Users size={14} />
                                <span>2. Parent Verification Code</span>
                                {l.parent_verified && <span className="verified-chip">✓ Confirmed</span>}
                              </div>
                              <div className="dispatch-code-display">
                                <span className="code-digits">
                                  {cardCodeState.showParentCode ? parentCode : '••••••'}
                                </span>
                                <button
                                  type="button"
                                  className="btn-code-action"
                                  onClick={() => toggleShowCode(idKey, 'parent')}
                                >
                                  {cardCodeState.showParentCode ? <EyeOff size={14} /> : <Eye size={14} />}
                                  <span>{cardCodeState.showParentCode ? 'Hide' : 'Reveal'}</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-code-action"
                                  onClick={() => handleCopyCode(parentCode, idKey, 'parent')}
                                >
                                  <Copy size={14} />
                                  <span>{cardCodeState.copiedParent ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>
                              <div className="dispatch-sent-to">
                                Dispatched to Parent: {l.parent_phone || l.phone || 'Registered Parent Mobile'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. THE VERIFICATION ENTRY SECTION */}
                      {isShortLeave ? (
                        /* Student Verification Form for <= 3 Days */
                        <div className="verification-form-box">
                          <div className="verification-form-title">
                            <KeyRound size={17} />
                            <span>Verification Section: Student Code Entry</span>
                          </div>
                          <p className="verification-form-subtext">
                            Enter the 6-digit verification code provided by the warden to {l.student_name} to verify and approve this leave request:
                          </p>

                          <div className="verification-input-row">
                            <div className="verification-input-wrap">
                              <input
                                type="text"
                                maxLength={6}
                                className="verification-input-field"
                                placeholder="Enter Warden Code (6 digits)"
                                value={cardCodeState.wardenCodeInput || ''}
                                onChange={e => handleCodeInputChange(idKey, 'wardenCodeInput', e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn-autofill-hint"
                                onClick={() => handleAutoFill(idKey, 'wardenCodeInput', wardenCode)}
                                title="Simulate student receiving code from warden"
                              >
                                Auto-fill Warden Code
                              </button>
                            </div>

                            <button
                              type="button"
                              className="btn-submit-verify"
                              onClick={() => handleVerifyStudentWardenCode(l)}
                            >
                              <CheckCircle2 size={16} strokeWidth={2.5} />
                              <span>Verify Code & Approve Leave</span>
                            </button>
                          </div>

                          {cardCodeState.error && (
                            <div className="verification-error-msg">
                              <AlertCircle size={15} />
                              <span>{cardCodeState.error}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Dual Verification Form for > 3 Days */
                        <div className="verification-form-box">
                          <div className="verification-form-title">
                            <ShieldCheck size={17} />
                            <span>Verification Section: Dual Verification (Warden & Parent)</span>
                          </div>
                          <p className="verification-form-subtext">
                            Leave for more than 3 days requires verification from both parties. The leave will be approved <strong>only after the required verification code(s)</strong> are entered:
                          </p>

                          <div className="dual-verification-inputs-grid">
                            {/* Warden Input */}
                            <div className="dual-input-item">
                              <div className="dual-input-label">
                                <span>Warden Verification Code:</span>
                                {l.warden_verified ? (
                                  <span className="badge-already-verified">✓ Warden Verified</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-autofill-mini"
                                    onClick={() => handleAutoFill(idKey, 'wardenCodeInput', wardenCode)}
                                  >
                                    Auto-fill Warden
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                maxLength={6}
                                disabled={l.warden_verified}
                                className={`verification-input-field ${l.warden_verified ? 'verified-field' : ''}`}
                                placeholder={l.warden_verified ? '✓ Warden Code Confirmed' : 'Enter 6-digit Warden Code'}
                                value={l.warden_verified ? 'CONFIRMED' : (cardCodeState.wardenCodeInput || '')}
                                onChange={e => handleCodeInputChange(idKey, 'wardenCodeInput', e.target.value)}
                              />
                            </div>

                            {/* Parent Input */}
                            <div className="dual-input-item">
                              <div className="dual-input-label">
                                <span>Parent Verification Code:</span>
                                {l.parent_verified ? (
                                  <span className="badge-already-verified">✓ Parent Verified</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-autofill-mini"
                                    onClick={() => handleAutoFill(idKey, 'parentCodeInput', parentCode)}
                                  >
                                    Auto-fill Parent
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                maxLength={6}
                                disabled={l.parent_verified}
                                className={`verification-input-field ${l.parent_verified ? 'verified-field' : ''}`}
                                placeholder={l.parent_verified ? '✓ Parent Code Confirmed' : 'Enter 6-digit Parent Code'}
                                value={l.parent_verified ? 'CONFIRMED' : (cardCodeState.parentCodeInput || '')}
                                onChange={e => handleCodeInputChange(idKey, 'parentCodeInput', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="dual-submit-bar">
                            <button
                              type="button"
                              className="btn-autofill-both"
                              onClick={() => {
                                handleAutoFill(idKey, 'wardenCodeInput', wardenCode);
                                handleAutoFill(idKey, 'parentCodeInput', parentCode);
                              }}
                            >
                              Auto-fill Both Codes (Testing Shortcut)
                            </button>

                            <button
                              type="button"
                              className="btn-submit-verify"
                              onClick={() => handleVerifyDualCodes(l)}
                            >
                              <CheckCircle2 size={16} strokeWidth={2.5} />
                              <span>Verify Required Codes & Approve Leave</span>
                            </button>
                          </div>

                          {cardCodeState.error && (
                            <div className="verification-error-msg">
                              <AlertCircle size={15} />
                              <span>{cardCodeState.error}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ==========================================================
                      APPROVED STATE: VERIFICATION RECEIPT
                      ========================================================== */}
                  {status === 'approved' && (
                    <div className="verification-approved-box">
                      <div className="approved-icon">
                        <CheckCircle2 size={22} strokeWidth={2.5} />
                      </div>
                      <div className="approved-content">
                        <div className="approved-title">
                          Leave Approved & Excused from Attendance
                        </div>
                        <div className="approved-details">
                          {isShortLeave ? (
                            <span>✓ Approved via Warden verification code entered by student.</span>
                          ) : (
                            <span>✓ Approved via Dual Verification (Both Warden & Parent codes verified).</span>
                          )}
                          {l.reviewed_at && (
                            <span className="approved-timestamp">
                              • Verified on {formatDateTime(l.reviewed_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-reset-pending"
                        onClick={() => handleResetToPending(l)}
                        title="Reset this leave to Pending to re-test verification process"
                      >
                        <RotateCcw size={13} />
                        <span>Reset to Pending (Test)</span>
                      </button>
                    </div>
                  )}

                  {/* ==========================================================
                      REJECTED STATE: REJECTION BANNER
                      ========================================================== */}
                  {status === 'rejected' && (
                    <div className="verification-rejected-box">
                      <div className="rejected-icon">
                        <XCircle size={22} strokeWidth={2.5} />
                      </div>
                      <div className="rejected-content">
                        <div className="rejected-title">Leave Request Denied</div>
                        <div className="rejected-details">
                          Student is not excused from attendance sessions.
                          {l.approval_remarks && <span> ({l.approval_remarks})</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-reopen-request"
                        onClick={() => handleResetToPending(l)}
                        title="Reopen request for verification"
                      >
                        <RotateCcw size={13} />
                        <span>Reopen Request</span>
                      </button>
                    </div>
                  )}

                  {/* Remarks Box if present */}
                  {l.approval_remarks && status !== 'rejected' && (
                    <div style={{
                      padding: '11px 16px',
                      borderRadius: '10px',
                      backgroundColor: status === 'approved' ? '#f0fdf4' : '#fffbeb',
                      border: `1px solid ${status === 'approved' ? '#bbf7d0' : '#fde68a'}`,
                      fontSize: '12.5px',
                      color: status === 'approved' ? '#166534' : '#92400e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Info size={16} />
                      <span><strong>Status Note:</strong> {l.approval_remarks}</span>
                    </div>
                  )}

                  {/* Action Footer in Card */}
                  <div className="card-action-footer">
                    <span style={{ marginRight: 'auto', fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                      Reviewed by: <strong style={{ color: '#475569' }}>{l.reviewed_by || 'Admin Portal'}</strong>
                    </span>

                    <div className="card-footer-buttons">
                      {status !== 'rejected' && (
                        <button
                          type="button"
                          className="btn-card-reject"
                          onClick={() => handleQuickStatusChange(l, 'rejected')}
                          title="Reject leave request"
                        >
                          <X size={14} strokeWidth={2.5} />
                          <span>Reject Request</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {trackingLeaves.length === 0 && (
              <HamsCard padding="36px" style={{ textAlign: 'center', color: '#94a3b8' }}>
                No leave requests found for the selected tracking criteria.
              </HamsCard>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          EDIT LEAVE MODAL (Edit Leave Details, Dates, Remarks)
          ===================================================================== */}
      {editModalOpen && editingLeave && (
        <div className="leaves-modal-backdrop">
          <div className="leaves-modal-card">
            <div className="modal-header-zone">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Edit3 size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="modal-title-text">
                    Edit Leave Details
                  </h3>
                  <p className="modal-subtitle-text">
                    Update timing, reason, and approval decision for {editingLeave.student_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="modal-close-icon"
                onClick={() => setEditModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-form-grid">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div className="form-group-field">
                  <label className="form-label-title">Student Full Name</label>
                  <input
                    type="text"
                    required
                    className="form-input-control"
                    value={editFormData.student_name}
                    onChange={e => setEditFormData({ ...editFormData, student_name: e.target.value })}
                  />
                </div>

                <div className="form-group-field">
                  <label className="form-label-title">Bank Code / Student ID</label>
                  <input
                    type="text"
                    required
                    className="form-input-control"
                    value={editFormData.bank_code}
                    onChange={e => setEditFormData({ ...editFormData, bank_code: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                <div className="form-group-field">
                  <label className="form-label-title">Floor</label>
                  <select
                    className="form-input-control"
                    value={editFormData.floor_id}
                    onChange={e => setEditFormData({ ...editFormData, floor_id: e.target.value })}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(fl => (
                      <option key={fl} value={String(fl)}>Floor {fl === 0 ? '0 (Ground)' : fl}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group-field">
                  <label className="form-label-title">Room Number</label>
                  <input
                    type="text"
                    className="form-input-control"
                    value={editFormData.room_number}
                    onChange={e => setEditFormData({ ...editFormData, room_number: e.target.value })}
                  />
                </div>

                <div className="form-group-field">
                  <label className="form-label-title">Student Phone</label>
                  <input
                    type="tel"
                    className="form-input-control"
                    value={editFormData.phone}
                    onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group-field">
                  <label className="form-label-title">Parent Phone</label>
                  <input
                    type="tel"
                    className="form-input-control"
                    value={editFormData.parent_phone}
                    onChange={e => setEditFormData({ ...editFormData, parent_phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div className="form-group-field">
                  <label className="form-label-title">Leave Start (From Date & Time) *</label>
                  <input
                    type="datetime-local"
                    required
                    className="form-input-control"
                    value={editFormData.start_time}
                    onChange={e => setEditFormData({ ...editFormData, start_time: e.target.value })}
                  />
                </div>

                <div className="form-group-field">
                  <label className="form-label-title">Leave End (To Date & Time) *</label>
                  <input
                    type="datetime-local"
                    required
                    className="form-input-control"
                    value={editFormData.end_time}
                    onChange={e => setEditFormData({ ...editFormData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group-field">
                <label className="form-label-title">Leave Reason / Purpose</label>
                <input
                  type="text"
                  className="form-input-control"
                  placeholder="e.g. Medical emergency, Family function"
                  value={editFormData.reason}
                  onChange={e => setEditFormData({ ...editFormData, reason: e.target.value })}
                />
              </div>

              {/* Approval Status Selector */}
              <div className="form-group-field">
                <label className="form-label-title">Leave Approval Status</label>
                <div className="status-toggles-grid">
                  <button
                    type="button"
                    className={`status-toggle-card ${editFormData.approval_status === 'approved' ? 'approved-active' : ''}`}
                    onClick={() => setEditFormData({ ...editFormData, approval_status: 'approved' })}
                  >
                    <CheckCircle2 size={22} color="#10b981" />
                    <span style={{ fontWeight: 800 }}>Approved</span>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>Excuses Attendance</small>
                  </button>

                  <button
                    type="button"
                    className={`status-toggle-card ${editFormData.approval_status === 'pending' ? 'pending-active' : ''}`}
                    onClick={() => setEditFormData({ ...editFormData, approval_status: 'pending' })}
                  >
                    <Clock size={22} color="#f59e0b" />
                    <span style={{ fontWeight: 800 }}>Pending</span>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>Code Verification</small>
                  </button>

                  <button
                    type="button"
                    className={`status-toggle-card ${editFormData.approval_status === 'rejected' ? 'rejected-active' : ''}`}
                    onClick={() => setEditFormData({ ...editFormData, approval_status: 'rejected' })}
                  >
                    <XCircle size={22} color="#ef4444" />
                    <span style={{ fontWeight: 800 }}>Rejected</span>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>Attendance Mandatory</small>
                  </button>
                </div>
              </div>

              <div className="form-group-field">
                <label className="form-label-title">Approval / Rejection Remarks</label>
                <textarea
                  rows={2}
                  className="form-input-control"
                  placeholder="Enter notes or reason for approval/rejection"
                  value={editFormData.approval_remarks}
                  onChange={e => setEditFormData({ ...editFormData, approval_remarks: e.target.value })}
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  onClick={() => handleDeleteLeave(editingLeave)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1.5px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Delete Leave
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    style={{
                      padding: '10px 22px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Status Guide / Info Modal */}
      {infoModalOpen && (
        <div className="leaves-modal-backdrop">
          <div className="leaves-modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header-zone">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Info size={20} />
                </div>
                <div>
                  <h3 className="modal-title-text">Leave Approval Policy</h3>
                  <p className="modal-subtitle-text">Understanding Verification Rules</p>
                </div>
              </div>
              <button onClick={() => setInfoModalOpen(false)} className="modal-close-icon">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                <strong style={{ color: '#5b21b6', fontSize: '13.5px' }}>⚡ Leave for 3 Days or Less</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#4c1d95' }}>
                  Verification code is sent to the warden. Once the warden provides the code to the student, the student enters it in the verification section to get the leave approved.
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
                <strong style={{ color: '#92400e', fontSize: '13.5px' }}>🛡️ Leave for More Than 3 Days</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#b45309' }}>
                  Verification codes are sent to both the warden and the parent. The leave is approved only after the required verification code(s) are entered.
                </p>
              </div>
            </div>

            <button
              onClick={() => setInfoModalOpen(false)}
              style={{
                width: '100%',
                marginTop: '18px',
                padding: '11px',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavesManagementView;
