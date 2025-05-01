import inquirer from 'inquirer';

import { generateComponent } from './component';
import { generateSchema } from './schema';

interface InquirerResult {
    type: 'component' | 'schema';
    name: string;
}

async function main() {
    const { type } = await inquirer.prompt([
        {
            type: 'list',
            name: 'type',
            message: '무엇을 생성하시겠습니까?',
            choices: [
                {
                    name: '컴포넌트 생성',
                    value: 'component'
                },
                {
                    name: '스키마 생성',
                    value: 'schema'
                }
            ]
        }
    ]) as Pick<InquirerResult, 'type'>;

    if (type === 'component') {
        const result = await inquirer.prompt<Pick<InquirerResult, 'name'>>([
            {
                type: 'input',
                name: 'name',
                message: '컴포넌트 이름을 입력하세요:'
            }
        ]);

        await generateComponent(result);
    }

    if (type === 'schema') {
        const result = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: '스키마 이름을 입력하세요:'
            }
        ]) as Pick<InquirerResult, 'name'>;

        await generateSchema(result);
    }
}

main().catch((error) => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
});
