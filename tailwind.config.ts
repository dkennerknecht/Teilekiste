import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        workshop: {
          50: "rgb(var(--workshop-50) / <alpha-value>)",
          100: "rgb(var(--workshop-100) / <alpha-value>)",
          200: "rgb(var(--workshop-200) / <alpha-value>)",
          300: "rgb(var(--workshop-300) / <alpha-value>)",
          400: "rgb(var(--workshop-400) / <alpha-value>)",
          500: "rgb(var(--workshop-500) / <alpha-value>)",
          600: "rgb(var(--workshop-600) / <alpha-value>)",
          700: "rgb(var(--workshop-700) / <alpha-value>)",
          800: "rgb(var(--workshop-800) / <alpha-value>)",
          900: "rgb(var(--workshop-900) / <alpha-value>)"
        }
      }
    }
  },
  plugins: []
};

export default config;
