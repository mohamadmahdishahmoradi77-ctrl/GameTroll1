-- Idempotent performance indexes. Safe to run repeatedly on MySQL.
-- Existing indexes from the complete schema are detected and skipped.

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'games' AND index_name = 'idx_games_status_created');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_games_status_created ON games(status,created_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'packs' AND index_name = 'idx_packs_status_created');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_packs_status_created ON packs(status,created_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'favorites' AND index_name = 'idx_favorites_user_created');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_favorites_user_created ON favorites(user_id,created_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tickets' AND index_name = 'idx_tickets_user_updated');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_tickets_user_updated ON tickets(user_id,updated_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'notifications' AND index_name = 'idx_notifications_user_created');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_notifications_user_created ON notifications(user_id,created_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'sessions' AND index_name = 'idx_sessions_user_expiry');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_sessions_user_expiry ON sessions(user_id,expires_at,revoked_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'password_resets' AND index_name = 'idx_password_resets_user_expiry');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_password_resets_user_expiry ON password_resets(user_id,expires_at,used_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'reviews' AND index_name = 'idx_reviews_game_created');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_reviews_game_created ON reviews(game_id,status,created_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;

SET @gt_idx_exists := (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'pack_reviews' AND index_name = 'idx_pack_reviews_pack_created');
SET @gt_sql := IF(@gt_idx_exists = 0, 'CREATE INDEX idx_pack_reviews_pack_created ON pack_reviews(pack_id,status,created_at)', 'SELECT 1');
PREPARE gt_stmt FROM @gt_sql; EXECUTE gt_stmt; DEALLOCATE PREPARE gt_stmt;
