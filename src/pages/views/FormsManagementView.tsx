import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  BarChart3, 
  Users, 
  Trash2, 
  Edit3, 
  Power, 
  X, 
  Download, 
  MessageSquare, 
  Sparkles, 
  Vote, 
  HelpCircle,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Layers,
  Star
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useConfirm } from '../../context/ConfirmContext';
import './FormsManagementView.css';

interface FormField {
  id: string;
  label: string;
  type: 'radio' | 'checkbox' | 'boolean' | 'text' | 'textarea' | 'rating';
  options?: string[];
  required?: boolean;
}

interface FormItem {
  id: number;
  title: string;
  description?: string;
  form_type: 'poll' | 'form';
  fields: FormField[];
  target_audience: 'all' | 'current' | 'alumni' | 'selected' | 'students' | 'floors';
  target_student_ids?: number[];
  target_floors?: any[];
  target_tags?: number[];
  start_time: string;
  end_time: string;
  is_active: boolean;
  is_mandatory: boolean;
  total_targeted: number;
  total_viewed: number;
  total_responded: number;
  seen_not_answered: number;
  status: 'active' | 'upcoming' | 'expired' | 'disabled';
  created_at: string;
}

export const FormsManagementView: React.FC = () => {
  const { showConfirm } = useConfirm();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'poll' | 'form' | 'expired'>('all');

  // Create / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFormId, setEditingFormId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<'poll' | 'form'>('poll');
  const [isMandatory, setIsMandatory] = useState(false);
  const [targetAudience, setTargetAudience] = useState<'all' | 'current' | 'alumni' | 'selected' | 'students' | 'floors'>('all');
  const [targetFloors, setTargetFloors] = useState<string[]>([]);
  const [targetStudentIds, setTargetStudentIds] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Student directory & search states
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearchText, setStudentSearchText] = useState('');
  const [studentFloorFilter, setStudentFloorFilter] = useState<string>('all');

  // Analytics Modal State
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [selectedAnalytics, setSelectedAnalytics] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<'charts' | 'responses' | 'seen' | 'pending'>('charts');
  const [responseSearch, setResponseSearch] = useState('');

  // Auxiliary floor options
  const [availableFloors, setAvailableFloors] = useState<any[]>([]);

  useEffect(() => {
    fetchForms();
    fetchFloors();
    fetchStudents();
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/forms');
      if (res.data.success && Array.isArray(res.data.data)) {
        setForms(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load forms:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFloors = async () => {
    try {
      const res = await apiClient.get('/floors');
      if (res.data.success && Array.isArray(res.data.data)) {
        setAvailableFloors(res.data.data);
      }
    } catch (e) {}
  };

  const fetchStudents = async () => {
    setStudentsLoading(true);
    try {
      const res = await apiClient.get('/students?status=all');
      if (res.data.success && Array.isArray(res.data.data)) {
        setAvailableStudents(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load students directory:', e);
    } finally {
      setStudentsLoading(false);
    }
  };

  const filteredForms = useMemo(() => {
    return forms.filter(f => {
      const matchSearch = (f.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (filterType === 'active') return f.status === 'active';
      if (filterType === 'poll') return f.form_type === 'poll';
      if (filterType === 'form') return f.form_type === 'form';
      if (filterType === 'expired') return f.status === 'expired';
      return true;
    });
  }, [forms, searchQuery, filterType]);

  // Filter available students by search query (id, code, name, room) and floor filter
  const filteredAudienceStudents = useMemo(() => {
    const query = studentSearchText.trim().toLowerCase();
    return availableStudents.filter(s => {
      const sId = String(s.student_id ?? s.id ?? '');
      const sCode = String(s.student_code ?? '');
      const sName = String(s.name ?? '').toLowerCase();
      const sRoom = String(s.room_number ?? '').toLowerCase();
      const sFloor = String(s.floor_id ?? '');

      if (studentFloorFilter !== 'all' && sFloor !== studentFloorFilter) {
        return false;
      }

      if (!query) return true;

      return (
        sId.toLowerCase().includes(query) ||
        sCode.toLowerCase().includes(query) ||
        sName.includes(query) ||
        sRoom.includes(query)
      );
    });
  }, [availableStudents, studentSearchText, studentFloorFilter]);

  const selectedStudentsList = useMemo(() => {
    const idSet = new Set(targetStudentIds);
    return availableStudents.filter(s => idSet.has(Number(s.student_id ?? s.id)));
  }, [availableStudents, targetStudentIds]);

  const handleToggleStudent = (studentId: number) => {
    setTargetStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId) 
        : [...prev, studentId]
    );
  };

  const handleSelectAllFilteredStudents = () => {
    const filteredIds = filteredAudienceStudents.map(s => Number(s.student_id ?? s.id));
    setTargetStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDeselectAllFilteredStudents = () => {
    const filteredIdSet = new Set(filteredAudienceStudents.map(s => Number(s.student_id ?? s.id)));
    setTargetStudentIds(prev => prev.filter(id => !filteredIdSet.has(id)));
  };

  const handleOpenCreateModal = () => {
    setEditingFormId(null);
    setFormTitle('');
    setFormDesc('');
    setFormType('poll');
    setIsMandatory(false);
    setTargetAudience('all');
    setTargetFloors([]);
    setTargetStudentIds([]);
    setStudentSearchText('');
    setStudentFloorFilter('all');
    
    // Default start now, end in 3 days
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 3);
    
    setStartTime(now.toISOString().slice(0, 16));
    setEndTime(future.toISOString().slice(0, 16));
    
    setFields([
      {
        id: `q_${Date.now()}_1`,
        label: 'What is your preference?',
        type: 'radio',
        options: ['Option A', 'Option B'],
        required: true
      }
    ]);
    setModalOpen(true);
    if (availableStudents.length === 0) {
      fetchStudents();
    }
  };

  const handleOpenEditModal = (form: FormItem) => {
    setEditingFormId(form.id);
    setFormTitle(form.title);
    setFormDesc(form.description || '');
    setFormType(form.form_type);
    setIsMandatory(form.is_mandatory);
    
    if (form.target_audience === 'selected' || form.target_audience === 'students' || form.target_audience === 'floors') {
      if (Array.isArray(form.target_student_ids) && form.target_student_ids.length > 0) {
        setTargetAudience('students');
      } else if (Array.isArray(form.target_floors) && form.target_floors.length > 0) {
        setTargetAudience('floors');
      } else {
        setTargetAudience(form.target_audience || 'selected');
      }
    } else {
      setTargetAudience(form.target_audience || 'all');
    }

    setTargetFloors((form.target_floors || []).map(String));
    setTargetStudentIds((form.target_student_ids || []).map(Number));
    setStudentSearchText('');
    setStudentFloorFilter('all');
    
    try {
      setStartTime(new Date(form.start_time).toISOString().slice(0, 16));
      setEndTime(new Date(form.end_time).toISOString().slice(0, 16));
    } catch (e) {
      setStartTime('');
      setEndTime('');
    }

    setFields(form.fields || []);
    setModalOpen(true);
    if (availableStudents.length === 0) {
      fetchStudents();
    }
  };

  const handleAddField = () => {
    const newField: FormField = {
      id: `q_${Date.now()}_${fields.length + 1}`,
      label: `Question ${fields.length + 1}`,
      type: formType === 'poll' ? 'radio' : 'text',
      options: ['Option 1', 'Option 2'],
      required: true
    };
    setFields([...fields, newField]);
  };

  const handleRemoveField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const handleUpdateField = (idx: number, updates: Partial<FormField>) => {
    const next = [...fields];
    next[idx] = { ...next[idx], ...updates };
    setFields(next);
  };

  const handleAddOption = (fieldIdx: number) => {
    const field = fields[fieldIdx];
    const opts = field.options || [];
    handleUpdateField(fieldIdx, {
      options: [...opts, `Option ${opts.length + 1}`]
    });
  };

  const handleRemoveOption = (fieldIdx: number, optIdx: number) => {
    const field = fields[fieldIdx];
    const opts = (field.options || []).filter((_, i) => i !== optIdx);
    handleUpdateField(fieldIdx, { options: opts });
  };

  const handleUpdateOption = (fieldIdx: number, optIdx: number, val: string) => {
    const field = fields[fieldIdx];
    const opts = [...(field.options || [])];
    opts[optIdx] = val;
    handleUpdateField(fieldIdx, { options: opts });
  };

  const handleMoveField = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    const next = [...fields];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setFields(next);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Please enter a form title.');
      return;
    }
    if (fields.length === 0) {
      alert('Please add at least one question.');
      return;
    }

    if (targetAudience === 'students' && targetStudentIds.length === 0) {
      alert('Please search and select at least one student for "Specific Students" audience.');
      return;
    }

    if (targetAudience === 'floors' && targetFloors.length === 0) {
      alert('Please select at least one floor for "Selected Floors" audience.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        form_type: formType,
        fields: fields,
        target_audience: targetAudience === 'floors' ? 'selected' : targetAudience,
        target_floors: (targetAudience === 'floors' || targetAudience === 'selected') ? targetFloors : null,
        target_student_ids: (targetAudience === 'students' || targetAudience === 'selected') ? targetStudentIds : null,
        start_time: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : new Date().toISOString(),
        is_mandatory: isMandatory,
        is_active: true
      };

      if (editingFormId) {
        await apiClient.put(`/forms/${editingFormId}`, payload);
      } else {
        await apiClient.post('/forms', payload);
      }

      setModalOpen(false);
      fetchForms();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (form: FormItem) => {
    try {
      const res = await apiClient.post(`/forms/${form.id}/toggle`, {});
      const newActive = res.data?.is_active !== undefined ? res.data.is_active : !form.is_active;
      setForms(prev => prev.map(f => {
        if (f.id === form.id) {
          return {
            ...f,
            is_active: newActive,
            status: newActive ? 'active' : 'disabled'
          };
        }
        return f;
      }));
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to toggle form status');
    }
  };

  const handleDeleteForm = (form: FormItem) => {
    showConfirm({
      title: 'Delete Form & Responses?',
      message: `Are you sure you want to delete "${form.title}"? All submitted student responses and view logs will be permanently deleted.`,
      confirmText: 'Delete Permanently',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/forms/${form.id}`);
          setForms(prev => prev.filter(f => f.id !== form.id));
        } catch (e) {
          alert('Failed to delete form');
        }
      }
    });
  };

  const handleOpenAnalytics = async (form: FormItem) => {
    setAnalyticsModalOpen(true);
    setAnalyticsLoading(true);
    setAnalyticsTab('charts');
    setSelectedAnalytics(null);

    try {
      const res = await apiClient.get(`/forms/${form.id}/analytics`, { skipCache: true } as any);
      if ((res.data.success || res.data.status === 'ok') && res.data.data) {
        setSelectedAnalytics(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load form analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const exportResponsesCSV = () => {
    if (!selectedAnalytics || !selectedAnalytics.responses) return;
    const respList = selectedAnalytics.responses;
    const formFields = selectedAnalytics.form?.fields || [];

    const headers = ['Student ID', 'Student Code', 'Name', 'Room', 'Floor', 'Phone', 'Submitted At'];
    for (const f of formFields) {
      headers.push(`"${(f.label || f.id).replace(/"/g, '""')}"`);
    }

    const rows = respList.map((r: any) => {
      const row = [
        r.student_id,
        r.student_code || '',
        `"${(r.student_name || '').replace(/"/g, '""')}"`,
        r.room_number || '',
        r.floor_id || '',
        r.phone || '',
        r.submitted_at || ''
      ];

      for (const f of formFields) {
        const val = r.answers[f.id || f.key || f.label];
        const formattedVal = Array.isArray(val) ? val.join('; ') : (val !== undefined && val !== null ? String(val) : '');
        row.push(`"${formattedVal.replace(/"/g, '""')}"`);
      }
      return row.join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `form_responses_${selectedAnalytics.form?.id || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendWhatsAppReminder = (phone: string, studentName: string) => {
    if (!phone) {
      alert('Student does not have a phone number on file.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Hello ${studentName}, this is a reminder from AVD Hostel Administration to fill out the form "${selectedAnalytics?.form?.title}". Please open your student portal to complete it.`);
    window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="forms-view-root">
      
      {/* Header & Controls */}
      <div className="forms-header-bar">
        <div className="forms-search-filter-group">
          <div className="forms-search-box">
            <Search size={16} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="Search forms & polls..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="forms-filter-pills">
            {(['all', 'active', 'poll', 'form', 'expired'] as const).map(f => (
              <button
                key={f}
                className={`forms-filter-pill ${filterType === f ? 'active' : ''}`}
                onClick={() => setFilterType(f)}
              >
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'poll' ? 'Polls' : f === 'form' ? 'Forms' : 'Expired'}
              </button>
            ))}
          </div>
        </div>

        <button className="create-form-btn" onClick={handleOpenCreateModal}>
          <Plus size={18} /> Create Form / Poll
        </button>
      </div>

      {/* Forms Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Loading forms & polls...
        </div>
      ) : filteredForms.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3.5rem 1.5rem',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1.5px dashed #cbd5e1'
        }}>
          <ClipboardList size={48} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>No Forms or Polls Found</h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px' }}>
            Click "Create Form / Poll" above to build your first survey or student poll.
          </p>
        </div>
      ) : (
        <div className="forms-cards-grid">
          {filteredForms.map(form => {
            const pct = form.total_targeted > 0 ? Math.round((form.total_responded / form.total_targeted) * 100) : 0;

            return (
              <div key={form.id} className="form-item-card">
                
                <div className="form-card-top">
                  <div className="form-card-badges">
                    <span className={`form-badge ${form.form_type === 'poll' ? 'type-poll' : 'type-form'}`}>
                      {form.form_type === 'poll' ? <Vote size={12} /> : <ClipboardList size={12} />}
                      {form.form_type === 'poll' ? 'Poll' : 'Form'}
                    </span>

                    <span className={`form-badge status-${form.status}`}>
                      {form.status === 'active' ? '● Active' : form.status === 'upcoming' ? 'Upcoming' : form.status === 'expired' ? 'Expired' : 'Disabled'}
                    </span>

                    {form.is_mandatory && (
                      <span className="form-badge mandatory-badge">
                        Mandatory
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                    {form.target_audience === 'all' 
                      ? 'All Students' 
                      : form.target_audience === 'current' 
                      ? 'Current Only' 
                      : form.target_audience === 'alumni' 
                      ? 'Alumni' 
                      : (form.target_audience === 'students' || (Array.isArray(form.target_student_ids) && form.target_student_ids.length > 0))
                      ? `${form.target_student_ids?.length || 0} Specific Students`
                      : (form.target_audience === 'floors' || (Array.isArray(form.target_floors) && form.target_floors.length > 0))
                      ? `Floors: ${(form.target_floors || []).join(', ')}`
                      : 'Selected'}
                  </span>
                </div>

                <div>
                  <h3 className="form-card-title">{form.title}</h3>
                  {form.description && (
                    <p className="form-card-desc">{form.description}</p>
                  )}
                </div>

                <div className="form-card-timing">
                  <Clock size={13} color="#64748b" />
                  <span>
                    {new Date(form.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(form.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="form-progress-wrap">
                  <div className="form-progress-info">
                    <span>{form.total_responded} / {form.total_targeted} Responded</span>
                    <span className="progress-rate-text">{pct}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>

                {/* Seen but not answered indicator */}
                {form.seen_not_answered > 0 && (
                  <div className="seen-warning-pill">
                    <Eye size={13} />
                    <span>{form.seen_not_answered} viewed without submitting</span>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="form-card-actions">
                  <button className="analytics-btn" onClick={() => handleOpenAnalytics(form)}>
                    <BarChart3 size={15} /> Analytics & Responses
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className="action-icon-btn" 
                      onClick={() => handleToggleActive(form)}
                      title={form.is_active ? 'Pause Form' : 'Activate Form'}
                    >
                      <Power size={14} color={form.is_active ? '#059669' : '#94a3b8'} />
                    </button>
                    <button 
                      className="action-icon-btn" 
                      onClick={() => handleOpenEditModal(form)}
                      title="Edit Form"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      className="action-icon-btn delete-btn" 
                      onClick={() => handleDeleteForm(form)}
                      title="Delete Form"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT FORM MODAL */}
      {modalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editingFormId ? 'Edit Form / Poll' : 'Create New Form or Poll'}
              </h2>
              <button className="action-icon-btn" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm}>
              <div className="admin-modal-body">
                
                {/* Title & Desc */}
                <div className="form-group">
                  <label className="form-label">Form Title *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Hostel Feedback Survey / Dinner Menu Poll"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea 
                    className="form-textarea" 
                    rows={2}
                    placeholder="Brief instructions or purpose of this form..."
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                  />
                </div>

                {/* Form Type & Mandatory */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Form Type</label>
                    <select 
                      className="form-select"
                      value={formType}
                      onChange={e => setFormType(e.target.value as any)}
                    >
                      <option value="poll">Quick Poll (Single Choice)</option>
                      <option value="form">Multi-Field Form (Multiple Questions)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '1.25rem' }}>
                      <input 
                        type="checkbox" 
                        checked={isMandatory}
                        onChange={e => setIsMandatory(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b' }}>
                        Mandatory to Fill on Login
                      </span>
                    </label>
                  </div>
                </div>

                {/* Schedule Start & End */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Date & Time *</label>
                    <input 
                      type="datetime-local" 
                      className="form-input"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date & Time *</label>
                    <input 
                      type="datetime-local" 
                      className="form-input"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Target Audience */}
                <div className="form-group">
                  <label className="form-label">Target Audience</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '8px' }}>
                    {[
                      { id: 'all', label: 'All Students' },
                      { id: 'current', label: 'Current Only' },
                      { id: 'alumni', label: 'Alumni Only' },
                      { id: 'floors', label: 'Selected Floors' },
                      { id: 'students', label: 'Specific Students' }
                    ].map(aud => (
                      <label key={aud.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        border: (targetAudience === aud.id || (aud.id === 'floors' && targetAudience === 'selected' && targetFloors.length > 0)) ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: (targetAudience === aud.id || (aud.id === 'floors' && targetAudience === 'selected' && targetFloors.length > 0)) ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem'
                      }}>
                        <input 
                          type="radio" 
                          name="target_audience"
                          checked={targetAudience === aud.id || (aud.id === 'floors' && targetAudience === 'selected' && targetFloors.length > 0)}
                          onChange={() => setTargetAudience(aud.id as any)}
                        />
                        <span>{aud.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Selected Floors Picker */}
                  {(targetAudience === 'floors' || (targetAudience === 'selected' && targetFloors.length > 0)) && (
                    <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                          Select Floors ({targetFloors.length} Selected):
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setTargetFloors(availableFloors.map(fl => String(fl.floor_id !== undefined ? fl.floor_id : fl.id)))}
                            style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                          >
                            Select All
                          </button>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <button
                            type="button"
                            onClick={() => setTargetFloors([])}
                            style={{ fontSize: '0.75rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {availableFloors.map(fl => {
                          const floorId = String(fl.floor_id !== undefined ? fl.floor_id : fl.id);
                          const isSelected = targetFloors.includes(floorId);
                          const floorLabel = fl.name || (fl.floor_name ? fl.floor_name : `Floor ${floorId}`);
                          return (
                            <button
                              key={floorId}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setTargetFloors(targetFloors.filter(f => f !== floorId));
                                } else {
                                  setTargetFloors([...targetFloors, floorId]);
                                }
                              }}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                background: isSelected ? '#2563eb' : '#ffffff',
                                color: isSelected ? '#ffffff' : '#334155',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {floorLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Specific Students Manual Search & Picker */}
                  {targetAudience === 'students' && (
                    <div className="target-students-picker-box">
                      <div className="target-students-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Users size={16} color="#2563eb" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                            Select Students ({targetStudentIds.length} Selected)
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {filteredAudienceStudents.length > 0 && (
                            <button
                              type="button"
                              className="student-quick-action-btn"
                              onClick={handleSelectAllFilteredStudents}
                            >
                              Select All Filtered ({filteredAudienceStudents.length})
                            </button>
                          )}
                          {targetStudentIds.length > 0 && (
                            <button
                              type="button"
                              className="student-quick-action-btn text-danger"
                              onClick={() => setTargetStudentIds([])}
                            >
                              Clear Selected
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Search & Floor filter row */}
                      <div className="target-students-filter-row">
                        <div className="student-search-input-wrap">
                          <Search size={14} color="#94a3b8" />
                          <input 
                            type="text"
                            placeholder="Search by ID, Code, Name, or Room..."
                            value={studentSearchText}
                            onChange={e => setStudentSearchText(e.target.value)}
                          />
                          {studentSearchText && (
                            <button type="button" onClick={() => setStudentSearchText('')} className="search-clear-btn">
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        <select
                          className="form-select student-floor-dropdown"
                          value={studentFloorFilter}
                          onChange={e => setStudentFloorFilter(e.target.value)}
                        >
                          <option value="all">All Floors</option>
                          {availableFloors.map(fl => {
                            const fid = String(fl.floor_id !== undefined ? fl.floor_id : fl.id);
                            const fName = fl.name || `Floor ${fid}`;
                            return <option key={fid} value={fid}>{fName}</option>;
                          })}
                        </select>
                      </div>

                      {/* Selected Students Chips Container */}
                      {selectedStudentsList.length > 0 && (
                        <div className="selected-chips-container">
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
                            Selected Students ({selectedStudentsList.length}):
                          </div>
                          <div className="selected-chips-scroll">
                            {selectedStudentsList.map(st => {
                              const sid = Number(st.student_id ?? st.id);
                              return (
                                <span key={sid} className="selected-student-chip">
                                  <span className="chip-name">{st.name || `Student ${sid}`}</span>
                                  <span className="chip-meta">
                                    {st.student_code ? `#${st.student_code}` : `ID:${sid}`}
                                    {st.room_number ? ` (R-${st.room_number})` : ''}
                                  </span>
                                  <button
                                    type="button"
                                    className="chip-remove-btn"
                                    onClick={() => handleToggleStudent(sid)}
                                    title="Remove"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Student list / table with checkboxes */}
                      {studentsLoading ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                          Loading students directory...
                        </div>
                      ) : filteredAudienceStudents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                          No students matched "{studentSearchText}"
                        </div>
                      ) : (
                        <div className="student-selection-scroll-list">
                          {filteredAudienceStudents.slice(0, 100).map(st => {
                            const sid = Number(st.student_id ?? st.id);
                            const isSelected = targetStudentIds.includes(sid);
                            return (
                              <div
                                key={sid}
                                className={`student-select-row ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleToggleStudent(sid)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // handled by row click
                                  style={{ cursor: 'pointer', pointerEvents: 'none' }}
                                />
                                <div className="student-row-id-badge">
                                  {st.student_code ? `${st.student_code}` : `ID:${sid}`}
                                </div>
                                <div className="student-row-info">
                                  <span className="student-row-name">{st.name}</span>
                                  <span className="student-row-sub">
                                    {st.room_number ? `Room: ${st.room_number}` : 'No Room'}
                                    {st.floor_id !== undefined && st.floor_id !== null ? ` • Floor ${st.floor_id}` : ''}
                                    {st.phone_number ? ` • ${st.phone_number}` : ''}
                                  </span>
                                </div>
                                {isSelected && (
                                  <CheckCircle2 size={16} color="#2563eb" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                                )}
                              </div>
                            );
                          })}
                          {filteredAudienceStudents.length > 100 && (
                            <div style={{ textAlign: 'center', padding: '8px', fontSize: '0.75rem', color: '#64748b', background: '#f8fafc' }}>
                              Showing first 100 of {filteredAudienceStudents.length} students. Use search above to narrow down.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Question / Fields Builder */}
                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ fontSize: '0.95rem' }}>
                      Questions / Poll Fields ({fields.length})
                    </label>
                    <button 
                      type="button" 
                      onClick={handleAddField}
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} /> Add Question
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {fields.map((field, fIdx) => (
                      <div key={field.id || fIdx} className="question-item-card">
                        
                        <div className="question-top-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="question-number-badge">Q{fIdx + 1}</span>
                            <select 
                              className="form-select"
                              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                              value={field.type}
                              onChange={e => handleUpdateField(fIdx, { type: e.target.value as any })}
                            >
                              <option value="radio">Single Choice (Radio / Poll)</option>
                              <option value="checkbox">Multiple Selection (Checkbox)</option>
                              <option value="boolean">True / False (Yes/No)</option>
                              <option value="text">Short Answer</option>
                              <option value="textarea">Paragraph / Essay</option>
                              <option value="rating">Star Rating (1-5)</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button 
                              type="button" 
                              className="action-icon-btn" 
                              onClick={() => handleMoveField(fIdx, 'up')}
                              disabled={fIdx === 0}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button 
                              type="button" 
                              className="action-icon-btn" 
                              onClick={() => handleMoveField(fIdx, 'down')}
                              disabled={fIdx === fields.length - 1}
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button 
                              type="button" 
                              className="action-icon-btn delete-btn" 
                              onClick={() => handleRemoveField(fIdx)}
                              disabled={fields.length === 1}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Question Text */}
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Type your question here..."
                          value={field.label}
                          onChange={e => handleUpdateField(fIdx, { label: e.target.value })}
                          required
                        />

                        {/* Option choices for Radio / Checkbox */}
                        {['radio', 'checkbox'].includes(field.type) && (
                          <div className="options-builder-list">
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                              Answer Choices:
                            </div>
                            {(field.options || []).map((opt, optIdx) => (
                              <div key={optIdx} className="option-input-row">
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>•</span>
                                <input 
                                  type="text" 
                                  className="form-input"
                                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                  value={opt}
                                  onChange={e => handleUpdateOption(fIdx, optIdx, e.target.value)}
                                  placeholder={`Option ${optIdx + 1}`}
                                  required
                                />
                                <button 
                                  type="button" 
                                  className="action-icon-btn delete-btn"
                                  style={{ width: '26px', height: '26px' }}
                                  onClick={() => handleRemoveOption(fIdx, optIdx)}
                                  disabled={(field.options || []).length <= 2}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                            <button 
                              type="button" 
                              className="add-opt-btn"
                              onClick={() => handleAddOption(fIdx)}
                            >
                              + Add Option
                            </button>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                            <input 
                              type="checkbox" 
                              checked={Boolean(field.required)}
                              onChange={e => handleUpdateField(fIdx, { required: e.target.checked })}
                            />
                            <span>Required Question</span>
                          </label>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div className="admin-modal-footer">
                <button 
                  type="button" 
                  className="forms-filter-pill" 
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="create-form-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingFormId ? 'Update Form' : 'Publish Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED ANALYTICS & RESPONSES MODAL */}
      {analyticsModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container wide-modal">
            
            <div className="admin-modal-header">
              <div>
                <h2 className="admin-modal-title">
                  {selectedAnalytics?.form?.title || 'Form Analytics & Responses'}
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  {selectedAnalytics?.form?.form_type === 'poll' ? 'Poll Results' : 'Form Responses'} · {selectedAnalytics?.summary?.total_responded || 0} Submissions
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="create-form-btn" 
                  style={{ padding: '6px 12px', fontSize: '0.82rem', background: '#059669' }}
                  onClick={exportResponsesCSV}
                >
                  <Download size={14} /> Export CSV
                </button>
                <button className="action-icon-btn" onClick={() => setAnalyticsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="admin-modal-body">
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  Calculating analytics and student responses...
                </div>
              ) : !selectedAnalytics ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#dc2626' }}>
                  Failed to load analytics.
                </div>
              ) : (
                <>
                  {/* KPI Summary Cards */}
                  <div className="analytics-stats-grid">
                    <div className="stat-kpi-card">
                      <span className="stat-kpi-label">Targeted Students</span>
                      <span className="stat-kpi-val">{selectedAnalytics.summary.total_targeted}</span>
                    </div>
                    <div className="stat-kpi-card success-card">
                      <span className="stat-kpi-label">Responded ({selectedAnalytics.summary.response_rate}%)</span>
                      <span className="stat-kpi-val">{selectedAnalytics.summary.total_responded}</span>
                    </div>
                    <div className="stat-kpi-card warning-card">
                      <span className="stat-kpi-label">Seen But Not Answered</span>
                      <span className="stat-kpi-val">{selectedAnalytics.summary.seen_not_answered}</span>
                    </div>
                    <div className="stat-kpi-card">
                      <span className="stat-kpi-label">Never Opened</span>
                      <span className="stat-kpi-val">{selectedAnalytics.summary.never_seen}</span>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="analytics-tabs-header">
                    <button 
                      className={`analytics-tab-btn ${analyticsTab === 'charts' ? 'active' : ''}`}
                      onClick={() => setAnalyticsTab('charts')}
                    >
                      📊 Visual Results & Poll Breakdown
                    </button>
                    <button 
                      className={`analytics-tab-btn ${analyticsTab === 'responses' ? 'active' : ''}`}
                      onClick={() => setAnalyticsTab('responses')}
                    >
                      📝 All Responses ({selectedAnalytics.responses.length})
                    </button>
                    <button 
                      className={`analytics-tab-btn ${analyticsTab === 'seen' ? 'active' : ''}`}
                      onClick={() => setAnalyticsTab('seen')}
                    >
                      👀 Seen But Not Answered ({selectedAnalytics.seen_not_answered.length})
                    </button>
                    <button 
                      className={`analytics-tab-btn ${analyticsTab === 'pending' ? 'active' : ''}`}
                      onClick={() => setAnalyticsTab('pending')}
                    >
                      ⏳ Not Responded ({selectedAnalytics.not_responded.length})
                    </button>
                  </div>

                  {/* TAB 1: CHARTS & BREAKDOWN */}
                  {analyticsTab === 'charts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {Object.keys(selectedAnalytics.field_analytics || {}).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No choice questions available for chart visualization.
                        </div>
                      ) : (
                        Object.values(selectedAnalytics.field_analytics).map((fieldAnalytic: any) => (
                          <div key={fieldAnalytic.field_id} className="poll-breakdown-card">
                            <h4 className="poll-question-title">{fieldAnalytic.label}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {fieldAnalytic.breakdown.map((optItem: any, idx: number) => (
                                <div key={idx} className="poll-option-row">
                                  <div className="poll-option-header">
                                    <span>{optItem.option}</span>
                                    <span>{optItem.count} votes ({optItem.percentage}%)</span>
                                  </div>
                                  <div className="poll-option-bar-track">
                                    <div className="poll-option-bar-fill" style={{ width: `${optItem.percentage}%` }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 2: ALL RESPONSES TABLE */}
                  {analyticsTab === 'responses' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <table className="responses-table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Room</th>
                              <th>Floor</th>
                              <th>Phone</th>
                              <th>Submitted Time</th>
                              {(selectedAnalytics.form?.fields || []).map((f: any) => (
                                <th key={f.id}>{f.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAnalytics.responses.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                  No responses received yet.
                                </td>
                              </tr>
                            ) : (
                              selectedAnalytics.responses.map((resp: any) => (
                                <tr key={resp.id}>
                                  <td>
                                    <div style={{ fontWeight: 800 }}>{resp.student_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🪪 {resp.student_code || `#${resp.student_id}`}</div>
                                  </td>
                                  <td><b>{resp.room_number || 'N/A'}</b></td>
                                  <td>Floor {resp.floor_id || 'N/A'}</td>
                                  <td>{resp.phone || '—'}</td>
                                  <td>{new Date(resp.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                  {(selectedAnalytics.form?.fields || []).map((f: any) => {
                                    const ans = resp.answers[f.id || f.key || f.label];
                                    return (
                                      <td key={f.id}>
                                        {Array.isArray(ans) ? ans.join(', ') : (ans !== undefined && ans !== null ? String(ans) : '—')}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SEEN BUT NOT ANSWERED */}
                  {analyticsTab === 'seen' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <table className="responses-table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Room</th>
                              <th>Floor</th>
                              <th>Phone</th>
                              <th>First Viewed At</th>
                              <th>Last Viewed At</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAnalytics.seen_not_answered.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#059669', fontWeight: 700 }}>
                                  ✓ Great! No students have viewed without submitting.
                                </td>
                              </tr>
                            ) : (
                              selectedAnalytics.seen_not_answered.map((s: any) => (
                                <tr key={s.student_id}>
                                  <td>
                                    <div style={{ fontWeight: 800 }}>{s.student_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🪪 {s.student_code || `#${s.student_id}`}</div>
                                  </td>
                                  <td><b>{s.room_number || 'N/A'}</b></td>
                                  <td>Floor {s.floor_id || 'N/A'}</td>
                                  <td>{s.phone || '—'}</td>
                                  <td>{new Date(s.first_viewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                  <td>{new Date(s.last_viewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                  <td>
                                    <button 
                                      className="whatsapp-action-btn"
                                      onClick={() => sendWhatsAppReminder(s.phone, s.student_name)}
                                    >
                                      <MessageSquare size={13} /> Remind
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ALL NOT RESPONDED */}
                  {analyticsTab === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <table className="responses-table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Room</th>
                              <th>Floor</th>
                              <th>Phone</th>
                              <th>Portal View Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAnalytics.not_responded.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#059669', fontWeight: 700 }}>
                                  🎉 100% Complete! All targeted students have submitted.
                                </td>
                              </tr>
                            ) : (
                              selectedAnalytics.not_responded.map((s: any) => (
                                <tr key={s.student_id}>
                                  <td>
                                    <div style={{ fontWeight: 800 }}>{s.student_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🪪 {s.student_code || `#${s.student_id}`}</div>
                                  </td>
                                  <td><b>{s.room_number || 'N/A'}</b></td>
                                  <td>Floor {s.floor_id || 'N/A'}</td>
                                  <td>{s.phone || '—'}</td>
                                  <td>
                                    {s.has_seen ? (
                                      <span style={{ color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <Eye size={13} /> Viewed on {new Date(s.last_viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                                        Never Opened
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <button 
                                      className="whatsapp-action-btn"
                                      onClick={() => sendWhatsAppReminder(s.phone, s.student_name)}
                                    >
                                      <MessageSquare size={13} /> Remind
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default FormsManagementView;
