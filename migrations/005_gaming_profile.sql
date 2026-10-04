CREATE TABLE achievements (id VARCHAR(191) PRIMARY KEY, code VARCHAR(100) NOT NULL UNIQUE, name VARCHAR(200) NOT NULL, description VARCHAR(500) NOT NULL, icon VARCHAR(20) NOT NULL DEFAULT '🏆', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE user_achievements (user_id VARCHAR(191) NOT NULL, achievement_id VARCHAR(191) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,achievement_id));
CREATE TABLE recently_viewed (user_id VARCHAR(191) NOT NULL, game_id VARCHAR(191) NOT NULL, viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,game_id));
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id,created_at);
CREATE INDEX idx_recently_viewed_user ON recently_viewed(user_id,viewed_at);
