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
const atDayHour = (base: number, days: number, hour: number) => {
    const date = new Date(base);
    date.setHours(hour, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return timestamp(date.getTime());
};

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
                        "This public demo is local-only. Your edits stay in this browser, so you can explore freely without changing anyone else's workspace.",
                    ),
                ]),
                heading('welcome-tour-heading', 'Suggested tour', 2),
                refBullet('welcome-link-backlinks', 'Explore links and backlinks: ', '2', 'Note Linking & Backlinks'),
                refBullet('welcome-link-project', 'Open a project workspace: ', '3', 'Project: Personal Knowledge Hub'),
                refBullet(
                    'welcome-link-board',
                    'See the Delivery board in Views: ',
                    '12',
                    'Project: Discovery Experience',
                ),
                refBullet('welcome-link-task', 'Try task properties and reminders: ', '4', 'Task Management Demo'),
                refBullet('welcome-link-editor', 'Play with editor blocks: ', '7', 'Editing Playground'),
                refBullet(
                    'welcome-link-research',
                    'Inspect a graph connection area: ',
                    '16',
                    'Research: Graph Discovery Patterns',
                ),
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
            tags: [graph, research],
            blocks: [
                heading('links-heading', 'Note Linking & Backlinks'),
                paragraph('links-references', [
                    text('This note references '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text(', '),
                    reference('16', 'Research: Graph Discovery Patterns'),
                    text(', and '),
                    reference('5', 'Research: Local-first Demo'),
                    text('.'),
                ]),
                paragraph('links-panel', [
                    text(
                        'Open the backlink panel or graph view to see how links form connection areas while tags provide supporting signals.',
                    ),
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
                    reference('12', 'Project: Discovery Experience'),
                    text(', and '),
                    reference('15', 'Decision: Ship Demo Walkthrough'),
                    text('.'),
                ]),
                heading('project-goals-heading', 'Goals', 2),
                checklist('project-goal-capture', 'Capture ideas without breaking flow'),
                checklist('project-goal-connect', 'Connect project notes through references'),
                checklist('project-goal-review', 'Review delivery from board and table views'),
                paragraph('project-research', [
                    text('The next discovery iteration is tracked in '),
                    reference('12', 'Project: Discovery Experience'),
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
                    reference('12', 'Project: Discovery Experience'),
                    text('.'),
                ]),
                checklist('task-change-status', 'Change the Status property'),
                checklist('task-add-reminder', 'Add a reminder'),
                checklist('task-table-filter', 'Check the Delivery board in Views'),
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
                    reference('2', 'Note Linking & Backlinks'),
                    text(', and '),
                    reference('16', 'Research: Graph Discovery Patterns'),
                    text('.'),
                ]),
                bullet('research-static', [text('The demo bundle ships its static assets and seed data.')]),
                bullet('research-browser', [text('Browser storage keeps visitor edits local.')]),
                bullet('research-refresh', [text('Versioned seed refreshes keep the public walkthrough current.')]),
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
                    text('Review discovery work in '),
                    reference('12', 'Project: Discovery Experience'),
                ]),
                heading('meeting-decisions-heading', 'Decisions', 2),
                paragraph('meeting-decisions-placeholder', [text('Write decisions here after the meeting.')]),
                heading('meeting-actions-heading', 'Action items', 2),
                checklist('meeting-action-task', 'Update project task statuses'),
                checklist('meeting-action-summary', 'Publish the demo walkthrough decision'),
                paragraph('meeting-decision-link', [
                    text('Decision record: '),
                    reference('15', 'Decision: Ship Demo Walkthrough'),
                ]),
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
                    text(' or continue with '),
                    reference('10', 'Capture Workflow Guide'),
                    text('.'),
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
                paragraph('media-intro', [text('Uploads stay in this browser and never leave the local demo.')]),
                paragraph('media-links', [
                    text('Go back to '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text(' or try block editing in '),
                    reference('7', 'Editing Playground'),
                    text(', then organize the result with '),
                    reference('10', 'Capture Workflow Guide'),
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
        createNote({
            id: '10',
            title: 'Capture Workflow Guide',
            createdAt: plusMinutes(seedStartMs, 9),
            order: 9,
            layout: 'wide',
            tags: [guide, editor],
            noteProperties: properties(createdAt, {
                status: 'doing',
                priority: 'medium',
                effort: 2,
                owner: 'Visitor',
            }),
            blocks: [
                heading('capture-heading', 'Capture Workflow Guide'),
                paragraph('capture-intro', [
                    text('Start from '),
                    reference('7', 'Editing Playground'),
                    text(', attach supporting material from '),
                    reference('8', 'Media & Attachments Example'),
                    text(', and return to '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text('.'),
                ]),
                checklist('capture-step-one', 'Capture one idea without organizing it first', true),
                checklist('capture-step-two', 'Add one useful tag and property'),
                checklist('capture-step-three', 'Review it during the weekly routine'),
                paragraph('capture-review', [
                    text('Continue with '),
                    reference('11', 'Weekly Review Routine'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '11',
            title: 'Weekly Review Routine',
            createdAt: plusMinutes(seedStartMs, 10),
            order: 10,
            layout: 'wide',
            tags: [guide, demo],
            noteProperties: properties(createdAt, {
                status: 'done',
                priority: 'low',
                effort: 1,
                owner: 'Visitor',
            }),
            blocks: [
                heading('review-heading', 'Weekly Review Routine'),
                paragraph('review-intro', [
                    text('Review recent captures from '),
                    reference('10', 'Capture Workflow Guide'),
                    text(' and clean up experiments in '),
                    reference('7', 'Editing Playground'),
                    text('.'),
                ]),
                bullet('review-link', [text('Add links when two notes answer the same question.')]),
                bullet('review-view', [text('Move active work into a focused View.')]),
                paragraph('review-home', [
                    text('Use '),
                    reference('1', 'Welcome to Ocean Brain Demo'),
                    text(' as the starting point for another tour.'),
                ]),
            ],
        }),
        createNote({
            id: '12',
            title: 'Project: Discovery Experience',
            createdAt: plusMinutes(seedStartMs, 11),
            order: 11,
            layout: 'wide',
            tags: [project, task],
            noteProperties: properties(createdAt, {
                status: 'doing',
                priority: 'high',
                dueDate: datePlusDays(nowMs, 4),
                effort: 5,
                owner: 'Demo Team',
                published: true,
            }),
            blocks: [
                heading('discovery-project-heading', 'Project: Discovery Experience'),
                paragraph('discovery-project-intro', [
                    text('This delivery stream belongs to '),
                    reference('3', 'Project: Personal Knowledge Hub'),
                    text(' and coordinates '),
                    reference('13', 'Task: Refine Connection Area Labels'),
                    text(', '),
                    reference('14', 'Task: Validate Board on Mobile'),
                    text(', and '),
                    reference('15', 'Decision: Ship Demo Walkthrough'),
                    text('.'),
                ]),
                heading('discovery-project-outcome', 'Expected outcome', 2),
                bullet('discovery-project-board', [text('The Delivery board has meaningful cards in every status.')]),
                bullet('discovery-project-graph', [
                    text('The graph reveals distinct areas connected by a small number of bridge notes.'),
                ]),
                paragraph('discovery-project-research', [
                    text('Research input: '),
                    reference('16', 'Research: Graph Discovery Patterns'),
                ]),
            ],
        }),
        createNote({
            id: '13',
            title: 'Task: Refine Connection Area Labels',
            createdAt: plusMinutes(seedStartMs, 12),
            order: 12,
            layout: 'wide',
            tags: [project, task],
            noteProperties: properties(createdAt, {
                status: 'todo',
                priority: 'medium',
                dueDate: datePlusDays(nowMs, 2),
                effort: 2,
                owner: 'Designer',
            }),
            blocks: [
                heading('labels-heading', 'Task: Refine Connection Area Labels'),
                paragraph('labels-context', [
                    text('Use the strongest hub note as a readable label inside '),
                    reference('12', 'Project: Discovery Experience'),
                    text('.'),
                ]),
                checklist('labels-check-map', 'Compare labels with the visible graph clusters'),
                checklist('labels-check-task', 'Keep task wording recognizable on the board'),
                paragraph('labels-related', [
                    text('Coordinate with '),
                    reference('14', 'Task: Validate Board on Mobile'),
                    text(' and '),
                    reference('3', 'Project: Personal Knowledge Hub'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '14',
            title: 'Task: Validate Board on Mobile',
            createdAt: plusMinutes(seedStartMs, 13),
            order: 13,
            layout: 'wide',
            tags: [project, task],
            noteProperties: properties(createdAt, {
                status: 'todo',
                priority: 'high',
                dueDate: datePlusDays(nowMs, 1),
                effort: 3,
                owner: 'QA',
            }),
            blocks: [
                heading('board-mobile-heading', 'Task: Validate Board on Mobile'),
                paragraph('board-mobile-context', [
                    text('Verify the status columns for '),
                    reference('12', 'Project: Discovery Experience'),
                    text(' without losing access to '),
                    reference('4', 'Task Management Demo'),
                    text('.'),
                ]),
                checklist('board-mobile-scroll', 'Move between status columns'),
                checklist('board-mobile-card', 'Open a card and return to the same View'),
                paragraph('board-mobile-labels', [
                    text('Share findings with '),
                    reference('13', 'Task: Refine Connection Area Labels'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '15',
            title: 'Decision: Ship Demo Walkthrough',
            createdAt: plusMinutes(seedStartMs, 14),
            order: 14,
            layout: 'wide',
            tags: [project, meeting],
            noteProperties: properties(createdAt, {
                status: 'done',
                priority: 'medium',
                effort: 2,
                owner: 'Demo Team',
                published: true,
            }),
            blocks: [
                heading('walkthrough-decision-heading', 'Decision: Ship Demo Walkthrough'),
                quote('walkthrough-decision', 'Lead with a real workspace, then let visitors explore freely.'),
                paragraph('walkthrough-project', [
                    text('Approved for '),
                    reference('12', 'Project: Discovery Experience'),
                    text(' after review in '),
                    reference('6', 'Meeting Notes Template'),
                    text('.'),
                ]),
                bullet('walkthrough-board', [text('Views should open with a useful list, table, and board.')]),
                bullet('walkthrough-graph', [text('The graph should show multiple understandable connection areas.')]),
                paragraph('walkthrough-owner', [
                    text('Follow-up owner: '),
                    reference('13', 'Task: Refine Connection Area Labels'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '16',
            title: 'Research: Graph Discovery Patterns',
            createdAt: plusMinutes(seedStartMs, 15),
            order: 15,
            layout: 'wide',
            tags: [research, graph],
            noteProperties: properties(createdAt, {
                status: 'doing',
                priority: 'high',
                effort: 5,
                owner: 'Researcher',
                published: true,
            }),
            blocks: [
                heading('graph-research-heading', 'Research: Graph Discovery Patterns'),
                paragraph('graph-research-intro', [
                    text('Links reveal working neighborhoods more reliably than tags alone. Compare '),
                    reference('2', 'Note Linking & Backlinks'),
                    text(' with '),
                    reference('5', 'Research: Local-first Demo'),
                    text('.'),
                ]),
                bullet('graph-research-area', [text('Dense internal links create a recognizable connection area.')]),
                bullet('graph-research-bridge', [text('A few bridge notes keep nearby areas discoverable.')]),
                paragraph('graph-research-related', [
                    text('Supporting studies: '),
                    reference('17', 'Research: Semantic Recall Signals'),
                    text(' and '),
                    reference('18', 'Experiment: Backlink Navigation'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '17',
            title: 'Research: Semantic Recall Signals',
            createdAt: plusMinutes(seedStartMs, 16),
            order: 16,
            layout: 'wide',
            tags: [research, graph],
            noteProperties: properties(createdAt, {
                status: 'todo',
                priority: 'medium',
                effort: 3,
                owner: 'Researcher',
            }),
            blocks: [
                heading('semantic-research-heading', 'Research: Semantic Recall Signals'),
                paragraph('semantic-research-intro', [
                    text('Search and graph exploration answer different recall problems. This study extends '),
                    reference('16', 'Research: Graph Discovery Patterns'),
                    text('.'),
                ]),
                bullet('semantic-research-search', [text('Search starts from a remembered phrase or meaning.')]),
                bullet('semantic-research-graph', [text('Graph exploration starts from a visible relationship.')]),
                paragraph('semantic-research-links', [
                    text('Compare the local-first constraints in '),
                    reference('5', 'Research: Local-first Demo'),
                    text(' with the navigation experiment in '),
                    reference('18', 'Experiment: Backlink Navigation'),
                    text('.'),
                ]),
            ],
        }),
        createNote({
            id: '18',
            title: 'Experiment: Backlink Navigation',
            createdAt: plusMinutes(seedStartMs, 17),
            order: 17,
            layout: 'wide',
            tags: [research, graph],
            noteProperties: properties(createdAt, {
                status: 'done',
                priority: 'low',
                effort: 2,
                owner: 'Visitor',
            }),
            blocks: [
                heading('backlink-experiment-heading', 'Experiment: Backlink Navigation'),
                paragraph('backlink-experiment-intro', [
                    text('Start at '),
                    reference('2', 'Note Linking & Backlinks'),
                    text(', move through '),
                    reference('16', 'Research: Graph Discovery Patterns'),
                    text(', and finish at '),
                    reference('17', 'Research: Semantic Recall Signals'),
                    text('.'),
                ]),
                checklist('backlink-experiment-open', 'Open a connected note from the graph', true),
                checklist('backlink-experiment-return', 'Return and keep the selected area in context', true),
                quote(
                    'backlink-experiment-result',
                    'A useful graph supports rediscovery without requiring a search query.',
                ),
            ],
        }),
    ];

    const reminders: Reminder[] = [
        {
            id: 'reminder-board-overdue',
            noteId: 14,
            reminderDate: plusDays(nowMs, -1),
            completed: false,
            priority: 'high',
            content: 'Finish the mobile board pass',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: 'reminder-labels-today',
            noteId: 13,
            reminderDate: atDayHour(nowMs, 0, 15),
            completed: false,
            priority: 'medium',
            content: 'Review connection area labels',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: 'reminder-task-filter',
            noteId: 4,
            reminderDate: plusDays(nowMs, 2),
            completed: false,
            priority: 'high',
            content: 'Review the Delivery board filters',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: 'reminder-meeting',
            noteId: 6,
            reminderDate: plusDays(nowMs, 5),
            completed: false,
            priority: 'medium',
            content: 'Prepare the next discovery review',
            createdAt,
            updatedAt: createdAt,
        },
        {
            id: 'reminder-walkthrough-complete',
            noteId: 15,
            reminderDate: plusDays(nowMs, -2),
            completed: true,
            priority: 'medium',
            content: 'Approve the demo walkthrough',
            createdAt: plusDays(nowMs, -7),
            updatedAt: plusDays(nowMs, -2),
        },
        {
            id: 'reminder-seed-complete',
            noteId: 9,
            reminderDate: plusDays(nowMs, -10),
            completed: true,
            priority: 'low',
            content: 'Prepare the seed workspace',
            createdAt: plusDays(nowMs, -14),
            updatedAt: plusDays(nowMs, -10),
        },
    ];

    const viewTabs: ViewTab[] = [
        {
            id: 'view-tab-overview',
            title: 'Overview',
            order: 0,
            sections: [
                {
                    ...createViewSection(
                        'view-section-start',
                        'view-tab-overview',
                        'Start here',
                        0,
                        ['guide'],
                        [],
                        'list',
                        8,
                    ),
                    sortBy: 'createdAt',
                    sortOrder: 'asc',
                },
                createViewSection(
                    'view-section-project',
                    'view-tab-overview',
                    'Project details',
                    1,
                    ['project'],
                    [],
                    'table',
                    12,
                ),
            ],
        },
        {
            id: 'view-tab-delivery',
            title: 'Delivery',
            order: 1,
            sections: [
                createBoardViewSection('view-section-delivery', 'view-tab-delivery', 'Project delivery', 'status', [
                    'project',
                ]),
            ],
        },
        {
            id: 'view-tab-timeline',
            title: 'Timeline',
            order: 2,
            sections: [
                createCalendarViewSection(
                    'view-section-timeline',
                    'view-tab-timeline',
                    'Project timeline',
                    ['project'],
                    'property',
                    'dueDate',
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
    displayType: ViewSection['displayType'] = 'table',
    limit = 25,
): ViewSection => ({
    id,
    tabId,
    title,
    displayType,
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'updatedAt'],
        tablePropertyKeys: displayType === 'table' ? ['status', 'priority', 'dueDate', 'owner'] : [],
        boardGroupByPropertyKey: null,
        calendarDateField: 'createdAt',
        calendarDatePropertyKey: null,
    },
    tagNames,
    mode: 'and',
    propertyFilters,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit,
    order,
});

const createBoardViewSection = (
    id: string,
    tabId: string,
    title: string,
    boardGroupByPropertyKey: string,
    tagNames: string[],
): ViewSection => ({
    ...createViewSection(id, tabId, title, 0, tagNames, []),
    displayType: 'board',
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'updatedAt'],
        tablePropertyKeys: [],
        boardGroupByPropertyKey,
        calendarDateField: 'createdAt',
        calendarDatePropertyKey: null,
    },
    limit: 8,
});

const createCalendarViewSection = (
    id: string,
    tabId: string,
    title: string,
    tagNames: string[],
    calendarDateField: ViewSection['displayOptions']['calendarDateField'],
    calendarDatePropertyKey: string | null = null,
): ViewSection => {
    const section = createViewSection(id, tabId, title, 0, tagNames, [], 'calendar');

    return {
        ...section,
        displayOptions: {
            ...section.displayOptions,
            calendarDateField,
            calendarDatePropertyKey,
        },
    };
};
