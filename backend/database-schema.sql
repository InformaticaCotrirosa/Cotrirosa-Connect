-- Script SQL para criar as tabelas do Cotrirosa-Connect
-- Executar no Oracle SQL*Plus ou SQL Developer

-- Criar tabela USERS
CREATE TABLE cnt_users (
  id VARCHAR2(36) PRIMARY KEY,
  email VARCHAR2(255) NOT NULL UNIQUE,
  password_hash VARCHAR2(255),
  full_name VARCHAR2(255),
  role VARCHAR2(50) DEFAULT 'user',
  position VARCHAR2(255),
  phone VARCHAR2(20),
  email_signature CLOB,
  status VARCHAR2(50) DEFAULT 'disponivel',
  unit VARCHAR2(100),
  work_schedule CLOB,
  created_date TIMESTAMP DEFAULT SYSDATE,
  updated_date TIMESTAMP
);

CREATE INDEX idx_cnt_users_email ON cnt_users(email);

-- Criar tabela DEPARTMENTS
CREATE TABLE cnt_departments (
  id VARCHAR2(36) PRIMARY KEY,
  name VARCHAR2(255) NOT NULL,
  description CLOB,
  unit VARCHAR2(100),
  manager_id VARCHAR2(36),
  created_date TIMESTAMP DEFAULT SYSDATE,
  updated_date TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES cnt_users(id)
);

CREATE INDEX idx_cnt_departments_unit ON cnt_departments(unit);

-- Criar tabela MEETING_ROOMS
CREATE TABLE cnt_meeting_rooms (
  id VARCHAR2(36) PRIMARY KEY,
  name VARCHAR2(255) NOT NULL,
  description CLOB,
  capacity NUMBER,
  location VARCHAR2(255),
  resources CLOB,
  color VARCHAR2(50) DEFAULT '#22c55e',
  type VARCHAR2(50) DEFAULT 'sala_reuniao',
  unit VARCHAR2(100),
  sort_order NUMBER DEFAULT 0,
  is_active NUMBER(1) DEFAULT 1,
  allowed_roles VARCHAR2(200),
  created_date TIMESTAMP DEFAULT SYSDATE,
  updated_date TIMESTAMP
);

-- Criar tabela CALENDAR_EVENTS
CREATE TABLE cnt_calendar_events (
  id VARCHAR2(36) PRIMARY KEY,
  title VARCHAR2(255) NOT NULL,
  description CLOB,
  location VARCHAR2(255),
  event_type VARCHAR2(50),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  all_day NUMBER(1) DEFAULT 0,
  participants CLOB,
  organizer_id VARCHAR2(36),
  organizer_name VARCHAR2(255),
  department_id VARCHAR2(36),
  unit VARCHAR2(100),
  room_id VARCHAR2(36),
  is_recurring NUMBER(1) DEFAULT 0,
  recurrence_rule VARCHAR2(255),
  recurrence_group_id VARCHAR2(36),
  color VARCHAR2(50) DEFAULT '#22c55e',
  priority VARCHAR2(50) DEFAULT 'media',
  created_date TIMESTAMP DEFAULT SYSDATE,
  updated_date TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES cnt_users(id),
  FOREIGN KEY (department_id) REFERENCES cnt_departments(id),
  FOREIGN KEY (room_id) REFERENCES cnt_meeting_rooms(id)
);

CREATE INDEX idx_cnt_calendar_events_start_date ON cnt_calendar_events(start_date);
CREATE INDEX idx_cnt_calendar_events_organizer_id ON cnt_calendar_events(organizer_id);
CREATE INDEX idx_cnt_calendar_events_recurrence_group ON cnt_calendar_events(recurrence_group_id);

-- Criar tabela EVENT_INVITATIONS
CREATE TABLE cnt_event_invitations (
  id VARCHAR2(36) PRIMARY KEY,
  event_id VARCHAR2(36) NOT NULL,
  event_title VARCHAR2(255),
  event_start TIMESTAMP,
  event_end TIMESTAMP,
  invitee_id VARCHAR2(36) NOT NULL,
  invitee_name VARCHAR2(255),
  inviter_id VARCHAR2(36),
  status VARCHAR2(50) DEFAULT 'pendente',
  response_note CLOB,
  created_date TIMESTAMP DEFAULT SYSDATE,
  updated_date TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES cnt_calendar_events(id) ON DELETE CASCADE,
  FOREIGN KEY (invitee_id) REFERENCES cnt_users(id),
  FOREIGN KEY (inviter_id) REFERENCES cnt_users(id)
);

CREATE INDEX idx_cnt_event_invitations_invitee_id ON cnt_event_invitations(invitee_id);
CREATE INDEX idx_cnt_event_invitations_event_id ON cnt_event_invitations(event_id);

-- Criar tabela NOTIFICATIONS
CREATE TABLE cnt_notifications (
  id VARCHAR2(36) PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  title VARCHAR2(255),
  message CLOB,
  notification_type VARCHAR2(50),
  related_id VARCHAR2(36),
  is_read NUMBER(1) DEFAULT 0,
  created_date TIMESTAMP DEFAULT SYSDATE,
  FOREIGN KEY (user_id) REFERENCES cnt_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_cnt_notifications_user_id ON cnt_notifications(user_id);
CREATE INDEX idx_cnt_notifications_is_read ON cnt_notifications(is_read);

-- Criar tabela INTERNAL_EMAILS
CREATE TABLE cnt_internal_emails (
  id VARCHAR2(36) PRIMARY KEY,
  sender_id VARCHAR2(36) NOT NULL,
  recipient_id VARCHAR2(36) NOT NULL,
  subject VARCHAR2(255),
  body CLOB,
  is_read NUMBER(1) DEFAULT 0,
  created_date TIMESTAMP DEFAULT SYSDATE,
  FOREIGN KEY (sender_id) REFERENCES cnt_users(id),
  FOREIGN KEY (recipient_id) REFERENCES cnt_users(id)
);

CREATE INDEX idx_cnt_internal_emails_recipient_id ON cnt_internal_emails(recipient_id);

-- Commit das mudanças
COMMIT;

-- Mensagem de conclusão: execute no cliente para confirmar
