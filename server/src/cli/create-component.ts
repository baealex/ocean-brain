import fs from 'fs/promises';
import path from 'path';

async function main() {
    const [, , ...args] = process.argv;

    if (args.length === 0) {
        throw new Error('Please provide component name');
    }

    let directory = '';
    let componentName = '';

    if (args.length === 1) {
        [componentName] = args;
    }

    if (args.length === 2) {
        [directory, componentName] = args;
    }

    if (componentName[0] !== componentName[0].toUpperCase()) {
        throw new Error('Component name must start with capital letter');
    }

    const templatePath = path.resolve(__dirname, './template/create-component');
    const componentPath = path.resolve(__dirname, `../client/src/components/${directory}/${componentName}`);

    await fs.mkdir(componentPath, { recursive: true });

    const templates = await fs.readdir(templatePath);

    for (const template of templates) {
        const fileContent = await fs.readFile(path.resolve(templatePath, template), 'utf-8');

        await fs.writeFile(
            path.resolve(componentPath, template.replace(/__NAME__/g, componentName)),
            fileContent.replace(/__NAME__/g, componentName)
        );
    }
}

main();
