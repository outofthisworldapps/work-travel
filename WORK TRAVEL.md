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
  - **Outbound Flights**: Departure time is in home time zone, arrival time is in destination time zone.
  - **Return Flights**: Departure time is in destination time zone, arrival time is in home time zone.
- **Editable Flight Data**: 
  - All flight times and dates are fully editable in text inputs.
  - Flight date dropdowns allow selection of any date within the trip duration.
  - Changes to flight times immediately update the timeline display and positioning.
  - No automatic history saves on keystroke - allows smooth editing without performance issues.
- **Single-line Flight Entry**: Each flight booking shows:
  - Drag handle (grip icon) on left.
  - Airline name input.
  - Confirmation/Reference number input.
  - Cost with $ / Globe toggle (on same line).
  - Delete button.
- **Segment Details**: Each leg shows:
  - Flight number (e.g., "FI 642").
  - **Departure Date**: Simple dropdown selector showing all dates within the trip duration.
    - Dates are stored as `yyyy-MM-dd` to ensure consistency and prevent browser-specific parsing issues.
    - Arrival date is **auto-calculated** based on departure and arrival times.
    - If arrival time is earlier than departure time, it's next day (redeye flight).
    - Displayed as: `→ Wed Apr 13` (arrow with arrival date).
  - Departure time (e.g., "8:30p").
  - Departure airport code (e.g., "BWI") + **Terminal** (e.g., "T4").
  - Arrow (→).
  - Arrival airport code + **Terminal**.
  - Arrival time (e.g., "6:25a").
  - **Mobile Layout**: Two-row compact grid (Row 1: Flight#/Dep info, Row 2: Seat#/Arr info) that fits perfectly within 375px screens.
- **Layovers**: Displayed between segments with time duration.

## Hotels Panel
- **Hotel Entry**: 
  - Hotel name with cost (total for stay) and $ / Globe toggle.
  - **Compact Trip Date Range Picker**:
    - Shows only the week(s) of the trip (not the full year).
    - 🗓️ icon opens compact calendar showing only trip dates.
    - First click = check-in date, second click = check-out date.
    - Display shows: `Sun JAN 4 – Thu JAN 8 (5 days)`.
    - Can also click individual dates as fallback.
  - Check-in and check-out times displayed on same row after dates.
- **Currency Toggle**: Individual toggle for domestic/foreign rate context.
- **Default Stay Logic**: STAY includes arrival night to departure day.
  - **Early Arrival Rule**: If the scheduled hotel arrival (airport arrival + 1.5h) is before 5:00 AM, the stay automatically includes the night before.
  - **Fix**: Check-in date should match the arrival day at the destination (unless the Early Arrival Rule applies).

## Transportation Panel
- **Purpose**: Manages all ground transportation to/from airports and other locations.
- **Auto-population from Flights**: When flights are added, transportation trips are automatically generated:
  - **Home → Airport**: Uber trip 4 hours before outbound departure (1 hour drive, arrive 3 hours before flight).
  - **Airport → Hotel**: Uber trip 1 hour after outbound arrival (30 minute ride to hotel).
  - **Hotel → Airport**: Uber trip 3.5 hours before return departure (30 minute ride, arrive 3 hours before flight).
  - **Airport → Home**: Uber trip 1 hour after return arrival (1 hour drive home).
- **Two-Row Layout**: Each transportation entry uses a 2-row format:
  - **Row 1**: Grab handle | Date | Timezone Icon | From Place | Departure Time | Price | Delete
  - **Row 2**: (spacer) | Transport Type | To Place | Arrival Time | Duration
- **Timezone Awareness**: 
  - Each trip displays a timezone indicator icon (🏡 for home, 💼 for away).
  - The timezone is automatically determined based on flight times:
    - Before outbound departure → Home timezone (🏡)
    - After outbound arrival and before return departure → Away timezone (💼)
    - After return arrival → Home timezone (🏡)
  - The indicator has a colored background (indigo for home, orange for away).
- **Place Selectors**: From/To dropdowns with emoji icons:
  - 🏡 Home
  - ✈️ Airport
  - 🏨 Hotel
  - 💼 Work
- **Transport Type Selector**: Dropdown with types:
  - 🚕 Uber/Taxi
  - 🚌 Bus
  - 🚆 Train
  - 🚶 Walk
- **Cost Entry**:
  - Price input field
  - Currency toggle button ($ for USD, 🌐 for foreign currency)
  - When foreign currency is selected, shows USD equivalent conversion
- **Reordering**: Drag handle (grip icon) on left side allows reordering trips
- **Add/Delete**: ADD TRIP button at bottom, delete (trash) button on each row
- **Linked Arrival Time & Duration**: 
  - Changing the **Arrival Time** updates the **Duration** automatically.
  - Changing the **Duration** updates the **Arrival Time** automatically.
  - The **Departure Time** remains fixed during these calculations.
- **Timeline Integration**: Transportation items appear on the timeline:
  - Home-side transport (indigo, left-aligned)
  - Away-side transport (orange, right-aligned)

## M&IE Panel
- **Purpose**: Displays day-by-day Meals & Incidental Expenses breakdown.
- **Location**: Positioned after TRANSPORTATION panel and before GRAND TOTAL.
- **Day-by-Day Table**: One row for each day of the trip with the following columns:
  - **Date**: Trip date (e.g., "Mon Aug 17")
  - **City, State, Country**: Destination location for per diem lookup
  - **Max Lodging**: Maximum lodging rate from per diem tables
  - **M&IE**: Base meals and incidentals rate from per diem tables
  - **%**: 100% for full days, 75% for first/last day of travel
  - **M&IE × %**: Adjusted M&IE amount after percentage applied
  - **B**: Breakfast cost (click to toggle deduction)
  - **L**: Lunch cost (click to toggle deduction)
  - **D**: Dinner cost (click to toggle deduction)
  - **I**: Incidentals cost (click to toggle deduction)
- **Per Diem Lookup**: Uses CSV tables in `src/data/` for:
  - `US_Per_Diem_FY2026.csv`: Domestic US rates by state/city with seasonal variations
  - `Foreign_Per_Diem_January2026PD.csv`: Foreign rates by country/city with seasonal variations
- **Meal Deductions**: Click B/L/D/I to toggle meals that were provided (deducted from per diem)
- **Visual Indicators**:
  - First/last travel days highlighted with 75% rate
  - Active meals show in purple chips
  - Deducted meals show strikethrough
- **Totals Row**: Shows sum of Max Lodging, M&IE, and adjusted M&IE

## Vertical Timeline (Continuous Graph)
- **Single Continuous Timeline**: The timeline is rendered as one continuous vertical graph spanning the entire trip duration, NOT as separate day units.
- **Multi-Day Spanning Elements**: 
  - Flights and hotels can span across multiple days and past midnight, existing as single continuous elements.
  - An overnight flight departing at 11pm and arriving at 6am the next day appears as one seamless block.
  - Hotels spanning 3 nights appear as one continuous block from check-in to check-out.
- **Timeline Scale**: Height is calculated based on total trip hours (24 hours per day × number of days).
- **Midnight Lines**:
  - **Home Midnight**: Solid indigo line extending from the left edge (past the home time column) all the way into the timeline grid.
  - **Destination Midnight**: Dashed orange line extending from the timeline grid all the way to the right edge (past the destination time column).
  - Date labels appear at midnight positions in respective time zone columns.
- **Flight Events**: 
  - Displayed as continuous blocks from departure to arrival time.
  - **No Minimum Height**: Flight blocks scale precisely to match flight duration with no artificial minimum size.
  - Flight information (airline, flight number, seat, confirmation) is rendered within the block regardless of size.
  - Show airline/flight number + route codes.
  - **Time Zone Relevance**: Time markers use opacity to indicate relevance:
    - **Outbound**: Home/left times are opaque (relevant), destination/right times are transparent (0.4 opacity).
    - **Return**: Destination/right times are opaque (relevant), home/left times are transparent (0.4 opacity).
    - This clarifies which timezone each flight time corresponds to.
- **Hotel Events**: 
  - Displayed as continuous blocks from check-in to check-out spanning all nights.
  - Show 🏨 icon and hotel name.
  - Right-aligned in timeline grid (destination-side).
- **Travel Blocks (Uber/Taxi)**:
  - Home transport is on the **left** (indigo/home styling).
  - Away transport is on the **right** (orange/destination styling).
  - **Visible Minimum Height**: Blocks have a `4px` minimum height to ensure they remain visible for very short durations while still scaling with time.
  - Icons: 🏡 (Home), 🏨 (Hotel), ✈️ (Airport), 💼 (Work/Destination), 🚘 (Uber/Car).
- **Auto-populate Travel Legs**:
  - Ride to / from the airport takes 1 hour (Home <-> Airport).
  - Get to the airport 3 hours before the flight.
  - Leave the airport 1 hour after arrival.
  - Ride between airport and hotel takes 30 minutes (Hotel <-> Airport).
  - Transportation updates automatically on flight or time zone changes.

## Data & Logic
- **Local Times**: All flight times (set in the Flights panel) correspond to the local time of the respective airport.
- **Precision**: Show cents for every total (always 2 decimal places).
- **M&IE First/Last Day**: 75% of full rate on travel days.
- **Date Format**: EEE M/d/yy for dates (e.g., Wed 8/16/26).
- **Domestic/Foreign Toggles**: Globe/Dollar icons for every money entry.

## JSON Export Format (Version 2)
The app exports data in a **category-based** structure rather than day-based, which better represents multi-day elements like flights and hotels that span across dates.

### Top-Level Structure
```json
{
  "version": 2,
  "exportedAt": "2025-12-29T19:43:00.000Z",
  "trip": { ... },
  "flights": [ ... ],
  "hotels": [ ... ],
  "transportation": [ ... ],
  "mie": [ ... ],
  "lodging": [ ... ],
  "registration": { ... },
  "currency": { ... },
  "_legacyDays": [ ... ]
}
```

### Categories
- **trip**: Trip metadata (name, website, dates, home/destination cities & timezones, conference center).
- **flights**: Array of flight bookings with segments. Each segment has departure/arrival dates and times.
- **hotels**: Array of hotel stays with check-in/check-out dates and times.
- **transportation**: Array of ground transport entries (Uber, taxi, bus, train, walk) with dates and times.
- **mie**: M&IE (Meals & Incidental Expenses) per day - includes date, location, base rate, and meal toggles.
- **lodging**: Per diem lodging data per day - includes date, rate, tax, currency, and overage settings.
- **registration**: Conference registration fee and currency.
- **currency**: Currency settings (alternate currency, custom exchange rates, useAlt flag).
- **_legacyDays**: Backward-compatible day array for loading older files.

### Backward Compatibility
- Files saved in the old day-based format (without `version: 2`) are still fully loadable.
- When loading a version 2 file, the app reconstructs `days` from the `mie` and `lodging` arrays.

## Styling Guidelines
- **Text Inputs**: Dark background (rgba(0,0,0,0.4)), gray text (#94a3b8), not white.
- **Buttons**: Nice themed background (linear-gradient or subtle indigo-glass), accent color text/border, avoiding plain white backgrounds.
- **Placeholders**: Dark gray (#475569).
- **Accent Color**: Indigo (#6366f1).
- **Responsive**: No second scroll bars in timeline. Flight info uses a space-optimized 2-row layout on mobile (375px+) to ensure all data (airport codes, etc.) is visible.
- **Mobile Timeline Width**: Maximize the horizontal space for the timeline grid on mobile by removing unnecessary blank space in margins and between side columns.
### Time Zones
- **Automatic Time Zone Detection**: Time zones are automatically determined from airport codes - no manual selection required.
  - A built-in database of 500+ global airport codes maps to IANA timezone identifiers.
  - When you enter an airport code (e.g., BWI, KEF, CPH), the app automatically knows the timezone.
  - **Home timezone**: Set from the first outbound departure airport.
  - **Destination timezone**: Set from the last outbound arrival airport.
  - Intermediate/layover airports also have their timezones correctly determined for accurate timeline display and time conversion.
- **5-Column Layout**: The timeline is partitioned into 5 distinct vertical tracks:
  1. **Home Date**: The date label for the home time zone.
  2. **Home Time**: The specific hour/minute markers for home (indigo colored).
  3. **Timeline Grid**: The central area for flights, hotels, and transportation.
  4. **Away Time**: The specific hour/minute markers for the destination (orange colored).
  5. **Away Date**: The date label for the destination time zone.
- **Local Times in Timeline**: Flight blocks display local departure/arrival times in **white** next to airport codes in the center of the timeline grid.
- **Bold Time Markers**: Times in the home and away columns are bolded when they correspond to that column's timezone (based on airport lookup):
  - If a flight departs from a home-timezone airport, the home (left) time is bold; the away (right) time is faint.
  - If a flight arrives at an away-timezone airport, the away (right) time is bold; the home (left) time is faint.
  - Intermediate airports with different timezones are properly converted for display.
- **Flight Spanning**: Flights span the full width of the 'Timeline Grid' column.
- **Transportation Alignment**: Home-based transportation is left-aligned in the grid; Away-based transportation is right-aligned.
- **Midnight Cues**: Home midnight is a solid indigo line; Destination midnight is a dashed orange line.

## Cloud & Authentication
- **User Authentication**:
  - Sign In with Google
  - Profile display with Sign Out option
- **Cloud Storage**:
  - Save trips to personal Firebase cloud storage
  - Load trips from cloud
  - List view of saved trips with modification dates
  - Delete saved trips
- **Data Persistence**:
  - Trips are stored under the user's UID in Firestore
  - Supports multiple trip files per user

