import fs from 'fs/promises';
import path from 'path';

async function main() {
    const [, , schemaName] = process.argv;

    if (schemaName[0] !== schemaName[0].toLocaleLowerCase()) {
        throw new Error('Schema name must be in lowercase');
    }

    const templatePath = path.resolve(__dirname, './template/create-schema');
    const schemaPath = path.resolve(__dirname, `../src/schema/${schemaName}`);

    await fs.mkdir(schemaPath, { recursive: true });

    const templates = await fs.readdir(templatePath);

    for (const template of templates) {
        const fileContent = await fs.readFile(path.resolve(templatePath, template), 'utf-8');

        const titleCase = schemaName[0].toLocaleUpperCase() + schemaName.slice(1);

        await fs.writeFile(
            path.resolve(schemaPath, template.replace(/__NAME__/g, schemaName)),
            fileContent.replace(/__NAME__UPPER__/g, titleCase).replace(/__NAME__/g, schemaName)
        );
    }
}

main();
