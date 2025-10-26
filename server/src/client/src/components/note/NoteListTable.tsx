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
        <div className="overflow-x-auto mt-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '60px' }} />
                </colgroup>
                <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                        <th className="text-left p-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300" />
                        <th className="text-left p-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Title</th>
                        <th className="text-left p-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tags</th>
                        <th className="text-left p-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Created</th>
                        <th className="text-left p-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Updated</th>
                        <th className="text-left p-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300" />
                    </tr>
                </thead>
                <tbody>
                    {notes.map((note) => {
                        const createdAtText = new Date(Number(note.createdAt)).toLocaleDateString();
                        const updatedTimeSince = timeSince(Number(note.updatedAt));

                        return (
                            <tr
                                key={note.id}
                                className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="p-3 text-center">
                                    {note.pinned && (
                                        <Icon.Pin className="text-red-500 fill-red-500 inline-block" width={16} height={16} />
                                    )}
                                </td>
                                <td className="p-3">
                                    <Link
                                        className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 block truncate"
                                        to={getNoteURL(note.id)}
                                        title={note.title || 'Untitled'}>
                                        {note.title || 'Untitled'}
                                    </Link>
                                </td>
                                <td className="p-3">
                                    {note.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 overflow-hidden" style={{ maxHeight: '60px' }}>
                                            {note.tags.slice(0, 3).map((tag) => (
                                                <Link key={tag.id} to={`/tag/${tag.id}`}>
                                                    <Badge name={tag.name} />
                                                </Link>
                                            ))}
                                            {note.tags.length > 3 && (
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400 self-center">
                                                    +{note.tags.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{createdAtText}</td>
                                <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{updatedTimeSince}</td>
                                <td className="p-3 text-center">
                                    <Dropdown
                                        button={<Icon.VerticalDots className="w-5 h-5" />}
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
    );
}
