import React from 'react';

export default function TaskModal({ task, onClose }) {
  if (!task) return null;

  const renderBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    return <span className={`badge badge-${s}`}>{status}</span>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="task-title" style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>
              {task.title}
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span className="task-op-tag">{task.operationType}</span>
              {renderBadge(task.status)}
            </div>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.4rem 0.8rem' }}>
            ✕
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Input Text</label>
          <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>
            {task.inputText}
          </div>
        </div>

        {task.result !== undefined && task.result !== null && (
          <div className="form-group">
            <label className="form-label" style={{ color: '#34d399' }}>Processed Result</label>
            <div className="result-box">
              {typeof task.result === 'object' ? JSON.stringify(task.result, null, 2) : String(task.result)}
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Execution Logs</label>
          <div className="log-box">
            {task.logs && task.logs.length > 0 ? (
              task.logs.map((log, index) => (
                <div key={index} className={`log-entry ${log.level}`}>
                  <span style={{ opacity: 0.6, marginRight: '0.5rem' }}>
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>
                  <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>[{log.level}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            ) : (
              <span style={{ color: '#64748b' }}>No logs recorded yet.</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
