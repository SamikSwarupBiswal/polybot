import winston from 'winston';
import path from 'path';

const logFilePath = path.resolve(process.cwd(), 'polybot.log');

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: logFilePath,
            maxsize: 10 * 1024 * 1024, // 10 MB per file
            maxFiles: 3,               // Keep last 3 rotations
        })
    ]
});

logger.info(`Logging to file: ${logFilePath}`);
