import childProcess from 'child_process';
import {
    createDatabase,
    removeDatabase,
} from './shared';

const main = async () => {
    const fileName = 'test.sqlite3';

    try {
        await removeDatabase(fileName);
        await createDatabase();
        childProcess.execSync('jest --runInBand --coverage', {
            stdio: 'inherit',
        });
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await removeDatabase(fileName);
    }
};

main();
