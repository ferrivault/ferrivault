/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--rw-brand-50) / <alpha-value>)",
          100: "rgb(var(--rw-brand-100) / <alpha-value>)",
          200: "rgb(var(--rw-brand-200) / <alpha-value>)",
          300: "rgb(var(--rw-brand-300) / <alpha-value>)",
          400: "rgb(var(--rw-brand-400) / <alpha-value>)",
          500: "rgb(var(--rw-brand-500) / <alpha-value>)",
          600: "rgb(var(--rw-brand-600) / <alpha-value>)",
          700: "rgb(var(--rw-brand-700) / <alpha-value>)",
          800: "rgb(var(--rw-brand-800) / <alpha-value>)",
          900: "rgb(var(--rw-brand-900) / <alpha-value>)",
        },
        slate: {
          50: "rgb(var(--rw-slate-50) / <alpha-value>)",
          100: "rgb(var(--rw-slate-100) / <alpha-value>)",
          200: "rgb(var(--rw-slate-200) / <alpha-value>)",
          300: "rgb(var(--rw-slate-300) / <alpha-value>)",
          400: "rgb(var(--rw-slate-400) / <alpha-value>)",
          500: "rgb(var(--rw-slate-500) / <alpha-value>)",
          600: "rgb(var(--rw-slate-600) / <alpha-value>)",
          700: "rgb(var(--rw-slate-700) / <alpha-value>)",
          800: "rgb(var(--rw-slate-800) / <alpha-value>)",
          900: "rgb(var(--rw-slate-900) / <alpha-value>)",
          950: "rgb(var(--rw-slate-950) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "calc(var(--rw-radius, 12px) * 0.66)",
        xl: "var(--rw-radius, 12px)",
        "2xl": "calc(var(--rw-radius, 12px) * 1.33)",
      },
    },
  },
  plugins: [],
};
