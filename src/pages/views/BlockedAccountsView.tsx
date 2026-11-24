import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Unlock, RefreshCw, Ban, FileWarning } from 'lucide-react';
import apiClient from '../../services/apiClient';

/**
 * Students blocked for sending an edited login token (or blocked by an admin), and the
 * log of every edited token the server received. Admin only (the API answers 403 to leaders).
 *
 * API: GET /security/blocks, POST /security/blocks/:id/unblock,
 *      GET /security/tamper-events, POST /security/tamper-events/:id/block
 */

interface StudentRef { id: number; name: string | null; student_code: string | null; room_number?: string | null }
interface Block {
  id: number;
  student: StudentRef;
  reason: string;
  source: string;
  is_active: boolean;
  blocked_by: string;
  blocked_at: string | null;
  unblocked_by: string | null;
  unblocked_at: string | null;
  unblock_note: string | null;
}
interface Change { field: string; expected: unknown; found: unknown }
interface TamperEvent {
  id: number;
  outcome: 'blocked' | 'corrupted' | 'unidentified';
  device_student: StudentRef | null;
  claimed_student: StudentRef | null;
  changes: Change[];
  block_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
  request_path: string | null;
  attempts: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

const OUTCOME_LABEL: Record<TamperEvent['outcome'], { text: string; color: string; bg: string }> = {
  blocked: { text: 'Blocked automatically', color: '#991b1b', bg: '#fee2e2' },
  corrupted: { text: 'Damaged token (not blocked)', color: '#92400e', bg: '#fef3c7' },
  unidentified: { text: 'Unknown phone (not blocked)', color: '#1e40af', bg: '#dbeafe' }
};

function when(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function who(s: StudentRef | null): string {
  if (!s) return 'Unknown';
  return `${s.name || 'Student'}${s.student_code ? ` (${s.student_code})` : ''}`;
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 12
};
const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 8,
  padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: bg, color
});

export const BlockedAccountsView: React.FC = () => {
  const [tab, setTab] = useState<'active' | 'history' | 'events'>('active');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [events, setEvents] = useState<TamperEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'events') {
        const res = await apiClient.get('/security/tamper-events?limit=200', { skipCache: true });
        setEvents(res.data.data || []);
      } else {
        const res = await apiClient.get(`/security/blocks?status=${tab === 'active' ? 'active' : 'all'}&limit=200`, { skipCache: true });
        setBlocks(res.data.data || []);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not load. Only platform admins can open this page.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleUnblock = async (b: Block) => {
    const note = window.prompt(`Unblock ${who(b.student)}?\n\nOptional note (e.g. "warned in person"):`, '');
    if (note === null) return;
    setBusyId(`b${b.id}`);
    try {
      await apiClient.post(`/security/blocks/${b.id}/unblock`, { note });
      setNotice(`${who(b.student)} is unblocked and can log in again.`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Unblock failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleBlockFromEvent = async (ev: TamperEvent) => {
    let studentId: number | undefined = ev.device_student?.id;
    if (!studentId) {
      const typed = window.prompt('This phone is not linked to a student. Enter the numeric student ID to block:', '');
      if (!typed) return;
      if (!/^[1-9]\d*$/.test(typed.trim())) {
        setError('Enter the numeric student ID (no leading zeros, not the bank code).');
        return;
      }
      studentId = Number(typed.trim());
    }
    const reason = window.prompt('Reason shown to the student:', `Edited login token (event #${ev.id}).`);
    if (reason === null) return;
    setBusyId(`e${ev.id}`);
    try {
      await apiClient.post(`/security/tamper-events/${ev.id}/block`, { student_id: studentId, reason });
      setNotice('Student blocked.');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Block failed');
    } finally {
      setBusyId(null);
    }
  };

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      onClick={() => { setTab(key); setNotice(''); }}
      style={{ ...btn(tab === key ? '#0f172a' : '#f1f5f9', tab === key ? '#fff' : '#0f172a') }}
    >{label}</button>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ShieldAlert size={24} color="#b91c1c" />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Blocked Accounts</h2>
      </div>
      <p style={{ color: '#64748b', marginTop: 0, fontSize: 14 }}>
        A student who edits their login token is blocked on every phone until you unblock them here.
        The block goes to the student logged in on the phone that sent it, so nobody can get a classmate blocked.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabBtn('active', 'Blocked now')}
        {tabBtn('history', 'All blocks')}
        {tabBtn('events', 'Edited-token log')}
        <button onClick={load} style={btn('#e2e8f0', '#0f172a')} disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>{error}</div>}
      {notice && <div style={{ ...card, background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>{notice}</div>}

      {tab !== 'events' && !loading && blocks.length === 0 && !error && (
        <div style={{ ...card, color: '#64748b' }}>{tab === 'active' ? 'No student is blocked.' : 'No blocks yet.'}</div>
      )}

      {tab !== 'events' && blocks.map(b => (
        <div key={b.id} style={{ ...card, borderLeft: `4px solid ${b.is_active ? '#dc2626' : '#94a3b8'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {who(b.student)}{b.student.room_number ? ` · Room ${b.student.room_number}` : ''}
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#334155' }}>
                  {b.source === 'multi_login' ? 'Multi-login (same phone)' : b.source === 'token_tamper' ? 'Edited token' : 'Blocked by admin'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#334155', margin: '6px 0' }}><strong>Reason:</strong> {b.reason}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Blocked {when(b.blocked_at)} by {b.blocked_by}
                {!b.is_active && <> · Unblocked {when(b.unblocked_at)} by {b.unblocked_by}{b.unblock_note ? ` (“${b.unblock_note}”)` : ''}</>}
              </div>
            </div>
            {b.is_active && (
              <button onClick={() => handleUnblock(b)} disabled={busyId === `b${b.id}`} style={btn('#16a34a')}>
                <Unlock size={14} /> {busyId === `b${b.id}` ? 'Unblocking…' : 'Unblock'}
              </button>
            )}
          </div>
        </div>
      ))}

      {tab === 'events' && !loading && events.length === 0 && !error && (
        <div style={{ ...card, color: '#64748b' }}>No edited tokens received.</div>
      )}

      {tab === 'events' && events.map(ev => {
        const label = OUTCOME_LABEL[ev.outcome];
        return (
          <div key={ev.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <FileWarning size={16} color={label.color} />
                  <span style={{ fontWeight: 800 }}>Sent from: {who(ev.device_student)}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: label.color, background: label.bg, padding: '2px 8px', borderRadius: 999 }}>
                    {label.text}
                  </span>
                </div>
                {ev.claimed_student && ev.claimed_student.id !== ev.device_student?.id && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>Token claimed to be: <strong>{who(ev.claimed_student)}</strong></div>
                )}
                <ul style={{ margin: '8px 0', paddingLeft: 18, fontSize: 13 }}>
                  {ev.changes.length === 0
                    ? <li>Contents unchanged, signature damaged.</li>
                    : ev.changes.map((c, i) => (
                      <li key={i}><strong>{c.field}</strong>: {JSON.stringify(c.expected)} → <span style={{ color: '#b91c1c' }}>{JSON.stringify(c.found)}</span></li>
                    ))}
                </ul>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {ev.attempts} attempt{ev.attempts === 1 ? '' : 's'} · first {when(ev.first_seen_at)} · last {when(ev.last_seen_at)}
                  {ev.ip_address ? ` · IP ${ev.ip_address}` : ''}{ev.request_path ? ` · ${ev.request_path}` : ''}
                </div>
              </div>
              {!ev.block_id && (
                <button onClick={() => handleBlockFromEvent(ev)} disabled={busyId === `e${ev.id}`} style={btn('#dc2626')}>
                  <Ban size={14} /> {busyId === `e${ev.id}` ? 'Blocking…' : 'Block student'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BlockedAccountsView;
