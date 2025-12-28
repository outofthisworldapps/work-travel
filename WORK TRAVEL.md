# Work Travel App - Feature Specifications

## Header & Trip Meta
- **Trip Name**: Large, bold editable text at the top.
- **Action Buttons**: Undo, Redo, Load, and Save buttons at the top:
  - **Undo**: Reverts the last change (Cmd/Ctrl+Z). Disabled when no history.
  - **Redo**: Restores the last undone change (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y). Disabled when no future states.
  - **Load**: Opens file picker to load a saved trip JSON file.
  - **Save**: Downloads current trip state as a JSON file (Cmd/Ctrl+S).
- **Auto-Save & Recovery**: App automatically saves state to browser's localStorage on every change. If the app crashes or browser closes, it automatically restores the last state on reload.
- **Trip Dates**: 
  - **Vertically Scrolling Date Range Picker** (Google Flights style):
    - Single 🗓️ calendar icon on the left opens the calendar.
    - Calendar scrolls vertically showing 13 months (current + 12 months ahead).
    - First click selects the departure (start) date.
    - Second click selects the return (end) date to complete the range.
    - If user clicks a date before the selected start, it resets as the new start.
    - Past dates are grayed out and not selectable.
    - Calendar auto-scrolls to the currently selected start month when opened.
  - **Display Format**: `🗓️ Sun JAN 4 – Thu JAN 8 (5 days)` showing weekday, month (uppercase), day, and trip duration.
  - **Sticky Duration**: Changing the start date shifts the entire trip (end date moves to keep the same # of days). Changing the start date also shifts all flights and hotel dates.
  - **User Never Enters Year**: Year is auto-determined as the next upcoming occurrence of the selected month/day.
- **Conference Center**: Displayed below the trip dates. Includes a Google Maps link icon.
- **Briefcase Icon**: Use a briefcase icon (💼) for the work destination (Destination City) and related header sections instead of airplane icons.
- **Currency Toggle**: 
  - Located at the top of the **Totals Section** at the bottom of the page.
  - Domestic ($) and Foreign toggle buttons.
  - Selector to choose the foreign currency (EUR, ISK, etc.).
  - Custom exchange rate entry field (free text).
- **Registration Fee**: Included in totals with its own currency context toggle.

## Flights Panel
- **Local Times**: All flight times (set in the Flights panel) correspond to the local time of the respective airport.
- **Single-line Flight Entry**: Each flight booking shows:
  - Drag handle (grip icon) on left.
  - Airline name input.
  - Confirmation/Reference number input.
  - Cost with $ / Globe toggle (on same line).
  - Delete button.
- **Segment Details**: Each leg shows:
  - Flight number (e.g., "FI 642").
  - Departure date (M/d/yy format with weekday).
  - Departure time (e.g., "8:30p").
  - Departure airport code (e.g., "BWI") + **Terminal** (e.g., "T4").
  - Arrow (→).
  - Arrival airport code + **Terminal**.
  - Arrival time.
  - Arrival date.
  - **Mobile Layout**: Two-row compact grid (Row 1: Flight#/Dep info, Row 2: Seat#/Arr info) that fits perfectly within 375px screens.
- **Date Selectors**: Same nice text + calendar icon format as the header.
- **Layovers**: Displayed between segments with time duration.

## Hotels Panel
- **Hotel Entry**: Name, Check-in Date/Time, Check-out Date/Time.
- **Total Cost**: Entered as total for stay with $ / Globe toggle.
- **Currency Toggle**: Individual toggle for domestic/foreign rate context.
- **Default Stay Logic**: STAY includes arrival night to departure day.
  - **Early Arrival Rule**: If the scheduled hotel arrival (airport arrival + 1.5h) is before 5:00 AM, the stay automatically includes the night before.
  - **Fix**: Check-in date should match the arrival day at the destination (unless the Early Arrival Rule applies).

## Vertical Timeline
- **Compact Layout**: Timeline days have a reduced height (approx 85-100px) to show more days in the viewport. No internal scrollbars.
- **Day Display**: Shows EEE (Wed) and M/d/yy for each day.
- **M&IE Toggle**: Functional toggle button located at the top right of the Timeline section header.
- **Flight & Hotel Events**: 
  - Flight events displayed at correct time positions with compact label (Airline/Flight + Route).
  - Hotel events displayed at check-in/out times with 🏨 icon and name.
- **Travel Blocks (Uber/Taxi)**:
  - Positioned on the **right side** of the timeline to avoid overlap with flights.
  - However, for clarity: Home transport is on the **left**, Away transport is on the **right**.
  - **Vertical Format** (Times rendered Inline):
    ```
    10:15a 🏡  (Start Time + From Icon)

    11:00a ✈️  (Arrival Time + To Icon)
    ```
  - Icons: 🏡 (Home), 🏨 (Hotel), ✈️ (Airport), 💼 (Work/Destination).
  - Mode: 🚘 (Uber/Car/Taxi). The car icon should be placed just outside the transportation block (thinner bars) and to the left of the time/icon label stack.
  - **Arrival/Departure Context**: Once arrived at the destination airport, all subsequent transportation (to hotel/work) should use the **Destination Time Zone**, be aligned to the **Right**, and use **Orange** text for times.
- **Auto-populate Travel Legs**:
  - Ride to / from the airport takes 1 hour (Home <-> Airport).
  - Get to the airport 3 hours before the flight.
  - Leave the airport 1 hour after arrival.
  - Ride between airport and hotel takes 30 minutes (Hotel <-> Airport).
  - Maintain correct location time zone for each ride.
  - Transportation updates automatically on flight or time zone changes.

## Data & Logic
- **Local Times**: All flight times (set in the Flights panel) correspond to the local time of the respective airport.
- **Precision**: Show cents for every total (always 2 decimal places).
- **M&IE First/Last Day**: 75% of full rate on travel days.
- **Date Format**: EEE M/d/yy for dates (e.g., Wed 8/16/26).
- **Domestic/Foreign Toggles**: Globe/Dollar icons for every money entry.

## Styling Guidelines
- **Text Inputs**: Dark background (rgba(0,0,0,0.4)), gray text (#94a3b8), not white.
- **Buttons**: Nice themed background (linear-gradient or subtle indigo-glass), accent color text/border, avoiding plain white backgrounds.
- **Placeholders**: Dark gray (#475569).
- **Accent Color**: Indigo (#6366f1).
- **Responsive**: No second scroll bars in timeline. Flight info uses a space-optimized 2-row layout on mobile (375px+) to ensure all data (airport codes, etc.) is visible.
- **Mobile Timeline Width**: Maximize the horizontal space for the timeline grid on mobile by removing unnecessary blank space in margins and between side columns.
### Time Zones
- **5-Column Layout**: The timeline is partitioned into 5 distinct vertical tracks:
  1. **Home Date**: The date label for the home time zone.
  2. **Home Time**: The specific hour/minute markers for home.
  3. **Timeline Grid**: The central area for flights, hotels, and transportation.
  4. **Away Time**: The specific hour/minute markers for the destination.
  5. **Away Date**: The date label for the destination time zone.
- **Flight Spanning**: Flights span the full width of the 'Timeline Grid' column.
- **Transportation Alignment**: Home-based transportation is left-aligned in the grid; Away-based transportation is right-aligned.
- **Midnight Cues**: Home midnight is a solid indigo line; Destination midnight is a dashed orange line.
- **TZ Selector**: Ordered by offset from **Hawaii (-5)** to **New Zealand (+17)**.

