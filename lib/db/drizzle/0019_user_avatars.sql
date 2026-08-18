-- User profile avatars — uploaded through /api/storage/avatar, stored in the
-- media library, referenced by URL on the users row so every user list
-- (leaderboard, buddies, admin users) renders the same picture.
ALTER TABLE users ADD COLUMN avatar_url text;
