import moduleAlias from 'module-alias';
import path from 'path';

// Register module aliases for compiled JavaScript code
moduleAlias.addAliases({
  '~': path.join(__dirname)
});
