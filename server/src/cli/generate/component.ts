import fs from 'fs/promises';
import path from 'path';

interface GenerateComponentOptions {
    name: string;
}

export async function generateComponent(options: GenerateComponentOptions) {
    const { name } = options;

    if (name[0] !== name[0].toUpperCase()) {
        throw new Error('Component name must start with capital letter');
    }

    const templatePath = path.resolve(__dirname, './template/component');
    const componentPath = path.resolve(__dirname, `../../client/src/components/${name}`);

    await fs.mkdir(componentPath, { recursive: true });

    const templates = await fs.readdir(templatePath);

    for (const template of templates) {
        const fileContent = await fs.readFile(path.resolve(templatePath, template), 'utf-8');

        await fs.writeFile(
            path.resolve(componentPath, template.replace(/__NAME__/g, name)),
            fileContent.replace(/__NAME__/g, name)
        );
    }
}
