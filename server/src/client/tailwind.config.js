/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,jsx,ts,tsx}'
    ],
    darkMode: 'selector',
    theme: {
        extend: {
            colors: {
                'pastel-yellow': { 200: '#FCEBAF' },
                'pastel-green': { 200: '#B2E0B2' },
                'pastel-pink': { 200: '#FFB3C1' },
                'pastel-orange': { 200: '#FFCCB3' },
                'pastel-blue': { 200: '#A4D8E1' },
                'pastel-purple': { 200: '#E1B7E1' },
                'pastel-teal': { 200: '#A4DBD6' },
                'pastel-lavender': { 200: '#E1C6E7' }
            }
        }
    },
    plugins: []
};
