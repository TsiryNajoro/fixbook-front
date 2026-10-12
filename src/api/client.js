const API_URL = import.meta.env.VITE_API_URL ?? '';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),
  updateProfile: (token, payload) => request('/auth/me', { method: 'PUT', body: payload, token }),
  providers: () => request('/auth/providers'),
  googleUrl: () => `${API_URL}/api/auth/google`,
  microsoftUrl: () => `${API_URL}/api/auth/microsoft`,

  listProblems: (token, params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/problems${qs ? `?${qs}` : ''}`, { token });
  },
  getProblem: (token, id) => request(`/problems/${id}`, { token }),
  createProblem: (token, payload) => request('/problems', { method: 'POST', body: payload, token }),
  updateProblem: (token, id, payload) => request(`/problems/${id}`, { method: 'PUT', body: payload, token }),
  publishProblem: (token, id) => request(`/problems/${id}/publish`, { method: 'POST', token }),
  deleteProblem: (token, id) => request(`/problems/${id}`, { method: 'DELETE', token }),
  updateSolution: (token, id, payload) => request(`/problems/${id}/solution`, { method: 'PUT', body: payload, token }),
  deleteSolution: (token, id) => request(`/problems/${id}/solution`, { method: 'DELETE', token }),
  addValidation: (token, id, comment) =>
    request(`/problems/${id}/validations`, { method: 'POST', body: { comment }, token }),
  removeValidation: (token, id, validationId) =>
    request(`/problems/${id}/validations/${validationId}`, { method: 'DELETE', token }),
  archiveProblem: (token, id, reason) => request(`/problems/${id}/archive`, { method: 'POST', body: { reason }, token }),
  unarchiveProblem: (token, id) => request(`/problems/${id}/unarchive`, { method: 'POST', token }),
  addComment: (token, id, text, parentId) =>
    request(`/problems/${id}/comments`, { method: 'POST', body: { text, parentId }, token }),
  removeComment: (token, id, commentId) => request(`/problems/${id}/comments/${commentId}`, { method: 'DELETE', token }),

  company: (token) => request('/company/me', { token }),

  listNotifications: (token) => request('/notifications', { token }),
  markNotificationRead: (token, id) => request(`/notifications/${id}/read`, { method: 'PATCH', token }),
  markAllNotificationsRead: (token) => request('/notifications/read-all', { method: 'PATCH', token }),
};
