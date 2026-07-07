/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E7D34",
          light: "#E6F4EA",
          dark: "#145A26",
          tint: "#46B869",
        },
        accent: {
          DEFAULT: "#E8A020",
          light: "#FDF1DC",
          dark: "#C17F10",
        },
        brand: {
          DEFAULT: "#E8A020",
          light: "#FDF1DC",
          dark: "#C17F10",
        },
        sidebar: {
          bg: "#0F1B14",
          border: "#1C2C22",
          text: "#94A3B8",
          hover: "#17251C",
          active: "#1B3325",
        },
        content: {
          bg: "#F1F5F9",
          card: "#FFFFFF",
          border: "#E2E8F0",
          "border-dark": "#CBD5E1",
        },
        ink: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#94A3B8",
        },
      },
      fontFamily: {
        heading: ["Syne", "sans-serif"],
        sans: ["DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.1)",
        soft: "0 4px 6px -1px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.06)",
        lift: "0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.05)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
