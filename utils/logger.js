const fs   = require('fs');
const path = require('path');

const COLORS = {
    info:    '\x1b[36m',
    warn:    '\x1b[33m',
    error:   '\x1b[31m',
    success: '\x1b[32m',
    debug:   '\x1b[35m',
};
const RESET = '\x1b[0m';

const LOG_DIR = path.join(__dirname, '../logs');

function getLogPath() {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(LOG_DIR, `${date}.log`);
}

function formatLine(level, args) {
    const time = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const msg  = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    return `[${time}] [${level.toUpperCase()}] ${msg}`;
}

function writeToFile(line) {
    try {
        fs.appendFileSync(getLogPath(), line + '\n');
    } catch {
        // Never let file I/O crash the bot
    }
}

function log(level, ...args) {
    const color = COLORS[level] ?? RESET;
    const line  = formatLine(level, args);
    console.log(color + line + RESET);
    writeToFile(line);
}

module.exports = { log };
