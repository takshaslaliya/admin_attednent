import React, { useEffect, useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  UserPlus,
  UserMinus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Sparkles,
  Building2,
  Phone
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';

interface GroupItem {
  id: number;
  name: string;
  normalized_name: string;
  description: string | null;
  color: string;
  is_auto_synced: boolean;
  total_members: number;
  active_members: number;
  api_members: number;
  manual_members: number;
}

interface GroupMember {
  id: number;
  student_code: string;
  name: string;
  floor_id: number;
  floor_name?: string;
  room_number: string | null;
  phone_number: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  is_active: number | boolean;
  student_status?: string | null;
  api_group_name?: string | null;
  source: 'api' | 'manual' | string;
  assigned_at?: string;
}

interface StudentRow {
  id: number;
  student_id?: number;
  student_code: string;
  name: string;
  floor_id: number;
  room_number: string | null;
  phone_number: string | null;
  is_active: number | boolean;
  group_name?: string | null;
  groups?: Array<{ id: number; name: string; color: string }>;
}

const COLOR_SWATCHES = [
  '#4f46e5',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#14b8a6',
  '#6366f1'
];

export const GroupsManagementView: React.FC = () => {
  const { admin } = useAuth();
  const confirm = useConfirm();
  const isLeader = (admin?.role || '').toUpperCase() === 'LEADER' || (admin?.role || '').toLowerCase() === 'floor_leader';

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<(GroupItem & { members: GroupMember[] }) | null>(null);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [syncingApi, setSyncingApi] = useState(false);

  const [groupSearch, setGroupSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Batch Add Groups Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'multiple'>('single');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(COLOR_SWATCHES[0]);
  const [multiGroupRows, setMultiGroupRows] = useState<Array<{ name: string; description: string; color: string }>>([
    { name: '', description: '', color: COLOR_SWATCHES[0] },
    { name: '', description: '', color: COLOR_SWATCHES[1] },
    { name: '', description: '', color: COLOR_SWATCHES[2] }
  ]);
  const [savingGroup, setSavingGroup] = useState(false);

  // Edit Group Modal
  const [editGroup, setEditGroup] = useState<GroupItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState(COLOR_SWATCHES[0]);

  // Link Students Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentRow[]>([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const [studentPickerFloor, setStudentPickerFloor] = useState<string>('All');
  const [studentPickerStatus, setStudentPickerStatus] = useState<'active' | 'all'>('active');
  const [pickedStudentIds, setPickedStudentIds] = useState<number[]>([]);
  const [linkingStudents, setLinkingStudents] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(prev => (prev?.text === text ? null : prev)), 4500);
  };

  const fetchGroups = async (preserveSelection = true) => {
    setLoadingGroups(true);
    try {
      const res = await apiClient.get('/groups');
      if (res.data?.success && Array.isArray(res.data.data)) {
        const list: GroupItem[] = res.data.data;
        setGroups(list);
        if (list.length > 0) {
          if (!preserveSelection || !selectedGroupId || !list.some(g => g.id === selectedGroupId)) {
            setSelectedGroupId(list[0].id);
          }
        } else {
          setSelectedGroupId(null);
          setSelectedGroupDetail(null);
        }
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchGroupDetail = async (groupId: number) => {
    setLoadingMembers(true);
    setSelectedMemberIds([]);
    try {
      const res = await apiClient.get(`/groups/${groupId}`);
      if (res.data?.success && res.data.data) {
        setSelectedGroupDetail(res.data.data);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to load group members');
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchGroups(false);
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupDetail(selectedGroupId);
    }
  }, [selectedGroupId]);

  const handleSyncFromApi = async () => {
    setSyncingApi(true);
    try {
      const res = await apiClient.post('/groups/sync-from-api');
      if (res.data?.success) {
        showToast('success', res.data.message || 'Synced students and auto-linked API groups successfully!');
        await fetchGroups(true);
        if (selectedGroupId) await fetchGroupDetail(selectedGroupId);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'API sync failed');
    } finally {
      setSyncingApi(false);
    }
  };

  const handleCreateGroups = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGroup(true);
    try {
      let payload: any;
      if (addMode === 'single') {
        if (!newGroupName.trim()) {
          showToast('error', 'Please enter a group name.');
          setSavingGroup(false);
          return;
        }
        payload = {
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || undefined,
          color: newGroupColor
        };
      } else {
        const validRows = multiGroupRows
          .map(r => ({
            name: r.name.trim(),
            description: r.description.trim() || undefined,
            color: r.color
          }))
          .filter(r => r.name.length > 0);

        if (validRows.length === 0) {
          showToast('error', 'Please enter at least one group name.');
          setSavingGroup(false);
          return;
        }
        payload = { groups: validRows };
      }

      const res = await apiClient.post('/groups', payload);
      if (res.data?.success) {
        showToast('success', res.data.message || 'Group(s) created successfully!');
        setAddModalOpen(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setMultiGroupRows([
          { name: '', description: '', color: COLOR_SWATCHES[0] },
          { name: '', description: '', color: COLOR_SWATCHES[1] },
          { name: '', description: '', color: COLOR_SWATCHES[2] }
        ]);
        const createdFirstId = Array.isArray(res.data.created) && res.data.created.length > 0
          ? res.data.created[0].id
          : res.data.data?.id;
        await fetchGroups(false);
        if (createdFirstId) setSelectedGroupId(createdFirstId);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to create group');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleOpenEdit = (g: GroupItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditGroup(g);
    setEditName(g.name);
    setEditDesc(g.description || '');
    setEditColor(g.color || COLOR_SWATCHES[0]);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroup || !editName.trim()) return;
    setSavingGroup(true);
    try {
      const res = await apiClient.put(`/groups/${editGroup.id}`, {
        name: editName.trim(),
        description: editDesc.trim(),
        color: editColor
      });
      if (res.data?.success) {
        showToast('success', `Group "${editName.trim()}" updated!`);
        setEditGroup(null);
        await fetchGroups(true);
        if (selectedGroupId === editGroup.id) {
          await fetchGroupDetail(editGroup.id);
        }
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to update group');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (g: GroupItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: `Delete Group "${g.name}"?`,
      message: `This will remove the group "${g.name}" and unlink its ${g.total_members} student(s). Student profiles themselves will NOT be deleted.`,
      confirmText: 'Delete Group',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const res = await apiClient.delete(`/groups/${g.id}`);
      if (res.data?.success) {
        showToast('success', res.data.message || 'Group deleted');
        if (selectedGroupId === g.id) setSelectedGroupId(null);
        await fetchGroups(false);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to delete group');
    }
  };

  const openLinkStudentsModal = async () => {
    if (!selectedGroupId) return;
    setLinkModalOpen(true);
    setPickedStudentIds([]);
    setStudentPickerSearch('');
    setStudentPickerFloor('All');
    setStudentPickerStatus('active');
    setLoadingAllStudents(true);
    try {
      const res = await apiClient.get('/students?status=all');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAllStudents(res.data.data);
      }
    } catch (err: any) {
      showToast('error', 'Failed to load students list');
    } finally {
      setLoadingAllStudents(false);
    }
  };

  const handleLinkPickedStudents = async () => {
    if (!selectedGroupId || pickedStudentIds.length === 0) return;
    setLinkingStudents(true);
    try {
      const res = await apiClient.post(`/groups/${selectedGroupId}/students`, {
        student_ids: pickedStudentIds
      });
      if (res.data?.success) {
        showToast('success', res.data.message || 'Students linked to group!');
        setLinkModalOpen(false);
        setPickedStudentIds([]);
        await fetchGroups(true);
        await fetchGroupDetail(selectedGroupId);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to link students');
    } finally {
      setLinkingStudents(false);
    }
  };

  const handleUnlinkStudent = async (member: GroupMember) => {
    if (!selectedGroupId) return;
    const ok = await confirm({
      title: 'Unlink Student from Group?',
      message: `Remove ${member.name} (${member.student_code}) from "${selectedGroupDetail?.name}"?`,
      confirmText: 'Unlink',
      type: 'warning'
    });
    if (!ok) return;

    try {
      const res = await apiClient.delete(`/groups/${selectedGroupId}/students/${member.id}`);
      if (res.data?.success) {
        showToast('success', `${member.name} unlinked from group.`);
        await fetchGroups(true);
        await fetchGroupDetail(selectedGroupId);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Failed to unlink student');
    }
  };

  const handleBulkUnlink = async () => {
    if (!selectedGroupId || selectedMemberIds.length === 0) return;
    const ok = await confirm({
      title: `Unlink ${selectedMemberIds.length} Student(s)?`,
      message: `Remove ${selectedMemberIds.length} selected student(s) from "${selectedGroupDetail?.name}"?`,
      confirmText: 'Unlink Selected',
      type: 'warning'
    });
    if (!ok) return;

    try {
      const res = await apiClient.post(`/groups/${selectedGroupId}/students/bulk-unlink`, {
        student_ids: selectedMemberIds
      });
      if (res.data?.success) {
        showToast('success', res.data.message || 'Selected students unlinked.');
        setSelectedMemberIds([]);
        await fetchGroups(true);
        await fetchGroupDetail(selectedGroupId);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || 'Bulk unlink failed');
    }
  };

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    );
  }, [groups, groupSearch]);

  const filteredMembers = useMemo(() => {
    const members = selectedGroupDetail?.members || [];
    const q = memberSearch.trim().toLowerCase();
    return members.filter(m => {
      if (memberStatusFilter === 'active' && !m.is_active) return false;
      if (memberStatusFilter === 'inactive' && m.is_active) return false;
      if (!q) return true;
      return (
        (m.name || '').toLowerCase().includes(q) ||
        (m.student_code || '').toLowerCase().includes(q) ||
        (m.room_number || '').toLowerCase().includes(q) ||
        (m.phone_number || '').toLowerCase().includes(q)
      );
    });
  }, [selectedGroupDetail, memberSearch, memberStatusFilter]);

  const alreadyLinkedSet = useMemo(() => {
    return new Set((selectedGroupDetail?.members || []).map(m => m.id));
  }, [selectedGroupDetail]);

  const pickerFloors = useMemo(() => {
    const set = new Set<number>();
    for (const s of allStudents) {
      if (s.floor_id !== undefined && s.floor_id !== null) set.add(Number(s.floor_id));
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [allStudents]);

  const filteredPickerStudents = useMemo(() => {
    const q = studentPickerSearch.trim().toLowerCase();
    return allStudents.filter(s => {
      if (studentPickerStatus === 'active' && !s.is_active) return false;
      if (studentPickerFloor !== 'All' && String(s.floor_id) !== studentPickerFloor) return false;
      if (!q) return true;
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.student_code || '').toLowerCase().includes(q) ||
        (s.room_number || '').toLowerCase().includes(q) ||
        (s.phone_number || '').toLowerCase().includes(q)
      );
    });
  }, [allStudents, studentPickerSearch, studentPickerFloor, studentPickerStatus]);

  const totalMembersAcrossGroups = groups.reduce((acc, g) => acc + g.total_members, 0);
  const activeMembersAcrossGroups = groups.reduce((acc, g) => acc + g.active_members, 0);
  const autoSyncedCount = groups.filter(g => g.is_auto_synced).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${toast.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: toast.type === 'success' ? '#065f46' : '#991b1b',
            fontWeight: 600,
            fontSize: '13px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toast.text}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Action Bar & KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Groups</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{groups.length}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{autoSyncedCount} auto-synced from API</div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Linked Students</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{activeMembersAcrossGroups}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{totalMembersAcrossGroups} total links (incl. alumni)</div>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {!isLeader && (
              <>
                <button
                  onClick={() => {
                    setAddMode('single');
                    setAddModalOpen(true);
                  }}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={16} />
                  Add Group(s)
                </button>
                <button
                  onClick={handleSyncFromApi}
                  disabled={syncingApi}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: syncingApi ? 'not-allowed' : 'pointer',
                    opacity: syncingApi ? 0.7 : 1
                  }}
                >
                  <RefreshCw size={15} className={syncingApi ? 'spin' : ''} />
                  {syncingApi ? 'Syncing...' : 'Sync API Groups'}
                </button>
              </>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Students with a <code>groupName</code> in the API are automatically linked to their group by default.
          </div>
        </div>
      </div>

      {/* Main Split View: Groups List (Left) + Linked Students (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(290px, 360px) 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left: Groups Directory */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>All Student Groups</h3>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{filteredGroups.length}</span>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
                placeholder="Search groups..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: '620px', overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loadingGroups ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading groups...</div>
            ) : filteredGroups.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No groups found. Click <strong>Add Group(s)</strong> or <strong>Sync API Groups</strong> to get started.
              </div>
            ) : (
              filteredGroups.map(g => {
                const isSelected = g.id === selectedGroupId;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1.5px solid ${isSelected ? (g.color || '#4f46e5') : '#e2e8f0'}`,
                      backgroundColor: isSelected ? `${g.color || '#4f46e5'}0d` : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: g.color || '#4f46e5',
                            flexShrink: 0
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{g.name}</span>
                            {g.is_auto_synced && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '999px',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe'
                              }}>
                                API Sync
                              </span>
                            )}
                          </div>
                          {g.description && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {g.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {!isLeader && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button
                            onClick={e => handleOpenEdit(g, e)}
                            title="Edit Group"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={e => handleDeleteGroup(g, e)}
                            title="Delete Group"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px', fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                      <span style={{ color: '#059669' }}>{g.active_members} Active</span>
                      <span>•</span>
                      <span>{g.total_members} Total</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Group Members & Linking */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: '500px' }}>
          {!selectedGroupDetail ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#94a3b8' }}>
              <Layers size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569' }}>Select a Group to View &amp; Manage Students</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Choose a group from the left panel or create new groups.</div>
            </div>
          ) : (
            <>
              {/* Group Detail Header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundColor: `${selectedGroupDetail.color || '#4f46e5'}18`,
                      color: selectedGroupDetail.color || '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '18px'
                    }}
                  >
                    {selectedGroupDetail.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{selectedGroupDetail.name}</h3>
                      {selectedGroupDetail.is_auto_synced && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                          API Auto-Linked
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {selectedGroupDetail.description || 'Manage students linked with this group'}
                    </div>
                  </div>
                </div>

                {!isLeader && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedMemberIds.length > 0 && (
                      <button
                        onClick={handleBulkUnlink}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '9px 14px',
                          borderRadius: '10px',
                          border: '1px solid #fecaca',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        <UserMinus size={15} />
                        Unlink ({selectedMemberIds.length})
                      </button>
                    )}
                    <button
                      onClick={openLinkStudentsModal}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#4f46e5',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <UserPlus size={15} />
                      Link Students
                    </button>
                  </div>
                )}
              </div>

              {/* Filter Bar for Members */}
              <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '380px' }}>
                  <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="Search linked student by name, ID, room..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {(['active', 'all', 'inactive'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => setMemberStatusFilter(st)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: memberStatusFilter === st ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                        backgroundColor: memberStatusFilter === st ? '#eef2ff' : '#ffffff',
                        color: memberStatusFilter === st ? '#4f46e5' : '#475569',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {st === 'active' ? 'Active Hostel' : st === 'inactive' ? 'Alumni / Left' : 'All'}
                    </button>
                  ))}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginLeft: '6px' }}>
                    Showing {filteredMembers.length}
                  </span>
                </div>
              </div>

              {/* Members List */}
              <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                {loadingMembers ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading linked students...</div>
                ) : filteredMembers.length === 0 ? (
                  <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No students found in this view. Click <strong>Link Students</strong> to assign students to this group.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                        {!isLeader && (
                          <th style={{ padding: '10px 16px', width: '36px' }}>
                            <input
                              type="checkbox"
                              checked={filteredMembers.length > 0 && filteredMembers.every(m => selectedMemberIds.includes(m.id))}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedMemberIds(filteredMembers.map(m => m.id));
                                } else {
                                  setSelectedMemberIds([]);
                                }
                              }}
                            />
                          </th>
                        )}
                        <th style={{ padding: '10px 12px' }}>Student</th>
                        <th style={{ padding: '10px 12px' }}>Room / Floor</th>
                        <th style={{ padding: '10px 12px' }}>Phone</th>
                        <th style={{ padding: '10px 12px' }}>Link Source</th>
                        {!isLeader && <th style={{ padding: '10px 16px', textAlign: 'right' }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {!isLeader && (
                            <td style={{ padding: '10px 16px' }}>
                              <input
                                type="checkbox"
                                checked={selectedMemberIds.includes(m.id)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedMemberIds(prev => [...prev, m.id]);
                                  } else {
                                    setSelectedMemberIds(prev => prev.filter(id => id !== m.id));
                                  }
                                }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>ID: {m.student_code}</span>
                              {!m.is_active && (
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>
                                  {m.student_status || 'Inactive'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Building2 size={13} color="#64748b" />
                              <span>{m.room_number ? `Room ${m.room_number} (F${m.floor_id})` : 'Unassigned'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} color="#64748b" />
                              <span>{m.phone_number || 'N/A'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              backgroundColor: m.source === 'api' ? '#eff6ff' : '#f3e8ff',
                              color: m.source === 'api' ? '#2563eb' : '#7e22ce'
                            }}>
                              {m.source === 'api' ? 'API Default' : 'Manual'}
                            </span>
                          </td>
                          {!isLeader && (
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleUnlinkStudent(m)}
                                title="Unlink from group"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid #fecaca',
                                  backgroundColor: '#ffffff',
                                  color: '#dc2626',
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                <UserMinus size={13} />
                                Unlink
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ADD SINGLE / MULTIPLE GROUPS MODAL */}
      {addModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={20} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>Add Student Group(s)</h3>
              </div>
              <button onClick={() => setAddModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateGroups} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Mode Switcher */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAddMode('single')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    backgroundColor: addMode === 'single' ? '#ffffff' : 'transparent',
                    color: addMode === 'single' ? '#4f46e5' : '#64748b',
                    boxShadow: addMode === 'single' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Single Group
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('multiple')}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    backgroundColor: addMode === 'multiple' ? '#ffffff' : 'transparent',
                    color: addMode === 'multiple' ? '#4f46e5' : '#64748b',
                    boxShadow: addMode === 'multiple' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Add Multiple Groups
                </button>
              </div>

              {addMode === 'single' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Group Name *</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="e.g. Pavitra, Param, Sports Team..."
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Description (Optional)</label>
                    <input
                      type="text"
                      value={newGroupDesc}
                      onChange={e => setNewGroupDesc(e.target.value)}
                      placeholder="Short note about this group..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Badge Color</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {COLOR_SWATCHES.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewGroupColor(c)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: c,
                            border: newGroupColor === c ? '3px solid #0f172a' : '2px solid transparent',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Add multiple groups at once. Any existing students matching the group name from the Student API will be auto-linked immediately.
                  </div>
                  {multiGroupRows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={row.color}
                        onChange={e => {
                          const updated = [...multiGroupRows];
                          updated[idx].color = e.target.value;
                          setMultiGroupRows(updated);
                        }}
                        style={{ width: '34px', height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2px', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => {
                          const updated = [...multiGroupRows];
                          updated[idx].name = e.target.value;
                          setMultiGroupRows(updated);
                        }}
                        placeholder={`Group #${idx + 1} name`}
                        style={{ flex: 1, padding: '9px 11px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      <input
                        type="text"
                        value={row.description}
                        onChange={e => {
                          const updated = [...multiGroupRows];
                          updated[idx].description = e.target.value;
                          setMultiGroupRows(updated);
                        }}
                        placeholder="Description (optional)"
                        style={{ flex: 1, padding: '9px 11px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      {multiGroupRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMultiGroupRows(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setMultiGroupRows(prev => [
                        ...prev,
                        { name: '', description: '', color: COLOR_SWATCHES[prev.length % COLOR_SWATCHES.length] }
                      ])
                    }
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px dashed #6366f1',
                      backgroundColor: '#eef2ff',
                      color: '#4f46e5',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} /> Add Another Row
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', opacity: savingGroup ? 0.7 : 1 }}
                >
                  {savingGroup ? 'Saving...' : addMode === 'single' ? 'Create Group' : 'Create All Groups'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GROUP MODAL */}
      {editGroup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Edit Group</h3>
              <button onClick={() => setEditGroup(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Group Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Badge Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {COLOR_SWATCHES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: editColor === c ? '3px solid #0f172a' : '2px solid transparent',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button type="button" onClick={() => setEditGroup(null)} style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={savingGroup} style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#4f46e5', color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                  {savingGroup ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINK STUDENTS TO GROUP MODAL */}
      {linkModalOpen && selectedGroupDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '680px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Link Students to "{selectedGroupDetail.name}"
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Select one or multiple students to assign to this group
                </div>
              </div>
              <button onClick={() => setLinkModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Picker Filter Bar */}
            <div style={{ padding: '14px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 220px' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={studentPickerSearch}
                  onChange={e => setStudentPickerSearch(e.target.value)}
                  placeholder="Search by name, bank code, room, phone..."
                  style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '9px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <select
                value={studentPickerFloor}
                onChange={e => setStudentPickerFloor(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '9px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px' }}
              >
                <option value="All">All Floors</option>
                {pickerFloors.map(f => (
                  <option key={f} value={String(f)}>{f === 0 ? 'Ground / Unassigned' : `Floor ${f}`}</option>
                ))}
              </select>

              <select
                value={studentPickerStatus}
                onChange={e => setStudentPickerStatus(e.target.value as 'active' | 'all')}
                style={{ padding: '8px 10px', borderRadius: '9px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px' }}
              >
                <option value="active">Active Hostel Students</option>
                <option value="all">All Students (Incl. Alumni)</option>
              </select>
            </div>

            {/* Select All Helper */}
            <div style={{ padding: '8px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#475569' }}>
              <span>Showing {filteredPickerStudents.length} student(s) • <strong>{pickedStudentIds.length}</strong> selected</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const selectable = filteredPickerStudents
                      .filter(s => !alreadyLinkedSet.has(s.id))
                      .map(s => s.id);
                    setPickedStudentIds(Array.from(new Set([...pickedStudentIds, ...selectable])));
                  }}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                >
                  Select All Visible
                </button>
                {pickedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPickedStudentIds([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            {/* Student Picker List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {loadingAllStudents ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading students...</div>
              ) : filteredPickerStudents.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No matching students found.</div>
              ) : (
                filteredPickerStudents.slice(0, 250).map(s => {
                  const isLinked = alreadyLinkedSet.has(s.id);
                  const isChecked = pickedStudentIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (isLinked) return;
                        setPickedStudentIds(prev =>
                          prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                        );
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1px solid ${isChecked ? '#4f46e5' : '#e2e8f0'}`,
                        backgroundColor: isLinked ? '#f8fafc' : isChecked ? '#eef2ff' : '#ffffff',
                        opacity: isLinked ? 0.65 : 1,
                        cursor: isLinked ? 'default' : 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '5px',
                            border: `1.5px solid ${isChecked || isLinked ? '#4f46e5' : '#cbd5e1'}`,
                            backgroundColor: isChecked || isLinked ? '#4f46e5' : '#ffffff',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {(isChecked || isLinked) && <Check size={12} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{s.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            ID: {s.student_code} • {s.room_number ? `Room ${s.room_number} (F${s.floor_id})` : 'No Room'} {s.phone_number ? `• ${s.phone_number}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {isLinked ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '999px' }}>
                            Already Linked
                          </span>
                        ) : s.group_name ? (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 7px', borderRadius: '999px' }}>
                            API: {s.group_name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
              {filteredPickerStudents.length > 250 && (
                <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', padding: '8px' }}>
                  Showing first 250 matches — use search or floor filter to narrow down.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pickedStudentIds.length === 0 || linkingStudents}
                onClick={handleLinkPickedStudents}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: pickedStudentIds.length === 0 || linkingStudents ? 'not-allowed' : 'pointer',
                  opacity: pickedStudentIds.length === 0 || linkingStudents ? 0.6 : 1
                }}
              >
                {linkingStudents ? 'Linking...' : `Link ${pickedStudentIds.length} Student${pickedStudentIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
