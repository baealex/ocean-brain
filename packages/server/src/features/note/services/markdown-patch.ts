import crypto from 'crypto';

const HASH_ALGORITHM = 'sha256';
const EXCERPT_CONTEXT_CHARS = 80;
const DIFF_CONTEXT_LINES = 3;

export interface MarkdownPatchNoteSnapshot {
    id: string;
    title: string;
    updatedAt: string;
    markdown: string;
}

export interface ExactTextMarkdownPatchSelector {
    type: 'exact_text';
    text: string;
    before?: string;
    after?: string;
}

export interface MatchCandidateMarkdownPatchSelector {
    type: 'match_candidate';
    text: string;
    matchIndex: number;
    lineStart: number;
    matchSha256: string;
    surroundingHash: string;
    positionHint?: 'first' | 'last';
}

export type MarkdownPatchSelector = ExactTextMarkdownPatchSelector | MatchCandidateMarkdownPatchSelector;

export interface ReplaceMarkdownPatchOperation {
    type: 'replace';
    replacement: string;
}

export interface InsertBeforeMarkdownPatchOperation {
    type: 'insert_before';
    insertion: string;
}

export interface InsertAfterMarkdownPatchOperation {
    type: 'insert_after';
    insertion: string;
}

export type MarkdownPatchOperation =
    | ReplaceMarkdownPatchOperation
    | InsertBeforeMarkdownPatchOperation
    | InsertAfterMarkdownPatchOperation;

export interface MarkdownChangePolicy {
    allowNoop?: boolean;
    maxChangedChars?: number;
    maxChangedLines?: number;
    preserveReferences?: boolean | 'warn';
    preserveTags?: boolean | 'warn';
}

export interface PreviewMarkdownPatchInput {
    note: MarkdownPatchNoteSnapshot;
    expectedUpdatedAt?: string;
    baseMarkdownSha256?: string;
    intent: string;
    selector: MarkdownPatchSelector;
    operation: MarkdownPatchOperation;
    policy?: MarkdownChangePolicy;
}

export interface MarkdownAppendPlacementEnd {
    type: 'end';
}

export interface MarkdownAppendPlacementAfterHeading {
    type: 'after_heading';
    heading: string;
    level?: number;
}

export type MarkdownAppendPlacement = MarkdownAppendPlacementEnd | MarkdownAppendPlacementAfterHeading;

export interface PreviewMarkdownAppendInput {
    note: MarkdownPatchNoteSnapshot;
    expectedUpdatedAt?: string;
    baseMarkdownSha256?: string;
    intent: string;
    insertion: string;
    placement?: MarkdownAppendPlacement;
    separator?: '\n\n' | '\n';
    policy?: MarkdownChangePolicy;
}

export interface PreviewMarkdownReplaceInput {
    note: MarkdownPatchNoteSnapshot;
    expectedUpdatedAt?: string;
    baseMarkdownSha256?: string;
    intent: string;
    replacement: string;
    policy?: MarkdownChangePolicy;
}

export interface MarkdownPatchMatch {
    matchIndex: number;
    lineStart: number;
    lineEnd: number;
    text: string;
    beforeExcerpt?: string;
    afterExcerpt?: string;
    matchSha256: string;
    surroundingHash: string;
    positionHint?: 'first' | 'last';
}

export interface MarkdownChangeDryRun {
    status: 'dry_run';
    note: {
        id: string;
        title: string;
        updatedAt: string;
    };
    match?: {
        count: 1;
        lineStart: number;
        lineEnd: number;
        selectorType: string;
        matchedTextSha256: string;
        surroundingHash: string;
    };
    placement?: MarkdownAppendPlacement;
    proposed: {
        changedLineCount: number;
        changedCharCount: number;
        beforeMarkdownSha256: string;
        afterMarkdownSha256: string;
        diff: string;
    };
    warnings: string[];
}

export interface MarkdownChangePlan extends MarkdownChangeDryRun {
    afterMarkdown: string;
}

export interface MarkdownPatchNeedsDisambiguation {
    status: 'needs_disambiguation';
    reason: 'TARGET_AMBIGUOUS';
    matches: MarkdownPatchMatch[];
}

export interface MarkdownChangeFailure {
    status: 'failed';
    reason:
        | 'ANCHOR_MISMATCH'
        | 'BASELINE_MISMATCH'
        | 'CANDIDATE_MISMATCH'
        | 'CHANGE_LIMIT_EXCEEDED'
        | 'EMPTY_INSERTION'
        | 'EMPTY_REPLACEMENT'
        | 'EMPTY_TARGET'
        | 'HEADING_AMBIGUOUS'
        | 'HEADING_NOT_FOUND'
        | 'INVALID_HEADING_LEVEL'
        | 'INVALID_PROPERTY_INPUT'
        | 'MARKDOWN_IMPORT_LOSSY'
        | 'MISSING_BASELINE'
        | 'NOOP'
        | 'REFERENCE_STRUCTURE_DECREASED'
        | 'REFERENCE_TOKEN_DECREASED'
        | 'TAG_TOKEN_DECREASED'
        | 'TARGET_NOT_FOUND'
        | 'UNSUPPORTED_MARKDOWN_STRUCTURE';
    message: string;
}

export type MarkdownPatchPreviewResult =
    | MarkdownChangeDryRun
    | MarkdownPatchNeedsDisambiguation
    | MarkdownChangeFailure;

export type MarkdownPatchPlanResult = MarkdownChangePlan | MarkdownPatchNeedsDisambiguation | MarkdownChangeFailure;
export type MarkdownAppendPlanResult = MarkdownChangePlan | MarkdownChangeFailure;
export type MarkdownReplacePlanResult = MarkdownChangePlan | MarkdownChangeFailure;

interface RawTextMatch {
    matchIndex: number;
    start: number;
    end: number;
    text: string;
}

interface HeadingMatch {
    heading: string;
    level: number;
    lineIndex: number;
    start: number;
    nextSectionStart: number;
}

export const calculateMarkdownSha256 = (value: string) => {
    return crypto.createHash(HASH_ALGORITHM).update(value, 'utf8').digest('hex');
};

const countNewlines = (value: string) => {
    let count = 0;

    for (const character of value) {
        if (character === '\n') {
            count += 1;
        }
    }

    return count;
};

const getLineRange = (markdown: string, match: RawTextMatch) => {
    const lineStart = countNewlines(markdown.slice(0, match.start)) + 1;
    const lineEnd = lineStart + countNewlines(match.text);

    return {
        lineStart,
        lineEnd,
    };
};

const buildExcerpt = (markdown: string, start: number, end: number) => {
    const excerpt = markdown.slice(start, end).trim();

    return excerpt.length > 0 ? excerpt : undefined;
};

const toPatchMatch = (markdown: string, match: RawTextMatch, totalMatches: number): MarkdownPatchMatch => {
    const { lineStart, lineEnd } = getLineRange(markdown, match);
    const beforeStart = Math.max(0, match.start - EXCERPT_CONTEXT_CHARS);
    const afterEnd = Math.min(markdown.length, match.end + EXCERPT_CONTEXT_CHARS);
    const beforeText = markdown.slice(beforeStart, match.start);
    const afterText = markdown.slice(match.end, afterEnd);

    return {
        matchIndex: match.matchIndex,
        lineStart,
        lineEnd,
        text: match.text,
        beforeExcerpt: buildExcerpt(markdown, beforeStart, match.start),
        afterExcerpt: buildExcerpt(markdown, match.end, afterEnd),
        matchSha256: calculateMarkdownSha256(match.text),
        surroundingHash: calculateMarkdownSha256(JSON.stringify({ beforeText, targetText: match.text, afterText })),
        ...(match.matchIndex === 0 && totalMatches > 1 ? { positionHint: 'first' } : {}),
        ...(match.matchIndex === totalMatches - 1 && totalMatches > 1 ? { positionHint: 'last' } : {}),
    };
};

const findExactTextMatches = (markdown: string, text: string) => {
    const matches: RawTextMatch[] = [];
    let searchStart = 0;

    while (searchStart <= markdown.length) {
        const start = markdown.indexOf(text, searchStart);

        if (start === -1) {
            break;
        }

        matches.push({
            matchIndex: matches.length,
            start,
            end: start + text.length,
            text,
        });
        searchStart = start + text.length;
    }

    return matches;
};

const splitLines = (value: string) => {
    return value.split('\n');
};

const findSharedLineEdges = (beforeLines: string[], afterLines: string[]) => {
    let prefix = 0;
    const maxPrefix = Math.min(beforeLines.length, afterLines.length);

    while (prefix < maxPrefix && beforeLines[prefix] === afterLines[prefix]) {
        prefix += 1;
    }

    let suffix = 0;
    const maxSuffix = Math.min(beforeLines.length - prefix, afterLines.length - prefix);

    while (
        suffix < maxSuffix &&
        beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
    ) {
        suffix += 1;
    }

    return {
        prefix,
        suffix,
    };
};

const formatDiffRange = (lineIndex: number, lineCount: number) => {
    const lineNumber = lineIndex + 1;

    return lineCount === 1 ? String(lineNumber) : `${lineNumber},${lineCount}`;
};

export const createUnifiedMarkdownDiff = (
    beforeMarkdown: string,
    afterMarkdown: string,
    contextLines: number | null = DIFF_CONTEXT_LINES,
) => {
    const beforeLines = splitLines(beforeMarkdown);
    const afterLines = splitLines(afterMarkdown);
    const { prefix, suffix } = findSharedLineEdges(beforeLines, afterLines);
    const changedBeforeStart = prefix;
    const changedBeforeEnd = beforeLines.length - suffix;
    const changedAfterStart = prefix;
    const changedAfterEnd = afterLines.length - suffix;
    const displayBeforeStart = contextLines === null ? 0 : Math.max(0, changedBeforeStart - contextLines);
    const displayBeforeEnd =
        contextLines === null ? beforeLines.length : Math.min(beforeLines.length, changedBeforeEnd + contextLines);
    const displayAfterStart = contextLines === null ? 0 : Math.max(0, changedAfterStart - contextLines);
    const displayAfterEnd =
        contextLines === null ? afterLines.length : Math.min(afterLines.length, changedAfterEnd + contextLines);
    const diffLines = [
        '--- before.md',
        '+++ after.md',
        `@@ -${formatDiffRange(displayBeforeStart, displayBeforeEnd - displayBeforeStart)} +${formatDiffRange(displayAfterStart, displayAfterEnd - displayAfterStart)} @@`,
    ];

    for (let index = displayBeforeStart; index < changedBeforeStart; index += 1) {
        diffLines.push(` ${beforeLines[index]}`);
    }

    for (let index = changedBeforeStart; index < changedBeforeEnd; index += 1) {
        diffLines.push(`-${beforeLines[index]}`);
    }

    for (let index = changedAfterStart; index < changedAfterEnd; index += 1) {
        diffLines.push(`+${afterLines[index]}`);
    }

    for (let index = changedBeforeEnd; index < displayBeforeEnd; index += 1) {
        diffLines.push(` ${beforeLines[index]}`);
    }

    return diffLines.join('\n');
};

const countChangedLines = (beforeMarkdown: string, afterMarkdown: string) => {
    const beforeLines = splitLines(beforeMarkdown);
    const afterLines = splitLines(afterMarkdown);
    const { prefix, suffix } = findSharedLineEdges(beforeLines, afterLines);
    const removedLineCount = beforeLines.length - prefix - suffix;
    const addedLineCount = afterLines.length - prefix - suffix;

    return Math.max(removedLineCount, addedLineCount);
};

const isMarkdownTokenWhitespace = (character: string) => /\s/.test(character);

export const countExplicitTagTokens = (value: string) => {
    let count = 0;

    for (let index = 0; index < value.length; index += 1) {
        if (value[index] !== '[' || (value[index + 1] !== '@' && value[index + 1] !== '#')) {
            continue;
        }

        let cursor = index + 2;
        let isValid = cursor < value.length;

        while (cursor < value.length && value[cursor] !== ']') {
            if (value[cursor] === '[' || isMarkdownTokenWhitespace(value[cursor])) {
                isValid = false;
                break;
            }

            cursor += 1;
        }

        if (isValid && cursor < value.length && cursor > index + 2) {
            count += 1;
            index = cursor;
            continue;
        }

        if (!isValid) {
            index = Math.max(index, cursor - 1);
        }
    }

    return count;
};

export const countMarkdownReferenceTokens = (value: string) => {
    let count = 0;
    let cursor = 0;

    while (cursor < value.length) {
        const start = value.indexOf('[[', cursor);

        if (start === -1) {
            break;
        }

        const end = value.indexOf(']]', start + 2);

        if (end === -1) {
            break;
        }

        if (end > start + 2) {
            count += 1;
        }

        cursor = end + 2;
    }

    return count;
};

const parseVersionTimestamp = (value: string) => {
    const timestamp = /^\d+$/.test(value) ? Number(value) : Date.parse(value);

    return Number.isFinite(timestamp) ? timestamp : null;
};

const noteVersionsMatch = (expectedUpdatedAt: string, currentUpdatedAt: string) => {
    const expectedTimestamp = parseVersionTimestamp(expectedUpdatedAt);
    const currentTimestamp = parseVersionTimestamp(currentUpdatedAt);

    return expectedTimestamp !== null && currentTimestamp !== null && expectedTimestamp === currentTimestamp;
};

const getPreservationFailure = (
    beforeMarkdown: string,
    afterMarkdown: string,
    policy: MarkdownChangePolicy | undefined,
): MarkdownChangeFailure | null => {
    const beforeTagCount = countExplicitTagTokens(beforeMarkdown);
    const afterTagCount = countExplicitTagTokens(afterMarkdown);

    if (policy?.preserveTags === true && afterTagCount < beforeTagCount) {
        return {
            status: 'failed',
            reason: 'TAG_TOKEN_DECREASED',
            message: 'The patch would reduce explicit tag tokens.',
        };
    }

    const beforeReferenceCount = countMarkdownReferenceTokens(beforeMarkdown);
    const afterReferenceCount = countMarkdownReferenceTokens(afterMarkdown);

    if (policy?.preserveReferences === true && afterReferenceCount < beforeReferenceCount) {
        return {
            status: 'failed',
            reason: 'REFERENCE_TOKEN_DECREASED',
            message: 'The patch would reduce note reference tokens.',
        };
    }

    return null;
};

const collectWarnings = (
    beforeMarkdown: string,
    afterMarkdown: string,
    policy: MarkdownChangePolicy | undefined,
): string[] => {
    const warnings: string[] = [];
    const beforeTagCount = countExplicitTagTokens(beforeMarkdown);
    const afterTagCount = countExplicitTagTokens(afterMarkdown);
    const shouldWarnTags = policy?.preserveTags === undefined || policy.preserveTags === 'warn';

    if (shouldWarnTags && afterTagCount < beforeTagCount) {
        warnings.push('TAG_TOKEN_COUNT_DECREASED');
    }

    const beforeReferenceCount = countMarkdownReferenceTokens(beforeMarkdown);
    const afterReferenceCount = countMarkdownReferenceTokens(afterMarkdown);
    const shouldWarnReferences = policy?.preserveReferences === undefined || policy.preserveReferences === 'warn';

    if (shouldWarnReferences && afterReferenceCount < beforeReferenceCount) {
        warnings.push('REFERENCE_TOKEN_COUNT_DECREASED');
    }

    return warnings;
};

const validateBaseline = (
    note: MarkdownPatchNoteSnapshot,
    expectedUpdatedAt: string | undefined,
    baseMarkdownSha256: string | undefined,
): MarkdownChangeFailure | null => {
    const beforeMarkdownSha256 = calculateMarkdownSha256(note.markdown);

    if (!expectedUpdatedAt && !baseMarkdownSha256) {
        return {
            status: 'failed',
            reason: 'MISSING_BASELINE',
            message: 'expectedUpdatedAt or baseMarkdownSha256 is required for markdown writes.',
        };
    }

    if (
        (expectedUpdatedAt && !noteVersionsMatch(expectedUpdatedAt, note.updatedAt)) ||
        (baseMarkdownSha256 && baseMarkdownSha256 !== beforeMarkdownSha256)
    ) {
        return {
            status: 'failed',
            reason: 'BASELINE_MISMATCH',
            message: 'The markdown write baseline does not match the current note.',
        };
    }

    return null;
};

const validateChangeLimits = (
    beforeMarkdown: string,
    afterMarkdown: string,
    changedCharCount: number,
    policy: MarkdownChangePolicy | undefined,
): MarkdownChangeFailure | null => {
    const changedLineCount = countChangedLines(beforeMarkdown, afterMarkdown);

    if (
        (policy?.maxChangedLines !== undefined && changedLineCount > policy.maxChangedLines) ||
        (policy?.maxChangedChars !== undefined && changedCharCount > policy.maxChangedChars)
    ) {
        return {
            status: 'failed',
            reason: 'CHANGE_LIMIT_EXCEEDED',
            message: 'The markdown write exceeds the configured change limit.',
        };
    }

    return null;
};

const createChangePlan = ({
    note,
    afterMarkdown,
    changedCharCount,
    policy,
    diffContextLines = DIFF_CONTEXT_LINES,
    match,
    placement,
}: {
    note: MarkdownPatchNoteSnapshot;
    afterMarkdown: string;
    changedCharCount: number;
    policy: MarkdownChangePolicy | undefined;
    diffContextLines?: number | null;
    match?: MarkdownChangeDryRun['match'];
    placement?: MarkdownAppendPlacement;
}): MarkdownChangePlan | MarkdownChangeFailure => {
    if (!policy?.allowNoop && afterMarkdown === note.markdown) {
        return {
            status: 'failed',
            reason: 'NOOP',
            message: 'The markdown write would not change the note.',
        };
    }

    const preservationFailure = getPreservationFailure(note.markdown, afterMarkdown, policy);

    if (preservationFailure) {
        return preservationFailure;
    }

    const limitFailure = validateChangeLimits(note.markdown, afterMarkdown, changedCharCount, policy);

    if (limitFailure) {
        return limitFailure;
    }

    return {
        status: 'dry_run',
        note: {
            id: note.id,
            title: note.title,
            updatedAt: note.updatedAt,
        },
        ...(match ? { match } : {}),
        ...(placement ? { placement } : {}),
        proposed: {
            changedLineCount: countChangedLines(note.markdown, afterMarkdown),
            changedCharCount,
            beforeMarkdownSha256: calculateMarkdownSha256(note.markdown),
            afterMarkdownSha256: calculateMarkdownSha256(afterMarkdown),
            diff: createUnifiedMarkdownDiff(note.markdown, afterMarkdown, diffContextLines),
        },
        warnings: collectWarnings(note.markdown, afterMarkdown, policy),
        afterMarkdown,
    };
};

const matchHasAnchors = (markdown: string, match: RawTextMatch, selector: ExactTextMarkdownPatchSelector) => {
    if (selector.before !== undefined && !markdown.slice(0, match.start).endsWith(selector.before)) {
        return false;
    }

    if (selector.after !== undefined && !markdown.slice(match.end).startsWith(selector.after)) {
        return false;
    }

    return true;
};

const selectExactTextMatch = (
    markdown: string,
    selector: ExactTextMarkdownPatchSelector,
):
    | { match: RawTextMatch; patchMatch: MarkdownPatchMatch }
    | MarkdownPatchNeedsDisambiguation
    | MarkdownChangeFailure => {
    if (selector.text.length === 0) {
        return {
            status: 'failed',
            reason: 'EMPTY_TARGET',
            message: 'Exact text selector must not be empty.',
        };
    }

    const rawMatches = findExactTextMatches(markdown, selector.text);

    if (rawMatches.length === 0) {
        return {
            status: 'failed',
            reason: 'TARGET_NOT_FOUND',
            message: 'No exact text match was found in the current note.',
        };
    }

    const anchoredMatches = rawMatches.filter((match) => matchHasAnchors(markdown, match, selector));

    if (anchoredMatches.length === 0) {
        return {
            status: 'failed',
            reason: 'ANCHOR_MISMATCH',
            message: 'Exact text matches were found, but before/after anchors did not match.',
        };
    }

    if (anchoredMatches.length > 1) {
        return {
            status: 'needs_disambiguation',
            reason: 'TARGET_AMBIGUOUS',
            matches: anchoredMatches.map((match) => toPatchMatch(markdown, match, rawMatches.length)),
        };
    }

    const match = anchoredMatches[0];

    return {
        match,
        patchMatch: toPatchMatch(markdown, match, rawMatches.length),
    };
};

const selectMatchCandidate = (
    markdown: string,
    selector: MatchCandidateMarkdownPatchSelector,
): { match: RawTextMatch; patchMatch: MarkdownPatchMatch } | MarkdownChangeFailure => {
    if (selector.text.length === 0) {
        return {
            status: 'failed',
            reason: 'EMPTY_TARGET',
            message: 'Match candidate selector text must not be empty.',
        };
    }

    const rawMatches = findExactTextMatches(markdown, selector.text);

    if (rawMatches.length === 0) {
        return {
            status: 'failed',
            reason: 'TARGET_NOT_FOUND',
            message: 'No match candidate text was found in the current note.',
        };
    }

    const match = rawMatches.find((candidate) => candidate.matchIndex === selector.matchIndex);

    if (!match) {
        return {
            status: 'failed',
            reason: 'CANDIDATE_MISMATCH',
            message: 'The selected match index does not exist in the current note.',
        };
    }

    const patchMatch = toPatchMatch(markdown, match, rawMatches.length);
    const positionMatches = selector.positionHint === undefined || patchMatch.positionHint === selector.positionHint;

    if (
        patchMatch.lineStart !== selector.lineStart ||
        patchMatch.matchSha256 !== selector.matchSha256 ||
        patchMatch.surroundingHash !== selector.surroundingHash ||
        !positionMatches
    ) {
        return {
            status: 'failed',
            reason: 'CANDIDATE_MISMATCH',
            message: 'The selected match candidate no longer matches the current note context.',
        };
    }

    return {
        match,
        patchMatch,
    };
};

const applyPatchOperation = (markdown: string, match: RawTextMatch, operation: MarkdownPatchOperation) => {
    if (operation.type === 'replace') {
        return {
            markdown: `${markdown.slice(0, match.start)}${operation.replacement}${markdown.slice(match.end)}`,
            changedCharCount: match.text.length + operation.replacement.length,
        };
    }

    if (operation.type === 'insert_before') {
        return {
            markdown: `${markdown.slice(0, match.start)}${operation.insertion}${markdown.slice(match.start)}`,
            changedCharCount: operation.insertion.length,
        };
    }

    return {
        markdown: `${markdown.slice(0, match.end)}${operation.insertion}${markdown.slice(match.end)}`,
        changedCharCount: operation.insertion.length,
    };
};

export const buildMarkdownPatchPlan = (input: PreviewMarkdownPatchInput): MarkdownPatchPlanResult => {
    const baselineFailure = validateBaseline(input.note, input.expectedUpdatedAt, input.baseMarkdownSha256);

    if (baselineFailure) {
        return baselineFailure;
    }

    const selected =
        input.selector.type === 'exact_text'
            ? selectExactTextMatch(input.note.markdown, input.selector)
            : selectMatchCandidate(input.note.markdown, input.selector);

    if ('status' in selected) {
        return selected;
    }

    const patched = applyPatchOperation(input.note.markdown, selected.match, input.operation);
    const plan = createChangePlan({
        note: input.note,
        afterMarkdown: patched.markdown,
        changedCharCount: patched.changedCharCount,
        policy: input.policy,
        match: {
            count: 1,
            lineStart: selected.patchMatch.lineStart,
            lineEnd: selected.patchMatch.lineEnd,
            selectorType: input.selector.type,
            matchedTextSha256: selected.patchMatch.matchSha256,
            surroundingHash: selected.patchMatch.surroundingHash,
        },
    });

    return plan;
};

const parseHeadingLine = (line: string) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);

    if (!match) {
        return null;
    }

    return {
        level: match[1].length,
        heading: match[2].trim(),
    };
};

const getLineStartOffsets = (lines: string[]) => {
    const offsets: number[] = [];
    let offset = 0;

    for (const line of lines) {
        offsets.push(offset);
        offset += line.length + 1;
    }

    return offsets;
};

const findHeadingMatches = (markdown: string, placement: MarkdownAppendPlacementAfterHeading) => {
    const lines = splitLines(markdown);
    const offsets = getLineStartOffsets(lines);
    const headingLines = lines
        .map((line, index) => {
            const heading = parseHeadingLine(line);

            if (!heading) {
                return null;
            }

            return {
                ...heading,
                lineIndex: index,
                start: offsets[index],
            };
        })
        .filter((heading): heading is Omit<HeadingMatch, 'nextSectionStart'> => heading !== null);
    const matches = headingLines.filter((heading) => {
        return (
            heading.heading === placement.heading &&
            (placement.level === undefined || heading.level === placement.level)
        );
    });

    return matches.map((match) => {
        const nextHeading = headingLines.find(
            (heading) => heading.lineIndex > match.lineIndex && heading.level <= match.level,
        );

        return {
            ...match,
            nextSectionStart: nextHeading?.start ?? markdown.length,
        };
    });
};

const appendWithSeparator = (prefix: string, insertion: string, separator: '\n\n' | '\n') => {
    if (prefix.length === 0) {
        return insertion;
    }

    return `${prefix}${prefix.endsWith(separator) ? '' : separator}${insertion}`;
};

const applyAppendPlacement = (
    markdown: string,
    insertion: string,
    placement: MarkdownAppendPlacement,
    separator: '\n\n' | '\n',
): { markdown: string; placement: MarkdownAppendPlacement } | MarkdownChangeFailure => {
    if (insertion.length === 0) {
        return {
            status: 'failed',
            reason: 'EMPTY_INSERTION',
            message: 'Append insertion must not be empty.',
        };
    }

    if (placement.type === 'end') {
        return {
            markdown: appendWithSeparator(markdown, insertion, separator),
            placement,
        };
    }

    if (
        placement.level !== undefined &&
        (!Number.isInteger(placement.level) || placement.level < 1 || placement.level > 6)
    ) {
        return {
            status: 'failed',
            reason: 'INVALID_HEADING_LEVEL',
            message: 'Heading level must be an integer from 1 to 6.',
        };
    }

    const headingMatches = findHeadingMatches(markdown, placement);

    if (headingMatches.length === 0) {
        return {
            status: 'failed',
            reason: 'HEADING_NOT_FOUND',
            message: 'The requested heading was not found.',
        };
    }

    if (headingMatches.length > 1) {
        return {
            status: 'failed',
            reason: 'HEADING_AMBIGUOUS',
            message: 'The requested heading appears more than once.',
        };
    }

    const [headingMatch] = headingMatches;
    const prefix = markdown.slice(0, headingMatch.nextSectionStart);
    const suffix = markdown.slice(headingMatch.nextSectionStart);
    const prefixWithInsertion = appendWithSeparator(prefix, insertion, separator);
    const nextMarkdown =
        suffix.length === 0
            ? prefixWithInsertion
            : `${prefixWithInsertion}${prefixWithInsertion.endsWith(separator) ? '' : separator}${suffix}`;

    return {
        markdown: nextMarkdown,
        placement,
    };
};

export const buildMarkdownAppendPlan = (input: PreviewMarkdownAppendInput): MarkdownAppendPlanResult => {
    const baselineFailure = validateBaseline(input.note, input.expectedUpdatedAt, input.baseMarkdownSha256);

    if (baselineFailure) {
        return baselineFailure;
    }

    const placement = input.placement ?? { type: 'end' as const };
    const separator = input.separator ?? '\n\n';
    const appended = applyAppendPlacement(input.note.markdown, input.insertion, placement, separator);

    if ('status' in appended) {
        return appended;
    }

    return createChangePlan({
        note: input.note,
        afterMarkdown: appended.markdown,
        changedCharCount: input.insertion.length,
        policy: input.policy,
        placement: appended.placement,
    });
};

export const buildMarkdownReplacePlan = (input: PreviewMarkdownReplaceInput): MarkdownReplacePlanResult => {
    const baselineFailure = validateBaseline(input.note, input.expectedUpdatedAt, input.baseMarkdownSha256);

    if (baselineFailure) {
        return baselineFailure;
    }

    if (input.replacement.length === 0) {
        return {
            status: 'failed',
            reason: 'EMPTY_REPLACEMENT',
            message: 'Replacement markdown must not be empty.',
        };
    }

    return createChangePlan({
        note: input.note,
        afterMarkdown: input.replacement,
        changedCharCount: input.note.markdown.length + input.replacement.length,
        policy: input.policy,
        diffContextLines: null,
    });
};

const toPreviewResult = (plan: MarkdownChangePlan): MarkdownChangeDryRun => {
    return {
        status: 'dry_run',
        note: plan.note,
        ...(plan.match ? { match: plan.match } : {}),
        ...(plan.placement ? { placement: plan.placement } : {}),
        proposed: plan.proposed,
        warnings: plan.warnings,
    };
};

export const previewMarkdownPatch = (input: PreviewMarkdownPatchInput): MarkdownPatchPreviewResult => {
    const plan = buildMarkdownPatchPlan(input);

    if (plan.status !== 'dry_run') {
        return plan;
    }

    return toPreviewResult(plan);
};

export const previewMarkdownAppend = (
    input: PreviewMarkdownAppendInput,
): MarkdownChangeDryRun | MarkdownChangeFailure => {
    const plan = buildMarkdownAppendPlan(input);

    if (plan.status !== 'dry_run') {
        return plan;
    }

    return toPreviewResult(plan);
};

export const previewMarkdownReplace = (
    input: PreviewMarkdownReplaceInput,
): MarkdownChangeDryRun | MarkdownChangeFailure => {
    const plan = buildMarkdownReplacePlan(input);

    if (plan.status !== 'dry_run') {
        return plan;
    }

    return toPreviewResult(plan);
};
