import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarClock, 
  PlusCircle, 
  FileSpreadsheet, 
  Users, 
  MessageSquare, 
  LogOut, 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  Palmtree, 
  Key, 
  KeyRound, 
  FileText, 
  ChevronDown,
  Clock,
  Send,
  X 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { renderSessionIcon } from '../utils/sessionIcons';
import './AdminSidebar.css';

interface AdminSidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
  sessions?: Array<{ session_key: string; session_name: string; icon_name?: string }>;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isOpen,
  onCloseMobile,
  sessions = [],
}) => {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const userRole = admin?.role || 'ADMIN';
  let permissions: any = admin?.session_permissions || {};
  if (typeof permissions === 'string') {
    try {
      permissions = JSON.parse(permissions);
    } catch (e) {
      permissions = {};
    }
  }

  // Show sections if admin OR if leader is explicitly granted permission
  const isLeader = userRole === 'LEADER' || userRole === 'floor_leader';
  const canShowWhatsApp = !isLeader || permissions?.can_access_whatsapp === true || permissions?.can_access_whatsapp === 'true' || permissions?.can_access_whatsapp === 1 || permissions?.can_access_whatsapp === '1';
  const canShowLeaves = !isLeader || permissions?.can_access_leaves === true || permissions?.can_access_leaves === 'true' || permissions?.can_access_leaves === 1 || permissions?.can_access_leaves === '1';
  const canShowSecurity = !isLeader || permissions?.can_access_security === true || permissions?.can_access_security === 'true' || permissions?.can_access_security === 1 || permissions?.can_access_security === '1';

  // Filter sessions assigned to leader
  let assignedSessions: string[] = admin?.assigned_sessions || ['all'];
  if (typeof assignedSessions === 'string') {
    try {
      assignedSessions = JSON.parse(assignedSessions);
    } catch (e) {
      assignedSessions = ['all'];
    }
  }
  if (!Array.isArray(assignedSessions)) {
    assignedSessions = ['all'];
  }

  const assignedLower = assignedSessions.map(s => String(s).toLowerCase().trim());
  const hasAllSessions = !isLeader || assignedLower.includes('all');

  const visibleSessions = sessions.filter(s => {
    if (!s.session_key) return false;
    if (hasAllSessions) return true;
    return assignedLower.includes(s.session_key.toLowerCase().trim());
  });

  const handleNavClick = (path: string) => {
    navigate(path);
    if (window.innerWidth <= 900) {
      onCloseMobile();
    }
  };

  // Route matches
  const isDashboard = pathname === '/' || pathname === '/dashboard';
  const isAttendance = pathname === '/attendance';
  const isLeaves = pathname === '/leaves';
  const isAttendanceActive = isAttendance || isLeaves;

  const isStudents = pathname === '/students';
  const isLeaders = pathname === '/leaders';
  const isSessionViewers = pathname === '/session-viewers';
  const isStudentsActive = isStudents || isLeaders || isSessionViewers;

  const isMessages = pathname === '/messages';
  const isTemplates = pathname === '/templates' || pathname === '/whatsapp-templates';
  const isWhatsAppActive = isMessages || isTemplates;

  const isStrings = pathname === '/strings' || pathname === '/floor-strings' || pathname === '/generate-string';
  const isSecurity = pathname === '/security';
  const isSecurityActive = isStrings || isSecurity;

  const isAddSession = pathname === '/session_add' || pathname === '/add_session';
  const isSessionsActive = pathname.startsWith('/session/') || isAddSession;

  // Category collapsible state (only open active category by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    attendance: isAttendanceActive,
    students: isStudentsActive,
    whatsapp: isWhatsAppActive,
    security: isSecurityActive,
    sessions: isSessionsActive
  });

  useEffect(() => {
    if (isAttendanceActive) setOpenSections(prev => ({ ...prev, attendance: true }));
    if (isStudentsActive) setOpenSections(prev => ({ ...prev, students: true }));
    if (isWhatsAppActive) setOpenSections(prev => ({ ...prev, whatsapp: true }));
    if (isSecurityActive) setOpenSections(prev => ({ ...prev, security: true }));
    if (isSessionsActive) setOpenSections(prev => ({ ...prev, sessions: true }));
  }, [isAttendanceActive, isStudentsActive, isWhatsAppActive, isSecurityActive, isSessionsActive]);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div 
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`} 
        onClick={onCloseMobile} 
        aria-hidden="true"
      />

      <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-wrap" style={isLeader ? { background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' } : {}}>
            {isLeader ? <UserCheck size={26} /> : <ShieldCheck size={26} />}
          </div>
          <div className="brand-info">
            <h2>{isLeader ? 'Mentor Portal' : 'HAMS Portal'}</h2>
            <span>{isLeader ? 'Mentor Console' : 'Admin Control'}</span>
          </div>
          <button 
            className="sidebar-close-btn" 
            onClick={onCloseMobile} 
            title="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

      {/* Navigation List */}
      <div className="sidebar-nav">
        <div className="nav-section-title">Main Operations</div>

        {/* 1. Dashboard Overview */}
        <button
          className={`nav-item-btn ${isDashboard ? 'active' : ''}`}
          onClick={() => handleNavClick('/')}
        >
          <LayoutDashboard size={18} className="nav-icon" />
          <span>Dashboard Overview</span>
        </button>

        {/* 2. Attendance Category (Collapsible Sub-menu) */}
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item-btn nav-group-btn ${isAttendanceActive ? 'parent-active' : ''}`}
            onClick={() => toggleSection('attendance')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CalendarClock size={18} className="nav-icon" style={{ color: '#4f46e5' }} />
              <span>Attendance</span>
            </div>
            <ChevronDown 
              size={16} 
              className={`nav-chevron ${openSections.attendance ? 'open' : ''}`} 
            />
          </button>

          {openSections.attendance && (
            <div className="nav-submenu">
              <button
                className={`nav-subitem-btn ${isAttendance ? 'active' : ''}`}
                onClick={() => handleNavClick('/attendance')}
              >
                <span className="subitem-bullet"></span>
                <FileSpreadsheet size={15} className="subitem-icon" />
                <span>Attendance Records</span>
              </button>

              {canShowLeaves && (
                <button
                  className={`nav-subitem-btn ${isLeaves ? 'active' : ''}`}
                  onClick={() => handleNavClick('/leaves')}
                >
                  <span className="subitem-bullet"></span>
                  <Palmtree size={15} className="subitem-icon" style={{ color: '#8b5cf6' }} />
                  <span>Approved Leaves</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Students & Users Category (Collapsible Sub-menu) */}
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item-btn nav-group-btn ${isStudentsActive ? 'parent-active' : ''}`}
            onClick={() => toggleSection('students')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users size={18} className="nav-icon" style={{ color: '#0284c7' }} />
              <span>{isLeader ? 'Students' : 'Students & Users'}</span>
            </div>
            <ChevronDown 
              size={16} 
              className={`nav-chevron ${openSections.students ? 'open' : ''}`} 
            />
          </button>

          {openSections.students && (
            <div className="nav-submenu">
              <button
                className={`nav-subitem-btn ${isStudents ? 'active' : ''}`}
                onClick={() => handleNavClick('/students')}
              >
                <span className="subitem-bullet"></span>
                <Users size={15} className="subitem-icon" />
                <span>Students Directory</span>
              </button>

              {!isLeader && (
                <>
                  <button
                    className={`nav-subitem-btn ${isLeaders ? 'active' : ''}`}
                    onClick={() => handleNavClick('/leaders')}
                  >
                    <span className="subitem-bullet"></span>
                    <Key size={15} className="subitem-icon" style={{ color: '#f59e0b' }} />
                    <span>User Credentials</span>
                  </button>

                  <button
                    className={`nav-subitem-btn ${isSessionViewers ? 'active' : ''}`}
                    onClick={() => handleNavClick('/session-viewers')}
                  >
                    <span className="subitem-bullet"></span>
                    <KeyRound size={15} className="subitem-icon" style={{ color: '#8b5cf6' }} />
                    <span>Live Viewer Numbers</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 4. WhatsApp Automation Category (Collapsible Sub-menu) */}
        {canShowWhatsApp && (
          <div className="nav-group">
            <button
              type="button"
              className={`nav-item-btn nav-group-btn ${isWhatsAppActive ? 'parent-active' : ''}`}
              onClick={() => toggleSection('whatsapp')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MessageSquare size={18} className="nav-icon" style={{ color: '#25D366' }} />
                <span>WhatsApp</span>
              </div>
              <ChevronDown 
                size={16} 
                className={`nav-chevron ${openSections.whatsapp ? 'open' : ''}`} 
              />
            </button>

            {openSections.whatsapp && (
              <div className="nav-submenu">
                <button
                  className={`nav-subitem-btn ${isMessages ? 'active' : ''}`}
                  onClick={() => handleNavClick('/messages')}
                >
                  <span className="subitem-bullet"></span>
                  <Send size={15} className="subitem-icon" style={{ color: '#25D366' }} />
                  <span>WhatsApp Messaging</span>
                </button>

                <button
                  className={`nav-subitem-btn ${isTemplates ? 'active' : ''}`}
                  onClick={() => handleNavClick('/templates')}
                >
                  <span className="subitem-bullet"></span>
                  <FileText size={15} className="subitem-icon" style={{ color: '#16a34a' }} />
                  <span>WhatsApp Templates</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. Security & Tokens Category (Collapsible Sub-menu) */}
        {(!isLeader || canShowSecurity) && (
          <div className="nav-group">
            <button
              type="button"
              className={`nav-item-btn nav-group-btn ${isSecurityActive ? 'parent-active' : ''}`}
              onClick={() => toggleSection('security')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ShieldCheck size={18} className="nav-icon" style={{ color: '#dc2626' }} />
                <span>Security & Tokens</span>
              </div>
              <ChevronDown 
                size={16} 
                className={`nav-chevron ${openSections.security ? 'open' : ''}`} 
              />
            </button>

            {openSections.security && (
              <div className="nav-submenu">
                {!isLeader && (
                  <button
                    className={`nav-subitem-btn ${isStrings ? 'active' : ''}`}
                    onClick={() => handleNavClick('/strings')}
                  >
                    <span className="subitem-bullet"></span>
                    <KeyRound size={15} className="subitem-icon" style={{ color: '#6366f1' }} />
                    <span>Generate String</span>
                  </button>
                )}

                {canShowSecurity && (
                  <button
                    className={`nav-subitem-btn ${isSecurity ? 'active' : ''}`}
                    onClick={() => handleNavClick('/security')}
                  >
                    <span className="subitem-bullet"></span>
                    <ShieldAlert size={15} className="subitem-icon" style={{ color: '#ef4444' }} />
                    <span>Proxy & IP Security</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. Live Sessions Category (Collapsible Sub-menu) */}
        {visibleSessions.length > 0 && (
          <div className="nav-group" style={{ marginTop: '6px' }}>
            <div className="nav-section-title" style={{ paddingBottom: '2px' }}>Session Management</div>
            <button
              type="button"
              className={`nav-item-btn nav-group-btn ${isSessionsActive ? 'parent-active' : ''}`}
              onClick={() => toggleSection('sessions')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={18} className="nav-icon" style={{ color: '#8b5cf6' }} />
                <span>Live Sessions</span>
                <span style={{ 
                  backgroundColor: '#f1f5f9', 
                  color: '#475569', 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  padding: '1px 6px', 
                  borderRadius: '10px' 
                }}>
                  {visibleSessions.length}
                </span>
              </div>
              <ChevronDown 
                size={16} 
                className={`nav-chevron ${openSections.sessions ? 'open' : ''}`} 
              />
            </button>

            {openSections.sessions && (
              <div className="nav-submenu">
                {visibleSessions.map((s) => (
                  <button
                    key={`sess_nav_${s.session_key}`}
                    className={`nav-subitem-btn ${pathname === `/session/${s.session_key}` ? 'active' : ''}`}
                    onClick={() => handleNavClick(`/session/${s.session_key}`)}
                  >
                    <span className="subitem-bullet"></span>
                    {renderSessionIcon(s.icon_name, s.session_key, 15, 'subitem-icon')}
                    <span>{s.session_name}</span>
                  </button>
                ))}

                {!isLeader && (
                  <button
                    className={`nav-subitem-btn ${isAddSession ? 'active' : ''}`}
                    onClick={() => handleNavClick('/session_add')}
                    style={{ color: '#4f46e5', fontWeight: 700 }}
                  >
                    <span className="subitem-bullet" style={{ backgroundColor: '#4f46e5' }}></span>
                    <PlusCircle size={15} className="subitem-icon" />
                    <span>+ Add New Session</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer User Info */}
      <div className="sidebar-footer">
        <div className="admin-profile">
          <div className="admin-avatar">
            {(admin?.name || 'A')[0].toUpperCase()}
          </div>
          <div>
            <div className="admin-name">{admin?.name || 'Administrator'}</div>
            <div className="admin-role">{userRole}</div>
          </div>
        </div>
        <button className="logout-icon-btn" onClick={logout} title="Log Out">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
    </>
  );
};
