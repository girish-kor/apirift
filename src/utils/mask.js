'use strict';

const SENSITIVE = new Set([
  'authorization', 'cookie', 'set-cookie',
  'x-api-key', 'x-auth-token', 'x-secret',
  'proxy-authorization', 'www-authenticate'
]);

/**
 * maskHeaders — redact sensitive header values (returns new object).
 * @param {Record<string,string>} headers
 * @param {string[]} [extra] — additional keys to redact
 */
function maskHeaders(headers, extra = []) {
  if (!headers || typeof headers !== 'object') return {};
  const blocked = extra.length
    ? new Set([...SENSITIVE, ...extra.map(k => k.toLowerCase())])
    : SENSITIVE;
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = blocked.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

/**
 * maskBody — redact fields from a parsed JSON body (top-level only).
 * @param {any}      body
 * @param {string[]} fields
 */
function maskBody(body, fields = []) {
  if (!fields.length || body === null || typeof body !== 'object') return body;
  const blocked = new Set(fields);
  if (Array.isArray(body)) return body.map(item => maskBody(item, fields));
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    out[k] = blocked.has(k) ? '[REDACTED]' : v;
  }
  return out;
}

module.exports = { maskHeaders, maskBody };
