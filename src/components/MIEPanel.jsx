/**
 * M&IE Panel Component
 * 
 * Displays a breakdown of Meals & Incidental Expenses for each day of the trip.
 * Shows: Date | City, State, Country | Max Lodging | M&IE | % | M&IE × % | B | L | D | I
 */

import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Utensils } from 'lucide-react';
import { getMealBreakdown, calculateDayMIE } from '../utils/perDiemLookup';
import { formatCurrency } from '../utils/calculations';

const MIEPanel = ({
    days,
    destCity,
    destState,
    destCountry,
    isForeign = false,
    onUpdateMeals
}) => {
    const totalDays = days.length;

    // Calculate totals
    const totals = useMemo(() => {
        let totalLodging = 0;
        let totalMIE = 0;
        let totalAdjustedMIE = 0;

        days.forEach((day, idx) => {
            totalLodging += day.maxLodging || 0;
            const { rate } = calculateDayMIE(idx, totalDays, day.mieBase || 0);
            totalMIE += day.mieBase || 0;
            totalAdjustedMIE += rate;
        });

        return { totalLodging, totalMIE, totalAdjustedMIE };
    }, [days, totalDays]);

    // Format location display
    const getLocationDisplay = (day) => {
        const parts = [];
        if (day.location) {
            parts.push(day.location);
        } else {
            if (destCity) parts.push(destCity);
            if (destState) parts.push(destState);
            if (destCountry) parts.push(destCountry);
        }
        return parts.join(', ') || 'Destination';
    };

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
                            <th className="mie-col-location">Location</th>
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
                        {days.map((day, idx) => {
                            const { rate, percent, isFirstOrLast } = calculateDayMIE(idx, totalDays, day.mieBase || 0);
                            const breakdown = getMealBreakdown(day.mieBase || 0, day.isForeignMie !== false);
                            const adjustedBreakdown = {
                                B: breakdown.B * (percent / 100),
                                L: breakdown.L * (percent / 100),
                                D: breakdown.D * (percent / 100),
                                I: breakdown.I * (percent / 100)
                            };

                            return (
                                <tr key={day.id} className={isFirstOrLast ? 'mie-row-travel-day' : ''}>
                                    <td className="mie-col-date">
                                        {day.date ? format(day.date, 'EEE MMM d') : '—'}
                                    </td>
                                    <td className="mie-col-location">
                                        {getLocationDisplay(day)}
                                    </td>
                                    <td className="mie-col-lodging">
                                        ${(day.maxLodging || 0).toFixed(0)}
                                    </td>
                                    <td className="mie-col-mie">
                                        ${(day.mieBase || 0).toFixed(0)}
                                    </td>
                                    <td className={`mie-col-pct ${isFirstOrLast ? 'highlight' : ''}`}>
                                        {percent}%
                                    </td>
                                    <td className="mie-col-adjusted">
                                        ${rate.toFixed(2)}
                                    </td>
                                    <td className="mie-col-meal">
                                        <span
                                            className={`meal-chip ${day.meals?.B !== false ? 'active' : 'inactive'}`}
                                            onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'B')}
                                            title={`Breakfast: $${adjustedBreakdown.B.toFixed(2)}`}
                                        >
                                            ${adjustedBreakdown.B.toFixed(0)}
                                        </span>
                                    </td>
                                    <td className="mie-col-meal">
                                        <span
                                            className={`meal-chip ${day.meals?.L !== false ? 'active' : 'inactive'}`}
                                            onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'L')}
                                            title={`Lunch: $${adjustedBreakdown.L.toFixed(2)}`}
                                        >
                                            ${adjustedBreakdown.L.toFixed(0)}
                                        </span>
                                    </td>
                                    <td className="mie-col-meal">
                                        <span
                                            className={`meal-chip ${day.meals?.D !== false ? 'active' : 'inactive'}`}
                                            onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'D')}
                                            title={`Dinner: $${adjustedBreakdown.D.toFixed(2)}`}
                                        >
                                            ${adjustedBreakdown.D.toFixed(0)}
                                        </span>
                                    </td>
                                    <td className="mie-col-meal">
                                        <span
                                            className={`meal-chip ${day.meals?.I !== false ? 'active' : 'inactive'}`}
                                            onClick={() => onUpdateMeals && onUpdateMeals(day.id, 'I')}
                                            title={`Incidentals: $${adjustedBreakdown.I.toFixed(2)}`}
                                        >
                                            ${adjustedBreakdown.I.toFixed(0)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
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
                <span className="legend-tip">Click B/L/D/I to toggle meal deductions</span>
            </div>
        </div>
    );
};

export default MIEPanel;
