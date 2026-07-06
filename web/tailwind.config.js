/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F59E0B",
          light: "#FEF3C7",
          dark: "#D97706",
        },
        sidebar: {
          bg: "#0A0F1C",
          border: "#1E2A3A",
          text: "#94A3B8",
          hover: "#131D2E",
          active: "#1A2840",
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
