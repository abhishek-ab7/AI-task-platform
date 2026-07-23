import React, { useState, useEffect } from 'react';
import { taskAPI } from '../services/api';
import TaskModal from '../components/TaskModal';

const OPERATORS = [
  { id: 'UPPERCASE', name: 'Uppercase', desc: 'Convert text to uppercase' },
  { id: 'LOWERCASE', name: 'Lowercase', desc: 'Convert text to lowercase' },
  { id: 'REVERSE_STRING', name: 'Reverse String', desc: 'Reverse the input string' },
  { id: 'WORD_COUNT', name: 'Word Count', desc: 'Calculate total word count' },
];

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [operationType, setOperationType] = useState('UPPERCASE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchTasks = async () => {
    try {
      const data = await taskAPI.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const newTask = await taskAPI.createTask(title, inputText, operationType);
      setTitle('');
      setInputText('');
      setTasks([newTask, ...tasks]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    return <span className={`badge badge-${s}`}>{status}</span>;
  };

  return (
    <div className="dashboard-grid">
      {/* Create Task Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', height: 'fit-content' }}>
        <h2 className="section-title">Create AI Task</h2>
        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleCreateTask}>
          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Clean Customer Data"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Operation Type</label>
            <select
              className="form-select"
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
            >
              {OPERATORS.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Input Text</label>
            <textarea
              className="form-textarea"
              placeholder="Enter text to process..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Submitting...' : '▶ Run AI Task'}
          </button>
        </form>
      </div>

      {/* Task List */}
      <div>
        <div className="section-title">
          <span>Task Execution Queue</span>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
            Auto-refreshing every 3s
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <p>No tasks submitted yet.</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Create a new task on the left to start background execution.
            </p>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div
                key={task._id}
                className="glass-panel task-card"
                onClick={() => setSelectedTask(task)}
              >
                <div className="task-card-header">
                  <span className="task-title">{task.title}</span>
                  {renderBadge(task.status)}
                </div>

                <p className="task-preview">{task.inputText}</p>

                <div className="task-meta">
                  <span className="task-op-tag">{task.operationType}</span>
                  <span>{new Date(task.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Logs & Result Detail Modal */}
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
