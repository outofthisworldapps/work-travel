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
  - **Mobile Layout**: Stacks identification (airline/flight), dates, and times/ports into a grid area for clarity on narrow screens.
- **Date Selectors**: Same nice text + calendar icon format as the header.
- **Layovers**: Displayed between segments with time duration.

## Hotels Panel
- **Hotel Entry**: Name, Check-in Date/Time, Check-out Date/Time.
- **Total Cost**: Entered as total for stay with $ / Globe toggle.
- **Currency Toggle**: Individual toggle for domestic/foreign rate context.
- **Default Stay Logic**: STAY includes arrival night to departure day.
  - **Early Arrival Rule**: If the scheduled hotel arrival (airport arrival + 1.5h) is before 5:00 AM, the stay automatically includes the night before.

## Vertical Timeline
- **Seamless Flow**: No gaps between days in the timeline. No internal scrollbars; the section expands to fit all days.
- **Day Display**: Shows EEE (Wed) and M/d/yy for each day.
- **M&IE Toggle**: Functional toggle button located at the top right of the Timeline section header.
- **Flight & Hotel Events**: 
  - Flight events displayed at correct time positions with departure and arrival details visible inside the block.
  - Hotel events displayed at check-in/out times with 🏨 icon and name.
- **Auto-populate Travel Legs (Uber/Taxi)**:
  - **Outbound to Airport**: Start 3h 45m before flight (45m drive to airport arriving 3h before).
  - **Outbound from Airport**: Start 1h after flight arrival (allow for customs/bags, 30m drive to hotel).
  - **Return to Airport**: Start 3h 30m before flight (35m drive to airport arriving 3h before).
  - **Return from Airport**: Start 1h after flight arrival (45m drive home).
- **Editable Legs**: Clicking timeline legs allows editing name, type, and cost (with currency toggle).

## Data & Logic
- **Precision**: Show cents for every total (always 2 decimal places).
- **M&IE First/Last Day**: 75% of full rate on travel days.
- **Date Format**: EEE M/d/yy for dates (e.g., Wed 8/16/26).
- **Domestic/Foreign Toggles**: Globe/Dollar icons for every money entry.

## Styling Guidelines
- **Text Inputs**: Dark background (rgba(0,0,0,0.4)), gray text (#94a3b8), not white.
- **Buttons**: Transparent background, accent color text/border, not white.
- **Placeholders**: Dark gray (#475569).
- **Accent Color**: Indigo (#6366f1).
- **Compact Layout**: Single-line entries where possible.
- **Responsive**: No second scroll bars in timeline. Flight info stacks on mobile.
