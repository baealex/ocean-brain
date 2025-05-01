import fs from 'fs/promises';
import path from 'path';

interface GenerateSchemaOptions {
    name: string;
}

export async function generateSchema(options: GenerateSchemaOptions) {
    const { name } = options;

    if (name[0] !== name[0].toLocaleLowerCase()) {
        throw new Error('Schema name must be in lowercase');
    }

    const templatePath = path.resolve(__dirname, './template/schema');
    const schemaPath = path.resolve(__dirname, `../../src/schema/${name}`);

    await fs.mkdir(schemaPath, { recursive: true });

    const templates = await fs.readdir(templatePath);

    for (const template of templates) {
        const fileContent = await fs.readFile(path.resolve(templatePath, template), 'utf-8');

        const titleCase = name[0].toLocaleUpperCase() + name.slice(1);

        await fs.writeFile(
            path.resolve(schemaPath, template.replace(/__NAME__/g, name)),
            fileContent.replace(/__NAME__UPPER__/g, titleCase).replace(/__NAME__/g, name)
        );
    }
}
