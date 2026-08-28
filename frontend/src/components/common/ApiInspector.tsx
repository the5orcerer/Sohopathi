import React, { useState, useEffect } from 'react';
import type { ApiLog } from '../../types';
import { subscribeApiLogs, getApiAuth } from '../../services/api';
import { useSession } from '../../context/SessionContext';
import { Terminal, X, ChevronUp, ChevronDown, Key, ShieldCheck, Activity } from 'lucide-react';

export const ApiInspector: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const { session, currentPersona } = useSession();
  const auth = getApiAuth();

  useEffect(() => {
    return subscribeApiLogs((newLogs) => {
      setLogs(newLogs);
      if (!selectedLog && newLogs.length > 0) {
        setSelectedLog(newLogs[0]);
      }
    });
  }, [selectedLog]);

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          right: '1.25rem',
          zIndex: 999,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: '#818cf8',
          border: '1px solid rgba(129, 140, 248, 0.4)',
          borderRadius: 'var(--radius-full)',
          padding: '0.6rem 1.1rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(99, 102, 241, 0.3)',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Terminal size={15} />
        <span>Live API Inspector</span>
        <span
          style={{
            background: 'rgba(99, 102, 241, 0.3)',
            color: '#ffffff',
            borderRadius: '9999px',
            padding: '0.1rem 0.45rem',
            fontSize: '0.7rem',
          }}
        >
          {logs.length}
        </span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {/* Slide-Up Drawer Panel */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '4.5rem',
            right: '1.25rem',
            width: 'calc(100vw - 2.5rem)',
            maxWidth: '850px',
            maxHeight: '480px',
            height: '480px',
            background: '#090d16',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.2)',
            zIndex: 998,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#0f172a',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Terminal size={16} color="#818cf8" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', fontFamily: 'var(--font-sans)' }}>
                Backend Request & Context Inspector
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-sans)' }}>
                {currentPersona.roleName}
              </span>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Active Context Banner */}
          <div
            style={{
              padding: '0.6rem 1rem',
              background: '#131c31',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.5rem',
              fontSize: '0.72rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
              <Key size={13} color="#818cf8" />
              <span style={{ color: '#64748b' }}>Bearer:</span>
              <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {auth.token}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
              <Activity size={13} color="#06b6d4" />
              <span style={{ color: '#64748b' }}>x-institution-id:</span>
              <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {auth.institutionId}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
              <ShieldCheck size={13} color="#10b981" />
              <span style={{ color: '#64748b' }}>Resolved Permissions:</span>
              <span style={{ color: '#34d399', fontWeight: 600 }}>{session.permissions.length} active</span>
            </div>
          </div>

          {/* Main Body: Split View (Log List vs JSON Details) */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>
            {/* Left column: Request Logs */}
            <div
              style={{
                borderRight: '1px solid var(--border-subtle)',
                overflowY: 'auto',
                padding: '0.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              {logs.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                  No requests intercepted yet.
                </div>
              ) : (
                logs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  const isSuccess = log.status >= 200 && log.status < 300;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      style={{
                        padding: '0.5rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        border: isSelected ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        transition: 'background var(--transition-fast)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                        <span style={{ fontWeight: 600, color: log.method === 'POST' ? '#38bdf8' : '#818cf8' }}>
                          {log.method}
                        </span>
                        <span
                          style={{
                            color: isSuccess ? '#34d399' : '#fb7185',
                            fontWeight: 600,
                          }}
                        >
                          {log.status === 0 ? 'ERR' : log.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.url}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b' }}>
                        <span>{log.timestamp}</span>
                        <span>{log.durationMs}ms</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right column: JSON Details & Payload */}
            <div style={{ padding: '0.75rem 1rem', overflowY: 'auto', background: '#090d16' }}>
              {selectedLog ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.8rem', color: '#818cf8', fontWeight: 600 }}>
                      {selectedLog.method} {selectedLog.url}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Completed in {selectedLog.durationMs}ms
                    </span>
                  </div>

                  {/* Headers */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      Request Headers Sent
                    </div>
                    <pre
                      style={{
                        padding: '0.5rem',
                        background: '#0f172a',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(selectedLog.headers, null, 2)}
                    </pre>
                  </div>

                  {/* Response Payload */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      Response Body Payload
                    </div>
                    <pre
                      style={{
                        padding: '0.6rem',
                        background: '#0f172a',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.72rem',
                        color: '#34d399',
                        overflowX: 'auto',
                        maxHeight: '200px',
                      }}
                    >
                      {JSON.stringify(selectedLog.responsePayload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  Select an API request on the left to inspect headers and response payloads.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
