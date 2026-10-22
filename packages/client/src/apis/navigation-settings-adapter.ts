import axios from 'axios';
import type { NavigationSettings, SaveNavigationSettings } from './navigation-settings.types';

export const fetchNavigationSettings = async () =>
    (await axios.get<NavigationSettings>('/api/navigation-settings')).data;

export const saveNavigationSettings = async (input: SaveNavigationSettings) =>
    (await axios.put<NavigationSettings>('/api/navigation-settings', input)).data;
