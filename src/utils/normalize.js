'use strict';

const VOLATILE_KEYS = new Set([
  'id', '_id', 'timestamp', 'createdAt', 'updatedAt',
  'requestId', 'traceId', 'correlationId', 'nonce', 'etag', 'date'
]);

/**
 * normalize — recursively strip volatile keys from a body value.
 * Accepts string (attempts JSON parse), object, or array.
 * @param {any}      body
 * @param {string[]} [extra] — additional volatile keys
 */
function normalize(body, extra = []) {
  const blocked = extra.length ? new Set([...VOLATILE_KEYS, ...extra]) : VOLATILE_KEYS;
  return _walk(body, blocked);
}

function _walk(node, blocked) {
  if (node === null || node === undefined) return node;
  if (typeof node === 'string') {
    try { return _walk(JSON.parse(node), blocked); } catch { return node; }
  }
  if (Array.isArray(node)) return node.map(n => _walk(n, blocked));
  if (typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (!blocked.has(k)) out[k] = _walk(v, blocked);
    }
    return out;
  }
  return node;
}

module.exports = { normalize };
