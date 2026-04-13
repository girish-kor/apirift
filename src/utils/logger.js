'use strict';

const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino(
  { level: process.env.LOG_LEVEL || 'info' },
  isDev
    ? pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } })
    : process.stdout
);

module.exports = logger;
