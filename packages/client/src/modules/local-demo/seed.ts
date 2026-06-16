import type { Note, NoteProperty, NotePropertyOption, NotePropertyValueType } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import type { ViewSection, ViewTab } from '~/models/view.model';
import type { LocalPropertyDefinition, LocalTag } from './types';

interface SeedInput {
    tags: LocalTag[];
    nowMs: number;
}

interface SeedOutput {
    notes: Note[];
    propertyDefinitions: LocalPropertyDefinition[];
    reminders: Reminder[];
    viewTabs: ViewTab[];
}

const paragraphProps = {
    backgroundColor: 'default',
    textColor: 'default',
    textAlignment: 'left',
};

const text = (value: string) => ({ type: 'text', text: value, styles: {} });
const reference = (id: string, title: string) => ({ type: 'reference', props: { id, title } });

const block = (id: string, type: string, content: unknown[] = [], props: Record<string, unknown> = paragraphProps) => ({
    id,
    type,
    props,
    content,
    children: [],
});

const heading = (id: string, value: string, level = 1) =>
    block(id, 'heading', [text(value)], {
        ...paragraphProps,
        level,
        isToggleable: false,
    });

const paragraph = (id: string, content: unknown[]) => block(id, 'paragraph', content);
const bullet = (id: string, content: unknown[]) => block(id, 'bulletListItem', content);
const numbered = (id: string, value: string) => block(id, 'numberedListItem', [text(value)]);
const checklist = (id: string, value: string, checked = false) =>
    block(id, 'checkListItem', [text(value)], {
        ...paragraphProps,
        checked,
    });
const quote = (id: string, value: string) => block(id, 'quote', [text(value)]);
const code = (id: string, value: string, language = 'bash') =>
    block(id, 'codeBlock', [text(value)], {
        language,
    });

const tableOfContents = (id: string) => ({
    id,
    type: 'tableOfContents',
    props: {},
    children: [],
});

const stringifyBlocks = (blocks: unknown[]) => JSON.stringify(blocks);
const timestamp = (value: number) => String(value);
const plusDays = (base: number, days: number) => timestamp(base + days * 24 * 60 * 60 * 1000);
const datePlusDays = (base: number, days: number) =>
    new Date(base + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const plusMinutes = (base: number, minutes: number) => timestamp(base + minutes * 60 * 1000);

const findTag = (tags: LocalTag[], name: string) => tags.find((tag) => tag.name === name) ?? tags[0];

const option = (key: string, label: string, value: string, color: string, order: number): NotePropertyOption => ({
    id: `${key}-${value}`,
    label,
    value,
    color,
    order,
});

const statusOptions = [
    option('status', 'To Do', 'todo', '#94a3b8', 0),
    option('status', 'Doing', 'doing', '#38bdf8', 1),
    option('status', 'Done', 'done', '#22c55e', 2),
];
const priorityOptions = [
    option('priority', 'Low', 'low', '#94a3b8', 0),
    option('priority', 'Medium', 'medium', '#f59e0b', 1),
    option('priority', 'High', 'high', '#ef4444', 2),
];
const publishedOptions = [
    option('published', 'False', 'false', '#94a3b8', 0),
    option('published', 'True', 'true', '#22c55e', 1),
];

const createPropertyDefinitions = (updatedAt: string): LocalPropertyDefinition[] => [
    { key: 'status', name: 'Status', valueType: 'select', options: statusOptions, updatedAt },
    { key: 'priority', name: 'Priority', valueType: 'select', options: priorityOptions, updatedAt },
    { key: 'dueDate', name: 'Due date', valueType: 'date', options: [], updatedAt },
    { key: 'effort', name: 'Effort', valueType: 'number', options: [], updatedAt },
    { key: 'owner', name: 'Owner', valueType: 'text', options: [], updatedAt },
    { key: 'published', name: 'Published', valueType: 'select', options: publishedOptions, updatedAt },
];

const selectProperty = (
    key: string,
    name: string,
    value: string,
    options: NotePropertyOption[],
    createdAt: string,
): NoteProperty => ({
    key,
    name,
    value,
    valueType: 'select',
    option: options.find((item) => item.value === value) ?? null,
    createdAt,
    updatedAt: createdAt,
});

const valueProperty = (
    key: string,
    name: string,
    value: string,
    valueType: Exclude<NotePropertyValueType, 'select'>,
    createdAt: string,
): NoteProperty => ({
    key,
    name,
    value,
    valueType,
    option: null,
    createdAt,
    updatedAt: createdAt,
});

const properties = (
    createdAt: string,
    input: {
        status?: 'todo' | 'doing' | 'done';
        priority?: 'low' | 'medium' | 'high';
        dueDate?: string;
        effort?: number;
        owner?: string;
        published?: boolean;
    },
): NoteProperty[] => {
    const result: NoteProperty[] = [];
    if (input.status) result.push(selectProperty('status', 'Status', input.status, statusOptions, createdAt));
    if (input.priority) result.push(selectProperty('priority', 'Priority', input.priority, priorityOptions, createdAt));
    if (input.dueDate) result.push(valueProperty('dueDate', 'Due date', input.dueDate, 'date', createdAt));
    if (input.effort != null) result.push(valueProperty('effort', 'Effort', String(input.effort), 'number', createdAt));
    if (input.owner) result.push(valueProperty('owner', 'Owner', input.owner, 'text', createdAt));
    if (input.published != null) {
        result.push(
            selectProperty('published', 'Published', input.published ? 'true' : 'false', publishedOptions, createdAt),
        );
    }
    return result;
};

const createNote = ({
    id,
    title,
    blocks,
    createdAt,
    pinned = false,
    order,
    layout = 'wide',
    tags,
    noteProperties = [],
}: {
    id: string;
    title: string;
    blocks: unknown[];
    createdAt: string;
    pinned?: boolean;
    order: number;
    layout?: Note['layout'];
    tags: LocalTag[];
    noteProperties?: NoteProperty[];
}): Note => ({
    id,
    title,
    content: stringifyBlocks(blocks),
    pinned,
    order,
    layout,
    tags,
    properties: noteProperties,
    createdAt,
    updatedAt: String(Number(createdAt) + 1000),
});

const refBullet = (id: string, label: string, noteId: string, title: string) =>
    bullet(id, [text(label), reference(noteId, title)]);

export const createLocalDemoSeed = ({ tags, nowMs }: SeedInput): SeedOutput => {
    const seedStartMs = nowMs - 30 * 60 * 1000;
    const createdAt = timestamp(seedStartMs);
    const guide = findTag(tags, '@guide');
    const demo = findTag(tags, '@demo');
    const graph = findTag(tags, '@graph');
    const project = findTag(tags, '@project');
    const task = findTag(tags, '@task');
    const research = findTag(tags, '@research');
    const meeting = findTag(tags, '@meeting');
    const editor = findTag(tags, '@editor');
    const media = findTag(tags, '@media');
    const archive = findTag(tags, '@archive');

    const notes: Note[] = [
        createNote({
            id: '1',
            title: 'Welcome to Ocean Brain Demo',
            createdAt,
            pinned: true,
            order: 0,
            layout: 'wide',
            tags: [guide, demo],
            blocks: [
                tableOfContents('welcome-toc'),
                heading('welcome-heading', 'Ocean Brain Demo'),
                paragraph('welcome-intro', [
                    text(
                        'This public demo is local-only. Your edits stay in this browser, so you can explore freely and reset anytime.',
                    ),
                ]),
                heading('welcome-tour-heading', 'Suggested tour', 2),
                refBullet('welcome-link-backlinks', 'Explore links and backlinks: ', '2', 'Note Linking & Backlinks'),
                refBullet('welcome-link-project', 'Open a project workspace: ', '3', 'Project: Personal Knowledge Hub'),
                refBullet('welcome-link-task', 'Try task properties and reminders: ', '4', 'Task Management Demo'),
                refBullet('welcome-link-editor', 'Play with editor blocks: ', '7', 'Editing Playground'),
                refBullet('welcome-link-research', 'Read the local-first note: ', '5', 'Research: Local-first Demo'),
                quote('welcome-quote', 'A safe public demo should be useful, connected, and disposable.'),
            ],
        }),
        createNote({
            id: '2',
            title: 'Note Linking & Backlinks',
            createdAt: plusMinutes(seedStartMs, 1),
            pinned: true,
            order: 1,
            layout: 'wide',
            tags: [graph, guide],
            blocks: [
                heading('links-heading', 'Note Linking & Backlinks'),
                paragraph('links-references', [
                    text('This note references '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text(', '),
                    reference('3', 'Project: Personal Knowledge Hub'),
                    text(', and '),
                    reference('5', 'Research: Local-first Demo'),
                    text('.'),
                ]),
                paragraph('links-panel', [
                    text('Open the backlink panel or graph view to see incoming references from other notes.'),
                ]),
                bullet('links-incoming', [text('Incoming references become backlinks automatically.')]),
                bullet('links-create', [text('Create a new note that references this one to see the graph update.')]),
            ],
        }),
        createNote({
            id: '3',
            title: 'Project: Personal Knowledge Hub',
            createdAt: plusMinutes(seedStartMs, 2),
            pinned: true,
            order: 2,
            layout: 'wide',
            tags: [project, demo],
            noteProperties: properties(createdAt, {
                status: 'doing',
                priority: 'high',
                dueDate: datePlusDays(nowMs, 7),
                effort: 8,
                owner: 'Demo Team',
                published: true,
            }),
            blocks: [
                heading('project-heading', 'Project: Personal Knowledge Hub'),
                paragraph('project-intro', [
                    text('This project connects planning, tasks, meetings, backlinks, and research. Related notes: '),
                    reference('4', 'Task Management Demo'),
                    text(', '),
                    reference('6', 'Meeting Notes Template'),
                    text(', '),
                    reference('2', 'Note Linking & Backlinks'),
                    text(', and '),
                    reference('5', 'Research: Local-first Demo'),
                    text('.'),
                ]),
                heading('project-goals-heading', 'Goals', 2),
                checklist('project-goal-capture', 'Capture ideas without breaking flow'),
                checklist('project-goal-connect', 'Connect project notes through references'),
                checklist('project-goal-review', 'Review tasks from a table view'),
                paragraph('project-research', [
                    text('The local-first demo strategy is documented in '),
                    reference('5', 'Research: Local-first Demo'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '4',
            title: 'Task Management Demo',
            createdAt: plusMinutes(seedStartMs, 3),
            order: 3,
            layout: 'wide',
            tags: [task, project],
            noteProperties: properties(createdAt, {
                status: 'todo',
                priority: 'high',
                dueDate: datePlusDays(nowMs, 2),
                effort: 3,
                owner: 'Visitor',
                published: false,
            }),
            blocks: [
                heading('task-heading', 'Task Management Demo'),
                paragraph('task-intro', [
                    text('This note has task-like properties such as Status, Priority, Due date, Effort, and Owner.'),
                ]),
                paragraph('task-related', [
                    text('It belongs to '),
                    reference('3', 'Project: Personal Knowledge Hub'),
                    text(' and can be discussed in '),
                    reference('6', 'Meeting Notes Template'),
                    text('.'),
                ]),
                checklist('task-change-status', 'Change the Status property'),
                checklist('task-add-reminder', 'Add a reminder'),
                checklist('task-table-filter', 'Check Tasks tab table filters'),
            ],
        }),
        createNote({
            id: '5',
            title: 'Research: Local-first Demo',
            createdAt: plusMinutes(seedStartMs, 4),
            order: 4,
            layout: 'wide',
            tags: [research, demo],
            noteProperties: properties(createdAt, {
                status: 'done',
                priority: 'medium',
                effort: 5,
                owner: 'Researcher',
                published: true,
            }),
            blocks: [
                heading('research-heading', 'Research: Local-first Demo'),
                paragraph('research-intro', [
                    text('The demo should feel real while keeping visitor content inside the browser.'),
                ]),
                paragraph('research-related', [
                    text('This supports '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text(', '),
                    reference('2', 'Note Linking & Backlinks'),
                    text(', and '),
                    reference('3', 'Project: Personal Knowledge Hub'),
                    text('.'),
                ]),
                bullet('research-static', [text('Server stores static assets and seed data.')]),
                bullet('research-browser', [text('Browser storage keeps visitor edits local.')]),
                bullet('research-reset', [text('Reset clears local data and re-imports the seed workspace.')]),
            ],
        }),
        createNote({
            id: '6',
            title: 'Meeting Notes Template',
            createdAt: plusMinutes(seedStartMs, 5),
            order: 5,
            layout: 'wide',
            tags: [meeting, project],
            noteProperties: properties(createdAt, {
                status: 'todo',
                priority: 'medium',
                dueDate: datePlusDays(nowMs, 5),
                owner: 'Facilitator',
            }),
            blocks: [
                heading('meeting-heading', 'Meeting Notes Template'),
                paragraph('meeting-intro', [
                    text('A structured meeting note can keep agenda, decisions, and action items connected.'),
                ]),
                heading('meeting-agenda-heading', 'Agenda', 2),
                bullet('meeting-agenda-project', [
                    text('Review progress on '),
                    reference('3', 'Project: Personal Knowledge Hub'),
                ]),
                bullet('meeting-agenda-task', [text('Check task status in '), reference('4', 'Task Management Demo')]),
                bullet('meeting-agenda-links', [
                    text('Confirm important links in '),
                    reference('2', 'Note Linking & Backlinks'),
                ]),
                heading('meeting-decisions-heading', 'Decisions', 2),
                paragraph('meeting-decisions-placeholder', [text('Write decisions here after the meeting.')]),
                heading('meeting-actions-heading', 'Action items', 2),
                checklist('meeting-action-task', 'Update project task statuses'),
                checklist('meeting-action-summary', 'Share a short summary'),
            ],
        }),
        createNote({
            id: '7',
            title: 'Editing Playground',
            createdAt: plusMinutes(seedStartMs, 6),
            order: 6,
            layout: 'full',
            tags: [editor, guide],
            noteProperties: properties(createdAt, {
                status: 'todo',
                priority: 'low',
                owner: 'Visitor',
            }),
            blocks: [
                heading('editor-heading', 'Editing Playground'),
                paragraph('editor-intro', [
                    text('Use this page to test common BlockNote blocks. Return to '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text(' when done.'),
                ]),
                bullet('editor-bullet', [text('Bullet list item')]),
                numbered('editor-numbered', 'Numbered list item'),
                quote('editor-quote', 'A safe public demo should be useful, connected, and disposable.'),
                code('editor-code', 'npm run start\n# edit freely', 'bash'),
                checklist('editor-unchecked', 'Unchecked checklist item', false),
                checklist('editor-checked', 'Checked checklist item', true),
            ],
        }),
        createNote({
            id: '8',
            title: 'Media & Attachments Example',
            createdAt: plusMinutes(seedStartMs, 7),
            order: 7,
            layout: 'wide',
            tags: [media, demo],
            noteProperties: properties(createdAt, {
                status: 'todo',
                priority: 'low',
                owner: 'Visitor',
            }),
            blocks: [
                heading('media-heading', 'Media & Attachments Example'),
                paragraph('media-intro', [
                    text('Uploads in this demo are temporary and stay local to this browser session.'),
                ]),
                paragraph('media-links', [
                    text('Go back to '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text(' or try block editing in '),
                    reference('7', 'Editing Playground'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '9',
            title: 'Done: Prepare Seed Workspace',
            createdAt: plusMinutes(seedStartMs, 8),
            order: 8,
            layout: 'wide',
            tags: [archive, project],
            noteProperties: properties(createdAt, {
                status: 'done',
                priority: 'low',
                effort: 1,
                owner: 'Demo Team',
                published: true,
            }),
            blocks: [
                heading('done-heading', 'Done: Prepare Seed Workspace'),
                paragraph('done-intro', [
                    text('This completed note exists so Done filters and table examples have useful data.'),
                ]),
                paragraph('done-project', [
                    text('It belongs to '),
                    reference('3', 'Project: Personal Knowledge Hub'),
                    text('.'),
                ]),
            ],
        }),
    ];

    const reminders: Reminder[] = [
        {
            id: 'reminder-task-filter',
            noteId: 4,
            reminderDate: plusDays(nowMs, 2),
            completed: false,
            priority: 'high',
            content: 'Review task table filters',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: 'reminder-meeting',
            noteId: 6,
            reminderDate: plusDays(nowMs, 5),
            completed: false,
            priority: 'medium',
            content: 'Prepare next demo meeting',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: 'reminder-editor',
            noteId: 7,
            reminderDate: plusDays(nowMs, 1),
            completed: false,
            priority: 'low',
            content: 'Try editor blocks',
            createdAt,
            updatedAt: createdAt,
        },
    ];

    const viewTabs: ViewTab[] = [
        {
            id: 'view-tab-demo',
            title: 'Demo',
            order: 0,
            sections: [
                createViewSection('view-section-all', 'view-tab-demo', 'All demo notes', 0, [], []),
                createViewSection('view-section-project', 'view-tab-demo', 'Project notes', 1, ['project'], []),
            ],
        },
        {
            id: 'view-tab-tasks',
            title: 'Tasks',
            order: 1,
            sections: [
                createViewSection(
                    'view-section-todo',
                    'view-tab-tasks',
                    'To do',
                    0,
                    [],
                    [{ key: 'status', name: 'Status', valueType: 'select', operator: 'equals', value: 'todo' }],
                ),
                createViewSection(
                    'view-section-done',
                    'view-tab-tasks',
                    'Done',
                    1,
                    [],
                    [{ key: 'status', name: 'Status', valueType: 'select', operator: 'equals', value: 'done' }],
                ),
            ],
        },
    ];

    return {
        notes,
        propertyDefinitions: createPropertyDefinitions(createdAt),
        reminders,
        viewTabs,
    };
};

const createViewSection = (
    id: string,
    tabId: string,
    title: string,
    order: number,
    tagNames: string[],
    propertyFilters: ViewSection['propertyFilters'],
): ViewSection => ({
    id,
    tabId,
    title,
    displayType: 'table',
    displayOptions: { tableColumns: ['title', 'tags', 'properties', 'updatedAt'] },
    tagNames,
    mode: 'and',
    propertyFilters,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 25,
    order,
});
