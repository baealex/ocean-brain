import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { resolveBuildAliases, rewriteBuildAliases } from '../../packages/server/scripts/resolve-build-aliases.mjs';

test('rewrites static, side-effect, re-export and dynamic aliases without changing unrelated text', () => {
    const dist = path.resolve('dist');
    const file = path.join(dist, 'features', 'example.js');
    const source = `import models from '~/models.js';
import '~/setup.js';
export { value } from '~/modules/value.js';
const lazy = import('~/modules/lazy.js');
const text = "import '~/keep.js'";
// import '~/comment.js'
import fs from 'node:fs';
import local from './local.js';
const url = import.meta.url;`;

    const rewritten = rewriteBuildAliases(source, file, dist);

    assert.equal(rewritten, source
        .replace("from '~/models.js'", "from '../models.js'")
        .replace("import '~/setup.js';", "import '../setup.js';")
        .replace("from '~/modules/value.js'", "from '../modules/value.js'")
        .replace("import('~/modules/lazy.js')", 'import("../modules/lazy.js")'));
});

test('rejects aliases outside the build output', () => {
    const dist = path.resolve('dist');

    assert.throws(() => rewriteBuildAliases("import '~/../secret.js'", path.join(dist, 'app.js'), dist), /escapes/);
});

test('resolves aliases throughout the emitted server tree', (context) => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'server-build-aliases-'));
    context.after(() => fs.rmSync(dist, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dist, 'features', 'note'), { recursive: true });
    const file = path.join(dist, 'features', 'note', 'handler.js');
    fs.writeFileSync(file, "import models from '~/models.js';");
    fs.writeFileSync(path.join(dist, 'app.js'), "import '~/models.js';");

    resolveBuildAliases(dist);

    assert.equal(fs.readFileSync(file, 'utf8'), "import models from '../../models.js';");
    assert.equal(fs.readFileSync(path.join(dist, 'app.js'), 'utf8'), "import './models.js';");
});
