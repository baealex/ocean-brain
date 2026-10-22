import { isCoreMenuVisible, orderNavigationItems, replaceKnownMenuOrder } from './navigation-preferences';

it('keeps custom mixed menu order and appends new menus while ignoring unavailable IDs', () => {
    const items = [{ id: 'core:notes' }, { id: 'core:graph' }, { id: 'core:new' }, { id: 'integration:app' }];
    expect(
        orderNavigationItems(items, [
            'integration:deleted',
            'integration:app',
            'core:graph',
            'core:graph',
            'core:notes',
        ]),
    ).toEqual([items[3], items[1], items[0], items[2]]);
    expect(orderNavigationItems(items)).toEqual(items);
});

it('keeps unknown menu IDs when reordering known menus and protects the settings entry', () => {
    expect(
        replaceKnownMenuOrder(['core:notes', 'core:future', 'core:graph'], ['core:graph', 'core:notes', 'core:new']),
    ).toEqual(['core:graph', 'core:future', 'core:notes', 'core:new']);
    const preferences = { schemaVersion: 1 as const, order: [], hiddenCoreIds: ['core:settings', 'core:graph'] };
    expect(isCoreMenuVisible('core:settings', preferences)).toBe(true);
    expect(isCoreMenuVisible('core:graph', preferences)).toBe(false);
    expect(isCoreMenuVisible('core:new', preferences)).toBe(true);
});
