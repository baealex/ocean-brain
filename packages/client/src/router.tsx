import { Outlet, createBrowserRouter } from 'react-router-dom';

import { SiteLayout } from './components/layout';

import Home from '~/pages/Home';
import Note from '~/pages/Note';
import Search from '~/pages/Search';
import TagNotes from '~/pages/TagNotes';
import Tag from '~/pages/Tag';
import Calendar from '~/pages/Calendar';
import Reminders from '~/pages/Reminders';
import Graph from '~/pages/Graph';

import Setting from '~/pages/setting';
import ManageImage from '~/pages/setting/manage-image';
import ManageImageDetail from '~/pages/setting/manage-image-detail';
import Placeholder from '~/pages/setting/placeholder';

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
                path: '/graph',
                element: <Graph />
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
