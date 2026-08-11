import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8F9FB",
        sidebar: "#FFFFFF",
        card: "#FFFFFF",
        border: "#E5E7EB",
        foreground: "#111827",
        muted: {
          DEFAULT: "#6B7280",
          foreground: "#9CA3AF",
        },
        primary: {
          DEFAULT: "#635BFF",
          hover: "#5147F5",
          foreground: "#FFFFFF",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        recording: "#EF4444",
      },
      borderRadius: {
        card: "14px",
        control: "10px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(17, 24, 39, 0.04), 0 1px 3px 0 rgba(17, 24, 39, 0.06)",
        card: "0 1px 3px 0 rgba(17, 24, 39, 0.05), 0 1px 2px -1px rgba(17, 24, 39, 0.05)",
      },
      keyframes: {
        "pulse-rec": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "pulse-rec": "pulse-rec 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
