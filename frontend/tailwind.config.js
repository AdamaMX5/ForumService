/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // 'class' instead of the default 'media': a host embedding <ForumThread>/<forum-thread> almost
  // always manages its own dark-mode toggle via a class further up the DOM (e.g. <html class="dark">),
  // independent of the OS-level prefers-color-scheme setting - the default 'media' strategy ignores
  // that entirely, which is exactly ForumService issue #6 ("Startseite"/ThemenListe stayed white
  // even with the host's dark theme active). See useResolvedDarkMode.ts for how the OS-preference
  // auto-detection is preserved on top of this by self-applying `.dark` on the widget's own root.
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
