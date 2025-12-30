/**
 * M&IE Panel Component
 * 
 * Displays a breakdown of Meals & Incidental Expenses for each day of the trip.
 * Shows: Date | City, State, Country | Max Lodging | M&IE | % | M&IE × % | B | L | D | I
 */

import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Utensils, RefreshCw } from 'lucide-react';
import { getMealBreakdown, calculateDayMIE, getPerDiemForLocation, US_PER_DIEM } from '../utils/perDiemLookup';
import { formatCurrency } from '../utils/calculations';

// Get list of all city names for autocomplete
const CITY_LIST = Object.keys(US_PER_DIEM);

// Autocomplete input component
const AutocompleteInput = ({ value, onChange, placeholder, onClear, isInherited, isFirst }) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestion, setSuggestion] = useState('');

    // Update input when external value changes
    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    // Find matching suggestion
    const findSuggestion = (text) => {
        if (!text || text.length < 2) return '';
        const lower = text.toLowerCase();
        for (const city of CITY_LIST) {
            if (city.toLowerCase().startsWith(lower) && city.toLowerCase() !== lower) {
                return city;
            }
        }
        return '';
    };

    const handleChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setSuggestion(findSuggestion(newValue));
        onChange(newValue);
    };

    const acceptSuggestion = () => {
        if (suggestion) {
            setInputValue(suggestion);
            onChange(suggestion);
            setSuggestion('');
        }
    };

    const handleKeyDown = (e) => {
        if ((e.key === 'Tab' || e.key === 'Enter') && suggestion) {
            e.preventDefault();
            acceptSuggestion();
        }
    };

    const handleBlur = () => {
        setSuggestion('');
    };

    return (
        <div className="autocomplete-wrapper">
            <div className="autocomplete-input-container">
                <input
                    type="text"
                    className={`location-input ${isInherited && !isFirst ? 'inherited' : ''} ${isFirst ? 'first-city' : ''}`}
                    value={inputValue}
                    placeholder={placeholder}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                />
                {suggestion && inputValue && (
                    <span className="autocomplete-suggestion">
                        <span className="typed-part">{inputValue}</span>
                        <span className="suggestion-part">{suggestion.slice(inputValue.length)}</span>
                    </span>
                )}
            </div>
            {inputValue && (
                <span
                    className="clear-location"
                    onClick={() => {
                        setInputValue('');
                        setSuggestion('');
                        onClear();
                    }}
                    title="Clear location"
                >×</span>
            )}
        </div>
    );
};

const MIEPanel = ({
    days,
    destCity,
    isForeign = false,
    onUpdateMeals,
    onUpdateLocation,
    onRefreshLocations
}) => {
    const totalDays = days.length;

    // Calculate effective location for each day (cascading from above)
    const getEffectiveLocations = () => {
        const locations = [];
        let lastExplicitLocation = destCity || '';

        for (let i = 0; i < days.length; i++) {
            const day = days[i];
            if (day.location) {
                // Explicitly set location
                lastExplicitLocation = day.location;
                locations.push({ value: day.location, isInherited: false });
            } else {
                // Inherited from previous day or destCity
                locations.push({ value: lastExplicitLocation, isInherited: true });
            }
        }
        return locations;
    };

    const effectiveLocations = useMemo(getEffectiveLocations, [days, destCity]);

    // Handle location change - also update all days below
    const handleLocationChange = (dayIndex, dayId, newLocation) => {
        if (onUpdateLocation) {
            // Update this day
            onUpdateLocation(dayId, newLocation);

            // If setting a new location, clear all days below so they inherit
            if (newLocation) {
                const daysBelow = days.slice(dayIndex + 1);
                daysBelow.forEach(d => {
                    if (!d.location) {
                        // Already inherited, will cascade automatically
                    }
                });
            }
        }
    };

    // Calculate per diem rates and totals for each day
    const dayData = useMemo(() => {
        return days.map((day, idx) => {
            // Use effective location (cascaded)
            const location = effectiveLocations[idx]?.value || '';

            // Look up per diem rates
            const perDiem = getPerDiemForLocation(location, day.date);

            // Calculate day's M&IE with first/last day adjustment
            const { rate: adjustedMie, percent, isFirstOrLast } = calculateDayMIE(idx, totalDays, perDiem.mie);

            // Get meal breakdown
            const breakdown = getMealBreakdown(perDiem.mie, isForeign);
            const adjustedBreakdown = {
                B: breakdown.B * (percent / 100),
                L: breakdown.L * (percent / 100),
                D: breakdown.D * (percent / 100),
                I: breakdown.I * (percent / 100)
            };

            return {
                day,
                idx,
                location: perDiem.city || location,
                displayLocation: effectiveLocations[idx]?.value || '',
                isInherited: effectiveLocations[idx]?.isInherited,
                lodging: perDiem.lodging,
                mie: perDiem.mie,
                adjustedMie,
                percent,
                isFirstOrLast,
                breakdown: adjustedBreakdown
            };
        });
    }, [days, effectiveLocations, totalDays, isForeign]);

    // Calculate totals
    const totals = useMemo(() => {
        let totalLodging = 0;
        let totalMIE = 0;
        let totalAdjustedMIE = 0;

        dayData.forEach(d => {
            totalLodging += d.lodging;
            totalMIE += d.mie;
            totalAdjustedMIE += d.adjustedMie;
        });

        return { totalLodging, totalMIE, totalAdjustedMIE };
    }, [dayData]);

    return (
        <div className="mie-panel glass">
            <div className="mie-panel-header">
                <div className="f-title"><Utensils size={14} /> M&IE PER DIEM</div>
                <div className="mie-total-badge">
                    Total: {formatCurrency(totals.totalAdjustedMIE, 'USD')}
                </div>
            </div>

            <div className="mie-table-wrapper">
                <table className="mie-table">
                    <thead>
                        <tr>
                            <th className="mie-col-date">Date</th>
                            <th className="mie-col-location">
                                <span>Location</span>
                                {onRefreshLocations && (
                                    <button
                                        className="refresh-locations-btn-inline"
                                        onClick={onRefreshLocations}
                                        title="Refresh locations from flight destination"
                                    >
                                        <RefreshCw size={10} />
                                    </button>
                                )}
                            </th>
                            <th className="mie-col-lodging">Max Lodging</th>
                            <th className="mie-col-mie">M&IE</th>
                            <th className="mie-col-pct">%</th>
                            <th className="mie-col-adjusted">M&IE × %</th>
                            <th className="mie-col-meal">B</th>
                            <th className="mie-col-meal">L</th>
                            <th className="mie-col-meal">D</th>
                            <th className="mie-col-meal">I</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dayData.map(({ day, idx, displayLocation, isInherited, lodging, mie, adjustedMie, percent, isFirstOrLast, breakdown }) => (
                            <tr key={day.id} className={isFirstOrLast ? 'mie-row-travel-day' : ''}>
                                <td className="mie-col-date">
                                    {day.date ? format(day.date, 'EEE MMM d') : '—'}
                                </td>
                                <td className="mie-col-location">
                                    <AutocompleteInput
                                        value={day.location || (isInherited ? displayLocation : '')}
                                        placeholder={idx === 0 ? (destCity || 'Enter city...') : 'Inherits from above'}
                                        onChange={(value) => handleLocationChange(idx, day.id, value)}
                                        onClear={() => onUpdateLocation && onUpdateLocation(day.id, '')}
                                        isInherited={isInherited && !day.location}
                                        isFirst={idx === 0}
                                    />
                                </td>
                                <td className="mie-col-lodging">
                                    ${lodging.toFixed(0)}
                                </td>
                                <td className="mie-col-mie">
                                    ${mie.toFixed(0)}
                                </td>
                                <td className={`mie-col-pct ${isFirstOrLast ? 'highlight' : ''}`}>
                                    {percent}%
                                </td>
                                <td className="mie-col-adjusted">
                                    ${adjustedMie.toFixed(2)}
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.B !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'B')}
                                        title={`Breakfast: $${breakdown.B.toFixed(2)}`}
                                    >
                                        ${breakdown.B.toFixed(0)}
                                    </span>
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.L !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'L')}
                                        title={`Lunch: $${breakdown.L.toFixed(2)}`}
                                    >
                                        ${breakdown.L.toFixed(0)}
                                    </span>
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.D !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'D')}
                                        title={`Dinner: $${breakdown.D.toFixed(2)}`}
                                    >
                                        ${breakdown.D.toFixed(0)}
                                    </span>
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.I !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'I')}
                                        title={`Incidentals: $${breakdown.I.toFixed(2)}`}
                                    >
                                        ${breakdown.I.toFixed(0)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="mie-totals-row">
                            <td colSpan="2" className="mie-totals-label">TOTALS</td>
                            <td className="mie-col-lodging">${totals.totalLodging.toFixed(0)}</td>
                            <td className="mie-col-mie">${totals.totalMIE.toFixed(0)}</td>
                            <td className="mie-col-pct">—</td>
                            <td className="mie-col-adjusted">${totals.totalAdjustedMIE.toFixed(2)}</td>
                            <td colSpan="4"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mie-legend">
                <span className="legend-item">
                    <span className="legend-color travel-day"></span> 75% Travel Day (First/Last)
                </span>
                <span className="legend-item">
                    <span className="legend-color full-day"></span> 100% Full Day
                </span>
                <span className="legend-tip">Tab/Enter to autocomplete • Cities cascade down</span>
            </div>
        </div>
    );
};

export default MIEPanel;
