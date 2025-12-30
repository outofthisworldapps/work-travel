/**
 * Per Diem Lookup Utilities
 * 
 * Provides lookup functions for US and Foreign per diem rates
 * using the parsed JSON data from CSV files.
 */

import { MEAL_BREAKDOWN_FOREIGN, MEAL_BREAKDOWN_US, MEAL_RATIOS_FOREIGN, MEAL_RATIOS_US } from './calculations';
import perDiemData from '../data/perDiemRates.json';

// City aliases for common variations
const CITY_ALIASES = {
    'Washington DC': 'District of Columbia',
    'Washington D.C.': 'District of Columbia',
    'DC': 'District of Columbia',
    'NYC': 'New York City',
    'New York City': 'New York City',
    'LA': 'Los Angeles',
};

// Airport code to city mapping
export const AIRPORT_TO_CITY = {
    // US Airports
    "PHX": "Phoenix",
    "TUS": "Tucson",
    "LAX": "Los Angeles",
    "SFO": "San Francisco",
    "SAN": "San Diego",
    "SJC": "San Jose",
    "SMF": "Sacramento",
    "OAK": "Oakland",
    "DEN": "Denver",
    "DCA": "District of Columbia",
    "IAD": "District of Columbia",
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
    "JFK": "New York City",
    "LGA": "New York City",
    "EWR": "Newark",
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
    // International Airports
    "CPH": "Copenhagen",
    "MAD": "Madrid",
    "SDR": "Santander",
    "LHR": "London",
    "CDG": "Paris",
    "FRA": "Frankfurt",
    "AMS": "Amsterdam",
    "FCO": "Rome",
    "BCN": "Barcelona",
    "MXP": "Milan",
    "ZRH": "Zurich",
    "VIE": "Vienna",
    "DUB": "Dublin",
    "LIS": "Lisbon",
    "ATH": "Athens",
    "IST": "Istanbul",
    "DXB": "Dubai",
    "SIN": "Singapore",
    "HKG": "Hong Kong",
    "NRT": "Tokyo",
    "ICN": "Seoul",
    "SYD": "Sydney",
    "MEL": "Melbourne",
    "YYZ": "Toronto",
    "YVR": "Vancouver",
    "MEX": "Mexico City",
    "CUN": "Cancun",
};

// Get list of all city names for autocomplete
export const CITY_LIST = Object.keys(perDiemData);

/**
 * Check if a date falls within a season range
 * Season dates are in format like "October 1" or "1-Jan"
 */
const isDateInSeason = (date, seasonStart, seasonEnd) => {
    if (!seasonStart || !seasonEnd || !date) return true;

    const months = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
    };

    const parseSeasonDate = (str) => {
        if (!str) return null;
        str = str.toLowerCase().trim();

        // Try "Month Day" format (e.g., "October 1")
        let match = str.match(/^(\w+)\s+(\d+)$/);
        if (match) {
            const month = months[match[1]];
            const day = parseInt(match[2]);
            return month !== undefined ? { month, day } : null;
        }

        // Try "Day-Mon" format (e.g., "1-Jan")
        match = str.match(/^(\d+)-(\w+)$/);
        if (match) {
            const day = parseInt(match[1]);
            const month = months[match[2]];
            return month !== undefined ? { month, day } : null;
        }

        return null;
    };

    const start = parseSeasonDate(seasonStart);
    const end = parseSeasonDate(seasonEnd);

    if (!start || !end) return true;

    const dateMonth = date.getMonth();
    const dateDay = date.getDate();

    // Handle seasons that wrap around year end
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
 * Get city name from airport code
 */
export const getCityFromAirport = (airportCode) => {
    if (!airportCode) return null;
    const code = airportCode.toUpperCase().trim();
    return AIRPORT_TO_CITY[code] || null;
};

/**
 * Look up per diem rates for a city
 * Returns null for lodging/mie if city not found (don't guess!)
 */
export const getPerDiem = (city, date) => {
    if (!city) return { lodging: null, mie: null, city: null, found: false };

    const cityInput = city.trim();
    if (!cityInput) return { lodging: null, mie: null, city: null, found: false };

    // Check aliases
    let lookupCity = CITY_ALIASES[cityInput] || cityInput;

    // Try exact match
    let cityData = perDiemData[lookupCity];

    // Try case-insensitive match
    if (!cityData) {
        const cityNorm = lookupCity.toLowerCase();
        for (const [name, data] of Object.entries(perDiemData)) {
            if (name.toLowerCase() === cityNorm) {
                cityData = data;
                lookupCity = name;
                break;
            }
        }
    }

    // Try partial match (min 3 chars)
    if (!cityData && lookupCity.length >= 3) {
        const cityNorm = lookupCity.toLowerCase();
        for (const [name, data] of Object.entries(perDiemData)) {
            const nameNorm = name.toLowerCase();
            if (nameNorm.includes(cityNorm) || cityNorm.includes(nameNorm)) {
                cityData = data;
                lookupCity = name;
                break;
            }
        }
    }

    if (!cityData) {
        return { lodging: null, mie: null, city: cityInput, found: false };
    }

    // Check seasonal rates
    if (cityData.seasons && cityData.seasons.length > 0 && date) {
        for (const season of cityData.seasons) {
            if (isDateInSeason(date, season.start, season.end)) {
                return {
                    lodging: season.lodging,
                    mie: season.mie,
                    city: lookupCity,
                    country: cityData.country,
                    state: cityData.state,
                    isForeign: cityData.isForeign,
                    found: true
                };
            }
        }
    }

    // Use base rates
    if (cityData.lodging !== undefined && cityData.mie !== undefined) {
        return {
            lodging: cityData.lodging,
            mie: cityData.mie,
            city: lookupCity,
            country: cityData.country,
            state: cityData.state,
            isForeign: cityData.isForeign,
            found: true
        };
    }

    // Has seasons but couldn't match, use first season
    if (cityData.seasons && cityData.seasons.length > 0) {
        return {
            lodging: cityData.seasons[0].lodging,
            mie: cityData.seasons[0].mie,
            city: lookupCity,
            country: cityData.country,
            state: cityData.state,
            isForeign: cityData.isForeign,
            found: true
        };
    }

    return { lodging: null, mie: null, city: lookupCity, found: false };
};

/**
 * Get meal breakdown for a given M&IE rate
 */
export const getMealBreakdown = (mieRate, isForeign = false) => {
    if (!mieRate) return { B: 0, L: 0, D: 0, I: 0 };

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
 */
export const calculateDayMIE = (dayIndex, totalDays, baseRate) => {
    if (!baseRate) return { rate: 0, percent: 100, isFirstOrLast: false };

    const isFirstOrLast = totalDays > 1 && (dayIndex === 0 || dayIndex === totalDays - 1);
    const percent = isFirstOrLast ? 75 : 100;
    const rate = baseRate * (percent / 100);

    return { rate, percent, isFirstOrLast };
};

/**
 * Get per diem for a location (handles airport codes too)
 * Returns null values if not found - don't guess!
 */
export const getPerDiemForLocation = (location, date) => {
    if (!location) return { lodging: null, mie: null, city: null, found: false };

    // Check if it's an airport code (3 letters)
    if (location.length === 3 && /^[A-Z]{3}$/i.test(location)) {
        const city = getCityFromAirport(location);
        if (city) {
            return getPerDiem(city, date);
        }
    }

    return getPerDiem(location, date);
};

// Re-export for compatibility
export { perDiemData as US_PER_DIEM };
