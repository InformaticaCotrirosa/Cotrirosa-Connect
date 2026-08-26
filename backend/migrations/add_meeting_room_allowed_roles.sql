-- Perfis que podem AGENDAR o recurso (admin, gerente, coordenador, user).
-- NULL ou vazio = todos os perfis.
ALTER TABLE cnt_meeting_rooms ADD allowed_roles VARCHAR2(200);
