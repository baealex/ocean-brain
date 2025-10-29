import { Link } from 'react-router-dom';

import { Badge, Dropdown } from '~/components/shared';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/note.model';

import { timeSince } from '~/modules/time';
import { getNoteURL } from '~/modules/url';

interface Props {
    notes: Note[];
    onPinned?: (id: string, pinned: boolean) => void;
    onDelete?: (id: string) => void;
}

export default function NoteListTable({ notes, onPinned, onDelete }: Props) {
    return (
        <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="border-collapse min-w-full" style={{ width: 'max-content' }}>
                    <colgroup>
                        <col
style={{
    width: '48px',
    minWidth: '48px'
}}
                        />
                        <col
style={{
    width: '300px',
    minWidth: '200px'
}}
                        />
                        <col
style={{
    width: '200px',
    minWidth: '150px'
}}
                        />
                        <col
style={{
    width: '140px',
    minWidth: '120px'
}}
                        />
                        <col
style={{
    width: '140px',
    minWidth: '120px'
}}
                        />
                        <col
style={{
    width: '48px',
    minWidth: '48px'
}}
                        />
                    </colgroup>
                    <thead>
                        <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-800/70 border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-center p-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300" />
                            <th className="text-left p-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Title</th>
                            <th className="text-left p-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tags</th>
                            <th className="text-left p-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Created</th>
                            <th className="text-left p-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Updated</th>
                            <th className="text-center p-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300" />
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900">
                        {notes.map((note, index) => {
                                const createdAtText = new Date(Number(note.createdAt)).toLocaleDateString();
                                const updatedTimeSince = timeSince(Number(note.updatedAt));
                                const isLast = index === notes.length - 1;

                                return (
                                    <tr
                                        key={note.id}
                                        className={`${
                                            !isLast ? 'border-b border-zinc-100 dark:border-zinc-800' : ''
                                        } hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group`}>
                                        <td className="p-4 text-center">
                                            {note.pinned && (
                                                <Icon.Pin className="text-red-500 fill-red-500 inline-block" width={16} height={16} />
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <Link
                                                className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 block truncate group-hover:underline"
                                                to={getNoteURL(note.id)}
                                                title={note.title || 'Untitled'}>
                                                {note.title || 'Untitled'}
                                            </Link>
                                        </td>
                                        <td className="p-4">
                                            {note.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 overflow-hidden" style={{ maxHeight: '64px' }}>
                                                    {note.tags.slice(0, 3).map((tag) => (
                                                        <Link key={tag.id} to={`/tag/${tag.id}`}>
                                                            <Badge name={tag.name} />
                                                        </Link>
                                                    ))}
                                                    {note.tags.length > 3 && (
                                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 self-center px-1">
                                                            +{note.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                            {createdAtText}
                                        </td>
                                        <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                            {updatedTimeSince}
                                        </td>
                                        <td className="p-4 text-center">
                                            <Dropdown
                                                button={<Icon.VerticalDots className="w-5 h-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" />}
                                                items={[
                                                    {
                                                        name: note.pinned ? 'Unpin' : 'Pin',
                                                        onClick: () => onPinned?.(note.id, note.pinned)
                                                    },
                                                    {
                                                        name: 'Delete',
                                                        onClick: () => onDelete?.(note.id)
                                                    }
                                                ]}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
