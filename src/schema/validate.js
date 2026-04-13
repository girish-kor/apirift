'use strict';

const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: false });

const logEntrySchema = {
  type: 'object',
  required: ['id', 'timestamp', 'method', 'url', 'status', 'latencyMs'],
  properties: {
    id:         { type: 'string' },
    timestamp:  { type: 'string' },
    method:     { type: 'string', enum: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'] },
    url:        { type: 'string' },
    status:     { type: 'integer', minimum: 0, maximum: 599 },
    latencyMs:  { type: 'number',  minimum: 0 },
    reqHeaders: { type: 'object' },
    resHeaders: { type: 'object' },
    reqBody:    {},
    resBody:    {}
  }
};

const validate = ajv.compile(logEntrySchema);

function validateEntry(entry) {
  return validate(entry) ? [] : (validate.errors || []).map(e => `${e.instancePath} ${e.message}`);
}

function validateAll(entries) {
  const invalid = [];
  let valid = 0;
  entries.forEach((entry, i) => {
    const errs = validateEntry(entry);
    if (errs.length) invalid.push({ line: i + 1, entry, errors: errs });
    else valid++;
  });
  return { valid, invalid };
}

module.exports = { validateEntry, validateAll };
