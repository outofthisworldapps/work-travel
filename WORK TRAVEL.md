# Work Travel App - Feature Specifications

## Header & Trip Meta
- **Trip Name**: Large, bold editable text at the top.
- **Trip Dates**: 
  - Displayed in M/d/yy format (e.g., `8/16/26`)
  - Each date part is clickable to edit
  - Calendar icon for date picker
  - Number of days displayed as badge (e.g., `4 Days`)
  - **Sticky Duration**: Changing the start date shifts the entire trip (end date moves to keep the same # of days)
- **Currency Toggle**: 
  - Domestic ($) and Foreign toggle buttons at top right
  - Selector to choose the foreign currency (EUR, ISK, etc.)
  - Custom exchange rate entry field

## Flights Panel
- **Single-line Flight Entry**: Each flight booking shows:
  - Drag handle (grip icon) on left
  - Airline name input
  - Confirmation/Reference number input  
  - Cost with $ / Globe toggle (on same line)
  - Delete button
- **Segment Details**: Each leg shows on one line:
  - Flight number (e.g., "FI 642")
  - Departure date (M/d/yy format)
  - Departure time (e.g., "8:30p")
  - Departure airport code (e.g., "BWI")
  - Arrow (→)
  - Arrival airport code
  - Arrival time
  - Arrival date
- **Layovers**: Displayed between segments with time duration

## Hotels Panel
- **Hotel Entry**: Name, Check-in Date/Time, Check-out Date/Time
- **Total Cost**: Entered as total for stay with $ / Globe toggle
- **Currency Toggle**: Individual toggle for domestic/foreign rate context

## Vertical Timeline
- **Day Display**: Shows EEE (Wed) and MMM d (Jan 23) for each day
- **+ Button**: Adds travel leg to that day (functional)
- **Flight Events**: Displayed as purple gradient boxes at correct time positions
- **Hotel Events**: Displayed as green boxes at check-in/out times
- **M&IE Section**:
  - Total M&IE for day
  - **75% Badge**: Orange badge shown for first and last days
  - Individual B, L, D, I chips with dollar amounts
  - Active/Inactive toggles for meal deductions
  - Prices reflect 75% reduction on first/last days

## Data & Logic
- **Precision**: Show cents for every total (always 2 decimal places)
- **M&IE First/Last Day**: 75% of full rate on travel days
- **Date Format**: M/d/yy for dates (e.g., 8/16/26)
- **Domestic/Foreign Toggles**: Globe/Dollar icons for every money entry

## Styling Guidelines
- **Text Inputs**: Dark background (rgba(0,0,0,0.4)), gray text (#94a3b8), not white
- **Buttons**: Transparent background, accent color text/border, not white
- **Placeholders**: Dark gray (#475569)
- **Accent Color**: Indigo (#6366f1)
- **Compact Layout**: Single-line entries where possible
