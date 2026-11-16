import React, { useEffect, useState, useMemo } from 'react';
import {
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Search,
  ShieldCheck,
  Layers,
  Radio,
  Code,
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  Globe,
  Plus,
  Trash2,
  Edit2,
  Users,
  Zap,
  X,
  ShieldAlert,
  Save,
  Wand2
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import { HamsCard } from '../../components/HamsCard';

interface FloorStringItem {
  floor_id: number;
  floor_name: string;
  string_value: string | null;
  updated_at: string | null;
  has_string: boolean;
  device_name?: string | null;
  last_seen?: string | null;
  student_count?: number;
}

export const FloorStringsView: React.FC = () => {
  const [floors, setFloors] = useState<FloorStringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedFloorId, setCopiedFloorId] = useState<number | null>(null);
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);
  const [revealedFloors, setRevealedFloors] = useState<{ [key: number]: boolean }>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live API Response Preview
  const [showApiPreview, setShowApiPreview] = useState(false);

  // --- Modals State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    floor_id: 1,
    floor_name: 'Floor 1',
    security_string: '',
    device_name: ''
  });

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    start_id: 1,
    end_id: 5,
    prefix: 'Floor'
  });

  const [editingFloor, setEditingFloor] = useState<FloorStringItem | null>(null);
  const [editForm, setEditForm] = useState({
    floor_name: '',
    security_string: '',
    device_name: ''
  });

  const [deletingFloor, setDeletingFloor] = useState<FloorStringItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchFloorStrings(true);
    const interval = setInterval(() => {
      fetchFloorStrings(false);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const fetchFloorStrings = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await apiClient.get('/floors/strings');
      if (res.data.success && Array.isArray(res.data.data)) {
        setFloors(res.data.data);
      }
    } catch (e: any) {
      console.error('Failed to fetch floor strings:', e);
      showToast('error', e.response?.data?.message || 'Failed to load floor strings');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const copyToClipboard = (text: string, floorId: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedFloorId(floorId);
    showToast('success', `Copied string: ${text}`);
    setTimeout(() => {
      setCopiedFloorId(null);
    }, 2000);
  };

  const apiEndpointUrl = `${window.location.origin}/api/floors/strings`;

  const copyApiUrl = () => {
    navigator.clipboard.writeText(apiEndpointUrl);
    setCopiedApiUrl(true);
    showToast('success', 'API URL copied to clipboard');
    setTimeout(() => setCopiedApiUrl(false), 2000);
  };

  const toggleReveal = (floorId: number) => {
    setRevealedFloors(prev => ({
      ...prev,
      [floorId]: !prev[floorId]
    }));
  };

  const areAllRevealed = floors.length > 0 && floors.every(f => Boolean(revealedFloors[f.floor_id]));

  const toggleRevealAll = () => {
    if (areAllRevealed) {
      setRevealedFloors({});
    } else {
      const all: { [key: number]: boolean } = {};
      floors.forEach(f => { all[f.floor_id] = true; });
      setRevealedFloors(all);
    }
  };

  const filteredFloors = useMemo(() => {
    if (!searchQuery.trim()) return floors;
    const q = searchQuery.toLowerCase().trim();
    return floors.filter(f =>
      f.floor_name?.toLowerCase().includes(q) ||
      String(f.floor_id).includes(q) ||
      (f.string_value && f.string_value.toLowerCase().includes(q)) ||
      (f.device_name && f.device_name.toLowerCase().includes(q))
    );
  }, [floors, searchQuery]);

  const activeCount = floors.filter(f => f.has_string).length;
  const globalFloor = floors.find(f => f.floor_id === 0) || (floors.length > 0 ? floors[0] : null);
  const globalStringValue = globalFloor?.string_value || 'FLR0-QFPH-HEYE';

  // --- Handlers: Add Floor ---
  const handleOpenAddModal = () => {
    const nextId = floors.length > 0 ? Math.max(...floors.map(f => f.floor_id)) + 1 : 1;
    setAddForm({
      floor_id: nextId,
      floor_name: `Floor ${nextId}`,
      security_string: '',
      device_name: `ESP32_Beacon_F${nextId}`
    });
    setIsAddModalOpen(true);
  };

  const handleSubmitAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.floor_name.trim()) {
      showToast('error', 'Please enter a Floor Name');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiClient.post('/floors', addForm);
      if (res.data.success) {
        showToast('success', res.data.message || 'Floor created successfully!');
        setIsAddModalOpen(false);
        fetchFloorStrings();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to add floor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers: Batch Add Floors ---
  const handleOpenBatchModal = () => {
    const nextStart = floors.length > 0 ? Math.max(...floors.map(f => f.floor_id)) + 1 : 1;
    setBatchForm({
      start_id: nextStart,
      end_id: nextStart + 4,
      prefix: 'Floor'
    });
    setIsBatchModalOpen(true);
  };

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchForm.start_id > batchForm.end_id) {
      showToast('error', 'Start Floor ID must be less than or equal to End Floor ID');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiClient.post('/floors/batch', batchForm);
      if (res.data.success) {
        showToast('success', res.data.message || 'Batch floors created successfully!');
        setIsBatchModalOpen(false);
        fetchFloorStrings();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to batch add floors');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers: Edit Floor ---
  const handleOpenEditModal = (floor: FloorStringItem) => {
    setEditingFloor(floor);
    setEditForm({
      floor_name: floor.floor_name,
      security_string: floor.string_value || '',
      device_name: floor.device_name || `ESP32_Beacon_F${floor.floor_id}`
    });
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFloor) return;
    if (!editForm.floor_name.trim()) {
      showToast('error', 'Floor Name cannot be empty');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiClient.put(`/floors/${editingFloor.floor_id}`, editForm);
      if (res.data.success) {
        showToast('success', res.data.message || 'Floor updated successfully!');
        setEditingFloor(null);
        fetchFloorStrings();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update floor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers: Delete Floor ---
  const handleOpenDeleteModal = (floor: FloorStringItem) => {
    if (floor.floor_id === 0) {
      showToast('error', 'Floor 0 (Ground / Global Attendance Floor) is protected and cannot be deleted.');
      return;
    }
    setDeletingFloor(floor);
  };

  const handleConfirmDelete = async (force = false) => {
    if (!deletingFloor) return;
    setIsSubmitting(true);
    try {
      const res = await apiClient.delete(`/floors/${deletingFloor.floor_id}${force ? '?force=true' : ''}`);
      if (res.data.success) {
        showToast('success', res.data.message || 'Floor deleted successfully');
        setDeletingFloor(null);
        fetchFloorStrings();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete floor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Quick Generate Token ---
  const handleQuickGenerateToken = async (floorId: number) => {
    try {
      const res = await apiClient.post('/floors/strings/generate', { floor_id: floorId });
      if (res.data.success) {
        showToast('success', `New token generated for F${floorId}!`);
        fetchFloorStrings();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to generate token');
    }
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
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
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
            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
          }}>
            <KeyRound size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Floor Management &amp; Security Strings
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Add, edit, delete hostel floors and configure unique ESP32 Bluetooth attendance security strings
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Add Floor Button */}
          <button
            onClick={handleOpenAddModal}
            style={{
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '13px',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} />
            Add Floor
          </button>

          {/* Batch Add Floors Button */}
          <button
            onClick={handleOpenBatchModal}
            style={{
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '13px',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.35)',
              transition: 'all 0.2s'
            }}
          >
            <Zap size={16} />
            Add Multiple Floors
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchFloorStrings(true)}
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
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Reveal / Hide All Button */}
          <button
            onClick={toggleRevealAll}
            disabled={loading || floors.length === 0}
            style={{
              padding: '10px 16px',
              backgroundColor: areAllRevealed ? '#f1f5f9' : '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              color: '#334155',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            {areAllRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
            {areAllRevealed ? 'Hide All' : 'Preview All'}
          </button>
        </div>
      </div>

      {/* Overview Stat Cards & API Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {/* Total Floors Card */}
        <HamsCard padding="20px">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Floors
              </span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {floors.length}
              </div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>
            Configured floors in hostel database
          </div>
        </HamsCard>

        {/* Active Strings Card */}
        <HamsCard padding="20px">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Strings
              </span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: activeCount === floors.length && floors.length > 0 ? '#059669' : '#d97706', marginTop: '4px' }}>
                {activeCount} <span style={{ fontSize: '16px', fontWeight: 500, color: '#94a3b8' }}>/ {floors.length}</span>
              </div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: activeCount === floors.length && floors.length > 0 ? '#059669' : '#d97706', marginTop: '12px', fontWeight: 600 }}>
            {activeCount === floors.length && floors.length > 0 ? '✓ All floors have security strings' : `⚠️ ${floors.length - activeCount} floors missing string`}
          </div>
        </HamsCard>

        {/* API Endpoint Quick Access Card */}
        <HamsCard padding="20px">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fetch API Endpoint
              </span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '6px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                GET /api/floors/strings
              </div>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Code size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={copyApiUrl}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                color: '#334155'
              }}
            >
              {copiedApiUrl ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
              {copiedApiUrl ? 'Copied URL!' : 'Copy API URL'}
            </button>
            <button
              onClick={() => setShowApiPreview(!showApiPreview)}
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: showApiPreview ? '#4f46e5' : '#f8fafc',
                color: showApiPreview ? '#ffffff' : '#4f46e5',
                border: '1px solid #c7d2fe',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <ExternalLink size={12} />
              {showApiPreview ? 'Hide JSON' : 'Test API'}
            </button>
          </div>
        </HamsCard>

      </div>

      {/* Live API JSON Viewer (Collapsible) */}
      {showApiPreview && (
        <div style={{
          backgroundColor: '#0f172a',
          color: '#38bdf8',
          borderRadius: '12px',
          padding: '20px',
          fontFamily: 'monospace',
          fontSize: '13px',
          overflowX: 'auto',
          border: '1px solid #334155',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>API Response Preview (GET /api/floors/strings)</span>
            <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: 700 }}>200 OK</span>
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#e2e8f0' }}>
            {JSON.stringify({
              success: true,
              count: floors.length,
              active_strings_count: activeCount,
              data: floors.map(f => ({
                floor_id: f.floor_id,
                floor_name: f.floor_name,
                string_value: f.string_value,
                updated_at: f.updated_at,
                has_string: f.has_string,
                student_count: f.student_count || 0
              }))
            }, null, 2)}
          </pre>
        </div>
      )}

      {/* 🌟 GLOBAL ATTENDANCE SECURITY STRING SPOTLIGHT */}
      {globalFloor && (
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: '18px',
          padding: '24px 28px',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.4), 0 8px 10px -6px rgba(49, 46, 129, 0.2)',
          border: '1.5px solid #6366f1',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)'
              }}>
                <Sparkles size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    Global Attendance Security String
                  </h3>
                  <span style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.25)',
                    color: '#fef3c7',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    🌟 Aarti &amp; Sabha (All Students)
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#c7d2fe' }}>
                  Configured across <strong>ALL ESP32 beacons</strong> in the hostel for Global Sessions. Any student from any floor matches this string.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => toggleReveal(0)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                {revealedFloors[0] ? <EyeOff size={14} /> : <Eye size={14} />}
                {revealedFloors[0] ? 'Hide String' : 'Preview String'}
              </button>

              <button
                onClick={() => copyToClipboard(globalStringValue, 0)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: copiedFloorId === 0 ? '#10b981' : '#f59e0b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                  transition: 'all 0.15s'
                }}
              >
                {copiedFloorId === 0 ? <Check size={14} /> : <Copy size={14} />}
                {copiedFloorId === 0 ? 'Copied Global String!' : 'Copy Global String'}
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            padding: '14px 18px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Global String (Floor 0)
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: 800,
                color: '#38bdf8',
                marginTop: '4px',
                letterSpacing: '0.05em'
              }}>
                {revealedFloors[0] ? globalStringValue : '••••••••••••••••'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shared Global Hardware ID
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 800,
                color: '#facc15',
                marginTop: '4px'
              }}>
                HSH_GLOBAL
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ESP32 Arduino Firmware Code
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#e2e8f0',
                marginTop: '4px',
                backgroundColor: 'rgba(0,0,0,0.3)',
                padding: '4px 8px',
                borderRadius: '6px'
              }}>
                #define GLOBAL_STRING "{globalStringValue}"
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          position: 'relative',
          flex: 1,
          minWidth: '260px'
        }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by floor name, ID or string value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '13px',
              color: '#1e293b',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
          Showing {filteredFloors.length} of {floors.length} floors
        </div>
      </div>

      {/* Floor String Cards Grid */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: '#6366f1' }} />
          <div>Loading floor security strings...</div>
        </div>
      ) : filteredFloors.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <Layers size={36} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#334155' }}>No floors found</h4>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            {searchQuery ? 'Try clearing your search query.' : 'No floors are configured in the system.'}
          </p>
          <button
            onClick={handleOpenAddModal}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Create First Floor
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredFloors.map((floor) => {
            const isGlobal = floor.floor_id === 0;
            const hasString = floor.has_string && floor.string_value;
            const isRevealed = Boolean(revealedFloors[floor.floor_id]);
            const displayString = hasString
              ? (isRevealed ? floor.string_value : '••••••••••••••••')
              : 'No string configured';

            return (
              <HamsCard
                key={floor.floor_id}
                padding="24px"
                className="floor-string-card"
                style={isGlobal ? {
                  border: '2px solid #818cf8',
                  boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.15)',
                  backgroundColor: '#faf5ff'
                } : undefined}
              >
                {/* Floor Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isGlobal
                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                        : (hasString ? '#e0e7ff' : '#f1f5f9'),
                      color: isGlobal || !hasString ? '#ffffff' : '#4338ca',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '15px',
                      boxShadow: isGlobal ? '0 4px 10px rgba(245, 158, 11, 0.3)' : 'none'
                    }}>
                      F{floor.floor_id}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                          {floor.floor_name}
                        </h3>
                        {isGlobal && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: '#92400e',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fde68a',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            🌟 Global String
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <Radio size={12} />
                        {floor.device_name || (isGlobal ? 'Hostel_Global_Hall / All ESP32s' : `ESP32 Beacon F${floor.floor_id}`)}
                      </div>
                    </div>
                  </div>

                  {/* Actions Group: Edit & Delete & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Edit Floor Button */}
                    <button
                      onClick={() => handleOpenEditModal(floor)}
                      title="Edit floor name & string"
                      style={{
                        padding: '6px',
                        borderRadius: '8px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Edit2 size={13} />
                    </button>

                    {/* Delete Floor Button (Disabled for Floor 0) */}
                    <button
                      onClick={() => handleOpenDeleteModal(floor)}
                      disabled={isGlobal}
                      title={isGlobal ? "Global floor cannot be deleted" : "Delete floor"}
                      style={{
                        padding: '6px',
                        borderRadius: '8px',
                        backgroundColor: isGlobal ? '#f8fafc' : '#fee2e2',
                        border: `1px solid ${isGlobal ? '#e2e8f0' : '#fecaca'}`,
                        color: isGlobal ? '#cbd5e1' : '#dc2626',
                        cursor: isGlobal ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isGlobal ? 0.6 : 1,
                        transition: 'all 0.15s'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Floor Meta Bar: Students assigned + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                    <Users size={13} color="#6366f1" />
                    <span>{floor.student_count || 0} Students Assigned</span>
                  </div>

                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: hasString ? '#ecfdf5' : '#fffbeb',
                    color: hasString ? '#047857' : '#b45309',
                    border: `1px solid ${hasString ? '#a7f3d0' : '#fde68a'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: hasString ? '#10b981' : '#f59e0b' }}></span>
                    {hasString ? 'String Active' : 'Unset'}
                  </span>
                </div>

                {/* String Box */}
                <div style={{
                  backgroundColor: hasString ? (isGlobal ? '#ffffff' : '#f8fafc') : '#fdf2f8',
                  border: `1px solid ${hasString ? (isGlobal ? '#c7d2fe' : '#e2e8f0') : '#fbcfe8'}`,
                  borderRadius: '12px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: isGlobal ? '#4f46e5' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {isGlobal ? '🌟 Global Session String (All ESP32s)' : 'Floor Security String'}
                    </span>
                    {hasString && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => toggleReveal(floor.floor_id)}
                          title={isRevealed ? "Hide string preview" : "Preview string"}
                          style={{
                            background: isRevealed ? '#e0e7ff' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: isRevealed ? '#4338ca' : '#64748b',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                          {isRevealed ? 'Hide' : 'Preview'}
                        </button>
                        <button
                          onClick={() => copyToClipboard(floor.string_value!, floor.floor_id)}
                          title="Copy string"
                          style={{
                            background: copiedFloorId === floor.floor_id ? '#dcfce7' : '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: copiedFloorId === floor.floor_id ? '#166534' : '#334155',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s'
                          }}
                        >
                          {copiedFloorId === floor.floor_id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedFloorId === floor.floor_id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: hasString ? '#0f172a' : '#94a3b8',
                    letterSpacing: hasString && isRevealed ? '0.06em' : 'normal',
                    wordBreak: 'break-all',
                    padding: '8px 12px',
                    backgroundColor: hasString ? (isRevealed ? '#eef2ff' : '#f1f5f9') : '#fff1f2',
                    borderRadius: '8px',
                    border: `1px solid ${hasString ? (isRevealed ? '#c7d2fe' : '#e2e8f0') : '#fecdd3'}`
                  }}>
                    {displayString}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    {floor.updated_at ? (
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Updated: {new Date(floor.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : <div></div>}

                    <button
                      onClick={() => handleQuickGenerateToken(floor.floor_id)}
                      title="Generate a fresh cryptographic token for this floor"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6366f1',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px'
                      }}
                    >
                      <Wand2 size={11} />
                      Regenerate
                    </button>
                  </div>
                </div>
              </HamsCard>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD SINGLE FLOOR */}
      {/* ======================================================== */}
      {isAddModalOpen && (
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
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Add New Floor</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddFloor} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Floor ID (Number) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={addForm.floor_id}
                  onChange={e => {
                    const id = parseInt(e.target.value, 10);
                    setAddForm(prev => ({
                      ...prev,
                      floor_id: id,
                      floor_name: prev.floor_name.startsWith('Floor ') ? `Floor ${id}` : prev.floor_name,
                      device_name: `ESP32_Beacon_F${id}`
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Floor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Floor 6, Terrace, Ground Floor"
                  value={addForm.floor_name}
                  onChange={e => setAddForm(prev => ({ ...prev, floor_name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Security String (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate unique secure token"
                  value={addForm.security_string}
                  onChange={e => setAddForm(prev => ({ ...prev, security_string: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  If empty, system will auto-generate format: <code>FLR{addForm.floor_id}-XXXX-XXXX</code>
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  ESP32 Device / Beacon Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder={`e.g. ESP32_Beacon_F${addForm.floor_id}`}
                  value={addForm.device_name}
                  onChange={e => setAddForm(prev => ({ ...prev, device_name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  {isSubmitting ? 'Creating...' : 'Create Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: BATCH ADD MULTIPLE FLOORS */}
      {/* ======================================================== */}
      {isBatchModalOpen && (
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
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '520px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Add Multiple Floors</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Quickly generate a range of consecutive floors</span>
                </div>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Start Floor ID *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={batchForm.start_id}
                    onChange={e => setBatchForm(prev => ({ ...prev, start_id: parseInt(e.target.value, 10) || 0 }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    End Floor ID *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={batchForm.end_id}
                    onChange={e => setBatchForm(prev => ({ ...prev, end_id: parseInt(e.target.value, 10) || 0 }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Floor Name Prefix
                </label>
                <input
                  type="text"
                  placeholder="e.g. Floor"
                  value={batchForm.prefix}
                  onChange={e => setBatchForm(prev => ({ ...prev, prefix: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Names will be generated as <strong>{batchForm.prefix || 'Floor'} {batchForm.start_id}</strong> to <strong>{batchForm.prefix || 'Floor'} {batchForm.end_id}</strong>
                </span>
              </div>

              {/* Preview Box */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                marginTop: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Floors to be created ({Math.max(0, batchForm.end_id - batchForm.start_id + 1)} total):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  {batchForm.end_id >= batchForm.start_id && (batchForm.end_id - batchForm.start_id <= 50) ? (
                    Array.from({ length: batchForm.end_id - batchForm.start_id + 1 }, (_, i) => {
                      const fid = batchForm.start_id + i;
                      const alreadyExists = floors.some(f => f.floor_id === fid);
                      return (
                        <span
                          key={fid}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: alreadyExists ? '#fee2e2' : '#e0f2fe',
                            color: alreadyExists ? '#991b1b' : '#0369a1',
                            border: `1px solid ${alreadyExists ? '#fecaca' : '#bae6fd'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          F{fid} ({batchForm.prefix || 'Floor'} {fid})
                          {alreadyExists && <span style={{ fontSize: '10px', color: '#dc2626' }}>[Exists]</span>}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: '12px', color: '#ef4444' }}>Please specify a valid range (max 50 floors).</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || batchForm.start_id > batchForm.end_id}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  {isSubmitting ? 'Creating...' : 'Create All Floors'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: EDIT FLOOR NAME & STRING */}
      {/* ======================================================== */}
      {editingFloor && (
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
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                    Edit Floor F{editingFloor.floor_id}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Modify floor name, beacon name, or security string</span>
                </div>
              </div>
              <button
                onClick={() => setEditingFloor(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Floor Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.floor_name}
                  onChange={e => setEditForm(prev => ({ ...prev, floor_name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Floor Security String
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={editForm.security_string}
                    onChange={e => setEditForm(prev => ({ ...prev, security_string: e.target.value }))}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                      let r = '';
                      for (let i = 0; i < 8; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
                      setEditForm(prev => ({ ...prev, security_string: `FLR${editingFloor.floor_id}-${r.slice(0, 4)}-${r.slice(4, 8)}` }));
                    }}
                    title="Generate Random Token"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#eef2ff',
                      color: '#4f46e5',
                      border: '1px solid #c7d2fe',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Wand2 size={14} />
                    New Token
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  ESP32 Device / Beacon Name
                </label>
                <input
                  type="text"
                  value={editForm.device_name}
                  onChange={e => setEditForm(prev => ({ ...prev, device_name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingFloor(null)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: DELETE FLOOR CONFIRMATION */}
      {/* ======================================================== */}
      {deletingFloor && (
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
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #fee2e2'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>
                  Delete Floor {deletingFloor.floor_name} (F{deletingFloor.floor_id})?
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>This action will permanently delete the floor from the system.</span>
              </div>
            </div>

            {/* Warning if students assigned */}
            {(deletingFloor.student_count || 0) > 0 ? (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#92400e',
                lineHeight: '1.5'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, marginBottom: '4px' }}>
                  <AlertCircle size={15} color="#b45309" />
                  <span>{deletingFloor.student_count} Student(s) Assigned to this Floor!</span>
                </div>
                Deleting this floor will automatically reassign all {deletingFloor.student_count} student(s) to <strong>Floor 0 (Ground / Global Attendance)</strong> so their profiles remain safe.
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                Are you sure you want to delete <strong>{deletingFloor.floor_name}</strong>? Its configured security string and beacon association will be removed.
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingFloor(null)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete((deletingFloor.student_count || 0) > 0)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
              >
                {isSubmitting ? 'Deleting...' : ((deletingFloor.student_count || 0) > 0 ? 'Force Delete & Reassign' : 'Delete Floor')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FloorStringsView;
