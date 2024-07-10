import fs from 'fs';
import childProcess from 'child_process';
import path from 'path';

const prismaPath = path.resolve(__dirname, '../prisma');

export const createDatabase = async () => {
    childProcess.execSync('npx prisma migrate dev', {
        stdio: 'inherit',
    });
};

export const removeDatabase = async (fileName = 'db.sqlite3') => {
    if (fs.existsSync(path.resolve(prismaPath, fileName))) {
        fs.unlinkSync(path.resolve(prismaPath, fileName));
    }
};
