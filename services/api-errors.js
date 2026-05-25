'use strict';

function apiError(res, status, error, code) {
  return res.status(status).json({ ok: false, error, code });
}

module.exports = { apiError };
