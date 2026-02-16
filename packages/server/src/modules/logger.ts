import type { LoggerOptions } from 'express-winston';
import expressWinston from 'express-winston';
import winston from 'winston';
import type { TransformableInfo } from 'logform';

export const loggerOptions: LoggerOptions = {
    transports: [
        new winston.transports.Console()
    ],
    meta: true,
    requestWhitelist: [
        'httpVersion',
        'method',
        'originalUrl',
        'url',
        'query',
        'params',
        'ip',
        'headers'
    ],
    responseWhitelist: [
        'statusCode'
    ],
    headerBlacklist: [
        'authorization',
        'cookie',
        'set-cookie',
        'x-api-key'
    ],
    requestFilter: (
        req: { headers?: Record<string, string | string[] | undefined> } & Record<string, unknown>,
        propName: string
    ): unknown => {
        if (propName === 'headers') {
            const h = req.headers || {};
            return {
                'user-agent': h['user-agent'],
                'content-type': h['content-type'],
                'accept': h['accept'],
                'x-forwarded-for': h['x-forwarded-for'],
                'x-real-ip': h['x-real-ip']
            };
        }
        return (req as Record<string, unknown>)[propName];
    },
    responseFilter: (res: Record<string, unknown>, propName: string): unknown => {
        return res[propName];
    },
    format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf((info: TransformableInfo) => {
            const meta = (info as unknown as { meta?: Record<string, unknown> }).meta || {};
            const req = (meta.req as Record<string, unknown>) || {};
            const res = (meta.res as Record<string, unknown>) || {};
            const rt = (meta as Record<string, unknown>).responseTime as number | undefined;
            const method = req.method as string | undefined;
            const url = (req.originalUrl as string | undefined) || (req.url as string | undefined);
            const status = res.statusCode as number | undefined;
            const headers = (req.headers as Record<string, string> | undefined) || {};
            const ua = headers['user-agent'];
            const fwd = headers['x-forwarded-for'];
            const fwdFirst = typeof fwd === 'string' ? fwd.split(',')[0].trim() : undefined;
            const realIp = fwdFirst || headers['x-real-ip'];
            const socketIp = (req as unknown as { ip?: string; socket?: { remoteAddress?: string } }).ip
                || (req as unknown as { socket?: { remoteAddress?: string } }).socket?.remoteAddress;
            const clientIp = fwdFirst || realIp || socketIp || '';
            return `${info.timestamp as string} ${info.level as string}: [${status ?? ''}] ${method || ''} ${url || ''} ${rt ?? ''}ms ip="${clientIp}" ua="${ua || ''}"`;
        })
    ),
    colorize: true,
    expressFormat: false
};

export default expressWinston.logger(loggerOptions);
