import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../src/api/client.js';
import { jsonResponse } from '../setup.js';

const token = 'fake-token';
const id = 'fake-entry-id';
const payload = { title: 'Fake issue', description: 'Fake details' };

describe('API client', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  // This protects query filtering and bearer authentication for the list endpoint.
  it('sends only non-empty filters and the bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ problems: [] }));

    await api.listProblems('fake-token', { q: 'database refused', status: '', category: 'Backend', mine: false });

    expect(fetchMock).toHaveBeenCalledWith('/api/problems?q=database+refused&category=Backend', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-token' },
      body: undefined,
    });
  });

  // This protects the JSON request format used by the sign-in endpoint.
  it('sends login credentials as JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: 'fake-token' }));

    await api.login({ email: 'dev@example.test', password: 'fake-password' });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dev@example.test', password: 'fake-password' }),
    });
  });

  // These cases preserve readable server validation, authentication, and server errors.
  it.each([
    { status: 400, error: 'Invalid request' },
    { status: 401, error: 'Session expired' },
    { status: 500, error: 'Service unavailable' },
  ])('forwards the API message for HTTP $status', async ({ status, error }) => {
    fetchMock.mockResolvedValue(jsonResponse({ error }, status));

    await expect(api.me('fake-token')).rejects.toThrow(error);
  });

  // This keeps failures useful when a server returns a non-JSON error page.
  it('falls back to the HTTP status when an error response is not JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: vi.fn().mockRejectedValue(new Error('not JSON')) });

    await expect(api.me('fake-token')).rejects.toThrow('Request failed (502)');
  });

  // These cases protect the HTTP method, endpoint, auth header, and payload for API wrappers.
  it.each([
    { name: 'register', run: () => api.register(payload), url: '/api/auth/register', method: 'POST', body: payload, token: null },
    { name: 'update profile', run: () => api.updateProfile(token, payload), url: '/api/auth/me', method: 'PUT', body: payload },
    { name: 'providers', run: () => api.providers(), url: '/api/auth/providers', token: null },
    { name: 'get problem', run: () => api.getProblem(token, id), url: `/api/problems/${id}` },
    { name: 'create problem', run: () => api.createProblem(token, payload), url: '/api/problems', method: 'POST', body: payload },
    { name: 'update problem', run: () => api.updateProblem(token, id, payload), url: `/api/problems/${id}`, method: 'PUT', body: payload },
    { name: 'publish problem', run: () => api.publishProblem(token, id), url: `/api/problems/${id}/publish`, method: 'POST' },
    { name: 'delete problem', run: () => api.deleteProblem(token, id), url: `/api/problems/${id}`, method: 'DELETE' },
    { name: 'update solution', run: () => api.updateSolution(token, id, payload), url: `/api/problems/${id}/solution`, method: 'PUT', body: payload },
    { name: 'delete solution', run: () => api.deleteSolution(token, id), url: `/api/problems/${id}/solution`, method: 'DELETE' },
    { name: 'add validation', run: () => api.addValidation(token, id, 'fake validation'), url: `/api/problems/${id}/validations`, method: 'POST', body: { comment: 'fake validation' } },
    { name: 'remove validation', run: () => api.removeValidation(token, id, 'fake-validation-id'), url: `/api/problems/${id}/validations/fake-validation-id`, method: 'DELETE' },
    { name: 'archive problem', run: () => api.archiveProblem(token, id, 'fake reason'), url: `/api/problems/${id}/archive`, method: 'POST', body: { reason: 'fake reason' } },
    { name: 'unarchive problem', run: () => api.unarchiveProblem(token, id), url: `/api/problems/${id}/unarchive`, method: 'POST' },
    { name: 'add comment', run: () => api.addComment(token, id, 'fake comment', 'fake-parent-id'), url: `/api/problems/${id}/comments`, method: 'POST', body: { text: 'fake comment', parentId: 'fake-parent-id' } },
    { name: 'remove comment', run: () => api.removeComment(token, id, 'fake-comment-id'), url: `/api/problems/${id}/comments/fake-comment-id`, method: 'DELETE' },
    { name: 'company', run: () => api.company(token), url: '/api/company/me' },
    { name: 'list notifications', run: () => api.listNotifications(token), url: '/api/notifications' },
    { name: 'mark notification read', run: () => api.markNotificationRead(token, id), url: `/api/notifications/${id}/read`, method: 'PATCH' },
    { name: 'mark all notifications read', run: () => api.markAllNotificationsRead(token), url: '/api/notifications/read-all', method: 'PATCH' },
  ])('maps $name to the expected API request', async ({ run, url, method = 'GET', body, token: authToken = 'fake-token' }) => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await run();

    expect(fetchMock).toHaveBeenCalledWith(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  });

  // This protects successful endpoints that return no JSON body, such as HTTP 204.
  it('returns an empty object for a successful non-JSON response', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: vi.fn().mockRejectedValue(new Error('no body')) });

    await expect(api.deleteProblem('fake-token', 'fake-entry-id')).resolves.toEqual({});
  });

  // This keeps OAuth links rooted at the configured API base path.
  it('builds provider URLs without hard-coding a host', () => {
    expect(api.googleUrl()).toMatch(/\/api\/auth\/google$/);
    expect(api.microsoftUrl()).toMatch(/\/api\/auth\/microsoft$/);
  });
});
