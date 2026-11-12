import winston from 'winston';
import 'winston-daily-rotate-file';
import { config } from './env.config.js';

// Cuanto más bajo el número, más grave es el evento
export const LOG_LEVELS = Object.freeze({
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
  http: 4,
  debug: 5,
});

const LEVEL_COLORS = {
  fatal: 'magenta',
  error: 'red',
  warning: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'gray',
};

const LOGS_DIR = 'logs';
const LONGEST_LEVEL = 'warning'.length;

// En desarrollo se ve todo; en producción, desde info hacia arriba
export const MIN_LEVEL = config.isProduction ? 'info' : 'debug';

winston.addColors(LEVEL_COLORS);

const { combine, timestamp, errors, printf, colorize } = winston.format;

// Formato: 2026-11-12 10:12:03 [info]    Mensaje
const line = printf((info) => {
  const rawLevel = info[Symbol.for('level')];
  const padding = ' '.repeat(LONGEST_LEVEL - rawLevel.length);
  const stack = info.stack ? `\n${info.stack}` : '';
  return `${info.timestamp} [${info.level}]${padding} ${info.message}${stack}`;
});

const baseFormat = combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }));

const rotatingFile = (name, level, extra = {}) =>
  new winston.transports.DailyRotateFile({
    dirname: LOGS_DIR,
    filename: `${name}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '14d',
    level,
    format: combine(baseFormat, line),
    ...extra,
  });

export const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: MIN_LEVEL,
  transports: [
    new winston.transports.Console({
      level: MIN_LEVEL,
      // Durante los tests la consola queda en silencio para que se lea el resultado de Mocha
      silent: config.isTest,
      format: config.isProduction ? combine(baseFormat, line) : combine(baseFormat, colorize(), line),
    }),
    // Solo error y fatal, y los errores que nadie atrapó
    rotatingFile('error', 'error', { handleExceptions: true, handleRejections: true }),
    // Todo lo que se registra según el entorno
    rotatingFile('combined', MIN_LEVEL),
  ],
  exitOnError: false,
});
