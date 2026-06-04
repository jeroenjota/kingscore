USE laurierboom;
CREATE TABLE IF NOT EXISTS kingen_game_states (
  game_id VARCHAR(32) PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
