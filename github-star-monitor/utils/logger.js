import { STORAGE_KEYS } from './storage.js';

const LOG_STORAGE_KEY = STORAGE_KEYS.LOGS;
const MAX_LOG_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_LOG_COUNT = 200;

let _logBuffer = [];

function generateId() {
  return Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

function formatTimestamp(isoString) {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

async function getStoredLogs() {
  const result = await chrome.storage.local.get(LOG_STORAGE_KEY);
  return result[LOG_STORAGE_KEY] || [];
}

async function setStoredLogs(logs) {
  await chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs });
}

async function pruneLogs(logs) {
  const now = Date.now();
  let pruned = logs.filter(log => (now - new Date(log.timestamp).getTime()) < MAX_LOG_AGE_MS);
  if (pruned.length > MAX_LOG_COUNT) {
    pruned = pruned.slice(pruned.length - MAX_LOG_COUNT);
  }
  return pruned;
}

async function log(level, event, message, data) {
  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level: level,
    event: event,
    message: message
  };
  if (data !== undefined) {
    entry.data = data;
  }

  _logBuffer.push(entry);

  const prefix = `[${entry.level}] ${event}`;
  switch (level) {
    case 'DEBUG':
      console.debug(prefix, message, data || '');
      break;
    case 'INFO':
      console.info(prefix, message, data || '');
      break;
    case 'WARN':
      console.warn(prefix, message, data || '');
      break;
    case 'ERROR':
      console.error(prefix, message, data || '');
      break;
  }
}

export async function flushLogs() {
  if (_logBuffer.length === 0) return;
  const toFlush = _logBuffer.splice(0);
  const logs = await getStoredLogs();
  logs.push(...toFlush);
  const pruned = await pruneLogs(logs);
  await setStoredLogs(pruned);
}

function debug(event, message, data) {
  return log('DEBUG', event, message, data);
}

function info(event, message, data) {
  return log('INFO', event, message, data);
}

function warn(event, message, data) {
  return log('WARN', event, message, data);
}

function error(event, message, data) {
  return log('ERROR', event, message, data);
}

async function getLogs() {
  return await getStoredLogs();
}

async function clearLogs() {
  await chrome.storage.local.remove(LOG_STORAGE_KEY);
}

async function exportLogs() {
  const logs = await getStoredLogs();
  if (!logs || logs.length === 0) {
    return '';
  }

  const lines = logs.map(entry => {
    const formattedTime = formatTimestamp(entry.timestamp);
    let line = `[${formattedTime}] [${entry.level}] ${entry.event} - ${entry.message}`;
    if (entry.data) {
      const dataStr = typeof entry.data === 'object' ? JSON.stringify(entry.data) : String(entry.data);
      line += ` (${dataStr})`;
    }
    return line;
  });

  return lines.join('\n');
}

export { log, debug, info, warn, error, getLogs, clearLogs, exportLogs };
