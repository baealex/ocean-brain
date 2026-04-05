import crypto from 'crypto';

const TOKEN_BYTE_LENGTH = 32;
const HASH_ALGORITHM = 'sha256';

export interface IssuedMcpToken {
    plaintext: string;
    hash: string;
}

const toTokenHash = (token: string) => {
    return crypto
        .createHash(HASH_ALGORITHM)
        .update(token, 'utf8')
        .digest('hex');
};

export const issueMcpToken = (): IssuedMcpToken => {
    const plaintext = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
    const hash = toTokenHash(plaintext);

    return {
        plaintext,
        hash
    };
};

export const verifyMcpToken = (storedHash: string, presentedToken: string) => {
    const presentedHash = toTokenHash(presentedToken);
    const storedBuffer = Buffer.from(storedHash, 'utf8');
    const presentedBuffer = Buffer.from(presentedHash, 'utf8');

    if (storedBuffer.length !== presentedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(storedBuffer, presentedBuffer);
};
