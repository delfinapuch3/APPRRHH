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
        heading: ["Public Sans", "sans-serif"],
        sans: ["Public Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,20,.05), 0 1px 3px rgba(15,27,20,.08)",
        soft: "0 4px 8px -2px rgba(15,27,20,.08), 0 2px 4px -2px rgba(15,27,20,.05)",
        lift: "0 12px 24px -6px rgba(15,27,20,.12), 0 4px 8px -4px rgba(15,27,20,.06)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
