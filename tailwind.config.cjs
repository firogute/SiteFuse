module.exports = {
  // Use class-based dark mode so toggling `document.documentElement.classList` works
  darkMode: "class",
  content: [
    "./index.html",
    "./*.html",
    "./public/**/*.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
      },
    },
  },
  plugins: [],
};
