"use strict";
/**
 * Social Media Analytics - SQLite Schema & Migration
 *
 * Uses better-sqlite3 synchronous API with user_version pragma for migrations.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = void 0;
// ============================================================================
// SCHEMA MIGRATIONS (versioned, run in order)
// ============================================================================
const MIGRATIONS = [
    // Version 1: Initial schema
    `
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    post_type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL DEFAULT '',
    hashtags TEXT NOT NULL DEFAULT '[]',
    media_urls TEXT NOT NULL DEFAULT '[]',
    published_at TEXT NOT NULL,
    external_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
  CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);
  CREATE INDEX IF NOT EXISTS idx_posts_external_id ON posts(external_id);

  CREATE TABLE IF NOT EXISTS post_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    impressions INTEGER NOT NULL DEFAULT 0,
    reach INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    saves INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    engagement_rate REAL NOT NULL DEFAULT 0.0,
    collected_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_post_metrics_post_id ON post_metrics(post_id);
  CREATE INDEX IF NOT EXISTS idx_post_metrics_collected_at ON post_metrics(collected_at);

  CREATE TABLE IF NOT EXISTS audience_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    followers INTEGER NOT NULL DEFAULT 0,
    following INTEGER NOT NULL DEFAULT 0,
    profile_views INTEGER NOT NULL DEFAULT 0,
    demographics TEXT NOT NULL DEFAULT '{}',
    active_hours TEXT NOT NULL DEFAULT '{}',
    growth_rate REAL NOT NULL DEFAULT 0.0,
    collected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audience_platform ON audience_metrics(platform);
  CREATE INDEX IF NOT EXISTS idx_audience_collected_at ON audience_metrics(collected_at);

  CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    profile_url TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_competitors_platform ON competitors(platform);

  CREATE TABLE IF NOT EXISTS competitor_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    engagement_rate REAL NOT NULL DEFAULT 0.0,
    published_at TEXT NOT NULL,
    collected_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_competitor_posts_competitor_id ON competitor_posts(competitor_id);

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    hashtags TEXT NOT NULL DEFAULT '[]',
    scheduled_for TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    post_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_scheduled_platform ON scheduled_posts(platform);
  CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_posts(status);
  CREATE INDEX IF NOT EXISTS idx_scheduled_for ON scheduled_posts(scheduled_for);

  CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    date TEXT NOT NULL,
    total_followers INTEGER NOT NULL DEFAULT 0,
    total_impressions INTEGER NOT NULL DEFAULT 0,
    avg_engagement_rate REAL NOT NULL DEFAULT 0.0,
    top_post_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (top_post_id) REFERENCES posts(id) ON DELETE SET NULL,
    UNIQUE(platform, date)
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_platform_date ON daily_snapshots(platform, date);
  `,
    // Version 2: Marketing automation tables (leads, campaigns, auto-reply rules)
    `
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL DEFAULT '',
    interest TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_platform ON leads(platform);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    platforms TEXT NOT NULL DEFAULT '[]',
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

  CREATE TABLE IF NOT EXISTS campaign_posts (
    campaign_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    PRIMARY KEY (campaign_id, post_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'keyword',
    trigger_value TEXT NOT NULL,
    reply_template TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    uses INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_auto_reply_platform ON auto_reply_rules(platform);
  CREATE INDEX IF NOT EXISTS idx_auto_reply_active ON auto_reply_rules(is_active);
  `,
    // Version 3: Social media monitoring tables
    `
  CREATE TABLE IF NOT EXISTS monitoring_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    action_type TEXT NOT NULL,
    comment_author TEXT,
    comment_text TEXT,
    reply_text TEXT,
    rule_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_monitoring_platform ON monitoring_log(platform);
  CREATE INDEX IF NOT EXISTS idx_monitoring_created ON monitoring_log(created_at);

  CREATE TABLE IF NOT EXISTS monitoring_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    interval_minutes INTEGER NOT NULL DEFAULT 10,
    platforms TEXT NOT NULL DEFAULT '["twitter","linkedin","youtube"]',
    max_replies_per_cycle INTEGER NOT NULL DEFAULT 5,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO monitoring_config (id) VALUES (1);
  `,
];
// ============================================================================
// MIGRATION RUNNER
// ============================================================================
function runMigrations(db) {
    const currentVersion = db.pragma('user_version', { simple: true });
    if (currentVersion >= MIGRATIONS.length) {
        return; // Already up to date
    }
    console.log(`[Analytics DB] Running migrations ${currentVersion + 1} to ${MIGRATIONS.length}`);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    const runMigration = db.transaction((version) => {
        const sql = MIGRATIONS[version];
        // Split on semicolons to execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        for (const stmt of statements) {
            db.exec(stmt);
        }
        db.pragma(`user_version = ${version + 1}`);
    });
    for (let v = currentVersion; v < MIGRATIONS.length; v++) {
        runMigration(v);
        console.log(`[Analytics DB] Migration ${v + 1} applied`);
    }
    console.log(`[Analytics DB] Schema at version ${MIGRATIONS.length}`);
}
exports.runMigrations = runMigrations;
//# sourceMappingURL=schema.js.map