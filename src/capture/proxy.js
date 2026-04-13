'use strict';

const http      = require('http');
const httpProxy = require('http-proxy');
const { v4: uuidv4 } = require('uuid');
const logger    = require('../utils/logger');
const { maskHeaders, maskBody } = require('../utils/mask');
const { appendLog, rotateLogs } = require('../storage/fileStore');

const MAX_REQ_BODY_BYTES = 512 * 1024;
const MAX_LOG_ROTATE     = 50000;

/**
 * startProxy — transparent HTTP capture proxy.
 *
 * @param {object} opts
 * @param {number}   opts.port
 * @param {string}   opts.target         Upstream base URL (required)
 * @param {string}   opts.output         JSONL log file
 * @param {string[]} opts.maskFields     Request body fields to redact
 * @param {string[]} opts.extraHeaders   Additional header names to redact
 * @param {RegExp}   opts.filterPaths    Only capture paths matching this regex
 * @param {number}   opts.maxBodyKb      Response body cap in KB
 */
function startProxy({
  port         = 8080,
  target,
  output       = 'logs/logs.jsonl',
  maskFields   = [],
  extraHeaders = [],
  filterPaths  = null,
  maxBodyKb    = 512
} = {}) {
  if (!target) throw new Error('--target <url> is required for capture mode');

  const bodyCap = maxBodyKb * 1024;
  const proxy   = httpProxy.createProxyServer({ selfHandleResponse: true });

  proxy.on('proxyRes', (proxyRes, req, res) => {
    const chunks   = [];
    let totalSize  = 0;
    let truncated  = false;

    proxyRes.on('data', chunk => {
      totalSize += chunk.length;
      if (totalSize <= bodyCap) chunks.push(chunk);
      else if (!truncated) { truncated = true; logger.warn({ url: req.url, maxBodyKb }, 'response body truncated'); }
    });

    proxyRes.on('end', async () => {
      const rawBody   = Buffer.concat(chunks);
      const latencyMs = Date.now() - req._startTime;

      if (!filterPaths || filterPaths.test(req.url)) {
        let parsedReqBody = null;
        try { parsedReqBody = req._rawBody ? JSON.parse(req._rawBody) : null; } catch {}

        const entry = {
          id:         uuidv4(),
          timestamp:  new Date().toISOString(),
          method:     req.method,
          url:        req.url,
          reqHeaders: maskHeaders(req.headers, extraHeaders),
          reqBody:    parsedReqBody ? JSON.stringify(maskBody(parsedReqBody, maskFields)) : req._rawBody || null,
          status:     proxyRes.statusCode,
          resHeaders: maskHeaders(proxyRes.headers, extraHeaders),
          resBody:    rawBody.toString('utf8'),
          latencyMs,
          truncated
        };

        appendLog(output, entry).catch(err => logger.error({ err: err.message }, 'log write failed'));
        logger.info({ method: entry.method, url: entry.url, status: entry.status, latencyMs }, 'captured');
      }

      const fwd = Object.assign({}, proxyRes.headers);
      delete fwd['transfer-encoding'];
      for (const [k, v] of Object.entries(fwd)) res.setHeader(k, v);
      res.statusCode = proxyRes.statusCode;
      res.end(rawBody);
    });

    proxyRes.on('error', err => { logger.error({ err: err.message }, 'upstream response error'); res.end(); });
  });

  proxy.on('error', (err, req, res) => {
    logger.error({ err: err.message, url: req?.url }, 'proxy error');
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', detail: err.message }));
    }
  });

  const server = http.createServer((req, res) => {
    req._startTime = Date.now();
    const chunks   = [];
    let bodySize   = 0;

    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize <= MAX_REQ_BODY_BYTES) chunks.push(chunk);
    });
    req.on('end', () => {
      req._rawBody = chunks.length ? Buffer.concat(chunks).toString('utf8') : null;
      proxy.web(req, res, { target, selfHandleResponse: true });
    });
    req.on('error', err => { logger.error({ err: err.message }, 'request error'); res.writeHead(400); res.end(); });
  });

  const sigHandler = () => {
    logger.info('shutting down proxy');
    clearInterval(rotateInterval);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT',  sigHandler);
  process.on('SIGTERM', sigHandler);

  const rotateInterval = setInterval(
    () => rotateLogs(output, MAX_LOG_ROTATE).catch(() => {}),
    10 * 60 * 1000
  );
  rotateInterval.unref();

  server.listen(port, () => logger.info({ port, target, output }, 'apirift proxy listening'));
  return server;
}

module.exports = { startProxy };
