import moduleAlias from 'module-alias';
import path from 'path';

moduleAlias.addAliases({
    '~': path.join(__dirname)
});
