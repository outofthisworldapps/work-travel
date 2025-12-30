/**
 * Script to parse US and Foreign per diem CSV files into JSON
 * Run with: node scripts/parsePerDiem.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse a CSV line handling quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Parse dollar amount like "$ 123" to number
function parseDollar(str) {
    if (!str) return null;
    const cleaned = str.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

// Parse US Per Diem CSV
function parseUSPerDiem(csvPath) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').map(l => l.replace(/\r/g, ''));

    const cities = {};

    // Skip header rows (first 3 lines)
    for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const cols = parseCSVLine(line);
        // ID, STATE, DESTINATION, COUNTY, SEASON_BEGIN, SEASON_END, LODGING, MIE
        const [id, state, destination, county, seasonBegin, seasonEnd, lodgingStr, mieStr] = cols;

        if (!state || !destination) continue;

        const lodging = parseDollar(lodgingStr);
        const mie = parseDollar(mieStr);

        if (lodging === null || mie === null) continue;

        // Normalize city names (handle "City1 / City2" format)
        const cityNames = destination.split('/').map(c => c.trim()).filter(c => c);

        for (const cityName of cityNames) {
            const key = cityName;

            if (!cities[key]) {
                cities[key] = {
                    state,
                    country: 'US',
                    seasons: []
                };
            }

            if (seasonBegin && seasonEnd) {
                // Seasonal rate
                cities[key].seasons.push({
                    start: seasonBegin,
                    end: seasonEnd,
                    lodging,
                    mie
                });
            } else {
                // Year-round rate
                cities[key].lodging = lodging;
                cities[key].mie = mie;
            }
        }
    }

    return cities;
}

// Parse Foreign Per Diem CSV
function parseForeignPerDiem(csvPath) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').map(l => l.replace(/\r/g, ''));

    const cities = {};

    // Find header row
    let headerIdx = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Country') && lines[i].includes('Lodging')) {
            headerIdx = i;
            break;
        }
    }

    // Parse header to find column indices
    const headerCols = parseCSVLine(lines[headerIdx]);
    const countryIdx = headerCols.findIndex(h => h.toLowerCase() === 'country');
    const cityIdx = headerCols.findIndex(h => h.toLowerCase() === 'location');
    const seasonStartIdx = headerCols.findIndex(h => h.toLowerCase().includes('season start'));
    const seasonEndIdx = headerCols.findIndex(h => h.toLowerCase().includes('season end'));
    const lodgingIdx = headerCols.findIndex(h => h.toLowerCase() === 'lodging');
    const mieIdx = headerCols.findIndex(h => h.toLowerCase().includes('meals'));

    console.log('Foreign CSV columns:', { countryIdx, cityIdx, seasonStartIdx, seasonEndIdx, lodgingIdx, mieIdx });

    for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const cols = parseCSVLine(line);

        const country = cols[countryIdx]?.trim();
        const city = cols[cityIdx]?.trim();
        const seasonStart = cols[seasonStartIdx]?.trim();
        const seasonEnd = cols[seasonEndIdx]?.trim();
        const lodging = parseDollar(cols[lodgingIdx]);
        const mie = parseDollar(cols[mieIdx]);

        if (!country || !city || lodging === null || mie === null) continue;

        // Use city as primary key, with country info
        const key = city;

        if (!cities[key]) {
            cities[key] = {
                country,
                isForeign: true,
                seasons: []
            };
        }

        if (seasonStart && seasonEnd && seasonStart !== 'N/A') {
            cities[key].seasons.push({
                start: seasonStart,
                end: seasonEnd,
                lodging,
                mie
            });
        } else {
            cities[key].lodging = lodging;
            cities[key].mie = mie;
        }
    }

    return cities;
}

// Main
const usPath = path.join(__dirname, '../src/data/US_Per_Diem_FY2026.csv');
const foreignPath = path.join(__dirname, '../src/data/Foreign_Per_Diem_January2026PD.csv');

console.log('Parsing US per diem...');
const usCities = parseUSPerDiem(usPath);
console.log(`Found ${Object.keys(usCities).length} US cities`);

console.log('Parsing Foreign per diem...');
const foreignCities = parseForeignPerDiem(foreignPath);
console.log(`Found ${Object.keys(foreignCities).length} foreign cities`);

// Merge into single object
const allCities = { ...usCities };
for (const [city, data] of Object.entries(foreignCities)) {
    if (allCities[city]) {
        // City exists in both - keep both with suffix
        allCities[`${city} (${data.country})`] = data;
    } else {
        allCities[city] = data;
    }
}

console.log(`Total: ${Object.keys(allCities).length} cities`);

// Write output
const outputPath = path.join(__dirname, '../src/data/perDiemRates.json');
fs.writeFileSync(outputPath, JSON.stringify(allCities, null, 2));
console.log(`Written to ${outputPath}`);

// Check for specific cities the user mentioned
const checkCities = ['Copenhagen', 'Madrid', 'Santander', 'Phoenix', 'Washington DC'];
console.log('\nRequested cities:');
for (const city of checkCities) {
    const data = allCities[city];
    if (data) {
        const lodging = data.lodging || data.seasons?.[0]?.lodging || '?';
        const mie = data.mie || data.seasons?.[0]?.mie || '?';
        console.log(`  ✓ ${city}: $${lodging} lodging, $${mie} M&IE (${data.country || data.state})`);
    } else {
        console.log(`  ✗ ${city}: NOT FOUND`);
    }
}
