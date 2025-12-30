/**
 * Per Diem Lookup Utilities
 * 
 * Provides lookup functions for US and Foreign per diem rates
 * including lodging and M&IE (Meals & Incidental Expenses) rates.
 */

import { MEAL_BREAKDOWN_FOREIGN, MEAL_BREAKDOWN_US, MEAL_RATIOS_FOREIGN, MEAL_RATIOS_US } from './calculations';

// US Per Diem Data (FY2026) - Parsed from CSV
// Format: { state: { city: { lodging, mie, seasons: [{start, end, lodging, mie}] } } }
// Standard CONUS rate (fallback): Lodging $110, M&IE $68
const US_STANDARD_RATE = { lodging: 110, mie: 68 };

// Note: In a production app, these would be loaded dynamically from CSV files
// For now, we'll create lookup functions that can be enhanced later

// Foreign Per Diem data structure
// Format: { country: { city: { lodging, mie, seasons: [{start, end, lodging, mie}] } } }

/**
 * Parse US Per Diem CSV data
 * Expected columns: ID, STATE, DESTINATION, COUNTY/LOCATION, SEASON BEGIN, SEASON END, FY26 Lodging Rate, FY26 M&IE
 */
export const parseUSPerDiem = (csvText) => {
    const lines = csvText.split('\n');
    const data = {};

    // Skip header rows (first 3 lines typically)
    for (let i = 3; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (handling quoted fields)
        const fields = parseCSVLine(line);
        if (fields.length < 8) continue;

        const state = fields[1]?.trim();
        const destination = fields[2]?.trim();
        const seasonBegin = fields[4]?.trim();
        const seasonEnd = fields[5]?.trim();
        const lodgingStr = fields[6]?.trim();
        const mieStr = fields[7]?.trim();

        if (!state || !destination) continue;

        const lodging = parseFloat(lodgingStr?.replace(/[$,\s]/g, '')) || 110;
        const mie = parseFloat(mieStr?.replace(/[$,\s]/g, '')) || 68;

        if (!data[state]) data[state] = {};
        if (!data[state][destination]) {
            data[state][destination] = { lodging, mie, seasons: [] };
        }

        if (seasonBegin && seasonEnd) {
            data[state][destination].seasons.push({
                start: seasonBegin,
                end: seasonEnd,
                lodging,
                mie
            });
        } else {
            // No season = year-round rate
            data[state][destination].lodging = lodging;
            data[state][destination].mie = mie;
        }
    }

    return data;
};

/**
 * Parse Foreign Per Diem CSV data
 * Expected columns: Country, Location, Season Code, Season Start Date, Season End Date, Lodging, Meals & Incidentals, Per Diem, Effective Date, Footnote Reference, Location Code
 */
export const parseForeignPerDiem = (csvText) => {
    const lines = csvText.split('\n');
    const data = {};

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseCSVLine(line);
        if (fields.length < 7) continue;

        const country = fields[0]?.trim();
        const location = fields[1]?.trim();
        const seasonStart = fields[3]?.trim();
        const seasonEnd = fields[4]?.trim();
        const lodgingStr = fields[5]?.trim();
        const mieStr = fields[6]?.trim();

        if (!country || !location) continue;

        const lodging = parseFloat(lodgingStr?.replace(/[$,\s]/g, '')) || 0;
        const mie = parseFloat(mieStr?.replace(/[$,\s]/g, '')) || 0;

        if (!data[country]) data[country] = {};
        if (!data[country][location]) {
            data[country][location] = { lodging, mie, seasons: [] };
        }

        if (seasonStart && seasonEnd && seasonStart !== '1-Jan' || seasonEnd !== '31-Dec') {
            data[country][location].seasons.push({
                start: seasonStart,
                end: seasonEnd,
                lodging,
                mie
            });
        } else {
            data[country][location].lodging = lodging;
            data[country][location].mie = mie;
        }
    }

    return data;
};

/**
 * Parse a CSV line handling quoted fields with commas
 */
const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result;
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
        'September': 8, 'October': 9, 'November': 10, 'December': 11,
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    const parseSeasonDate = (str) => {
        if (!str) return null;
        // Handle formats like "October 1", "1-Oct", "Oct 1"
        const parts = str.split(/[\s-]+/);
        let month, day;

        for (const part of parts) {
            if (months[part] !== undefined) {
                month = months[part];
            } else if (!isNaN(parseInt(part))) {
                day = parseInt(part);
            }
        }

        return month !== undefined && day ? { month, day } : null;
    };

    const start = parseSeasonDate(seasonStart);
    const end = parseSeasonDate(seasonEnd);

    if (!start || !end) return true;

    const dateMonth = date.getMonth();
    const dateDay = date.getDate();

    // Handle seasons that wrap around year end (e.g., October 1 - February 28)
    if (start.month > end.month || (start.month === end.month && start.day > end.day)) {
        // Season wraps around year end
        if (dateMonth > start.month || (dateMonth === start.month && dateDay >= start.day)) {
            return true;
        }
        if (dateMonth < end.month || (dateMonth === end.month && dateDay <= end.day)) {
            return true;
        }
        return false;
    } else {
        // Normal season within same year
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
 * Get US Per Diem rates for a location and date
 * @param {Object} usData - Parsed US per diem data
 * @param {string} state - Two-letter state code
 * @param {string} city - City name (optional)
 * @param {Date} date - Date for seasonal lookup
 * @returns {{ lodging: number, mie: number }}
 */
export const getUSPerDiem = (usData, state, city, date) => {
    if (!usData || !state) return US_STANDARD_RATE;

    const stateData = usData[state.toUpperCase()];
    if (!stateData) return US_STANDARD_RATE;

    // Try to find exact city match
    if (city) {
        const cityNorm = city.toUpperCase();
        for (const [destName, destData] of Object.entries(stateData)) {
            if (destName.toUpperCase().includes(cityNorm) || cityNorm.includes(destName.toUpperCase())) {
                // Check seasonal rates
                if (destData.seasons && destData.seasons.length > 0) {
                    for (const season of destData.seasons) {
                        if (isDateInSeason(date, season.start, season.end)) {
                            return { lodging: season.lodging, mie: season.mie };
                        }
                    }
                }
                return { lodging: destData.lodging, mie: destData.mie };
            }
        }
    }

    return US_STANDARD_RATE;
};

/**
 * Get Foreign Per Diem rates for a location and date
 * @param {Object} foreignData - Parsed foreign per diem data
 * @param {string} country - Country name
 * @param {string} city - City name (optional)
 * @param {Date} date - Date for seasonal lookup
 * @returns {{ lodging: number, mie: number }}
 */
export const getForeignPerDiem = (foreignData, country, city, date) => {
    if (!foreignData || !country) return { lodging: 0, mie: 0 };

    const countryData = foreignData[country.toUpperCase()] || foreignData[country];
    if (!countryData) {
        // Try partial match
        for (const [countryName, data] of Object.entries(foreignData)) {
            if (countryName.toUpperCase().includes(country.toUpperCase()) ||
                country.toUpperCase().includes(countryName.toUpperCase())) {
                return getForeignPerDiem(foreignData, countryName, city, date);
            }
        }
        return { lodging: 0, mie: 0 };
    }

    // Try to find city, fall back to [Other]
    const lookupCity = city || '[Other]';
    let cityData = countryData[lookupCity];

    if (!cityData && city) {
        // Try partial match
        for (const [cityName, data] of Object.entries(countryData)) {
            if (cityName.toUpperCase().includes(city.toUpperCase()) ||
                city.toUpperCase().includes(cityName.toUpperCase())) {
                cityData = data;
                break;
            }
        }
    }

    if (!cityData) {
        cityData = countryData['[Other]'] || Object.values(countryData)[0];
    }

    if (!cityData) return { lodging: 0, mie: 0 };

    // Check seasonal rates
    if (cityData.seasons && cityData.seasons.length > 0) {
        for (const season of cityData.seasons) {
            if (isDateInSeason(date, season.start, season.end)) {
                return { lodging: season.lodging, mie: season.mie };
            }
        }
    }

    return { lodging: cityData.lodging, mie: cityData.mie };
};

/**
 * Get meal breakdown for a given M&IE rate
 * @param {number} mieRate - The M&IE rate
 * @param {boolean} isForeign - Whether this is foreign travel
 * @returns {{ B: number, L: number, D: number, I: number }}
 */
export const getMealBreakdown = (mieRate, isForeign = true) => {
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
