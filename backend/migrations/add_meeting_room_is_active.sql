-- Ativar/desativar salas de reunião
-- Execute no Oracle se a coluna ainda não existir:

ALTER TABLE cnt_meeting_rooms ADD is_active NUMBER(1) DEFAULT 1;
UPDATE cnt_meeting_rooms SET is_active = 1 WHERE is_active IS NULL;
COMMIT;
