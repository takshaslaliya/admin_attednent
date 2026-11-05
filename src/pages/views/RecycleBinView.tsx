import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RotateCcw,
  Trash2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  RefreshCw,
  PlusCircle,
  Edit3,
  Calendar,
  User,
  ArrowRight,
  CheckCircle2,
  XCircle,
  X,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import './RecycleBinView.css';

interface RecoveryLogItem {
  id: number;
  operation_type: 'CREATE' | 'UPDATE' | 'DELETE';
  module_name: string;
  table_name: string;
  record_id: string;
  record_identifier: string | null;
  admin_id: number | null;
  admin_name: string | null;
  previous_data: any;
  new_data: any;
  status: 'pending' | 'restored' | 'finalized';
  recovery_deadline: string;
  remaining_seconds: number;
  is_expired: boolean;
  can_restore: boolean;
  restored_at: string | null;
  restored_by_name: string | null;
  finalized_at: string | null;
  created_at: string;
}

interface RecoverySummary {
  total_operations: number;
  pending_recovery: number;
  expiring_soon: number;
  permanently_finalized: number;
  restored_operations: number;
  available_modules: string[];
}

export const RecycleBinView: React.FC = () => {
  // State
  const [logs, setLogs] = useState<RecoveryLogItem[]>([]);
  const [summary, setSummary] = useState<RecoverySummary>({
    total_operations: 0,
    pending_recovery: 0,
    expiring_soon: 0,
    permanently_finalized: 0,
    restored_operations: 0,
    available_modules: []
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [cleanupLoading, setCleanupLoading] = useState<boolean>(false);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);

  // Pagination & Filters
  const [search, setSearch] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [opFilter, setOpFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Modals
  const [detailItem, setDetailItem] = useState<RecoveryLogItem | null>(null);
  const [confirmRestoreItem, setConfirmRestoreItem] = useState<RecoveryLogItem | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live countdown state (local tick decrementer)
  const [tick, setTick] = useState<number>(0);

  // Ticker for smooth live countdown updates
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch summary stats
  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiClient.get('/recovery/summary');
      if (res.data?.success && res.data?.data) {
        setSummary(res.data.data);
      }
    } catch (err: any) {
      console.error('[RecycleBin] Error loading summary:', err);
    }
  }, []);

  // Fetch paginated logs
  const fetchLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const params: any = {
        page,
        limit: 20
      };
      if (search.trim()) params.search = search.trim();
      if (moduleFilter !== 'all') params.module_name = moduleFilter;
      if (opFilter !== 'all') params.operation_type = opFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await apiClient.get('/recovery/logs', { params });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.total || 0);
      }
    } catch (err: any) {
      console.error('[RecycleBin] Error loading logs:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [page, search, moduleFilter, opFilter, statusFilter, fromDate, toDate]);

  // Initial load
  useEffect(() => {
    fetchSummary();
    fetchLogs();
  }, [fetchSummary, fetchLogs]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchSummary();
      fetchLogs(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSummary, fetchLogs]);

  // Format seconds into HH:MM:SS
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Trigger automated cleanup manually
  const handleRunCleanup = async () => {
    setCleanupLoading(true);
    setActionFeedback(null);
    try {
      const res = await apiClient.post('/recovery/cleanup');
      if (res.data?.success) {
        setActionFeedback({
          type: 'success',
          message: res.data.message || 'Expired operations successfully finalized.'
        });
        fetchSummary();
        fetchLogs();
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to run cleanup.'
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  // Execute restore operation
  const handleExecuteRestore = async () => {
    if (!confirmRestoreItem) return;
    setRestoreLoading(true);
    setActionFeedback(null);
    try {
      const res = await apiClient.post(`/recovery/logs/${confirmRestoreItem.id}/restore`);
      if (res.data?.success) {
        setActionFeedback({
          type: 'success',
          message: res.data.message || 'Operation successfully restored.'
        });
        setConfirmRestoreItem(null);
        if (detailItem?.id === confirmRestoreItem.id) {
          setDetailItem(null);
        }
        fetchSummary();
        fetchLogs();
      } else {
        setActionFeedback({
          type: 'error',
          message: res.data?.message || 'Restore failed.'
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to execute restoration.'
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setModuleFilter('all');
    setOpFilter('all');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  return (
    <div className="rb-container">
      {/* Top Header Card */}
      <div className="rb-header-card">
        <div className="rb-header-left">
          <div className="rb-header-icon-box">
            <RotateCcw size={28} />
          </div>
          <div>
            <h1 className="rb-header-title">Recycle Bin & Data Recovery</h1>
            <p className="rb-header-sub">
              Centralized CRUD audit tracking with strict 48-hour temporary recovery
              <span className="rb-badge-pill">
                <Clock size={12} /> 48h Live Window
              </span>
            </p>
          </div>
        </div>

        <div className="rb-header-actions">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (15s)
          </label>

          <button
            className="btn-rb-secondary"
            onClick={() => { fetchSummary(); fetchLogs(); }}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          <button
            className="btn-rb-cleanup"
            onClick={handleRunCleanup}
            disabled={cleanupLoading}
            title="Immediately finalizes records older than 48 hours"
          >
            <ShieldCheck size={16} />
            {cleanupLoading ? 'Running...' : 'Run Expiration Cleanup'}
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: actionFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${actionFeedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: actionFeedback.type === 'success' ? '#065f46' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {actionFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="rb-kpi-grid">
        <div className="rb-kpi-card">
          <div className="rb-kpi-top">
            <span className="rb-kpi-label">Total Tracked Operations</span>
            <div className="rb-kpi-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
              <Layers size={18} />
            </div>
          </div>
          <div className="rb-kpi-value">{summary.total_operations}</div>
          <div className="rb-kpi-sub">Total database CRUD events tracked</div>
        </div>

        <div className="rb-kpi-card">
          <div className="rb-kpi-top">
            <span className="rb-kpi-label">Pending Recovery</span>
            <div className="rb-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="rb-kpi-value" style={{ color: '#2563eb' }}>
            {summary.pending_recovery}
          </div>
          <div className="rb-kpi-sub">Within active 48-hour restoration window</div>
        </div>

        <div className="rb-kpi-card">
          <div className="rb-kpi-top">
            <span className="rb-kpi-label">Expiring Soon</span>
            <div className="rb-kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="rb-kpi-value" style={{ color: '#d97706' }}>
            {summary.expiring_soon}
          </div>
          <div className="rb-kpi-sub">Less than 6 hours remaining</div>
        </div>

        <div className="rb-kpi-card">
          <div className="rb-kpi-top">
            <span className="rb-kpi-label">Permanently Finalized</span>
            <div className="rb-kpi-icon" style={{ background: '#f1f5f9', color: '#64748b' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="rb-kpi-value" style={{ color: '#64748b' }}>
            {summary.permanently_finalized}
          </div>
          <div className="rb-kpi-sub">Expired & irrevocably permanent</div>
        </div>

        <div className="rb-kpi-card">
          <div className="rb-kpi-top">
            <span className="rb-kpi-label">Restored Operations</span>
            <div className="rb-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="rb-kpi-value" style={{ color: '#059669' }}>
            {summary.restored_operations}
          </div>
          <div className="rb-kpi-sub">Successfully undone / rolled back</div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="rb-filter-card">
        <div className="rb-filter-grid">
          {/* Search Term */}
          <div className="rb-filter-item">
            <label className="rb-filter-label">Search Operations</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                className="rb-input"
                style={{ paddingLeft: '34px' }}
                placeholder="Search record name, ID, admin..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Module Filter */}
          <div className="rb-filter-item">
            <label className="rb-filter-label">Module / Section</label>
            <select
              className="rb-select"
              value={moduleFilter}
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            >
              <option value="all">All Modules</option>
              {summary.available_modules.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
              <option value="Students">Students</option>
              <option value="Staff & Roles">Staff & Roles</option>
              <option value="One-Day Attendance">One-Day Attendance</option>
              <option value="Attendance Schedules">Attendance Schedules</option>
              <option value="Forms & Polls">Forms & Polls</option>
              <option value="Security Strings">Security Strings</option>
            </select>
          </div>

          {/* Operation Type Filter */}
          <div className="rb-filter-item">
            <label className="rb-filter-label">Operation Type</label>
            <select
              className="rb-select"
              value={opFilter}
              onChange={(e) => { setOpFilter(e.target.value); setPage(1); }}
            >
              <option value="all">All Types (CRUD)</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="rb-filter-item">
            <label className="rb-filter-label">Recovery Status</label>
            <select
              className="rb-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Recovery (&lt; 48h)</option>
              <option value="expiring_soon">Expiring Soon (&lt; 6h)</option>
              <option value="restored">Restored</option>
              <option value="finalized">Permanently Finalized</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="rb-filter-item">
            <label className="rb-filter-label">From Date</label>
            <input
              type="date"
              className="rb-input"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            />
          </div>

          {/* Reset Action */}
          <div className="rb-filter-item">
            <button
              className="btn-rb-secondary"
              style={{ width: '100%', height: '40px' }}
              onClick={handleResetFilters}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Operations Table Card */}
      <div className="rb-table-card">
        <div className="rb-table-header">
          <h2 className="rb-table-title">Tracked Operations & Recovery Center</h2>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Showing <strong>{logs.length}</strong> of <strong>{totalCount}</strong> tracked records
          </span>
        </div>

        <div className="rb-table-responsive">
          <table className="rb-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Target Record & Module</th>
                <th>Admin Performer</th>
                <th>Operation Time</th>
                <th>48h Recovery Window</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                    <RefreshCw size={24} className="spin" style={{ color: '#059669', margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, color: '#64748b' }}>Loading tracked operations...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                    <RotateCcw size={32} style={{ color: '#cbd5e1', margin: '0 auto 10px auto' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No operations found</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                      Try adjusting your search terms or filters
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((item) => {
                  // Compute remaining seconds live based on local tick
                  const remaining = Math.max(0, item.remaining_seconds);
                  const isExpiringSoon = item.status === 'pending' && remaining > 0 && remaining <= 21600; // < 6h

                  return (
                    <tr key={item.id}>
                      {/* Operation Type */}
                      <td>
                        {item.operation_type === 'CREATE' && (
                          <span className="op-badge op-badge-create">
                            <PlusCircle size={13} /> CREATE
                          </span>
                        )}
                        {item.operation_type === 'UPDATE' && (
                          <span className="op-badge op-badge-update">
                            <Edit3 size={13} /> UPDATE
                          </span>
                        )}
                        {item.operation_type === 'DELETE' && (
                          <span className="op-badge op-badge-delete">
                            <Trash2 size={13} /> DELETE
                          </span>
                        )}
                      </td>

                      {/* Record & Module */}
                      <td>
                        <div className="rb-ident-wrapper">
                          <span className="rb-ident-name">
                            {item.record_identifier || `Record #${item.record_id}`}
                          </span>
                          <div className="rb-ident-meta">
                            <span className="rb-module-pill">{item.module_name}</span>
                            <span>Table: <code>{item.table_name}</code></span>
                          </div>
                        </div>
                      </td>

                      {/* Admin */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={14} style={{ color: '#64748b' }} />
                          <span style={{ fontWeight: 600 }}>{item.admin_name || 'Admin'}</span>
                        </div>
                      </td>

                      {/* Operation Time */}
                      <td>
                        <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                          {item.created_at}
                        </div>
                      </td>

                      {/* 48-Hour Recovery Window Countdown */}
                      <td>
                        {item.status === 'pending' && remaining > 0 && (
                          <span className={`rb-countdown-pill ${isExpiringSoon ? 'warning' : 'active'}`}>
                            <Clock size={13} />
                            {formatCountdown(remaining)}
                          </span>
                        )}

                        {item.status === 'restored' && (
                          <span className="rb-countdown-pill restored" title={`Restored by ${item.restored_by_name || 'Admin'} at ${item.restored_at}`}>
                            <CheckCircle2 size={13} /> Restored
                          </span>
                        )}

                        {(item.status === 'finalized' || remaining <= 0) && item.status !== 'restored' && (
                          <span className="rb-countdown-pill finalized">
                            <ShieldCheck size={13} /> Permanently Finalized
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`rb-status-pill rb-status-${item.status}`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="rb-action-group" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn-row-action btn-view-details"
                            onClick={() => setDetailItem(item)}
                            title="Inspect before/after data changes"
                          >
                            <Eye size={13} /> Details
                          </button>

                          {item.can_restore && (
                            <button
                              className="btn-row-action btn-restore"
                              onClick={() => setConfirmRestoreItem(item)}
                              title="Restore or reverse this operation within 48h"
                            >
                              <RotateCcw size={13} /> Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="rb-pagination-bar">
          <div className="rb-page-info">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total operations)
          </div>

          <div className="rb-page-nav">
            <button
              className="btn-page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <button
              className="btn-page"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: VIEW DETAILS (Visual Diff & Metadata)
          ========================================================================= */}
      {detailItem && (
        <div className="rb-modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="rb-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rb-modal-header">
              <h3 className="rb-modal-title">
                {detailItem.operation_type === 'CREATE' && <PlusCircle size={20} color="#059669" />}
                {detailItem.operation_type === 'UPDATE' && <Edit3 size={20} color="#2563eb" />}
                {detailItem.operation_type === 'DELETE' && <Trash2 size={20} color="#dc2626" />}
                <span>Operation Audit & Data Diff #{detailItem.id}</span>
              </h3>
              <button className="rb-modal-close" onClick={() => setDetailItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="rb-modal-body">
              {/* Metadata Highlights */}
              <div className="rb-meta-grid">
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Operation Type</span>
                  <span className="rb-meta-v">{detailItem.operation_type}</span>
                </div>
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Target Module</span>
                  <span className="rb-meta-v">{detailItem.module_name}</span>
                </div>
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Database Table</span>
                  <span className="rb-meta-v"><code>{detailItem.table_name}</code></span>
                </div>
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Record Identifier</span>
                  <span className="rb-meta-v">{detailItem.record_identifier || detailItem.record_id}</span>
                </div>
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Performed By</span>
                  <span className="rb-meta-v">{detailItem.admin_name || 'Admin'}</span>
                </div>
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Operation Timestamp</span>
                  <span className="rb-meta-v">{detailItem.created_at}</span>
                </div>
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Recovery Deadline</span>
                  <span className="rb-meta-v">{detailItem.recovery_deadline}</span>
                </div>
                <div className="rb-meta-item">
                  <span className="rb-meta-k">Recovery Status</span>
                  <span className="rb-meta-v" style={{ textTransform: 'capitalize' }}>
                    {detailItem.status}
                  </span>
                </div>
              </div>

              {/* Visual Diff: Before vs After */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#1e293b' }}>
                  State Changes & Snapshot Inspection
                </h4>
                <div className="rb-diff-container">
                  {/* Previous State */}
                  <div className="rb-diff-box">
                    <div className="rb-diff-box-header prev">
                      <Trash2 size={14} />
                      <span>Previous Version (Before Operation)</span>
                    </div>
                    <pre className="rb-json-viewer">
                      {detailItem.previous_data
                        ? JSON.stringify(detailItem.previous_data, null, 2)
                        : '(No previous state - Record was newly created)'}
                    </pre>
                  </div>

                  {/* New State */}
                  <div className="rb-diff-box">
                    <div className="rb-diff-box-header next">
                      <PlusCircle size={14} />
                      <span>New Version (After Operation)</span>
                    </div>
                    <pre className="rb-json-viewer">
                      {detailItem.new_data
                        ? JSON.stringify(detailItem.new_data, null, 2)
                        : '(No new state - Record was deleted)'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="rb-modal-footer">
              <button className="btn-rb-secondary" onClick={() => setDetailItem(null)}>
                Close
              </button>
              {detailItem.can_restore && (
                <button
                  className="btn-rb-cleanup"
                  onClick={() => {
                    setConfirmRestoreItem(detailItem);
                  }}
                >
                  <RotateCcw size={15} /> Restore Record
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CONFIRM RESTORE DIALOG
          ========================================================================= */}
      {confirmRestoreItem && (
        <div className="rb-modal-overlay" onClick={() => !restoreLoading && setConfirmRestoreItem(null)}>
          <div className="rb-modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="rb-modal-header">
              <h3 className="rb-modal-title">
                <RotateCcw size={20} color="#059669" />
                <span>Confirm Data Restoration</span>
              </h3>
              <button
                className="rb-modal-close"
                onClick={() => !restoreLoading && setConfirmRestoreItem(null)}
                disabled={restoreLoading}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rb-modal-body">
              <div className="rb-confirm-box green">
                <Info size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 className="rb-confirm-title">
                    Restoring {confirmRestoreItem.operation_type} Operation
                  </h4>
                  <p className="rb-confirm-text">
                    Target: <strong>{confirmRestoreItem.record_identifier || confirmRestoreItem.record_id}</strong>
                    <br />
                    Module: <strong>{confirmRestoreItem.module_name}</strong>
                  </p>
                </div>
              </div>

              <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: '1.5' }}>
                {confirmRestoreItem.operation_type === 'CREATE' && (
                  <p>
                    <strong>Undo Action:</strong> Restoring this operation will remove the newly created
                    record from active tables, reversing its addition.
                  </p>
                )}
                {confirmRestoreItem.operation_type === 'UPDATE' && (
                  <p>
                    <strong>Undo Action:</strong> Restoring this operation will re-apply the previous
                    snapshot values, rolling back any recent edits.
                  </p>
                )}
                {confirmRestoreItem.operation_type === 'DELETE' && (
                  <p>
                    <strong>Undo Action:</strong> Restoring this operation will re-insert and resurrect the
                    deleted record back into the database with its previous state.
                  </p>
                )}

                <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  ⏳ This action is permitted because it is within the 48-hour temporary recovery window.
                </p>
              </div>
            </div>

            <div className="rb-modal-footer">
              <button
                className="btn-rb-secondary"
                onClick={() => setConfirmRestoreItem(null)}
                disabled={restoreLoading}
              >
                Cancel
              </button>
              <button
                className="btn-rb-cleanup"
                onClick={handleExecuteRestore}
                disabled={restoreLoading}
              >
                {restoreLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw size={15} />
                    Confirm & Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecycleBinView;
