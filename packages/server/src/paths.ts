import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 패키지 루트 (dist/paths.js 기준 상위)
const PACKAGE_ROOT = process.env.OCEAN_BRAIN_PACKAGE_ROOT || path.resolve(__dirname, '..');
const DATA_DIR = process.env.OCEAN_BRAIN_DATA_DIR || '.';

// 이미지 디렉토리 (별도 지정 가능, Docker에서 분리 볼륨용)
const IMAGE_DIR = process.env.OCEAN_BRAIN_IMAGE_DIR || path.resolve(DATA_DIR, 'assets/images');
const SEARCH_INDEX_PATH = process.env.OCEAN_BRAIN_SEARCH_INDEX_PATH || path.resolve(DATA_DIR, 'search.sqlite3');
const EMBEDDING_API_KEY_PATH = path.resolve(DATA_DIR, 'embedding-api-key');

export const paths = {
    packageRoot: path.resolve(PACKAGE_ROOT),
    clientDist: path.resolve(PACKAGE_ROOT, 'client/dist'),
    clientIndex: path.resolve(PACKAGE_ROOT, 'client/dist/index.html'),
    imageDir: path.resolve(IMAGE_DIR),
    searchIndex: path.resolve(SEARCH_INDEX_PATH),
    embeddingApiKey: path.resolve(EMBEDDING_API_KEY_PATH),
};
