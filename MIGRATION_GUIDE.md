# Migração do Base44 para Backend Próprio

## 📋 Visão Geral

Este documento descreve a migração da aplicação Cotrirosa-Connect do Base44 para um backend Node.js + Express + Oracle propriamente desenvolvido.

## 🏗️ Estrutura Criada

### Backend (`/backend`)

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js      # Conexão e pool Oracle
│   │   └── auth.js          # JWT configuration
│   ├── middleware/
│   │   └── auth.js          # Autenticação JWT
│   ├── routes/
│   │   ├── auth.js          # Autenticação (register, login, logout, me)
│   │   ├── users.js         # CRUD de usuários
│   │   ├── calendar.js      # CRUD de eventos
│   │   ├── eventInvitations.js  # CRUD de convites
│   │   ├── meetingRooms.js  # CRUD de salas
│   │   └── departments.js   # CRUD de departamentos
│   ├── utils/
│   │   └── helpers.js       # Funções auxiliares
│   └── server.js            # Aplicação Express
├── package.json
├── .env.example
└── database-schema.sql      # Schema Oracle
```

## 🗄️ Banco de Dados Oracle

As tabelas criadas espelham as entidades do Base44:

- **users** - Usuários do sistema
- **departments** - Departamentos
- **meeting_rooms** - Salas de reunião
- **calendar_events** - Eventos de calendário
- **event_invitations** - Convites de eventos
- **notifications** - Notificações
- **internal_emails** - Emails internos

### Executar Schema

```bash
# No SQL*Plus ou SQL Developer do seu Oracle
@backend/database-schema.sql
```

## 🚀 Configuração Inicial

### 1. Instalar Dependências

```bash
cd backend
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env` e atualize com suas credenciais:

```bash
cp .env.example .env
```

**Variáveis principais:**

```env
ORACLE_USER=seu_usuario
ORACLE_PASSWORD=sua_senha
ORACLE_CONNECTION_STRING=localhost:1521/seu_database
JWT_SECRET=sua_chave_super_secreta
```

### 3. Executar Server

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

Server estará disponível em: `http://localhost:3001`

## 🔄 Mapeamento de Endpoints

### Autenticação

| Base44 | Novo Backend |
|--------|-------------|
| `base44.auth.register()` | `POST /api/auth/register` |
| `base44.auth.login()` | `POST /api/auth/login` |
| `base44.auth.logout()` | `POST /api/auth/logout` |
| `base44.auth.me()` | `GET /api/auth/me` |

### Usuários

| Base44 | Novo Backend |
|--------|-------------|
| `base44.entities.User.list()` | `GET /api/users` |
| `base44.entities.User.get(id)` | `GET /api/users/{id}` |
| `base44.entities.User.update()` | `PUT /api/users/{id}` |

### Eventos

| Base44 | Novo Backend |
|--------|-------------|
| `base44.entities.CalendarEvent.list()` | `GET /api/calendar-events` |
| `base44.entities.CalendarEvent.create()` | `POST /api/calendar-events` |
| `base44.entities.CalendarEvent.update()` | `PUT /api/calendar-events/{id}` |
| `base44.entities.CalendarEvent.delete()` | `DELETE /api/calendar-events/{id}` |

### Convites

| Base44 | Novo Backend |
|--------|-------------|
| `base44.entities.EventInvitation.list()` | `GET /api/event-invitations` |
| `base44.entities.EventInvitation.create()` | `POST /api/event-invitations` |
| `base44.entities.EventInvitation.update()` | `PUT /api/event-invitations/{id}` |

### Salas de Reunião

| Base44 | Novo Backend |
|--------|-------------|
| `base44.entities.MeetingRoom.list()` | `GET /api/meeting-rooms` |

### Departamentos

| Base44 | Novo Backend |
|--------|-------------|
| `base44.entities.Department.list()` | `GET /api/departments` |

## 🔌 WebSocket (Real-time)

Substitui o `base44.entities.*.subscribe()` do Base44.

### No Cliente

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// Inscrever em atualizações de calendário
socket.on('connect', () => {
  socket.emit('subscribe:calendar', userId);
});

// Ouvir eventos
socket.on('event:created', (data) => {
  console.log('Novo evento:', data);
});

socket.on('event:updated', (data) => {
  console.log('Evento atualizado:', data);
});
```

## 📱 Cliente API (Frontend)

Um novo cliente API foi criado em `src/api/apiClient.js` que funciona como wrapper do novo backend, substituindo completamente o `base44Client.js`.

### Uso

```javascript
import apiClient from '@/api/apiClient';

// Autenticação
const result = await apiClient.login(email, password);
apiClient.setToken(result.token);

// Usuários
const users = await apiClient.listUsers();
const user = await apiClient.getUser(userId);

// Eventos
const events = await apiClient.listCalendarEvents();
await apiClient.createCalendarEvent(eventData);

// Convites
const invitations = await apiClient.listEventInvitations();
await apiClient.updateEventInvitation(id, 'aceito');
```

## 🔐 Autenticação

### JWT Token

- Token armazenado em `localStorage` como `auth_token`
- Enviado em todos os requests: `Authorization: Bearer {token}`
- Expira em 24h (configurável)

### Middleware

Todas as rotas (exceto `/auth/register` e `/auth/login`) requerem token válido.

## ✅ Próximas Etapas

1. **Atualizar Frontend**
   - Substituir imports de `base44Client` por `apiClient`
   - Atualizar componentes React para usar novo cliente
   - Implementar WebSocket

2. **Implementar Funções Remotas**
   - `listUsers` (já implementada como rota GET)
   - `manageRecurringEvents`
   - `handleEventRsvp`
   - `notifyEventParticipants`
   - `syncUsersFromSenior`

3. **Testes**
   - Testes unitários
   - Testes de integração
   - Testes de autenticação

4. **Deploy**
   - Containerizar com Docker
   - Configurar CI/CD
   - Deploy em servidor

## 📝 Notas Importantes

- A chave `JWT_SECRET` deve ser muito segura em produção
- Recomenda-se usar HTTPS em produção
- Implementar rate limiting para autenticação
- Adicionar validações mais robustas
- Implementar logs estruturados
- Adicionar tratamento de erros melhorado

## 🆘 Suporte

Para dúvidas ou problemas, consulte a documentação de cada componente nos arquivos do backend.
