# 🌍 Work-Travel Expense Planner

A premium, interactive suite designed for professionals to plan, track, and calculate business travel expenses with precision. Built with a focus on ease of use, global currency support, and intelligent expense logic.

![Work Travel Banner](https://raw.githubusercontent.com/outofthisworldapps/work-travel/main/public/banner.png) *(Placeholder if you add a banner)*

## ✨ Key Features

### 📅 Seamless Trip Management
- **Multi-Day Timeline**: View and edit your entire journey in a single, fluid interface.
- **Dynamic Date Ranges**: Drag dates to expand your trip; the app intelligently handles middle-day additions.
- **History (Undo/Redo)**: Never lose a change with full `Cmd+Z` / `Cmd+Shift+Z` support.

### ✈️ Intelligent Travel Legs
- **Drag & Drop Reordering**: Uses `@dnd-kit` for smooth, intuitive itinerary management.
- **Multiple Modes**: Support for Flights, Ubers, Trains, Buses, Driving, and Walking.
- **Mirror Symmetry**: Link outbound and return legs so that updates to one (like location or amount) sync to the other automatically.

### 🍱 Smart M&IE & Lodging
- **Automated Calculations**: Calculates Meals & Incidentals based on complex US and Foreign rate tables.
- **First/Last Day Logic**: Automatically applies the 75% rate for travel days.
- **Meal Toggles**: Granular control over individual meal deductions (Breakfast, Lunch, Dinner, Incidentals).
- **Hotel Suite**: Track room rates, taxes, and fees with built-in compliance indicators (orange/red alerts for overages).

### 💱 Global Currency Suite
- **Multi-Currency Support**: Switch between USD, EUR, GBP, JPY, and more.
- **Live Conversion**: Set custom exchange rates to see your total costs in your home currency.
- **Independent Toggles**: Each line item can be toggled between Domestic and Foreign currency contexts.

### 💾 Data Persistence
- **JSON Import/Export**: Save trips as local files and reload them anytime.
- **Drag-to-Load**: Drop a saved `.json` file directly onto the app to load your itinerary.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Drag & Drop**: [@dnd-kit](https://dnd-kit.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Date Handling**: [date-fns](https://date-fns.org/)
- **Styling**: Vanilla CSS (Premium Dark Mode / Glassmorphism)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/outofthisworldapps/work-travel.git
   cd work-travel
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

---

## 📄 License

MIT License - Copyright (c) 2025 Out Of This World Apps

---

Generated with 💜 by Antigravity.
