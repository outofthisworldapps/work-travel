/**
 * M&IE Panel Component
 * 
 * Displays a breakdown of Meals & Incidental Expenses for each day of the trip.
 * Columns: Date | Location | Lodging | M&IE | B | L | D | I
 * 
 * Features:
 * - Location cascades downward (edit one, affects all below)
 * - Lodging and M&IE cascade similarly
 * - Unknown cities show blank (user must enter manually)
 */

import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Utensils, RefreshCw } from 'lucide-react';
import { getMealBreakdown, calculateDayMIE, getPerDiemForLocation, CITY_LIST } from '../utils/perDiemLookup';
import { formatCurrency } from '../utils/calculations';

// Autocomplete input component
const AutocompleteInput = ({ value, onChange, placeholder, onClear, isInherited, isFirst }) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestion, setSuggestion] = useState('');

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

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
                    onBlur={() => {
                        if (suggestion && inputValue.length >= 2) {
                            acceptSuggestion();
                        }
                        setSuggestion('');
                    }}
                />
                {suggestion && inputValue && (
                    <span className="autocomplete-suggestion">
                        <span className="typed-part">{inputValue}</span>
                        <span className="suggestion-part">{suggestion.slice(inputValue.length)}</span>
                    </span>
                )}
            </div>
            {inputValue && (
                <span className="clear-location" onClick={() => { setInputValue(''); onClear(); }} title="Clear">×</span>
            )}
        </div>
    );
};

// Editable number input for manual rate entry
const EditableRate = ({ value, onChange, placeholder, isInherited, isFirst }) => {
    const [inputValue, setInputValue] = useState(value !== null ? value.toString() : '');

    useEffect(() => {
        setInputValue(value !== null && value !== undefined ? value.toString() : '');
    }, [value]);

    const handleChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        const num = parseFloat(val);
        onChange(isNaN(num) ? null : num);
    };

    return (
        <div className="rate-input-wrapper">
            <span className="rate-currency-prefix">$</span>
            <input
                type="text"
                className={`rate-input ${isInherited ? 'inherited' : ''} ${isFirst ? 'first-rate' : ''}`}
                value={inputValue}
                placeholder={placeholder || '—'}
                onChange={handleChange}
                size={4}
            />
        </div>
    );
};

const MIEPanel = ({
    days,
    destCity,
    isForeign = false,
    onUpdateMeals,
    onUpdateLocation,
    onUpdateLodging,
    onUpdateMie,
    onRefreshLocations
}) => {
    const totalDays = days.length;

    // Calculate effective values for each day (cascading from above)
    const getEffectiveValues = () => {
        const results = [];
        let lastExplicitLocation = destCity || '';
        let lastExplicitLodging = null;
        let lastExplicitMie = null;

        for (let i = 0; i < days.length; i++) {
            const day = days[i];

            // Location cascading
            let location, locationInherited;
            if (day.location) {
                location = day.location;
                locationInherited = false;
                lastExplicitLocation = day.location;
            } else {
                location = lastExplicitLocation;
                locationInherited = true;
            }

            // Look up rates from location
            const perDiem = getPerDiemForLocation(location, day.date);

            // Lodging cascading: explicit day value > lookup > inherited
            let lodging, lodgingInherited;
            if (day.lodging !== undefined && day.lodging !== null) {
                lodging = day.lodging;
                lodgingInherited = false;
                lastExplicitLodging = lodging;
            } else if (perDiem.found && perDiem.lodging !== null) {
                lodging = perDiem.lodging;
                lodgingInherited = false;
                lastExplicitLodging = lodging;
            } else if (lastExplicitLodging !== null) {
                lodging = lastExplicitLodging;
                lodgingInherited = true;
            } else {
                lodging = null;
                lodgingInherited = false;
            }

            // M&IE cascading: explicit day value > lookup > inherited
            let mie, mieInherited;
            if (day.mie !== undefined && day.mie !== null) {
                mie = day.mie;
                mieInherited = false;
                lastExplicitMie = mie;
            } else if (perDiem.found && perDiem.mie !== null) {
                mie = perDiem.mie;
                mieInherited = false;
                lastExplicitMie = mie;
            } else if (lastExplicitMie !== null) {
                mie = lastExplicitMie;
                mieInherited = true;
            } else {
                mie = null;
                mieInherited = false;
            }

            results.push({
                location,
                locationInherited,
                lodging,
                lodgingInherited,
                mie,
                mieInherited,
                perDiem
            });
        }
        return results;
    };

    const effectiveValues = useMemo(getEffectiveValues, [days, destCity]);

    // Calculate display data for each day
    const dayData = useMemo(() => {
        return days.map((day, idx) => {
            const eff = effectiveValues[idx];
            const { rate: adjustedMie, percent, isFirstOrLast } = calculateDayMIE(idx, totalDays, eff.mie);
            const breakdown = getMealBreakdown(eff.mie, isForeign || eff.perDiem.isForeign);
            const adjustedBreakdown = {
                B: breakdown.B * (percent / 100),
                L: breakdown.L * (percent / 100),
                D: breakdown.D * (percent / 100),
                I: breakdown.I * (percent / 100)
            };

            return {
                day,
                idx,
                ...eff,
                adjustedMie,
                percent,
                isFirstOrLast,
                breakdown: adjustedBreakdown
            };
        });
    }, [days, effectiveValues, totalDays, isForeign]);

    // Calculate totals
    const totals = useMemo(() => {
        let totalLodging = 0;
        let totalAdjustedMIE = 0;

        dayData.forEach(d => {
            if (d.lodging !== null) totalLodging += d.lodging;
            if (d.adjustedMie !== null) totalAdjustedMIE += d.adjustedMie;
        });

        return { totalLodging, totalAdjustedMIE };
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
                                    <button className="refresh-locations-btn-inline" onClick={onRefreshLocations} title="Refresh from flights">
                                        <RefreshCw size={10} />
                                    </button>
                                )}
                            </th>
                            <th className="mie-col-lodging">Hotel</th>
                            <th className="mie-col-mie">M&IE</th>
                            <th className="mie-col-meal">B</th>
                            <th className="mie-col-meal">L</th>
                            <th className="mie-col-meal">D</th>
                            <th className="mie-col-meal">I</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dayData.map(({ day, idx, location, locationInherited, lodging, lodgingInherited, mie, mieInherited, adjustedMie, isFirstOrLast, breakdown }) => (
                            <tr key={day.id} className={isFirstOrLast ? 'mie-row-travel-day' : ''}>
                                <td className="mie-col-date">
                                    {day.date ? format(day.date, 'EEE MMM d') : '—'}
                                </td>
                                <td className="mie-col-location">
                                    <AutocompleteInput
                                        value={day.location || (locationInherited ? location : '')}
                                        placeholder={idx === 0 ? (destCity || 'City...') : 'Inherited'}
                                        onChange={(value) => onUpdateLocation && onUpdateLocation(day.id, value)}
                                        onClear={() => onUpdateLocation && onUpdateLocation(day.id, '')}
                                        isInherited={locationInherited && !day.location}
                                        isFirst={idx === 0}
                                    />
                                </td>
                                <td className="mie-col-lodging">
                                    <EditableRate
                                        value={day.lodging !== undefined && day.lodging !== null ? day.lodging : (lodgingInherited ? lodging : lodging)}
                                        placeholder={idx === 0 ? "" : "—"}
                                        onChange={(val) => onUpdateLodging && onUpdateLodging(day.id, val)}
                                        isInherited={lodgingInherited && day.lodging === undefined}
                                        isFirst={idx === 0}
                                    />
                                </td>
                                <td className={`mie-col-mie ${isFirstOrLast ? 'travel-day-rate' : ''}`}>
                                    <EditableRate
                                        value={day.mie !== undefined && day.mie !== null ? (isFirstOrLast ? day.mie * 0.75 : day.mie) : (mieInherited ? (isFirstOrLast ? mie * 0.75 : mie) : (isFirstOrLast ? adjustedMie : adjustedMie))}
                                        placeholder={idx === 0 ? "" : "—"}
                                        onChange={(val) => {
                                            if (onUpdateMie) {
                                                // If user types a value on a travel day, we store the base rate (val / 0.75)
                                                // so that it cascades correctly as the base rate
                                                const baseVal = isFirstOrLast ? val / 0.75 : val;
                                                onUpdateMie(day.id, baseVal);
                                            }
                                        }}
                                        isInherited={mieInherited && day.mie === undefined}
                                        isFirst={idx === 0}
                                    />
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.B !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'B')}
                                        title={`Breakfast: $${Math.round(breakdown.B)}`}
                                    >
                                        {breakdown.B ? `$${Math.round(breakdown.B)}` : '—'}
                                    </span>
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.L !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'L')}
                                        title={`Lunch: $${Math.round(breakdown.L)}`}
                                    >
                                        {breakdown.L ? `$${Math.round(breakdown.L)}` : '—'}
                                    </span>
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.D !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'D')}
                                        title={`Dinner: $${Math.round(breakdown.D)}`}
                                    >
                                        {breakdown.D ? `$${Math.round(breakdown.D)}` : '—'}
                                    </span>
                                </td>
                                <td className="mie-col-meal">
                                    <span
                                        className={`meal-chip ${day.meals?.I !== false ? 'active' : 'inactive'}`}
                                        onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'I')}
                                        title={`Incidentals: $${Math.round(breakdown.I)}`}
                                    >
                                        {breakdown.I ? `$${Math.round(breakdown.I)}` : '—'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="mie-totals-row">
                            <td colSpan="2" className="mie-totals-label">TOTALS</td>
                            <td className="mie-col-lodging">${Math.round(totals.totalLodging)}</td>
                            <td className="mie-col-mie">${Math.round(totals.totalAdjustedMIE)}</td>
                            <td colSpan="4"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mie-legend">
                <span className="legend-item">
                    <span className="legend-color travel-day"></span> 75% First/Last Day
                </span>
                <span className="legend-item">
                    <span className="legend-color full-day"></span> 100% Full Day
                </span>
                <span className="legend-tip">Edit values cascade down • Tab to autocomplete</span>
            </div>
        </div>
    );
};

export default MIEPanel;
