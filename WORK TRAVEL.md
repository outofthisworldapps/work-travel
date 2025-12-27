# Work Travel App - Feature Specifications

## Header & Trip Meta
- **Trip Name**: Large, bold editable text at the top.
- **Trip Dates**: 
  - Displayed in M/d/yy format (e.g., `Wed 8/16/26`) with abbreviated weekday.
  - Each date part is clickable to edit.
  - Calendar icon for date picker.
  - **Range Picker**: Clicking the calendar icon should ideally allow selecting a range (start and end).
  - Number of days displayed as badge (e.g., `4 Days`) below the date row.
  - **Sticky Duration**: Changing the start date shifts the entire trip (end date moves to keep the same # of days). Changing the start date also shifts all flights and hotel dates.
- **Conference Center**: Displayed below the trip dates next to the day count. Includes a Google Maps link icon.
- **Currency Toggle**: 
  - Located at the top of the **Totals Section** at the bottom of the page.
  - Domestic ($) and Foreign toggle buttons.
  - Selector to choose the foreign currency (EUR, ISK, etc.).
  - Custom exchange rate entry field (free text).
- **Registration Fee**: Included in totals with its own currency context toggle.

## Flights Panel
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
  - Departure airport code (e.g., "BWI").
  - Arrow (→).
  - Arrival airport code.
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
  - **Vertical Format**:
    ```
    10:15a 🏡  (Start Time + From Icon)
    🚘        (Mode Icon)
    11:00a ✈️  (Arrival Time + To Icon)
    ```
  - Icons: 🏡 (Home), 🏨 (Hotel), ✈️ (Airport).
  - Mode: 🚘 (Uber/Car/Taxi).
- **Auto-populate Travel Legs**:
  - Outbound to Airport: 45m drive, arriving 3h before.
  - Outbound from Airport: 1h after arrival, 30m drive.
  - Return to Airport: 30m drive, arriving 3h before.
  - Return from Airport: 1h after arrival, 45m drive.

## Data & Logic
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
## Time Zones
- **Dual Time Zone Support**:
  - Header includes inputs for Home City, Home Time Zone, Destination City, and Destination Time Zone.
  - Automatically converts and displays both Home and Destination times on the timeline.
  - **Relevance Logic**: Bold the time zone where the event occurs (Home for home travel, Destination for destination travel).
  - **Visuals**: 
    - Home times are colored Indigo/Indigo-light.
    - Destination times are colored Orange (to differentiate clearly).
    - Dual dates are shown in the timeline sidebar if the time zones cause a date shift.
