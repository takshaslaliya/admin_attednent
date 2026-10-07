import React, { useEffect, useState } from 'react';
import { 
  KeyRound, 
  Plus, 
  Search, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  Clock, 
  Layers, 
  Users, 
  Eye, 
  Tv, 
  Sparkles,
  ExternalLink,
  Copy
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { HamsCard } from '../../components/HamsCard';

interface SessionDetail {
  session_key: string;
  session_name: string;
  icon_name?: string;
  start_time?: string;
  end_time?: string;
}

interface ViewerCredential {
  id: number;
  access_number: string;
  name: string;
  assigned_sessions: string[];
  assigned_floors: string[];
  session_details: SessionDetail[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const SessionViewerCredentialsView: React.FC = () => {
  const [credentials, setCredentials] = useState<ViewerCredential[]>([]);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<ViewerCredential | null>(null);
  const [formNumber, setFormNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formSessions, setFormSessions] = useState<string[]>([]);
  const [formFloors, setFormFloors] = useState<string[]>(['all']);
  const [formActive, setFormActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Number availability check state
  const [checkingNumber, setCheckingNumber] = useState(false);
  const [numberStatus, setNumberStatus] = useState<{ available: boolean; message?: string } | null>(null);

  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; cred: ViewerCredential | null }>({
    isOpen: false,
    cred: null
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [credRes, sessRes, floorRes] = await Promise.all([
        apiClient.get('/viewer-credentials').catch(() => ({ data: { success: true, data: [] } })),
        apiClient.get('/admin/sessions').catch(() => ({ data: { success: true, data: [] } })),
        apiClient.get('/floors').catch(() => ({ data: { success: true, data: [] } }))
      ]);

      if (credRes.data?.success) {
        setCredentials(credRes.data.data || []);
      }
      if (sessRes.data?.success) {
        setAvailableSessions(sessRes.data.data || []);
      }
      if (floorRes.data?.success) {
        setFloors(floorRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load viewer credentials', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Debounced check on access number
  useEffect(() => {
    if (!modalOpen || !formNumber.trim()) {
      setNumberStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingNumber(true);
      try {
        const excludeId = editingCred ? editingCred.id : 0;
        const res = await apiClient.get(`/viewer-credentials/check-number?number=${encodeURIComponent(formNumber.trim())}&exclude_id=${excludeId}`);
        setNumberStatus(res.data);
      } catch (err) {
        setNumberStatus(null);
      } finally {
        setCheckingNumber(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formNumber, modalOpen, editingCred]);

  const openCreateModal = () => {
    setEditingCred(null);
    setFormNumber('');
    setFormName('');
    setFormSessions(availableSessions.length > 0 ? [availableSessions[0].session_key] : ['night']);
    setFormFloors(['all']);
    setFormActive(true);
    setModalError('');
    setNumberStatus(null);
    setModalOpen(true);
  };

  const openEditModal = (cred: ViewerCredential) => {
    setEditingCred(cred);
    setFormNumber(cred.access_number);
    setFormName(cred.name);
    setFormSessions(cred.assigned_sessions || []);
    setFormFloors(cred.assigned_floors || ['all']);
    setFormActive(cred.is_active);
    setModalError('');
    setNumberStatus(null);
    setModalOpen(true);
  };

  const toggleSession = (key: string) => {
    if (key === 'all') {
      setFormSessions(['all']);
      return;
    }
    setFormSessions(prev => {
      let filtered = prev.filter(k => k !== 'all');
      if (filtered.includes(key)) {
        filtered = filtered.filter(k => k !== key);
        return filtered.length === 0 ? [key] : filtered;
      } else {
        return [...filtered, key];
      }
    });
  };

  const toggleFloor = (fl: string) => {
    if (fl === 'all') {
      setFormFloors(['all']);
      return;
    }
    setFormFloors(prev => {
      let filtered = prev.filter(f => f !== 'all');
      if (filtered.includes(fl)) {
        filtered = filtered.filter(f => f !== fl);
        return filtered.length === 0 ? ['all'] : filtered;
      } else {
        return [...filtered, fl];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!formNumber.trim()) {
      setModalError('Please enter an access number.');
      return;
    }

    if (numberStatus && !numberStatus.available) {
      setModalError(numberStatus.message || 'This number is already in use by a student or another user.');
      return;
    }

    if (formSessions.length === 0) {
      setModalError('Please select at least one session.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        access_number: formNumber.trim(),
        name: formName.trim() || `Viewer ${formNumber.trim()}`,
        assigned_sessions: formSessions,
        assigned_floors: formFloors,
        is_active: formActive
      };

      if (editingCred) {
        await apiClient.put(`/viewer-credentials/${editingCred.id}`, payload);
      } else {
        await apiClient.post('/viewer-credentials', payload);
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to save credential');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.cred) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/viewer-credentials/${deleteModal.cred.id}`);
      setDeleteModal({ isOpen: false, cred: null });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete credential');
    } finally {
      setDeleting(false);
    }
  };

  const copyLoginNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    alert(`Access number "${num}" copied to clipboard! Enter this number on the User Portal (https://users.hpys.in) to view live attendance.`);
  };

  // Filter credentials list
  const filteredCredentials = credentials.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.access_number.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.assigned_sessions.some(s => s.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner / Actions */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KeyRound size={26} color="#4f46e5" />
            Session Viewer Credentials
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Assign dedicated access numbers to display live attendance strictly for selected sessions on TV screens, monitors, or student devices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontWeight: 600,
              fontSize: '13px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={openCreateModal}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
            }}
          >
            <Plus size={16} />
            + Add Access Number
          </button>
        </div>
      </div>

      {/* Info Card */}
      <HamsCard padding="18px">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tv size={20} color="#4f46e5" />
          </div>
          <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
            <strong style={{ color: '#1e293b' }}>How it works:</strong> Assign any unique number (e.g. <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#4f46e5', fontWeight: 700 }}>9901</code>) that is not used as a student ID. When someone types this number on <a href="https://users.hpys.in" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}>users.hpys.in</a>, they will immediately see the <strong>Live Attendance</strong> screen exclusively for the selected session(s) once active!
          </div>
        </div>
      </HamsCard>

      {/* Search Bar */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          placeholder="Search by number, label name, or session..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px 10px 36px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
      </div>

      {/* Credentials Grid / Cards */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', color: '#4f46e5' }} />
          Loading viewer credentials...
        </div>
      ) : filteredCredentials.length === 0 ? (
        <HamsCard padding="40px">
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <KeyRound size={48} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#1e293b' }}>No Viewer Credentials Found</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px' }}>
              {searchQuery ? 'No credentials match your search query.' : 'Click "+ Add Access Number" to create your first session-specific viewer number.'}
            </p>
            {!searchQuery && (
              <button
                onClick={openCreateModal}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                + Add Access Number
              </button>
            )}
          </div>
        </HamsCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredCredentials.map(c => (
            <HamsCard key={c.id} padding="20px">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  {/* Top Row: Number Badge & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '6px 14px',
                        backgroundColor: '#eef2ff',
                        color: '#4338ca',
                        border: '1.5px solid #c7d2fe',
                        borderRadius: '10px',
                        fontSize: '18px',
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        letterSpacing: '0.05em'
                      }}>
                        {c.access_number}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: c.is_active ? '#ecfdf5' : '#fef2f2',
                        color: c.is_active ? '#065f46' : '#991b1b',
                        border: `1px solid ${c.is_active ? '#a7f3d0' : '#fecaca'}`
                      }}>
                        {c.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => copyLoginNumber(c.access_number)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                        title="Copy Number"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          color: '#3b82f6',
                          cursor: 'pointer'
                        }}
                        title="Edit Credential"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, cred: c })}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          border: '1px solid #fee2e2',
                          backgroundColor: '#fef2f2',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                        title="Delete Credential"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Name / Label */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                      {c.name}
                    </div>
                  </div>

                  {/* Allowed Sessions */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Allowed Session Live Attendance:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {c.assigned_sessions.includes('all') ? (
                        <span style={{
                          padding: '4px 10px',
                          backgroundColor: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700
                        }}>
                          🌟 All Sessions
                        </span>
                      ) : (
                        c.session_details.map(s => (
                          <span
                            key={s.session_key}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700
                            }}
                          >
                            <Clock size={12} />
                            {s.session_name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Allowed Floors */}
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Allowed Floors:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {c.assigned_floors.includes('all') ? (
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>All Floors (Hostel-wide)</span>
                      ) : (
                        c.assigned_floors.map(f => (
                          <span
                            key={f}
                            style={{
                              padding: '2px 8px',
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            Floor {f}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div style={{
                  paddingTop: '10px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#94a3b8'
                }}>
                  <span>Created {new Date(c.created_at).toLocaleDateString()}</span>
                  <a
                    href={`https://users.hpys.in`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#4f46e5',
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    Open Portal <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </HamsCard>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    {editingCred ? 'Edit Viewer Credential' : 'Add New Access Number'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Assign a unique number and select allowed attendance sessions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {modalError && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '10px',
                  color: '#ef4444',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Access Number Input with Live Conflict Checking */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Unique Access Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="e.g. 9901, 7777, 8080"
                    value={formNumber}
                    onChange={e => setFormNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${numberStatus ? (numberStatus.available ? '#10b981' : '#ef4444') : '#cbd5e1'}`,
                      fontSize: '15px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  {checkingNumber && (
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#64748b' }}>
                      Checking...
                    </span>
                  )}
                </div>

                {/* Validation Status Message */}
                {numberStatus && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: numberStatus.available ? '#059669' : '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {numberStatus.available ? (
                      <>
                        <Check size={14} /> Number is unique and available.
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} /> {numberStatus.message}
                      </>
                    )}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  💡 This number must not be already registered as a student ID.
                </div>
              </div>

              {/* Friendly Name / Label */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Label Name / Purpose <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aarti Live TV Screen, Assembly Hall Monitor"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* SELECT SESSIONS */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    Select Allowed Sessions <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSession('all')}
                    style={{
                      background: formSessions.includes('all') ? '#ecfdf5' : '#f1f5f9',
                      border: formSessions.includes('all') ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: formSessions.includes('all') ? '#047857' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    All Sessions
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '8px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  padding: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px'
                }}>
                  <div
                    onClick={() => toggleSession('all')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: formSessions.includes('all') ? '#ecfdf5' : '#ffffff',
                      border: formSessions.includes('all') ? '2px solid #10b981' : '1px solid #e2e8f0',
                      color: formSessions.includes('all') ? '#047857' : '#475569',
                      fontWeight: formSessions.includes('all') ? 700 : 500,
                      fontSize: '12px'
                    }}
                  >
                    <span>🌟 All Sessions</span>
                    {formSessions.includes('all') && <Check size={14} color="#10b981" />}
                  </div>

                  {availableSessions.map(sess => {
                    const isSelected = !formSessions.includes('all') && formSessions.includes(sess.session_key);
                    return (
                      <div
                        key={sess.session_key}
                        onClick={() => toggleSession(sess.session_key)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
                          border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                          color: isSelected ? '#4338ca' : '#475569',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '12px'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sess.session_name}
                        </span>
                        {isSelected && <Check size={14} color="#4f46e5" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SELECT FLOORS */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    Select Allowed Floors
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleFloor('all')}
                    style={{
                      background: formFloors.includes('all') ? '#ecfdf5' : '#f1f5f9',
                      border: formFloors.includes('all') ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: formFloors.includes('all') ? '#047857' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    All Floors
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: '6px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px'
                }}>
                  <div
                    onClick={() => toggleFloor('all')}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: formFloors.includes('all') ? '#ecfdf5' : '#ffffff',
                      border: formFloors.includes('all') ? '2px solid #10b981' : '1px solid #e2e8f0',
                      color: formFloors.includes('all') ? '#047857' : '#475569',
                      fontWeight: formFloors.includes('all') ? 700 : 500,
                      fontSize: '11px'
                    }}
                  >
                    <span>All Floors</span>
                    {formFloors.includes('all') && <Check size={12} color="#10b981" />}
                  </div>

                  {floors.map(f => {
                    const fid = String(f.floor_id);
                    const isSelected = !formFloors.includes('all') && formFloors.includes(fid);
                    return (
                      <div
                        key={`modal_fl_${fid}`}
                        onClick={() => toggleFloor(fid)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isSelected ? '#eef2ff' : '#ffffff',
                          border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                          color: isSelected ? '#4338ca' : '#475569',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '11px'
                        }}
                      >
                        <span>Floor {fid}</span>
                        {isSelected && <Check size={12} color="#4f46e5" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Switch */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Active Status</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Allow users to log in with this access number immediately.</div>
                </div>
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={e => setFormActive(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (numberStatus !== null && !numberStatus.available)}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: (numberStatus !== null && !numberStatus.available) ? '#94a3b8' : '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: (submitting || (numberStatus !== null && !numberStatus.available)) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                  }}
                >
                  {submitting ? 'Saving...' : (editingCred ? 'Update Credential' : 'Create Access Number')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && deleteModal.cred && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>Delete Access Number</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Are you sure you want to delete access number <strong>{deleteModal.cred.access_number}</strong> ({deleteModal.cred.name})?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setDeleteModal({ isOpen: false, cred: null })}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
