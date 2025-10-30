import { Outlet, createBrowserRouter } from 'react-router-dom';

import SiteLayout from '~/widgets/site-layout';

import Home from '~/pages/home';
import Note from '~/pages/note';
import Search from '~/pages/search';
import TagNotes from '~/pages/tag-notes';
import Tag from '~/pages/tag';
import Calendar from '~/pages/calendar';
import Reminders from '~/pages/reminders';

import Setting from '~/pages/settings';
import ManageImage from '~/pages/settings/manage-image';
import ManageImageDetail from '~/pages/settings/manage-image-detail';
import Placeholder from '~/pages/settings/placeholder';

const router = createBrowserRouter([
    {
        path: '/',
        element: (
            <SiteLayout>
                <Outlet />
            </SiteLayout>
        ),
        children: [
            {
                path: '/',
                element: <Home />
            },
            {
                path: '/calendar',
                element: <Calendar />
            },
            {
                path: '/reminders',
                element: <Reminders />
            },
            {
                path: '/search',
                element: <Search />
            },
            {
                path: '/tag',
                element: <Tag />
            },
            {
                path: '/:id',
                element: <Note />
            },
            {
                path: '/tag/:id',
                element: <TagNotes />
            },
            {
                path: '/setting',
                children: [
                    {
                        path: '',
                        element: <Setting />
                    },
                    {
                        path: 'manage-image',
                        element: <ManageImage />
                    },
                    {
                        path: 'manage-image/:id',
                        element: <ManageImageDetail />
                    },
                    {
                        path: 'placeholder',
                        element: <Placeholder />
                    }
                ]
            }
        ]
    }
]);

export default router;
