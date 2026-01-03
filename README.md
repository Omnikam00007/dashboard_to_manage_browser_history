# ContextHub: Visual History & Tabs

ContextHub transforms your browser history into a rich, visual workspace. Instead of a dry list of URLs, experience your browsing journey with context—images, descriptions, and snippets automatically extracted from the pages you visit.

## ✨ Features

- **Visual History Dashboard**: Browse your history as rich cards with preview images and descriptions.
- **Smart Context Extraction**: Automatically captures:
  - Page Title & Headings
  - Meta Descriptions
  - Open Graph Images
  - Relevant Text Snippets
- **Privacy-First**: All data is stored locally in your browser using IndexedDB. No data leaves your machine.
- **Search & Filter**: Quickly find past content with a powerful search interface.
- **Modern UI**: Built with a sleek, responsive design using TailwindCSS and Framer Motion.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Storage**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Omnikam00007/dashboard_to_manage_browser_history.git
   cd dashboard_to_manage_browser_history
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```
   This will generate a `dist` folder containing the production build.

### Loading into Chrome/Edge

1. Open your browser and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `dist` directory generated in the previous step.
5. The extension is now installed! Click the extension icon to open the dashboard.

## 💻 Development

To work on the project with hot reloading (for UI components):

```bash
npm run dev
```

Note: For testing extension-specific features (like `chrome.runtime` messaging), you must rebuild and reload the extension in the browser.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](LICENSE)
