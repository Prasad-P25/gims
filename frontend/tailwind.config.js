/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // GURUAMRUT Brand Colors
        primary: {
          50: '#e6f7ff',
          100: '#b3e6ff',
          200: '#80d4ff',
          300: '#4dc3ff',
          400: '#1ab2ff',
          500: '#00A0E3', // Main brand blue
          600: '#0088c2',
          700: '#0070a1',
          800: '#005880',
          900: '#00405f',
          950: '#002840',
        },
        brand: {
          blue: '#00A0E3',
          darkBlue: '#1a5276',
          green: '#27AE60',
          lightGreen: '#82E0AA',
          orange: '#F39C12',
          red: '#E74C3C',
          yellow: '#F1C40F',
        },
        // Keep for backwards compatibility
        government: {
          orange: '#FF9933',
          white: '#FFFFFF',
          green: '#138808',
          blue: '#000080',
        }
      },
      animation: {
        'marquee': 'marquee 120s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}
