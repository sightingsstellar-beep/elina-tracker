'use strict';

const session = require('express-session');

class PostgresSessionStore extends session.Store {
  constructor(database, ttlSeconds = 7 * 24 * 60 * 60) {
    super();
    this._db = database;
    this._ttl = ttlSeconds;

    setInterval(() => {
      this._db.sessionPrune(Math.floor(Date.now() / 1000)).catch(() => {});
    }, 60 * 60 * 1000).unref();
  }

  async get(sid, cb) {
    try {
      const row = await this._db.sessionGet(sid);
      if (!row) return cb(null, null);
      if (row.expires < Math.floor(Date.now() / 1000)) {
        await this._db.sessionDestroy(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (err) { cb(err); }
  }

  async set(sid, sess, cb) {
    try {
      const expires = Math.floor(Date.now() / 1000) + this._ttl;
      await this._db.sessionSet(sid, expires, JSON.stringify(sess));
      cb(null);
    } catch (err) { cb(err); }
  }

  async destroy(sid, cb) {
    try { await this._db.sessionDestroy(sid); cb(null); } catch (err) { cb(err); }
  }

  async touch(sid, sess, cb) {
    try {
      const expires = Math.floor(Date.now() / 1000) + this._ttl;
      await this._db.sessionTouch(sid, expires);
      cb(null);
    } catch (err) { cb(err); }
  }
}

module.exports = { PostgresSessionStore };
