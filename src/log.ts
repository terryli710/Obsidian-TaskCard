const winston = require('winston');
const { format, transports } = winston
const path = require('path')

const loggerConfiguration = {
  transports: [new winston.transports.Console()],
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.label({ label: 'Obsidian Task Card' }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.splat(),
    format.simple(),
    format.printf(info => {
      const { timestamp, label, level, message, ...metadata } = info;
      let msg = `${timestamp} [${label}] ${level}: ${message} `;
      if(Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata);
      }
      return msg;
    })
  )
}


export const logger = winston.createLogger(loggerConfiguration);

