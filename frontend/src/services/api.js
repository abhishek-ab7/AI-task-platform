const API_BASE = '/api';

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

const request = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
    }
    throw new Error(data.message || data.error || 'Something went wrong');
  }

  return data;
};

export const authAPI = {
  register: (name, email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request('/auth/me'),
};

export const taskAPI = {
  createTask: (title, inputText, operationType) =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, inputText, operationType }),
    }),
  getTasks: () => request('/tasks'),
  getTaskById: (id) => request(`/tasks/${id}`),
};
