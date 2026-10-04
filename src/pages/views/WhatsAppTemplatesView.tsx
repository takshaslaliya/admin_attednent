import React, { useEffect, useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  Image as ImageIcon, 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  Sparkles, 
  Search, 
  Send, 
  RefreshCw, 
  AlertCircle,
  Eye,
  Layers,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Upload,
  Settings,
  Tag,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { useConfirm } from '../../context/ConfirmContext';
import { HamsCard } from '../../components/HamsCard';

export interface WhatsAppTemplate {
  id: number;
  name: string;
  category: string;
  content: string;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

const DYNAMIC_VARIABLES = [
  {
    group: 'Student Details',
    vars: [
      { key: '{name}', label: 'Student Name', desc: 'Full name of the student' },
      { key: '{student_code}', label: 'Student ID', desc: 'Student unique code / ID' },
      { key: '{student_mobile}', label: 'Student Mobile', desc: 'Assigned mobile number of student' },
      { key: '{parent_mobile}', label: 'Parent Mobile', desc: 'Parent / Father / Mother mobile' },
      { key: '{room}', label: 'Room Number', desc: 'Room assigned (e.g. 717)' },
      { key: '{floor}', label: 'Floor', desc: 'Floor assigned (e.g. Floor 7)' }
    ]
  },
  {
    group: 'Session & Status',
    vars: [
      { key: '{session_name}', label: 'Session Name', desc: 'Name of attendance session (e.g. Night, Aarti)' },
      { key: '{date}', label: 'Date / Range', desc: 'Selected date or date range' },
      { key: '{status}', label: 'Status', desc: 'Status (Present, Absent, Late, Leave)' },
      { key: '{reason}', label: 'Reason / Remark', desc: 'Absent or leave reason' }
    ]
  },
  {
    group: 'Multi-Day & Statistics',
    vars: [
      { key: '{present_days}', label: 'Present Days', desc: 'Number of present days in range' },
      { key: '{absent_days}', label: 'Absent Days', desc: 'Number of absent days in range' },
      { key: '{late_days}', label: 'Late Days', desc: 'Number of late days in range' },
      { key: '{leave_days}', label: 'Leave Days', desc: 'Number of approved leave days' },
      { key: '{attendance_percentage}', label: 'Attendance %', desc: 'Calculated attendance percentage' }
    ]
  },
  {
    group: 'System & Security',
    vars: [
      { key: '{floor_string}', label: 'Floor Security String', desc: 'Floor active token / security string' },
      { key: '{hostel_name}', label: 'Hostel Name', desc: 'Hostel name' }
    ]
  }
];

const DEFAULT_CATEGORIES = [
  { key: 'general', label: 'General / Report' },
  { key: 'absent', label: 'Absent Alerts' },
  { key: 'late', label: 'Late Alerts' },
  { key: 'parent', label: 'Parent Notices' },
  { key: 'leave', label: 'Leave Notices' }
];

export const WhatsAppTemplatesView: React.FC = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Custom Categories & Deleted Categories
  const [customCategories, setCustomCategories] = useState<{ key: string; label: string }[]>(() => {
    try {
      const saved = localStorage.getItem('hams_custom_wa_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedCategories, setDeletedCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hams_deleted_wa_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<WhatsAppTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Combine default, custom, and any existing template categories
  const allCategories = useMemo(() => {
    const map = new Map<string, string>();
    DEFAULT_CATEGORIES.forEach(c => {
      if (!deletedCategories.includes(c.key.toLowerCase())) {
        map.set(c.key.toLowerCase(), c.label);
      }
    });
    customCategories.forEach(c => {
      if (!deletedCategories.includes(c.key.toLowerCase())) {
        map.set(c.key.toLowerCase(), c.label);
      }
    });
    templates.forEach(t => {
      if (t.category && !deletedCategories.includes(t.category.toLowerCase()) && !map.has(t.category.toLowerCase())) {
        const formatted = t.category.charAt(0).toUpperCase() + t.category.slice(1).replace(/_/g, ' ');
        map.set(t.category.toLowerCase(), formatted);
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [deletedCategories, customCategories, templates]);

  useEffect(() => {
    fetchTemplates(true);
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreateCategory = (nameToCreate?: string) => {
    const rawName = (nameToCreate || newCategoryName).trim();
    if (!rawName) {
      showToast('error', 'Please enter a category name');
      return;
    }
    const key = rawName.toLowerCase().replace(/\s+/g, '_');
    const label = rawName;

    // Remove from deleted categories if re-adding
    if (deletedCategories.includes(key) || deletedCategories.includes(rawName.toLowerCase())) {
      const newDel = deletedCategories.filter(d => d !== key && d !== rawName.toLowerCase());
      setDeletedCategories(newDel);
      try { localStorage.setItem('hams_deleted_wa_categories', JSON.stringify(newDel)); } catch(e) {}
    }

    // Check if category already exists
    const exists = allCategories.some(c => c.key === key || c.label.toLowerCase() === rawName.toLowerCase());
    if (exists) {
      if (editingTemplate) {
        setEditingTemplate({ ...editingTemplate, category: key });
      }
      setIsCreatingCategory(false);
      setNewCategoryName('');
      showToast('success', `Category "${label}" selected`);
      return;
    }

    const updated = [...customCategories, { key, label }];
    setCustomCategories(updated);
    try {
      localStorage.setItem('hams_custom_wa_categories', JSON.stringify(updated));
    } catch(e) {}

    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, category: key });
    }
    setIsCreatingCategory(false);
    setNewCategoryName('');
    showToast('success', `New category "${label}" created successfully!`);
  };

  const handleDeleteCategory = async (catKey: string, catLabel: string) => {
    const isConfirmed = await confirm({
      title: 'Permanently Delete Category',
      message: `Are you sure you want to delete category "${catLabel}"?`,
      warningNote: 'Templates assigned to this category will automatically fallback to another category.',
      confirmText: 'Yes, Delete Category',
      type: 'danger',
      icon: 'trash'
    });

    if (!isConfirmed) return;

    // Track in deletedCategories
    const newDeleted = Array.from(new Set([...deletedCategories, catKey.toLowerCase(), catLabel.toLowerCase()]));
    setDeletedCategories(newDeleted);
    try {
      localStorage.setItem('hams_deleted_wa_categories', JSON.stringify(newDeleted));
    } catch(e) {}

    // Filter out from customCategories
    const updated = customCategories.filter(c => c.key.toLowerCase() !== catKey.toLowerCase() && c.label.toLowerCase() !== catLabel.toLowerCase());
    setCustomCategories(updated);
    try {
      localStorage.setItem('hams_custom_wa_categories', JSON.stringify(updated));
    } catch(e) {}

    // Determine fallback
    const fallbackCategory = allCategories.find(c => c.key.toLowerCase() !== catKey.toLowerCase())?.key || 'general';

    // Reset templates using this category in memory
    setTemplates(prev => prev.map(t => t.category?.toLowerCase() === catKey.toLowerCase() ? { ...t, category: fallbackCategory } : t));

    // If template in editor was using this category, reset to fallback
    if (editingTemplate && editingTemplate.category?.toLowerCase() === catKey.toLowerCase()) {
      setEditingTemplate({ ...editingTemplate, category: fallbackCategory });
    }

    // If currently filtering by this category, reset to 'all'
    if (selectedCategory.toLowerCase() === catKey.toLowerCase()) {
      setSelectedCategory('all');
    }

    showToast('success', `Category "${catLabel}" deleted successfully.`);
  };

  const handleRestoreDefaultCategories = async () => {
    const isConfirmed = await confirm({
      title: 'Restore Default Categories',
      message: 'Do you want to restore all original system default template categories?',
      confirmText: 'Restore Defaults',
      type: 'info'
    });
    if (!isConfirmed) return;

    setDeletedCategories([]);
    try {
      localStorage.removeItem('hams_deleted_wa_categories');
    } catch(e) {}
    showToast('success', 'Default categories restored successfully.');
  };

  const fetchTemplates = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await apiClient.get('/whatsapp/templates');
      if (res.data.success && Array.isArray(res.data.data)) {
        setTemplates(res.data.data);
      }
    } catch (e: any) {
      console.error('Failed to fetch templates:', e);
      showToast('error', e.response?.data?.message || 'Failed to load templates');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTemplate({
      name: '',
      category: 'general',
      content: '*Jai Swaminarayan {name}*,\n\nNotification for *{session_name}* on *{date}*.\nStatus: *{status}*\nRoom: *{room}* | Floor: *{floor}*\n\n_Please ensure timely presence._\n- *HAMS Hostel Administration*',
      image_url: ''
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (tpl: WhatsAppTemplate) => {
    setEditingTemplate({ ...tpl });
    setIsEditorOpen(true);
  };

  const handleImageFileSelect = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please select an image file (PNG, JPG, WebP, GIF)');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('error', 'Image size should be less than 15MB');
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          const res = await apiClient.post('/whatsapp/upload-image', {
            image_base64: base64,
            filename: file.name
          });
          if (res.data.success && res.data.url) {
            setEditingTemplate(prev => ({
              ...prev,
              image_url: res.data.url
            }));
            showToast('success', 'Image uploaded successfully!');
          } else {
            showToast('error', res.data.message || 'Failed to upload image');
          }
        } catch (err: any) {
          showToast('error', 'Failed to upload image to server');
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingImage(false);
      showToast('error', 'Failed to read image file');
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate?.name?.trim()) {
      showToast('error', 'Template name is required');
      return;
    }
    if (!editingTemplate?.content?.trim()) {
      showToast('error', 'Message content is required');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate.id) {
        // Update
        const res = await apiClient.put(`/whatsapp/templates/${editingTemplate.id}`, editingTemplate);
        if (res.data.success) {
          showToast('success', 'Template updated successfully');
          setIsEditorOpen(false);
          await fetchTemplates(false);
        }
      } else {
        // Create
        const res = await apiClient.post('/whatsapp/templates', editingTemplate);
        if (res.data.success) {
          showToast('success', 'Template created successfully');
          setIsEditorOpen(false);
          await fetchTemplates(false);
        }
      }
    } catch (e: any) {
      showToast('error', e.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number, name: string) => {
    const isConfirmed = await confirm({
      title: 'Permanently Delete Template',
      message: `Are you sure you want to delete template "${name}"?`,
      warningNote: 'This action cannot be undone. The template will be permanently removed.',
      confirmText: 'Yes, Delete Template',
      type: 'danger',
      icon: 'trash'
    });
    if (!isConfirmed) return;

    try {
      const res = await apiClient.delete(`/whatsapp/templates/${id}`);
      if (res.data.success) {
        showToast('success', 'Template deleted');
        await fetchTemplates(false);
      }
    } catch (e: any) {
      showToast('error', e.response?.data?.message || 'Failed to delete template');
    }
  };

  const handleDuplicateTemplate = async (tpl: WhatsAppTemplate) => {
    try {
      const res = await apiClient.post('/whatsapp/templates', {
        name: `${tpl.name} (Copy)`,
        category: tpl.category,
        content: tpl.content,
        image_url: tpl.image_url
      });
      if (res.data.success) {
        showToast('success', 'Template duplicated');
        await fetchTemplates(false);
      }
    } catch (e: any) {
      showToast('error', 'Failed to duplicate template');
    }
  };

  const handleUseInMessaging = (tpl: WhatsAppTemplate) => {
    // Store in sessionStorage or navigate to messaging view with template state
    sessionStorage.setItem('hams_active_wa_template', JSON.stringify(tpl));
    navigate('/messages');
  };

  // Helper to insert formatting or variable into textarea
  const insertTextAtCursor = (textToInsert: string, wrapChars?: { start: string; end: string }) => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
    if (!textarea) {
      setEditingTemplate(prev => ({
        ...prev,
        content: (prev?.content || '') + textToInsert
      }));
      return;
    }

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentVal = textarea.value;

    let newVal = '';
    if (wrapChars && startPos !== endPos) {
      // Wrap selected text
      const selected = currentVal.substring(startPos, endPos);
      newVal = currentVal.substring(0, startPos) + wrapChars.start + selected + wrapChars.end + currentVal.substring(endPos);
    } else {
      newVal = currentVal.substring(0, startPos) + textToInsert + currentVal.substring(endPos);
    }

    setEditingTemplate(prev => ({ ...prev, content: newVal }));
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = startPos + (wrapChars ? wrapChars.start.length : textToInsert.length);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  const copyTemplateContent = (tpl: WhatsAppTemplate) => {
    navigator.clipboard.writeText(tpl.content);
    setCopiedId(tpl.id);
    showToast('success', 'Template text copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchCat = selectedCategory === 'all' || t.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  // WhatsApp Formatting Preview Parser (renders *bold*, _italic_, ~strike~, ```code```)
  const renderFormattedWhatsApp = (rawText: string) => {
    if (!rawText) return null;

    // Replace sample variables with realistic dummy data for preview
    let previewText = rawText
      .replace(/{name}/gi, 'Aadi Pandya')
      .replace(/{student_name}/gi, 'Aadi Pandya')
      .replace(/{student_code}/gi, '0876')
      .replace(/{student_id}/gi, '0876')
      .replace(/{student_mobile}/gi, '+91 87340 87243')
      .replace(/{parent_mobile}/gi, '+91 72840 81187')
      .replace(/{session_name}/gi, 'Night Attendance')
      .replace(/{date}/gi, '03/10/2026')
      .replace(/{status}/gi, 'Absent')
      .replace(/{room}/gi, '717')
      .replace(/{room_number}/gi, '717')
      .replace(/{floor}/gi, 'Floor 7')
      .replace(/{present_days}/gi, '18')
      .replace(/{absent_days}/gi, '3')
      .replace(/{late_days}/gi, '1')
      .replace(/{leave_days}/gi, '0')
      .replace(/{attendance_percentage}/gi, '85.7%')
      .replace(/{reason}/gi, 'Unexcused Absence')
      .replace(/{floor_string}/gi, 'FLR7-9X2K-8M4A')
      .replace(/{hostel_name}/gi, 'HAMS Hostel');

    // Line breaks to paragraphs
    const lines = previewText.split('\n');
    return (
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word', fontSize: '13.5px' }}>
        {lines.map((line, idx) => {
          let formattedLine: React.ReactNode = line;
          
          // Basic Bold parsing *text*
          const boldRegex = /\*([^*]+)\*/g;
          const italicRegex = /_([^_]+)_/g;
          const strikeRegex = /~([^~]+)~/g;

          const parts = line.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g);
          return (
            <div key={idx} style={{ minHeight: line.trim() ? 'auto' : '12px' }}>
              {parts.map((part, pIdx) => {
                if (part.startsWith('*') && part.endsWith('*')) {
                  return <strong key={pIdx} style={{ fontWeight: 800 }}>{part.slice(1, -1)}</strong>;
                }
                if (part.startsWith('_') && part.endsWith('_')) {
                  return <em key={pIdx} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
                }
                if (part.startsWith('~') && part.endsWith('~')) {
                  return <span key={pIdx} style={{ textDecoration: 'line-through' }}>{part.slice(1, -1)}</span>;
                }
                return part;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Toast Alert */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '10px',
          backgroundColor: notification.type === 'success' ? '#065f46' : '#991b1b',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {notification.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#ffffff',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.35)'
          }}>
            <MessageSquare size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              WhatsApp Message Templates
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Create reusable formatted WhatsApp templates with dynamic variables, bold/italic text, and image attachments
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchTemplates(true)}
            disabled={loading}
            style={{
              padding: '10px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleOpenCreate}
            style={{
              padding: '10px 18px',
              backgroundColor: '#22c55e',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
            }}
          >
            <Plus size={16} />
            Create New Template
          </button>
        </div>
      </div>

      {/* Filter & Category Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: selectedCategory === 'all' ? '1px solid #16a34a' : '1px solid #cbd5e1',
              backgroundColor: selectedCategory === 'all' ? '#dcfce7' : '#ffffff',
              color: selectedCategory === 'all' ? '#15803d' : '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            All Templates
          </button>
          {allCategories.map(cat => {
            const isSelected = selectedCategory === cat.key;

            return (
              <div
                key={cat.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid #16a34a' : '1px solid #cbd5e1',
                  backgroundColor: isSelected ? '#dcfce7' : '#ffffff',
                  transition: 'all 0.15s',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    padding: '8px 8px 8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: isSelected ? '#15803d' : '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {cat.label}
                </button>
                {allCategories.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat.key, cat.label);
                    }}
                    title={`Delete category "${cat.label}"`}
                    style={{
                      padding: '8px 8px 8px 2px',
                      border: 'none',
                      background: 'transparent',
                      color: isSelected ? '#dc2626' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Quick Add Category Button on Filter Bar */}
          <button
            onClick={() => {
              const name = window.prompt('Enter new template category name (e.g. Exam Notice, Fee Reminder, Holiday Alert):');
              if (name && name.trim()) {
                handleCreateCategory(name.trim());
              }
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px dashed #16a34a',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s'
            }}
            title="Create a new category"
          >
            <Plus size={14} /> New Category
          </button>

          {/* Manage Categories Button */}
          <button
            onClick={() => setIsManageCategoriesOpen(true)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s'
            }}
            title="Manage and delete categories"
          >
            <Settings size={13} /> Manage
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#22c55e' }} />
          <div>Loading WhatsApp templates...</div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <FileText size={36} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#334155' }}>No templates found</h4>
          <p style={{ margin: '6px 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
            {searchQuery ? 'Try clearing your search query.' : 'Create your first WhatsApp message template now.'}
          </p>
          <button
            onClick={handleOpenCreate}
            style={{
              padding: '10px 18px',
              backgroundColor: '#22c55e',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: '#ffffff'
            }}
          >
            + Create Template
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredTemplates.map((tpl) => {
            const hasImage = Boolean(tpl.image_url && tpl.image_url.trim().length > 0);

            return (
              <HamsCard key={tpl.id} padding="22px" className="template-card">
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      {tpl.name}
                    </h3>
                    <span style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: tpl.category === 'absent' ? '#fee2e2' : (tpl.category === 'late' ? '#fef3c7' : (tpl.category === 'parent' ? '#e0e7ff' : (tpl.category === 'leave' ? '#f3e8ff' : '#ecfdf5'))),
                      color: tpl.category === 'absent' ? '#dc2626' : (tpl.category === 'late' ? '#d97706' : (tpl.category === 'parent' ? '#4338ca' : (tpl.category === 'leave' ? '#7e22ce' : '#047857'))),
                      textTransform: 'capitalize'
                    }}>
                      {allCategories.find(c => c.key === tpl.category)?.label || tpl.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {hasImage && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#f1f5f9',
                      color: '#475569'
                    }}>
                      <ImageIcon size={12} /> Image Attached
                    </span>
                  )}
                </div>

                {/* WhatsApp Chat Preview Bubble */}
                <div style={{
                  backgroundColor: '#efeae2', // Classic WhatsApp background
                  backgroundImage: 'radial-gradient(#d1d7db 1px, transparent 0)',
                  backgroundSize: '16px 16px',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '16px',
                  border: '1px solid #e2e8f0',
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                    color: '#111b21',
                    fontSize: '13px',
                    position: 'relative'
                  }}>
                    {hasImage && (
                      <div style={{ marginBottom: '8px', borderRadius: '6px', overflow: 'hidden', maxHeight: '120px' }}>
                        <img 
                          src={tpl.image_url!} 
                          alt="Template attachment" 
                          style={{ width: '100%', height: 'auto', maxHeight: '120px', objectFit: 'cover', display: 'block' }}
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                    {renderFormattedWhatsApp(tpl.content)}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleUseInMessaging(tpl)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#22c55e',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(34, 197, 94, 0.25)'
                    }}
                  >
                    <Send size={13} />
                    Use in Broadcast
                  </button>

                  <button
                    onClick={() => handleOpenEdit(tpl)}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Edit Template"
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>

                  <button
                    onClick={() => handleDuplicateTemplate(tpl)}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Duplicate Template"
                  >
                    <Copy size={13} />
                  </button>

                  <button
                    onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: '#fff1f2',
                      color: '#e11d48',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Delete Template"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

              </HamsCard>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {isEditorOpen && editingTemplate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    {editingTemplate.id ? 'Edit WhatsApp Template' : 'Create WhatsApp Template'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Configure template text, WhatsApp bold/italic formatting, and variables
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Row 1: Name & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Template Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Daily Absent Notice"
                    value={editingTemplate.name || ''}
                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: 0 }}>
                      Category
                    </label>
                    {!isCreatingCategory && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#16a34a',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            padding: 0
                          }}
                        >
                          <Plus size={12} /> New
                        </button>
                        <span style={{ color: '#cbd5e1', fontSize: '10px' }}>•</span>
                        <button
                          type="button"
                          onClick={() => setIsManageCategoriesOpen(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#6366f1',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            padding: 0
                          }}
                        >
                          <Settings size={11} /> Manage
                        </button>
                      </div>
                    )}
                  </div>

                  {isCreatingCategory ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="e.g. Exam Alert, Fee Notice, Bus Schedule"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateCategory();
                          }
                          if (e.key === 'Escape') {
                            setIsCreatingCategory(false);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1.5px solid #16a34a',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateCategory()}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreatingCategory(false)}
                        style={{
                          padding: '8px 10px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={editingTemplate.category || 'general'}
                        onChange={e => {
                          if (e.target.value === '__new__') {
                            setIsCreatingCategory(true);
                          } else if (e.target.value === '__manage__') {
                            setIsManageCategoriesOpen(true);
                          } else {
                            setEditingTemplate({ ...editingTemplate, category: e.target.value });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      >
                        <optgroup label="System Default Categories">
                          {DEFAULT_CATEGORIES.map(c => (
                            <option key={c.key} value={c.key}>{c.label}</option>
                          ))}
                        </optgroup>
                        {allCategories.filter(c => !DEFAULT_CATEGORIES.some(dc => dc.key === c.key)).length > 0 && (
                          <optgroup label="Custom Categories">
                            {allCategories.filter(c => !DEFAULT_CATEGORIES.some(dc => dc.key === c.key)).map(c => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </optgroup>
                        )}
                        <option value="__new__">✨ + Create New Category...</option>
                        <option value="__manage__">⚙️ Manage / Delete Categories...</option>
                      </select>

                      {/* If category selected and more than 1 category exists, allow direct delete */}
                      {editingTemplate.category && allCategories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const catObj = allCategories.find(c => c.key === editingTemplate.category);
                            if (catObj) {
                              handleDeleteCategory(catObj.key, catObj.label);
                            }
                          }}
                          title={`Delete category "${allCategories.find(c => c.key === editingTemplate.category)?.label || editingTemplate.category}"`}
                          style={{
                            padding: '9px 10px',
                            backgroundColor: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Image Attachment Direct Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Image Attachment (Direct File Upload - Will be sent with caption on WhatsApp)
                </label>
                
                {editingTemplate.image_url ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={editingTemplate.image_url}
                        alt="Attached"
                        style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #86efac' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={14} /> Image Uploaded & Attached
                        </div>
                        <div style={{ fontSize: '11px', color: '#65a30d', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {editingTemplate.image_url}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <label style={{
                        padding: '6px 12px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: '#334155',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Upload size={13} /> Change
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => e.target.files?.[0] && handleImageFileSelect(e.target.files[0])}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingTemplate({ ...editingTemplate, image_url: '' })}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#dc2626',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 20px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    cursor: uploadingImage ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center'
                  }}>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && handleImageFileSelect(e.target.files[0])}
                    />
                    <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                      {uploadingImage ? <RefreshCw size={20} className="animate-spin text-green-600" /> : <Upload size={20} />}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                      {uploadingImage ? 'Uploading image to server...' : 'Click to Upload Image from Your Device'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Supports PNG, JPG, JPEG, WebP (Direct file upload)
                    </span>
                  </label>
                )}
              </div>

              {/* Row 3: WhatsApp Formatting & Variables Toolbar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Message Content Template *
                  </span>

                  {/* WhatsApp Quick Formatting Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px 6px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>Format:</span>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('*bold*', { start: '*', end: '*' })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 800 }}
                      title="Bold (*text*)"
                    >
                      <Bold size={12} /> Bold
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('_italic_', { start: '_', end: '_' })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontStyle: 'italic' }}
                      title="Italic (_text_)"
                    >
                      <Italic size={12} /> Italic
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('~strike~', { start: '~', end: '~' })}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', textDecoration: 'line-through' }}
                      title="Strikethrough (~text~)"
                    >
                      <Strikethrough size={12} /> Strike
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTextAtCursor('• ')}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                      title="Bullet Point"
                    >
                      • Bullet
                    </button>
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  id="template-textarea"
                  rows={6}
                  value={editingTemplate.content || ''}
                  onChange={e => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  placeholder="Type your message template here..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Dynamic Variables Selector Accordion/Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Click to Insert Dynamic Variables:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {DYNAMIC_VARIABLES.map(grp => (
                    <div key={grp.group} style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                        {grp.group}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {grp.vars.map(v => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => insertTextAtCursor(` ${v.key} `)}
                            title={v.desc}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #bbf7d0',
                              backgroundColor: '#f0fdf4',
                              color: '#15803d',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>+ {v.key}</span>
                            <span style={{ fontSize: '10px', color: '#65a30d', fontWeight: 500 }}>({v.label})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Live WhatsApp Preview (Sample Data Replaced):
                </label>
                <div style={{
                  backgroundColor: '#efeae2',
                  backgroundImage: 'radial-gradient(#d1d7db 1px, transparent 0)',
                  backgroundSize: '16px 16px',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #cbd5e1'
                }}>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                    color: '#111b21',
                    maxWidth: '480px'
                  }}>
                    {editingTemplate.image_url && editingTemplate.image_url.trim() && (
                      <div style={{ marginBottom: '10px', borderRadius: '6px', overflow: 'hidden' }}>
                        <img 
                          src={editingTemplate.image_url.trim()} 
                          alt="Preview" 
                          style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }}
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                    {renderFormattedWhatsApp(editingTemplate.content || '')}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#f8fafc'
            }}>
              <button
                onClick={() => setIsEditorOpen(false)}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#ffffff',
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
                onClick={handleSaveTemplate}
                disabled={saving}
                style={{
                  padding: '10px 22px',
                  backgroundColor: '#22c55e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}
              >
                {saving ? 'Saving...' : (editingTemplate.id ? 'Update Template' : 'Save Template')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Manage Categories Modal */}
      {isManageCategoriesOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tag size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Manage Template Categories
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Create, view, and delete WhatsApp template categories
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManageCategoriesOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Inline Add Category */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Enter new category name..."
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => handleCreateCategory()}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={14} /> Add Category
              </button>
            </div>

            {/* List of categories */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {allCategories.map(cat => {
                const isDefault = DEFAULT_CATEGORIES.some(dc => dc.key === cat.key);
                const count = templates.filter(t => t.category === cat.key).length;

                return (
                  <div
                    key={cat.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        {cat.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Key: <code>{cat.key}</code> • {count} {count === 1 ? 'template' : 'templates'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isDefault && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: '6px',
                          backgroundColor: '#e2e8f0',
                          color: '#475569'
                        }}>
                          Default
                        </span>
                      )}
                      
                      {allCategories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.key, cat.label)}
                          title={`Delete "${cat.label}" category`}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecdd3',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {deletedCategories.length > 0 ? (
                <button
                  type="button"
                  onClick={handleRestoreDefaultCategories}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#4f46e5',
                    cursor: 'pointer'
                  }}
                >
                  ↺ Restore Default Categories
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(false)}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WhatsAppTemplatesView;
