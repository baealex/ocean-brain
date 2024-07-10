import expressWinston, { type LoggerOptions } from 'express-winston';
import winston from 'winston';

export const loggerOptions: LoggerOptions = {
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
    ),
    colorize: true,
    expressFormat: true
};

export default expressWinston.logger(loggerOptions);
