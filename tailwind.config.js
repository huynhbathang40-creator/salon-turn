/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          cream: "#FAFAFA",
          warmIvory: "#F9F8F6",
          cardBg: "#FFFFFF",
          charcoal: "#1E1E24",
          softSlate: "#4A4A52",
          gold: "#C5A059",
          goldHover: "#B08C45",
          lightGold: "#F7F3EB",
          borderGold: "#E5D5B8",
          borderLight: "#E8E8EC",
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
