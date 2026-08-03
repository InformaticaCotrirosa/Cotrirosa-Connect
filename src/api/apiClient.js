const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken() {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  async request(method, endpoint, data = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.token) {
      options.headers.Authorization = `Bearer ${this.token}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const isAuthAttempt = endpoint === '/auth/login' || endpoint === '/auth/register';
      if (response.status === 401 && !isAuthAttempt) {
        this.clearToken();
        window.location.href = '/login';
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro na requisição');
    }

    return response.json();
  }

  // Auth
  async register(username, password, full_name) {
    const data = await this.request('POST', '/auth/register', { username, password, full_name });
    if (data?.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async login(username, password) {
    const data = await this.request('POST', '/auth/login', { username, password });
    if (data?.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async logout() {
    try {
      await this.request('POST', '/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  getMe() {
    return this.request('GET', '/auth/me');
  }

  // Users
  listUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/users${query ? '?' + query : ''}`);
  }

  getUser(id) {
    return this.request('GET', `/users/${id}`);
  }

  updateUser(id, data) {
    return this.request('PUT', `/users/${id}`, data);
  }

  deleteUser(id) {
    return this.request('DELETE', `/users/${id}`);
  }

  // Calendar Events
  listCalendarEvents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/calendar-events${query ? '?' + query : ''}`);
  }

  getCalendarEvent(id) {
    return this.request('GET', `/calendar-events/${id}`);
  }

  createCalendarEvent(data) {
    return this.request('POST', '/calendar-events', data);
  }

  previewRecurrence(data) {
    return this.request('POST', '/calendar-events/recurrence-preview', data);
  }

  updateCalendarEvent(id, data) {
    return this.request('PUT', `/calendar-events/${id}`, data);
  }

  deleteCalendarEvent(id, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('DELETE', `/calendar-events/${id}${query ? '?' + query : ''}`);
  }

  // Event Invitations
  listEventInvitations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/event-invitations${query ? '?' + query : ''}`);
  }

  getEventInvitation(id) {
    return this.request('GET', `/event-invitations/${id}`);
  }

  createEventInvitation(data) {
    return this.request('POST', '/event-invitations', data);
  }

  // Notifications
  listNotifications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/notifications${query ? '?' + query : ''}`);
  }

  updateNotification(id, data) {
    return this.request('PUT', `/notifications/${id}`, data);
  }

  updateEventInvitation(id, status, response_note = null) {
    return this.request('PUT', `/event-invitations/${id}`, { status, response_note });
  }

  deleteEventInvitation(id) {
    return this.request('DELETE', `/event-invitations/${id}`);
  }

  // Meeting Rooms
  listMeetingRooms(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/meeting-rooms${query ? '?' + query : ''}`);
  }

  getMeetingRoom(id) {
    return this.request('GET', `/meeting-rooms/${id}`);
  }

  createMeetingRoom(data) {
    return this.request('POST', '/meeting-rooms', data);
  }

  updateMeetingRoom(id, data) {
    return this.request('PUT', `/meeting-rooms/${id}`, data);
  }

  deleteMeetingRoom(id) {
    return this.request('DELETE', `/meeting-rooms/${id}`);
  }

  // Departments
  listDepartments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/departments${query ? '?' + query : ''}`);
  }

  getDepartment(id) {
    return this.request('GET', `/departments/${id}`);
  }

  createDepartment(data) {
    return this.request('POST', '/departments', data);
  }

  updateDepartment(id, data) {
    return this.request('PUT', `/departments/${id}`, data);
  }

  deleteDepartment(id) {
    return this.request('DELETE', `/departments/${id}`);
  }
}

export default new ApiClient();
