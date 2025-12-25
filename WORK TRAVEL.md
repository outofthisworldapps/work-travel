# Work Travel App - Feature Specifications

## Header & Trip Meta
- **Trip Name**: Large, bold editable text at the top.
- **Trip Dates**: 
  - Editable start and end dates.
  - Number of days displayed (e.g., `4 Days`).
  - **Sticky Duration**: Changing the start date shifts the entire trip (end date moves to keep the same # of days).
- **Location**: Displayed below dates, linked to the trip destination.
- **Currency Toggle**: 
  - Global toggle between Domestic (USD) and Foreign (e.g., EUR).
  - Selector to choose the foreign currency.
  - Custom exchange rate entry field.

## Flights Panel
- **Entry Layout**: One line for Airline Name, Confirmation Code, and Total Cost.
- **Leg Details**: List of segments (Date, Time, Airport Port).
- **Layovers**: Displayed *between* segments where time gap exists.
- **Unified Cost**: All flight costs are aggregated, but individual costs are editable per flight group.

## Hotels Panel
- **Hotel Details**: Name, Check-in Date/Time, Check-out Date/Time.
- **Total Cost**: Entered as a total for the stay.
- **Currency Toggle**: Individual toggle for domestic/foreign rate context.

## Vertical Timeline
- **Seamless Flow**: Continuous time flow between days.
- **Events**: Flight boxes (✈️) and Hotel boxes (🏨) accurately positioned by time.
- **M&IE Breakdown**:
  - Individual B, L, D, I chips with prices.
  - **$ Symbol**: Always explicitly shown (e.g., `$15`).
  - Active/Inactive toggles for meal deductions.
- **Compactness**: Optimized horizontal space and reduced vertical height for overview.

## Data & Logic
- **Precision**: Show cents for every total.
- **Domestic/Foreign Toggles**: Globe/Dollar icons for every money entry to switch context.
- **Date Inputs**: Support both calendar picker and manual text entry (parsing common formats).
