const winston = require('winston');

const logConfiguration = {
  transports: [new winston.transports.Console()]
};

export const logger = winston.createLogger(logConfiguration);
