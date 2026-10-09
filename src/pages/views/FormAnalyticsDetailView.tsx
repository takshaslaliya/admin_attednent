import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  BarChart3, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  MessageSquare, 
  Search, 
  RotateCw, 
  Vote, 
  ClipboardList, 
  ChevronRight,
  Filter,
  Check,
  X
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import './FormAnalyticsDetailView.css';

export const FormAnalyticsDetailView: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'charts' | 'responses' | 'seen' | 'pending'>('charts');
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (formId) {
      fetchAnalytics();
    }
  }, [formId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/forms/${formId}/analytics`, { skipCache: true } as any);
      if ((res.data.success || res.data.status === 'ok') && res.data.data) {
        setAnalyticsData(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load form analytics');
      }
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchAnalytics();
  };

  const exportResponsesCSV = () => {
    if (!analyticsData || !analyticsData.responses) return;
    const respList = analyticsData.responses;
    const formFields = analyticsData.form?.fields || [];

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
    link.setAttribute('download', `form_report_${analyticsData.form?.title || 'export'}_${formId}.csv`);
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
    const msg = encodeURIComponent(`Hello ${studentName}, this is an urgent reminder from AVD Hostel Administration to fill out the form "${analyticsData?.form?.title}". Please open your student portal to complete it now.`);
    window.open(`https://wa.me/91${cleanPhone}?text=${msg}`, '_blank');
  };

  // Filtered lists for responses, seen, and pending
  const filteredResponses = (analyticsData?.responses || []).filter((r: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (r.student_name || '').toLowerCase().includes(q) ||
      (r.student_code || '').toLowerCase().includes(q) ||
      String(r.room_number || '').toLowerCase().includes(q);
    const matchesFloor = floorFilter === 'all' || String(r.floor_id) === floorFilter;
    return matchesSearch && matchesFloor;
  });

  const filteredSeenNotAnswered = (analyticsData?.seen_not_answered || []).filter((s: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q) ||
      String(s.room_number || '').toLowerCase().includes(q);
    const matchesFloor = floorFilter === 'all' || String(s.floor_id) === floorFilter;
    return matchesSearch && matchesFloor;
  });

  const filteredNotResponded = (analyticsData?.not_responded || []).filter((s: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q) ||
      String(s.room_number || '').toLowerCase().includes(q);
    const matchesFloor = floorFilter === 'all' || String(s.floor_id) === floorFilter;
    return matchesSearch && matchesFloor;
  });

  // Extract unique floors
  const availableFloors = Array.from(new Set([
    ...(analyticsData?.responses || []).map((r: any) => String(r.floor_id)),
    ...(analyticsData?.not_responded || []).map((r: any) => String(r.floor_id))
  ].filter(f => f && f !== 'undefined' && f !== 'null'))).sort((a, b) => Number(a) - Number(b));

  if (loading) {
    return (
      <div className="analytics-detail-page">
        <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b' }}>
          <RotateCw size={36} className="spin-icon" style={{ marginBottom: '1rem', color: '#3b82f6' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>Generating Form Report & Analytics...</h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Retrieving live student submissions, view logs, and vote breakdowns.</p>
        </div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="analytics-detail-page">
        <div className="report-top-nav">
          <button className="back-btn" onClick={() => navigate('/forms')}>
            <ArrowLeft size={16} /> Back to Forms & Polls
          </button>
        </div>
        <div className="error-card-state">
          <AlertCircle size={44} color="#ef4444" />
          <h3>Error Loading Analytics</h3>
          <p>{error || 'Form record or analytics data could not be retrieved.'}</p>
          <button className="retry-btn" onClick={fetchAnalytics}>
            <RotateCw size={15} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const { form, summary, field_analytics } = analyticsData;
  const isPoll = form.form_type === 'poll';

  return (
    <div className="analytics-detail-page">
      
      {/* Top Header & Navigation */}
      <div className="report-header-banner">
        <div className="report-nav-left">
          <button className="back-btn" onClick={() => navigate('/forms')}>
            <ArrowLeft size={16} /> Back to Forms
          </button>
          
          <div className="report-title-group">
            <div className="report-badge-row">
              <span className={`form-type-tag ${isPoll ? 'poll' : 'form'}`}>
                {isPoll ? <Vote size={13} /> : <ClipboardList size={13} />}
                {isPoll ? 'Poll' : 'Multi-Field Form'}
              </span>
              <span className={`form-status-tag ${form.is_active ? 'active' : 'paused'}`}>
                {form.is_active ? '● Live & Active' : '○ Paused / Inactive'}
              </span>
              {form.is_mandatory && (
                <span className="mandatory-tag">Mandatory on Login</span>
              )}
            </div>
            <h1 className="report-main-title">{form.title}</h1>
            {form.description && (
              <p className="report-main-desc">{form.description}</p>
            )}
            <div className="report-timing-info">
              <Clock size={13} />
              <span>
                <b>Start:</b> {new Date(form.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {' · '}
                <b>Deadline:</b> {new Date(form.end_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="report-actions-right">
          <button className="refresh-report-btn" onClick={handleManualRefresh} title="Refresh live responses">
            <RotateCw size={15} className={isRefreshing ? 'spin-icon' : ''} /> Refresh
          </button>
          <button className="export-csv-btn" onClick={exportResponsesCSV}>
            <Download size={15} /> Export CSV Report
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="report-stats-grid">
        <div className="report-stat-card">
          <div className="stat-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Users size={22} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Targeted Audience</span>
            <span className="stat-card-number">{summary.total_targeted}</span>
            <span className="stat-card-sub">Eligible students</span>
          </div>
        </div>

        <div className="report-stat-card highlight-success">
          <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Responses Received</span>
            <span className="stat-card-number">{summary.total_responded}</span>
            <span className="stat-card-sub" style={{ color: '#059669', fontWeight: 700 }}>
              {summary.response_rate}% Participation Rate
            </span>
          </div>
        </div>

        <div className="report-stat-card highlight-warning">
          <div className="stat-card-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
            <Eye size={22} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Seen But Not Answered</span>
            <span className="stat-card-number">{summary.seen_not_answered}</span>
            <span className="stat-card-sub" style={{ color: '#d97706', fontWeight: 600 }}>
              Viewed popup, skipped submission
            </span>
          </div>
        </div>

        <div className="report-stat-card">
          <div className="stat-card-icon" style={{ background: '#f8fafc', color: '#64748b' }}>
            <Clock size={22} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-title">Never Opened</span>
            <span className="stat-card-number">{summary.never_seen}</span>
            <span className="stat-card-sub">Pending initial view</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="report-tabs-bar">
        <div className="report-tabs-group">
          <button 
            className={`report-tab-pill ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            📊 Visual Results & Poll Breakdown
          </button>
          <button 
            className={`report-tab-pill ${activeTab === 'responses' ? 'active' : ''}`}
            onClick={() => setActiveTab('responses')}
          >
            📝 All Student Responses ({analyticsData.responses.length})
          </button>
          <button 
            className={`report-tab-pill ${activeTab === 'seen' ? 'active' : ''}`}
            onClick={() => setActiveTab('seen')}
          >
            👀 Seen But Not Answered ({analyticsData.seen_not_answered.length})
          </button>
          <button 
            className={`report-tab-pill ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            ⏳ All Pending ({analyticsData.not_responded.length})
          </button>
        </div>

        {activeTab !== 'charts' && (
          <div className="report-table-filters">
            <div className="report-search-box">
              <Search size={15} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search student, code, room..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  <X size={13} />
                </button>
              )}
            </div>

            {availableFloors.length > 0 && (
              <select 
                className="report-floor-select"
                value={floorFilter}
                onChange={e => setFloorFilter(e.target.value)}
              >
                <option value="all">All Floors</option>
                {availableFloors.map(f => (
                  <option key={f} value={f}>Floor {f}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: VISUAL BREAKDOWN & CHARTS */}
      {activeTab === 'charts' && (
        <div className="report-tab-content">
          {Object.keys(field_analytics || {}).length === 0 ? (
            <div className="empty-content-box">
              <ClipboardList size={40} color="#94a3b8" />
              <h4>No Multi-Choice Questions For Chart Visualization</h4>
              <p>Check the "All Student Responses" tab to review text responses submitted by students.</p>
            </div>
          ) : (
            <div className="poll-charts-grid">
              {Object.values(field_analytics).map((fieldAnalytic: any) => (
                <div key={fieldAnalytic.field_id} className="chart-breakdown-card">
                  <div className="chart-header">
                    <div>
                      <h3 className="chart-question-title">{fieldAnalytic.label}</h3>
                      <span className="chart-answer-count">{fieldAnalytic.total_answered} answered</span>
                    </div>
                  </div>

                  <div className="chart-options-list">
                    {fieldAnalytic.breakdown.map((optItem: any, idx: number) => (
                      <div key={idx} className="chart-option-row">
                        <div className="option-label-info">
                          <span className="option-name">{optItem.option}</span>
                          <span className="option-votes">{optItem.count} votes ({optItem.percentage}%)</span>
                        </div>
                        <div className="option-progress-track">
                          <div 
                            className="option-progress-fill" 
                            style={{ 
                              width: `${optItem.percentage}%`,
                              backgroundColor: idx % 4 === 0 ? '#3b82f6' : idx % 4 === 1 ? '#8b5cf6' : idx % 4 === 2 ? '#10b981' : '#f59e0b'
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: ALL RESPONSES TABLE */}
      {activeTab === 'responses' && (
        <div className="report-tab-content">
          <div className="report-table-wrapper">
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>Student Info</th>
                  <th>Room</th>
                  <th>Floor</th>
                  <th>Phone Number</th>
                  <th>Submitted At</th>
                  {(form.fields || []).map((f: any) => (
                    <th key={f.id}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResponses.length === 0 ? (
                  <tr>
                    <td colSpan={5 + (form.fields?.length || 0)} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      No responses matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredResponses.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.student_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🪪 {r.student_code || `#${r.student_id}`}</div>
                      </td>
                      <td><b>{r.room_number || 'N/A'}</b></td>
                      <td>Floor {r.floor_id || 'N/A'}</td>
                      <td>{r.phone || '—'}</td>
                      <td>{new Date(r.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      {(form.fields || []).map((f: any) => {
                        const ans = r.answers[f.id || f.key || f.label];
                        return (
                          <td key={f.id}>
                            {Array.isArray(ans) ? (
                              <span className="multi-tag-display">{ans.join(', ')}</span>
                            ) : ans !== undefined && ans !== null ? (
                              String(ans)
                            ) : (
                              <span style={{ color: '#cbd5e1' }}>—</span>
                            )}
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

      {/* TAB CONTENT 3: SEEN BUT NOT ANSWERED */}
      {activeTab === 'seen' && (
        <div className="report-tab-content">
          <div className="report-table-wrapper">
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Room</th>
                  <th>Floor</th>
                  <th>Phone</th>
                  <th>First Viewed</th>
                  <th>Last Viewed</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSeenNotAnswered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#059669', fontWeight: 700 }}>
                      <CheckCircle2 size={32} style={{ display: 'block', margin: '0 auto 8px auto' }} />
                      Great! No students have viewed without submitting.
                    </td>
                  </tr>
                ) : (
                  filteredSeenNotAnswered.map((s: any) => (
                    <tr key={s.student_id}>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{s.student_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🪪 {s.student_code || `#${s.student_id}`}</div>
                      </td>
                      <td><b>{s.room_number || 'N/A'}</b></td>
                      <td>Floor {s.floor_id || 'N/A'}</td>
                      <td>{s.phone || '—'}</td>
                      <td>{new Date(s.first_viewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{new Date(s.last_viewed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="whatsapp-btn"
                          onClick={() => sendWhatsAppReminder(s.phone, s.student_name)}
                        >
                          <MessageSquare size={13} /> Send WhatsApp Reminder
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

      {/* TAB CONTENT 4: ALL PENDING */}
      {activeTab === 'pending' && (
        <div className="report-tab-content">
          <div className="report-table-wrapper">
            <table className="report-data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Room</th>
                  <th>Floor</th>
                  <th>Phone</th>
                  <th>Portal View Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotResponded.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#059669', fontWeight: 700 }}>
                      <CheckCircle2 size={32} style={{ display: 'block', margin: '0 auto 8px auto' }} />
                      100% Complete! All targeted students have submitted.
                    </td>
                  </tr>
                ) : (
                  filteredNotResponded.map((s: any) => (
                    <tr key={s.student_id}>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{s.student_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>🪪 {s.student_code || `#${s.student_id}`}</div>
                      </td>
                      <td><b>{s.room_number || 'N/A'}</b></td>
                      <td>Floor {s.floor_id || 'N/A'}</td>
                      <td>{s.phone || '—'}</td>
                      <td>
                        {s.has_seen ? (
                          <span className="view-status-pill seen">
                            <Eye size={13} /> Viewed ({new Date(s.last_viewed_at).toLocaleDateString()})
                          </span>
                        ) : (
                          <span className="view-status-pill never">
                            Never Opened
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="whatsapp-btn"
                          onClick={() => sendWhatsAppReminder(s.phone, s.student_name)}
                        >
                          <MessageSquare size={13} /> Send Reminder
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

    </div>
  );
};

export default FormAnalyticsDetailView;
