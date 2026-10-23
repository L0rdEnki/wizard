// Builds css/tailwind.css – run `npm run build:css` after changing classes in index.html.
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['dark', 'light'],
    logs: false
  }
};
