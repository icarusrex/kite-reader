-- Learner progress, kept off the device so clearing the browser cache or changing tablets loses nothing.
-- One row per learner profile; the app sends the whole profile and the row's rev guards against overwriting
-- a newer copy from another device.
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,             -- LearnerProfile JSON (name, createdAt, modules.reading, modules.math)
  rev INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Safety net: the last copy of each profile per day (kind 'daily'), and any copy that lost a sync conflict
-- (kind 'conflict'). Restorable by hand; pruned after 90 days.
CREATE TABLE snapshots (
  profile_id TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  saved_by TEXT NOT NULL,
  PRIMARY KEY (profile_id, day, kind)
);
