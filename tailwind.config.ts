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
          50: "#f4f6f1",
          100: "#e6ecdf",
          200: "#cbd7bd",
          300: "#a7ba8f",
          400: "#82985f",
          500: "#627a40",
          600: "#4e6233",
          700: "#3f4d2b",
          800: "#343f25",
          900: "#2d3521"
        }
      }
    }
  },
  plugins: []
};

export default config;
