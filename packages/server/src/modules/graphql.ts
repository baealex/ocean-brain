export function gql(texts: TemplateStringsArray, ...values: unknown[]) {
    return texts.map((text, i) => text + (values[i] || '')).join('');
}
