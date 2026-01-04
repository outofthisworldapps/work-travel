import React, { useMemo } from 'react';
import { format, differenceInHours, differenceInMinutes, addDays, startOfDay } from 'date-fns';
import { Home, Briefcase, Utensils, CreditCard } from 'lucide-react';

// Utility: parse time string to hours (e.g., "8:30p" -> 20.5)
const parseTime = (timeStr) => {
    if (!timeStr) return null;
    try {
        let t = timeStr.toLowerCase().replace(' ', '');
        let meridiem = t.slice(-1);
        if (meridiem !== 'a' && meridiem !== 'p') meridiem = 'p';
        let timePart = t.endsWith('a') || t.endsWith('p') ? t.slice(0, -1) : t;
        let parts = timePart.split(':');
        let h = parseInt(parts[0]);
        let m = parseInt(parts[1]) || 0;
        if (isNaN(h)) return null;
        if (meridiem === 'p' && h < 12) h += 12;
        if (meridiem === 'a' && h === 12) h = 0;
        return h + m / 60;
    } catch (e) { return null; }
};

// Format time number to display string (e.g., 20.5 -> "8:30p")
const formatTimeNum = (num) => {
    // Normalize to positive 0-24 range first
    let normalized = num;
    while (normalized < 0) { normalized += 24; }
    while (normalized >= 24) { normalized -= 24; }

    let h = Math.floor(normalized);
    let m = Math.round((normalized - h) * 60);

    // Handle minute overflow
    if (m >= 60) {
        m -= 60;
        h += 1;
    }
    if (m < 0) {
        m += 60;
        h -= 1;
    }

    // Re-normalize hours
    while (h < 0) { h += 24; }
    while (h >= 24) { h -= 24; }

    const meridiem = h < 12 ? 'a' : 'p';
    const dispH = h % 12 || 12;
    return `${dispH}:${m.toString().padStart(2, '0')}${meridiem}`;
};

// Parse segment date string to Date
const parseSegDate = (dateStr, refDate) => {
    if (!dateStr) return null;
    try {
        let d = null;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            let y = parseInt(parts[2]);
            if (y < 100) y += 2000;
            d = new Date(y, parseInt(parts[0]) - 1, parseInt(parts[1]), 12, 0, 0);
        } else if (dateStr.includes('-')) {
            const [y, m, d_part] = dateStr.split('-').map(Number);
            d = new Date(y, m - 1, d_part, 12, 0, 0);
        } else {
            // Try native parsing for 'EEE MMM d yyyy' etc.
            d = new Date(dateStr);
            if (isNaN(d.getTime())) {
                // Handle formats like "Wed Apr 15"
                const parts = dateStr.split(' ');
                if (parts.length >= 3) {
                    const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
                    const month = months[parts[1]];
                    const day = parseInt(parts[2]);
                    const year = parts[3] ? parseInt(parts[3]) : (refDate ? refDate.getFullYear() : new Date().getFullYear());
                    d = new Date(year, month, day, 12, 0, 0);
                }
            } else if (refDate && d.getFullYear() !== refDate.getFullYear()) {
                // If it parsed but the year is wrong (e.g. current year vs trip year)
                d.setFullYear(refDate.getFullYear());
            }
        }
        return (!d || isNaN(d.getTime())) ? null : d;
    } catch (e) { return null; }
};

// Get TZ offset between two time zones in hours
const getTZOffset = (date, tz1, tz2) => {
    if (!tz1 || !tz2 || tz1 === tz2) return 0;
    try {
        const options = { hour: 'numeric', hour12: false, minute: 'numeric', year: 'numeric', month: 'numeric', day: 'numeric' };
        const formatter1 = new Intl.DateTimeFormat('en-US', { ...options, timeZone: tz1 });
        const formatter2 = new Intl.DateTimeFormat('en-US', { ...options, timeZone: tz2 });
        const parts1 = formatter1.formatToParts(date);
        const parts2 = formatter2.formatToParts(date);
        const getVal = (parts, type) => parseInt(parts.find(p => p.type === type).value);
        const d1 = new Date(getVal(parts1, 'year'), getVal(parts1, 'month') - 1, getVal(parts1, 'day'), getVal(parts1, 'hour'), getVal(parts1, 'minute'));
        const d2 = new Date(getVal(parts2, 'year'), getVal(parts2, 'month') - 1, getVal(parts2, 'day'), getVal(parts2, 'hour'), getVal(parts2, 'minute'));
        return (d1.getTime() - d2.getTime()) / 3600000;
    } catch (e) { return 0; }
};

// Import airport timezone lookup
import { getAirportTimezone } from '../utils/airportTimezones';

// Determine port's time zone using airport database first
const getPortTZ = (port, homeCity, destCity, homeTZ, destTZ) => {
    if (!port) return destTZ;
    const p = port.toUpperCase().trim();

    // First try airport timezone database
    const airportTZ = getAirportTimezone(p);
    if (airportTZ) return airportTZ;

    // Fallback to city name matching
    const hc = (homeCity || '').toUpperCase();
    const dc = (destCity || '').toUpperCase();
    if (hc.includes(p) || (p.length === 3 && hc.includes(p))) return homeTZ;
    if (dc.includes(p) || (p.length === 3 && dc.includes(p))) return destTZ;
    return homeTZ;
};

// Calculate all midnight positions for home and dest time zones across the trip
const calculateMidnights = (tripStartDate, totalDays, homeTZ, destTZ) => {
    const midnights = [];

    // For each day in the trip, add home midnight (at 0h of that day in home time)
    for (let dayIdx = 0; dayIdx <= totalDays; dayIdx++) {
        const dayDate = addDays(tripStartDate, dayIdx);
        const dayLabel = format(dayDate, 'EEE MMM d').toUpperCase();

        midnights.push({
            dayIndex: dayIdx,
            hoursFromStart: dayIdx * 24,
            tz: 'home',
            label: dayLabel
        });
    }

    // Calculate destination midnights (where destination clock hits midnight in home time)
    if (homeTZ !== destTZ) {
        for (let dayIdx = 0; dayIdx <= totalDays + 1; dayIdx++) {
            // The destination date we want to find midnight for
            const destDayDate = addDays(tripStartDate, dayIdx);

            // Find when this destination midnight occurs in home timeline hours
            // offset is positive when dest is ahead (e.g., Europe vs US East)
            const offset = getTZOffset(destDayDate, destTZ, homeTZ);
            // Midnight in dest timezone occurs 'offset' hours earlier in home time
            const destMidnightInHomeHours = dayIdx * 24 - offset;

            // Only add if within trip bounds (with some margin)
            if (destMidnightInHomeHours >= -12 && destMidnightInHomeHours <= (totalDays + 1) * 24) {
                // The label should be for the destination date (dayIdx), not the home date
                const destLabel = format(destDayDate, 'EEE MMM d').toUpperCase();

                midnights.push({
                    dayIndex: dayIdx,
                    hoursFromStart: destMidnightInHomeHours,
                    tz: 'dest',
                    label: destLabel
                });
            }
        }
    }

    return midnights.sort((a, b) => a.hoursFromStart - b.hoursFromStart);
};

/**
 * ContinuousTimeline - A single continuous vertical timeline for the entire trip
 */
const ContinuousTimeline = ({
    days,
    flights,
    hotels,
    transportation,
    showMIE,
    onEditEvent,
    onUpdateMeals,
    homeTimeZone,
    destTimeZone,
    homeCity,
    destCity,
    currentRates
}) => {
    const totalDays = days.length;
    const tripStartDate = days[0]?.date;
    const totalHours = totalDays * 24;
    const isDifferentTZ = homeTimeZone !== destTimeZone;

    // Height per day in pixels
    const hoursPerDay = 24;
    const dayHeight = 120; // px per day
    const totalHeight = totalDays * dayHeight;

    // Convert hours from trip start to percentage position
    const getPosition = (hoursFromStart) => {
        if (hoursFromStart === null || isNaN(hoursFromStart)) return 0;
        return (hoursFromStart / totalHours) * 100;
    };

    // Calculate all midnights
    const midnights = useMemo(() => {
        if (!tripStartDate) return [];
        const homeMidnights = calculateMidnights(tripStartDate, totalDays, homeTimeZone, homeTimeZone);
        let awayMidnights = [];
        if (isDifferentTZ) {
            awayMidnights = calculateMidnights(tripStartDate, totalDays, homeTimeZone, destTimeZone);
        }
        return [...homeMidnights, ...awayMidnights];
    }, [tripStartDate, totalDays, homeTimeZone, destTimeZone, isDifferentTZ]);

    // Calculate position for "Now" line
    const nowPos = useMemo(() => {
        if (!tripStartDate) return null;
        const now = new Date();
        const tripStart = startOfDay(tripStartDate);
        const minutesFromStart = differenceInMinutes(now, tripStart);
        const hoursFromStart = minutesFromStart / 60;

        if (hoursFromStart >= 0 && hoursFromStart <= totalHours) {
            return getPosition(hoursFromStart);
        }
        return null;
    }, [tripStartDate, totalHours]);

    // Process all flights into timeline segments
    const flightSegments = useMemo(() => {
        const segments = [];
        const seenIds = new Set();

        flights.forEach((f, fIdx) => {
            const allSegs = [
                ...(f.outbound || []),
                ...(f.returnSegments || [])
            ];

            allSegs.forEach((s, sIdx) => {
                if (!s.id) return;
                // Avoid duplicates if a segment is in multiple lists for some reason
                if (seenIds.has(s.id)) return;
                seenIds.add(s.id);

                const depDate = parseSegDate(s.depDate, tripStartDate);
                const arrDate = parseSegDate(s.arrDate, tripStartDate);
                const depTime = parseTime(s.depTime);
                const arrTime = parseTime(s.arrTime);

                if (!depDate || !arrDate || depTime === null || arrTime === null) return;

                // Get time zones for ports using airport database
                const depTZ = getPortTZ(s.depPort, homeCity, destCity, homeTimeZone, destTimeZone);
                const arrTZ = getPortTZ(s.arrPort, homeCity, destCity, homeTimeZone, destTimeZone);

                // Convert from LOCAL AIRPORT TIME to HOME TIMELINE TIME
                // The offset tells us: homeTime = localTime - offset
                // If PHX is 2h behind NY: offset = -2, so homeTime = 12:35 - (-2) = 14:35 (2:35p)
                const depShift = getTZOffset(depDate, depTZ, homeTimeZone);
                const arrShift = getTZOffset(arrDate, arrTZ, homeTimeZone);

                // Calculate days offset from trip start
                const tripStart = startOfDay(tripStartDate);
                const depDayOffset = Math.round(differenceInMinutes(startOfDay(depDate), tripStart) / 1440);
                const arrDayOffset = Math.round(differenceInMinutes(startOfDay(arrDate), tripStart) / 1440);

                // Subtract offset to convert local airport time to home time
                let depHoursFromStart = depDayOffset * 24 + depTime - depShift;
                let arrHoursFromStart = arrDayOffset * 24 + arrTime - arrShift;

                // Fix for overnight flights where arrival date is wrong in the data
                // If arrival appears before departure, the arrival date should be +1 day
                if (arrHoursFromStart < depHoursFromStart) {
                    arrHoursFromStart += 24;
                }

                // Only include if within trip bounds (allow slight overflow for long flights)
                if (arrHoursFromStart >= -24 && depHoursFromStart <= totalHours + 24) {
                    segments.push({
                        id: s.id || `f-${fIdx}-${sIdx}`,
                        parentFlight: f,
                        segment: s,
                        startHours: depHoursFromStart,
                        endHours: arrHoursFromStart,
                        depPort: s.depPort,
                        arrPort: s.arrPort,
                        // Store home timeline times (what the timeline uses for positioning)
                        depTimeHome: depTime - depShift,
                        arrTimeHome: arrTime - arrShift,
                        // Store original local airport times for display (in white)
                        localDepTime: s.depTime,
                        localArrTime: s.arrTime,
                        // Store timezones for reference
                        depTZ,
                        arrTZ,
                    });
                }
            });
        });

        return segments;
    }, [flights, tripStartDate, totalHours, homeCity, destCity, homeTimeZone, destTimeZone]);

    // Process hotels into timeline segments
    const hotelSegments = useMemo(() => {
        const segments = [];

        hotels.forEach((h, hIdx) => {
            if (!h.checkIn || !h.checkOut || isNaN(h.checkIn.getTime()) || isNaN(h.checkOut.getTime())) return;

            const tripStart = startOfDay(tripStartDate);
            const checkInDayOffset = differenceInHours(startOfDay(h.checkIn), tripStart) / 24;
            const checkOutDayOffset = differenceInHours(startOfDay(h.checkOut), tripStart) / 24;

            const checkInTime = parseTime(h.checkInTime) || 14;
            const checkOutTime = parseTime(h.checkOutTime) || 11;

            // Hotels are in dest time zone - subtract offset to get home time
            const shift = getTZOffset(h.checkIn, destTimeZone, homeTimeZone);

            const startHours = checkInDayOffset * 24 + checkInTime - shift;
            const endHours = checkOutDayOffset * 24 + checkOutTime - shift;

            if (startHours < totalHours + 24 && endHours > -24) {
                segments.push({
                    id: h.id || `h-${hIdx}`,
                    hotel: h,
                    startHours: Math.max(-24, startHours),
                    endHours: Math.min(totalHours + 24, endHours),
                    name: h.name
                });
            }
        });

        return segments;
    }, [hotels, tripStartDate, totalHours, destTimeZone, homeTimeZone]);


    // NOTE: travelLegs from days[].legs is DEPRECATED
    // All transportation is now in the transportation[] array

    // Map place values to emojis
    const getPlaceEmoji = (place) => {
        switch (place) {
            case 'home': return '🏡';
            case 'airport': return '✈️';
            case 'hotel': return '🏨';
            case 'work': return '💼';
            default: return place || '📍';
        }
    };

    // Process transportation items (from the new Transportation panel)
    const transportationSegments = useMemo(() => {
        if (!transportation || transportation.length === 0) return [];

        return transportation.map((t, idx) => {
            if (!t.date || !t.time) return null;

            // Determine isHome: use stored value, or infer from from/to places
            let isHome = t.isHome;
            if (isHome === undefined) {
                // If going to/from 'home', it's home timezone
                // If going to/from 'airport', 'hotel', 'work' without 'home' involved, it's away
                const fromHome = t.from === 'home';
                const toHome = t.to === 'home';
                const involvesHome = fromHome || toHome;
                const involvesAway = ['airport', 'hotel', 'work'].includes(t.from) ||
                    ['airport', 'hotel', 'work'].includes(t.to);

                if (involvesHome && !involvesAway) {
                    isHome = true;
                } else if (involvesAway && !involvesHome) {
                    isHome = false;
                } else {
                    // Mixed or unclear - default based on which endpoint is 'home'
                    isHome = toHome || fromHome;
                }
            }

            const transportTZ = isHome ? homeTimeZone : destTimeZone;
            const shift = getTZOffset(t.date, transportTZ, homeTimeZone);

            // Calculate day offset from trip start
            const tripStart = startOfDay(tripStartDate);
            const transportDate = startOfDay(t.date);
            const dayOffset = Math.round(differenceInMinutes(transportDate, tripStart) / 1440);

            const startTime = parseTime(t.time) || 0;
            const endTime = parseTime(t.endTime) || (startTime + (t.duration || 60) / 60);
            const duration = endTime - startTime; // Actual duration from times

            // Hours from trip start in home timezone (for positioning on timeline)
            const startHours = dayOffset * 24 + startTime - shift;
            const endHours = dayOffset * 24 + endTime - shift;

            // Get emojis from from/to fields or legacy fromEmoji/toEmoji
            const fromEmoji = t.from ? getPlaceEmoji(t.from) : (t.fromEmoji || '🏡');
            const toEmoji = t.to ? getPlaceEmoji(t.to) : (t.toEmoji || '✈️');

            return {
                id: t.id || `t-${idx}`,
                transport: t,
                startHours,
                endHours,
                isHome,
                fromEmoji,
                toEmoji,
                description: t.description || '',
                type: t.type || 'uber',
                // Store original local times for display labels
                localStartTime: startTime,
                localEndTime: endTime
            };
        }).filter(Boolean);
    }, [transportation, tripStartDate, homeTimeZone, destTimeZone]);

    // Get emoji for location
    const getEmoji = (loc, isAway = false) => {
        if (loc === 'Home') return '🏡';
        if (loc === 'Hotel') return '🏨';
        if (loc === 'Briefcase' || loc === 'Work' || loc === 'Office' || loc === 'Meeting' || loc === 'Conference') return '💼';
        if (isAway && loc !== 'Home') return '💼';
        return '✈️';
    };

    return (
        <div className="continuous-timeline-wrapper">
            {/* Header Row */}
            <div className={`timeline-header-icons ${isDifferentTZ ? 'dual-tz' : ''}`}>
                <div className="side-col combined-col left"><Home size={14} /></div>
                <div className="center-spacer"></div>
                {isDifferentTZ && (
                    <div className="side-col combined-col right"><Briefcase size={14} /></div>
                )}
                {showMIE && <div style={{ width: '65px' }} />}
            </div>

            {/* Main Timeline Area */}
            <div className={`continuous-timeline ${isDifferentTZ ? 'dual-tz' : ''} ${showMIE ? 'with-mie' : ''}`}
                style={{ height: `${totalHeight}px`, position: 'relative', display: 'flex' }}>

                {/* Left Combined Column - Home Time Zone Dates + Times */}
                <div className="timeline-col combined-col left" style={{ position: 'relative' }}>
                    {/* Date labels at midnight positions */}
                    {midnights.filter(m => m.tz === 'home').map((m, i) => (
                        <div key={`home-${i}`} className="midnight-label-single home"
                            style={{ position: 'absolute', top: `${getPosition(m.hoursFromStart)}%` }}>
                            {m.label}
                        </div>
                    ))}
                    {/* Hour labels for each day */}
                    {Array.from({ length: totalDays + 1 }, (_, dayIdx) => (
                        Array.from({ length: 23 }, (_, h) => {
                            const hour = h + 1; // 1-23 (skip 0 which is midnight)
                            const hoursFromStart = dayIdx * 24 + hour;
                            if (hoursFromStart >= totalHours) return null;
                            return (
                                <div
                                    key={`home-hour-${dayIdx}-${hour}`}
                                    style={{
                                        position: 'absolute',
                                        top: `${getPosition(hoursFromStart)}%`,
                                        right: '5px',
                                        fontSize: '0.4rem',
                                        color: 'rgba(99, 102, 241, 0.5)',
                                        transform: 'translateY(-50%)',
                                        fontFamily: 'monospace'
                                    }}
                                >
                                    {hour}
                                </div>
                            );
                        })
                    ))}
                </div>

                {/* Main Timeline Grid */}
                <div className="timeline-hours-container" style={{ flex: 1, position: 'relative' }}>

                    {/* Midnight Lines - Home extends all left, Dest extends all right */}
                    {midnights.map((m, i) => (
                        <div
                            key={`line-${i}`}
                            className={`midnight-line-continuous ${m.tz}`}
                            style={{
                                position: 'absolute',
                                top: `${getPosition(m.hoursFromStart)}%`,
                                left: m.tz === 'home' ? '-120px' : '0',
                                right: m.tz === 'dest' ? '-120px' : '0',
                                borderTop: m.tz === 'home' ? '2px solid #6366f1' : '2px dashed #f59e0b',
                                zIndex: 5,
                                opacity: 0.5
                            }}
                        />
                    ))}

                    {/* Hour lines for visual reference */}
                    {Array.from({ length: totalDays * 24 }, (_, h) => (
                        <div
                            key={`hour-${h}`}
                            className="hour-line"
                            style={{
                                position: 'absolute',
                                top: `${getPosition(h)}%`,
                                left: 0,
                                right: 0,
                                height: '1px',
                                background: 'rgba(255,255,255,0.04)'
                            }}
                        />
                    ))}

                    {/* Day separator lines */}
                    {Array.from({ length: totalDays }, (_, d) => (
                        <div
                            key={`day-sep-${d}`}
                            style={{
                                position: 'absolute',
                                top: `${getPosition(d * 24)}%`,
                                left: 0,
                                right: 0,
                                height: '1px',
                                background: 'rgba(255,255,255,0.1)',
                                zIndex: 3
                            }}
                        />
                    ))}

                    {/* Current Time "Now" Line */}
                    {nowPos !== null && (
                        <div
                            style={{
                                position: 'absolute',
                                top: `${nowPos}%`,
                                left: 0,
                                right: 0,
                                height: '1px',
                                background: '#ef4444',
                                opacity: 0.8,
                                zIndex: 1,
                                boxShadow: '0 0 4px rgba(239, 68, 68, 0.4)'
                            }}
                        />
                    )}

                    {/* Flight Segments - Single blocks spanning multiple days */}
                    {flightSegments.map(seg => {
                        const startPos = getPosition(seg.startHours);
                        const endPos = getPosition(seg.endHours);
                        const height = endPos - startPos;

                        // Determine if this is outbound or return for time zone relevance
                        const isOutbound = seg.parentFlight.outbound && seg.parentFlight.outbound.find(s => s.id === seg.id);

                        // Check if departure/arrival is at home or away timezone
                        const depIsHome = seg.depTZ === homeTimeZone;
                        const arrIsHome = seg.arrTZ === homeTimeZone;

                        return (
                            <div
                                key={seg.id}
                                className="tl-event flight-event clickable"
                                onClick={() => onEditEvent({ type: 'flight', id: seg.parentFlight.id, segmentId: seg.id })}
                                style={{
                                    position: 'absolute',
                                    top: `${startPos}%`,
                                    height: `${height}%`,
                                    left: 0,
                                    right: 0,
                                    borderRadius: '8px',
                                    zIndex: 10,
                                    padding: 0
                                }}
                            >
                                <div className="tl-f-main-wrap" style={{
                                    display: 'flex', width: '100%', alignItems: 'center',
                                    justifyContent: 'flex-start', position: 'relative', height: '100%'
                                }}>
                                    {/* Restructured content: Two rows for flight details */}
                                    <div className="tl-f-content-stack" style={{
                                        display: 'flex', flexDirection: 'column', gap: '1px',
                                        width: '100%', padding: '0 10px', justifyContent: 'center',
                                        position: 'relative'
                                    }}>
                                        {/* Row 1: departure time // airport // space for straddling icon // airline */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 700, color: '#fff',
                                                minWidth: '42px', textAlign: 'right', opacity: 0.95
                                            }}>{seg.localDepTime || ''}</span>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 950, lineHeight: 1, color: '#fff'
                                            }}>{seg.depPort}</span>

                                            {/* Straddling Plane Icon */}
                                            <span style={{
                                                fontSize: '0.65rem', width: '12px', display: 'flex', justifyContent: 'center',
                                                position: 'relative', top: '7px', zIndex: 6
                                            }}>✈️</span>

                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap'
                                            }}>{seg.segment.airlineCode}</span>
                                        </div>
                                        {/* Row 2: arrival time // airport // small space // flight number */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 700, color: '#fff',
                                                minWidth: '42px', textAlign: 'right', opacity: 0.95
                                            }}>{seg.localArrTime || ''}</span>
                                            <span style={{
                                                fontSize: '0.75rem', fontWeight: 950, lineHeight: 1, color: '#fff'
                                            }}>{seg.arrPort}</span>
                                            <span style={{ minWidth: '12px' }}></span>
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap'
                                            }}>{seg.segment.flightNumber}</span>
                                            {seg.segment.seat && <span style={{ fontSize: '0.55rem', opacity: 0.7, color: '#fff', marginLeft: 'auto', marginRight: '30px' }}>Seat: {seg.segment.seat}</span>}
                                        </div>
                                    </div>

                                    <div className="tl-f-rec" style={{
                                        position: 'absolute', right: '4px', color: '#fff', fontSize: '0.7rem', fontWeight: 950
                                    }}>
                                        {seg.parentFlight.confirmation || ''}
                                    </div>
                                </div>

                                {/* Left (Home TZ) time markers - bold if airport matches home TZ */}
                                <div className="flight-time-marker dep" style={{
                                    position: 'absolute', top: 0, left: '-55px', fontSize: '0.55rem',
                                    fontWeight: 950, color: '#a5b4fc',
                                    transform: 'translateY(-50%)',
                                    opacity: depIsHome ? 1 : 0.4
                                }}>
                                    {formatTimeNum(seg.depTimeHome % 24)}
                                </div>
                                <div className="flight-time-marker arr" style={{
                                    position: 'absolute', bottom: 0, left: '-55px', fontSize: '0.55rem',
                                    fontWeight: 950, color: '#a5b4fc',
                                    transform: 'translateY(50%)',
                                    opacity: arrIsHome ? 1 : 0.4
                                }}>
                                    {formatTimeNum(seg.arrTimeHome % 24)}
                                </div>

                                {/* Right (Away TZ) time markers - bold if airport matches dest TZ */}
                                {isDifferentTZ && (
                                    <>
                                        <div className="flight-time-marker dep dest" style={{
                                            position: 'absolute', top: 0, right: '-55px', fontSize: '0.55rem',
                                            fontWeight: 950, color: '#f59e0b',
                                            transform: 'translateY(-50%)',
                                            opacity: !depIsHome ? 1 : 0.4
                                        }}>
                                            {formatTimeNum((seg.depTimeHome + getTZOffset(tripStartDate, destTimeZone, homeTimeZone)) % 24)}
                                        </div>
                                        <div className="flight-time-marker arr dest" style={{
                                            position: 'absolute', bottom: 0, right: '-55px', fontSize: '0.55rem',
                                            fontWeight: 950, color: '#f59e0b',
                                            transform: 'translateY(50%)',
                                            opacity: !arrIsHome ? 1 : 0.4
                                        }}>
                                            {formatTimeNum((seg.arrTimeHome + getTZOffset(tripStartDate, destTimeZone, homeTimeZone)) % 24)}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {/* Hotel Segments - Single blocks spanning multiple days */}
                    {hotelSegments.map(seg => {
                        const startPos = getPosition(seg.startHours);
                        const endPos = getPosition(seg.endHours);
                        const height = endPos - startPos;

                        return (
                            <div
                                key={seg.id}
                                className="tl-event hotel-event clickable"
                                onClick={() => onEditEvent({ type: 'hotel', id: seg.id })}
                                style={{
                                    position: 'absolute',
                                    top: `${startPos}%`,
                                    height: `${height}%`,
                                    width: '50%',
                                    left: '50%',
                                    borderLeft: '3px solid rgba(16, 185, 129, 0.6)',
                                    borderRadius: '8px',
                                    zIndex: 2,
                                    background: 'linear-gradient(to right, rgba(16, 185, 129, 0.25), rgba(16, 185, 129, 0.15) 50%, rgba(16, 185, 129, 0.25))'
                                }}
                            >
                                <div className="tl-hotel-name" style={{
                                    position: 'absolute', top: '50%', left: 0, right: 0,
                                    textAlign: 'center', transform: 'translateY(-50%)', zIndex: 5,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
                                }}>
                                    <span style={{ fontSize: '1rem' }}>🏨</span>
                                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.7rem' }}>{seg.name || 'Hotel'}</span>
                                </div>
                            </div>
                        );
                    })}


                    {/* NOTE: Travel Legs (travelLegs) rendering REMOVED - deprecated */}

                    {/* Transportation Segments (from Transportation panel) */}
                    {transportationSegments.map(seg => {
                        const startPos = getPosition(seg.startHours);
                        const endPos = getPosition(seg.endHours);
                        const height = endPos - startPos;

                        // Get transport type emoji
                        const typeEmoji = seg.type === 'uber' ? '🚕' :
                            seg.type === 'bus' ? '🚌' :
                                seg.type === 'train' ? '🚆' :
                                    seg.type === 'walk' ? '🚶' : '🚘';

                        return (
                            <div
                                key={seg.id}
                                className={`tl-event travel-event clickable ${seg.isHome ? 'home-side' : 'away-side'}`}
                                onClick={() => onEditEvent({ type: 'transportation', id: seg.id })}
                                style={{
                                    position: 'absolute',
                                    top: `${startPos}%`,
                                    height: `${height}%`,
                                    minHeight: '4px'
                                }}
                            >
                                <div className={`tl-travel-meta ${seg.isHome ? 'home-side' : 'away-side'}`} style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}>
                                    {/* typeEmoji // startTime // fromEmoji // endTime // toEmoji */}
                                    <div style={{ fontSize: '0.9rem' }}>{typeEmoji}</div>

                                    <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#fff' }}>
                                        {formatTimeNum(seg.localStartTime)}
                                    </span>

                                    <span style={{ fontSize: '0.65rem' }}>{seg.fromEmoji}</span>

                                    <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#fff' }}>
                                        {formatTimeNum(seg.localEndTime)}
                                    </span>

                                    <span style={{ fontSize: '0.65rem' }}>{seg.toEmoji}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right Combined Column - Dest Time Zone Dates + Times (if different TZ) */}
                {isDifferentTZ && (
                    <div className="timeline-col combined-col right" style={{ position: 'relative' }}>
                        {/* Date labels at midnight positions */}
                        {midnights.filter(m => m.tz === 'dest').map((m, i) => (
                            <div key={`dest-${i}`} className="midnight-label-single dest"
                                style={{ position: 'absolute', top: `${getPosition(m.hoursFromStart)}%` }}>
                                {m.label}
                            </div>
                        ))}
                        {/* Hour labels for dest timezone - positioned relative to dest midnights */}
                        {Array.from({ length: totalDays + 2 }, (_, dayIdx) => {
                            // Get the offset for this day
                            const dayDate = addDays(tripStartDate, dayIdx);
                            const offset = getTZOffset(dayDate, destTimeZone, homeTimeZone);

                            return Array.from({ length: 23 }, (_, h) => {
                                const hour = h + 1; // 1-23 (skip 0 which is midnight)
                                // Dest midnight for dayIdx is at (dayIdx * 24 - offset) in home hours
                                // Each dest hour is at that position + hour
                                const hoursFromStart = dayIdx * 24 - offset + hour;
                                if (hoursFromStart < 0 || hoursFromStart >= totalHours) return null;
                                return (
                                    <div
                                        key={`dest-hour-${dayIdx}-${hour}`}
                                        style={{
                                            position: 'absolute',
                                            top: `${getPosition(hoursFromStart)}%`,
                                            left: '5px',
                                            fontSize: '0.4rem',
                                            color: 'rgba(245, 158, 11, 0.5)',
                                            transform: 'translateY(-50%)',
                                            fontFamily: 'monospace'
                                        }}
                                    >
                                        {hour}
                                    </div>
                                );
                            });
                        })}
                    </div>
                )}

                {/* M&IE Column */}
                {showMIE && (
                    <div className="timeline-mie-column" style={{ width: '65px', position: 'relative' }}>
                        {days.map((day, idx) => {
                            const isFirstOrLast = totalDays > 1 && (idx === 0 || idx === totalDays - 1);
                            const mieTotal = isFirstOrLast ? day.mieBase * 0.75 : day.mieBase;
                            const topPos = getPosition(idx * 24);

                            return (
                                <div key={day.id} className="mie-day-block" style={{
                                    position: 'absolute',
                                    top: `${topPos}%`,
                                    height: `${100 / totalDays}%`,
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    padding: '8px',
                                    gap: '4px',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div className="tl-mie-total" style={{ fontSize: '0.75rem', fontWeight: 950, color: '#a5b4fc', marginBottom: '4px' }}>
                                        ${mieTotal.toFixed(2)}
                                    </div>
                                    {isFirstOrLast && <span className="tl-mie-75" style={{ fontSize: '0.55rem', opacity: 0.6 }}>75%</span>}
                                    <div className="tl-mie-stack" style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                                        {['B', 'L', 'D', 'I'].map(m => (
                                            <div
                                                key={m}
                                                className={`tl-meal-chip ${day.meals[m] !== false ? 'active' : ''}`}
                                                onClick={() => onUpdateMeals(day.id, m)}
                                                style={{
                                                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                                                    padding: '2px 4px', background: day.meals[m] !== false ? '#6366f1' : 'rgba(0,0,0,0.2)',
                                                    border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', cursor: 'pointer',
                                                    fontSize: '0.5rem', fontWeight: 950, color: day.meals[m] !== false ? '#fff' : '#64748b'
                                                }}
                                            >
                                                {m}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContinuousTimeline;
