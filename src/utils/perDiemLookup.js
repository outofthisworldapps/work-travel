/**
 * Per Diem Lookup Utilities
 * 
 * Provides lookup functions for US and Foreign per diem rates
 * including lodging and M&IE (Meals & Incidental Expenses) rates.
 */

import { MEAL_BREAKDOWN_FOREIGN, MEAL_BREAKDOWN_US, MEAL_RATIOS_FOREIGN, MEAL_RATIOS_US } from './calculations';

// US Standard CONUS rate (fallback)
export const US_STANDARD_RATE = { lodging: 110, mie: 68 };

/**
 * Pre-compiled US Per Diem data for common destinations
 * Source: FY2026 Per Diem Rates (October 1, 2025)
 * Format: { city: { state, lodging, mie, seasons?: [{start, end, lodging, mie}] } }
 */
export const US_PER_DIEM = {
    // Arizona
    "Phoenix": {
        state: "AZ", seasons: [
            { start: "October 1", end: "January 31", lodging: 160, mie: 86 },
            { start: "February 1", end: "March 31", lodging: 229, mie: 86 },
            { start: "April 1", end: "May 31", lodging: 161, mie: 86 },
            { start: "June 1", end: "August 31", lodging: 113, mie: 86 },
            { start: "September 1", end: "September 30", lodging: 160, mie: 86 }
        ]
    },
    "Scottsdale": {
        state: "AZ", seasons: [
            { start: "October 1", end: "January 31", lodging: 160, mie: 86 },
            { start: "February 1", end: "March 31", lodging: 229, mie: 86 },
            { start: "April 1", end: "May 31", lodging: 161, mie: 86 },
            { start: "June 1", end: "August 31", lodging: 113, mie: 86 },
            { start: "September 1", end: "September 30", lodging: 160, mie: 86 }
        ]
    },
    "Tucson": {
        state: "AZ", lodging: 128, mie: 74, seasons: [
            { start: "October 1", end: "November 30", lodging: 128, mie: 74 },
            { start: "December 1", end: "January 31", lodging: 171, mie: 74 },
            { start: "February 1", end: "April 30", lodging: 191, mie: 74 },
            { start: "May 1", end: "September 30", lodging: 105, mie: 74 }
        ]
    },
    "Sedona": {
        state: "AZ", lodging: 157, mie: 86, seasons: [
            { start: "October 1", end: "December 31", lodging: 157, mie: 86 },
            { start: "January 1", end: "May 31", lodging: 200, mie: 86 },
            { start: "June 1", end: "September 30", lodging: 157, mie: 86 }
        ]
    },

    // California
    "Los Angeles": { state: "CA", lodging: 219, mie: 92 },
    "San Francisco": { state: "CA", lodging: 321, mie: 92 },
    "San Diego": { state: "CA", lodging: 223, mie: 86 },
    "San Jose": { state: "CA", lodging: 267, mie: 86 },
    "Sacramento": { state: "CA", lodging: 179, mie: 86 },
    "Oakland": { state: "CA", lodging: 227, mie: 86 },

    // Colorado
    "Denver": { state: "CO", lodging: 202, mie: 86 },
    "Boulder": { state: "CO", lodging: 178, mie: 86 },
    "Colorado Springs": { state: "CO", lodging: 153, mie: 80 },

    // DC
    "Washington DC": {
        state: "DC", seasons: [
            { start: "October 1", end: "October 31", lodging: 275, mie: 92 },
            { start: "November 1", end: "February 28", lodging: 196, mie: 92 },
            { start: "March 1", end: "June 30", lodging: 276, mie: 92 },
            { start: "July 1", end: "August 31", lodging: 183, mie: 92 },
            { start: "September 1", end: "September 30", lodging: 275, mie: 92 }
        ]
    },
    "Washington": {
        state: "DC", seasons: [
            { start: "October 1", end: "October 31", lodging: 275, mie: 92 },
            { start: "November 1", end: "February 28", lodging: 196, mie: 92 },
            { start: "March 1", end: "June 30", lodging: 276, mie: 92 },
            { start: "July 1", end: "August 31", lodging: 183, mie: 92 },
            { start: "September 1", end: "September 30", lodging: 275, mie: 92 }
        ]
    },

    // Florida
    "Miami": {
        state: "FL", seasons: [
            { start: "October 1", end: "November 30", lodging: 145, mie: 92 },
            { start: "December 1", end: "January 31", lodging: 210, mie: 92 },
            { start: "February 1", end: "March 31", lodging: 232, mie: 92 },
            { start: "April 1", end: "May 31", lodging: 182, mie: 92 },
            { start: "June 1", end: "September 30", lodging: 145, mie: 92 }
        ]
    },
    "Orlando": {
        state: "FL", seasons: [
            { start: "October 1", end: "December 31", lodging: 140, mie: 80 },
            { start: "January 1", end: "March 31", lodging: 169, mie: 80 },
            { start: "April 1", end: "September 30", lodging: 140, mie: 80 }
        ]
    },
    "Tampa": {
        state: "FL", seasons: [
            { start: "October 1", end: "January 31", lodging: 135, mie: 80 },
            { start: "February 1", end: "April 30", lodging: 190, mie: 80 },
            { start: "May 1", end: "September 30", lodging: 135, mie: 80 }
        ]
    },
    "Fort Lauderdale": {
        state: "FL", seasons: [
            { start: "October 1", end: "December 31", lodging: 172, mie: 86 },
            { start: "January 1", end: "April 30", lodging: 224, mie: 86 },
            { start: "May 1", end: "September 30", lodging: 143, mie: 86 }
        ]
    },

    // Georgia
    "Atlanta": { state: "GA", lodging: 162, mie: 86 },

    // Illinois
    "Chicago": { state: "IL", lodging: 225, mie: 86 },

    // Maryland (near DC)
    "Baltimore": { state: "MD", lodging: 157, mie: 80 },

    // Massachusetts
    "Boston": {
        state: "MA", seasons: [
            { start: "October 1", end: "November 30", lodging: 276, mie: 86 },
            { start: "December 1", end: "March 31", lodging: 238, mie: 86 },
            { start: "April 1", end: "June 30", lodging: 310, mie: 86 },
            { start: "July 1", end: "September 30", lodging: 276, mie: 86 }
        ]
    },

    // Nevada
    "Las Vegas": {
        state: "NV", seasons: [
            { start: "October 1", end: "December 31", lodging: 161, mie: 86 },
            { start: "January 1", end: "February 28", lodging: 186, mie: 86 },
            { start: "March 1", end: "April 30", lodging: 210, mie: 86 },
            { start: "May 1", end: "September 30", lodging: 161, mie: 86 }
        ]
    },

    // New York
    "New York": { state: "NY", lodging: 329, mie: 92 },
    "New York City": { state: "NY", lodging: 329, mie: 92 },
    "NYC": { state: "NY", lodging: 329, mie: 92 },

    // Texas
    "Dallas": { state: "TX", lodging: 161, mie: 86 },
    "Fort Worth": { state: "TX", lodging: 161, mie: 86 },
    "Houston": { state: "TX", lodging: 148, mie: 80 },
    "Austin": {
        state: "TX", seasons: [
            { start: "October 1", end: "February 28", lodging: 166, mie: 86 },
            { start: "March 1", end: "April 30", lodging: 253, mie: 86 },
            { start: "May 1", end: "September 30", lodging: 166, mie: 86 }
        ]
    },
    "San Antonio": { state: "TX", lodging: 145, mie: 80 },

    // Washington
    "Seattle": { state: "WA", lodging: 253, mie: 86 },
    "Portland": { state: "OR", lodging: 180, mie: 86 },

    // Utah
    "Salt Lake City": { state: "UT", lodging: 147, mie: 80 },

    // Minnesota
    "Minneapolis": { state: "MN", lodging: 147, mie: 80 },

    // Hawaii
    "Honolulu": { state: "HI", lodging: 248, mie: 108 },
};

/**
 * Airport code to city name mapping for per diem lookup
 * Extended from airportTimezones.js AIRPORT_CITIES
 */
export const AIRPORT_TO_PERDIEM_CITY = {
    "PHX": "Phoenix",
    "TUS": "Tucson",
    "LAX": "Los Angeles",
    "SFO": "San Francisco",
    "SAN": "San Diego",
    "SJC": "San Jose",
    "SMF": "Sacramento",
    "OAK": "Oakland",
    "DEN": "Denver",
    "DCA": "Washington DC",
    "IAD": "Washington DC",
    "BWI": "Baltimore",
    "MIA": "Miami",
    "MCO": "Orlando",
    "TPA": "Tampa",
    "FLL": "Fort Lauderdale",
    "ATL": "Atlanta",
    "ORD": "Chicago",
    "MDW": "Chicago",
    "BOS": "Boston",
    "LAS": "Las Vegas",
    "JFK": "New York",
    "LGA": "New York",
    "EWR": "New York",
    "DFW": "Dallas",
    "DAL": "Dallas",
    "IAH": "Houston",
    "HOU": "Houston",
    "AUS": "Austin",
    "SAT": "San Antonio",
    "SEA": "Seattle",
    "PDX": "Portland",
    "SLC": "Salt Lake City",
    "MSP": "Minneapolis",
    "HNL": "Honolulu",
};

/**
 * Check if a date falls within a season range
 * Season dates are in format like "October 1" or "February 28"
 */
const isDateInSeason = (date, seasonStart, seasonEnd) => {
    if (!seasonStart || !seasonEnd || !date) return true;

    const months = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3,
        'May': 4, 'June': 5, 'July': 6, 'August': 7,
        'September': 8, 'October': 9, 'November': 10, 'December': 11
    };

    const parseSeasonDate = (str) => {
        if (!str) return null;
        const parts = str.split(' ');
        const month = months[parts[0]];
        const day = parseInt(parts[1]);
        return month !== undefined && day ? { month, day } : null;
    };

    const start = parseSeasonDate(seasonStart);
    const end = parseSeasonDate(seasonEnd);

    if (!start || !end) return true;

    const dateMonth = date.getMonth();
    const dateDay = date.getDate();

    // Handle seasons that wrap around year end (e.g., October 1 - February 28)
    if (start.month > end.month || (start.month === end.month && start.day > end.day)) {
        if (dateMonth > start.month || (dateMonth === start.month && dateDay >= start.day)) {
            return true;
        }
        if (dateMonth < end.month || (dateMonth === end.month && dateDay <= end.day)) {
            return true;
        }
        return false;
    } else {
        if (dateMonth < start.month || (dateMonth === start.month && dateDay < start.day)) {
            return false;
        }
        if (dateMonth > end.month || (dateMonth === end.month && dateDay > end.day)) {
            return false;
        }
        return true;
    }
};

/**
 * Get city name from airport code for per diem lookup
 * @param {string} airportCode - 3-letter IATA code
 * @returns {string|null} City name for per diem lookup
 */
export const getCityFromAirport = (airportCode) => {
    if (!airportCode) return null;
    const code = airportCode.toUpperCase().trim();
    return AIRPORT_TO_PERDIEM_CITY[code] || null;
};

/**
 * Get US Per Diem rates for a city and date
 * @param {string} city - City name
 * @param {Date} date - Date for seasonal lookup
 * @returns {{ lodging: number, mie: number, city: string }}
 */
export const getUSPerDiem = (city, date) => {
    if (!city) return { ...US_STANDARD_RATE, city: 'Standard CONUS' };

    // Try exact match first
    let cityData = US_PER_DIEM[city];

    // Try case-insensitive match
    if (!cityData) {
        const cityNorm = city.toLowerCase();
        for (const [name, data] of Object.entries(US_PER_DIEM)) {
            if (name.toLowerCase() === cityNorm || name.toLowerCase().includes(cityNorm)) {
                cityData = data;
                break;
            }
        }
    }

    if (!cityData) {
        return { ...US_STANDARD_RATE, city };
    }

    // Check seasonal rates
    if (cityData.seasons && cityData.seasons.length > 0) {
        for (const season of cityData.seasons) {
            if (isDateInSeason(date, season.start, season.end)) {
                return { lodging: season.lodging, mie: season.mie, city };
            }
        }
        // No matching season, use first season's rates as default
        return { lodging: cityData.seasons[0].lodging, mie: cityData.seasons[0].mie, city };
    }

    return { lodging: cityData.lodging, mie: cityData.mie, city };
};

/**
 * Get meal breakdown for a given M&IE rate
 * @param {number} mieRate - The M&IE rate
 * @param {boolean} isForeign - Whether this is foreign travel
 * @returns {{ B: number, L: number, D: number, I: number }}
 */
export const getMealBreakdown = (mieRate, isForeign = false) => {
    const breakdown = isForeign ? MEAL_BREAKDOWN_FOREIGN : MEAL_BREAKDOWN_US;
    const entry = breakdown[Math.round(mieRate).toString()];

    if (entry) {
        return { ...entry };
    }

    // Fallback: calculate using ratios
    const ratios = isForeign ? MEAL_RATIOS_FOREIGN : MEAL_RATIOS_US;
    return {
        B: Math.round(mieRate * ratios.B * 100) / 100,
        L: Math.round(mieRate * ratios.L * 100) / 100,
        D: Math.round(mieRate * ratios.D * 100) / 100,
        I: Math.round(mieRate * ratios.I * 100) / 100
    };
};

/**
 * Calculate M&IE for a day with first/last day adjustment
 * @param {number} dayIndex - Index of day in trip (0-based)
 * @param {number} totalDays - Total days in trip
 * @param {number} baseRate - Base M&IE rate
 * @returns {{ rate: number, percent: number, isFirstOrLast: boolean }}
 */
export const calculateDayMIE = (dayIndex, totalDays, baseRate) => {
    const isFirstOrLast = totalDays > 1 && (dayIndex === 0 || dayIndex === totalDays - 1);
    const percent = isFirstOrLast ? 75 : 100;
    const rate = baseRate * (percent / 100);

    return { rate, percent, isFirstOrLast };
};

/**
 * Get per diem for a location (auto-detect airport or use city name)
 * @param {string} location - City name or airport code
 * @param {Date} date - Date for seasonal lookup
 * @returns {{ lodging: number, mie: number, city: string }}
 */
export const getPerDiemForLocation = (location, date) => {
    if (!location) return { ...US_STANDARD_RATE, city: 'Standard CONUS' };

    // Check if it's an airport code (3 letters)
    if (location.length === 3 && /^[A-Z]{3}$/i.test(location)) {
        const city = getCityFromAirport(location);
        if (city) {
            return getUSPerDiem(city, date);
        }
    }

    // Otherwise try as city name
    return getUSPerDiem(location, date);
};
