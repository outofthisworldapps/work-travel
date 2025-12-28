import React, { useMemo } from 'react';
import { format, differenceInHours, differenceInMinutes, addDays, startOfDay } from 'date-fns';
import { Calendar, Home, Briefcase, Utensils, CreditCard } from 'lucide-react';

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
    let h = Math.floor(num);
    let m = Math.round((num % 1) * 60);
    while (h < 0) { h += 24; }
    while (h >= 24) { h -= 24; }
    const meridiem = h < 12 ? 'a' : 'p';
    const dispH = h % 12 || 12;
    return `${dispH}:${m.toString().padStart(2, '0')}${meridiem}`;
};

// Parse segment date string to Date
const parseSegDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d, 12, 0, 0);
        }
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            let y = parseInt(parts[2]);
            if (y < 100) y += 2000;
            return new Date(y, parseInt(parts[0]) - 1, parseInt(parts[1]), 12, 0, 0);
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
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

// Determine port's time zone
const getPortTZ = (port, homeCity, destCity, homeTZ, destTZ) => {
    if (!port) return destTZ;
    const p = port.toUpperCase();
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
        const dayLabel = format(dayDate, 'EEE|MMM d').toUpperCase();

        midnights.push({
            dayIndex: dayIdx,
            hoursFromStart: dayIdx * 24,
            tz: 'home',
            label: dayLabel
        });
    }

    // Calculate destination midnights (where destination clock hits midnight in home time)
    if (homeTZ !== destTZ) {
        for (let dayIdx = 0; dayIdx <= totalDays; dayIdx++) {
            const dayDate = addDays(tripStartDate, dayIdx);
            // Find when dest midnight occurs in home time
            const offset = getTZOffset(dayDate, destTZ, homeTZ);
            const destMidnightInHomeHours = dayIdx * 24 - offset;

            // Only add if within trip bounds
            if (destMidnightInHomeHours >= 0 && destMidnightInHomeHours <= totalDays * 24) {
                // Get the actual dest date for the label
                const destDate = new Date(dayDate.getTime() - offset * 3600000);
                const destLabel = format(destDate, 'EEE|MMM d').toUpperCase();

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
    const midnights = useMemo(() =>
        calculateMidnights(tripStartDate, totalDays, homeTimeZone, destTimeZone),
        [tripStartDate, totalDays, homeTimeZone, destTimeZone]
    );

    // Process all flights into timeline segments
    const flightSegments = useMemo(() => {
        const segments = [];

        flights.forEach(f => {
            (f.segments || []).forEach(s => {
                const depDate = parseSegDate(s.depDate);
                const arrDate = parseSegDate(s.arrDate);
                const depTime = parseTime(s.depTime);
                const arrTime = parseTime(s.arrTime);

                if (!depDate || !arrDate || depTime === null || arrTime === null) return;

                // Get time zones for ports
                const depTZ = getPortTZ(s.depPort, homeCity, destCity, homeTimeZone, destTimeZone);
                const arrTZ = getPortTZ(s.arrPort, homeCity, destCity, homeTimeZone, destTimeZone);

                // Convert to home time zone hours from trip start
                const depShift = getTZOffset(depDate, depTZ, homeTimeZone);
                const arrShift = getTZOffset(arrDate, arrTZ, homeTimeZone);

                // Calculate days offset from trip start
                const tripStart = startOfDay(tripStartDate);
                const depDayOffset = differenceInHours(startOfDay(depDate), tripStart) / 24;
                const arrDayOffset = differenceInHours(startOfDay(arrDate), tripStart) / 24;

                const depHoursFromStart = depDayOffset * 24 + depTime + depShift;
                const arrHoursFromStart = arrDayOffset * 24 + arrTime + arrShift;

                // Only include if within trip bounds
                if (depHoursFromStart >= 0 && depHoursFromStart <= totalHours) {
                    segments.push({
                        id: s.id,
                        parentFlight: f,
                        segment: s,
                        startHours: Math.max(0, depHoursFromStart),
                        endHours: Math.min(totalHours, arrHoursFromStart),
                        depPort: s.depPort,
                        arrPort: s.arrPort,
                        depTime: depTime + depShift,
                        arrTime: arrTime + arrShift,
                    });
                }
            });
        });

        return segments;
    }, [flights, tripStartDate, totalHours, homeCity, destCity, homeTimeZone, destTimeZone]);

    // Process hotels into timeline segments
    const hotelSegments = useMemo(() => {
        const segments = [];

        hotels.forEach(h => {
            if (!h.checkIn || !h.checkOut || isNaN(h.checkIn.getTime()) || isNaN(h.checkOut.getTime())) return;

            const tripStart = startOfDay(tripStartDate);
            const checkInDayOffset = differenceInHours(startOfDay(h.checkIn), tripStart) / 24;
            const checkOutDayOffset = differenceInHours(startOfDay(h.checkOut), tripStart) / 24;

            const checkInTime = parseTime(h.checkInTime) || 14;
            const checkOutTime = parseTime(h.checkOutTime) || 11;

            // Hotels are in dest time zone
            const shift = getTZOffset(h.checkIn, destTimeZone, homeTimeZone);

            const startHours = checkInDayOffset * 24 + checkInTime + shift;
            const endHours = checkOutDayOffset * 24 + checkOutTime + shift;

            if (startHours < totalHours && endHours > 0) {
                segments.push({
                    id: h.id,
                    hotel: h,
                    startHours: Math.max(0, startHours),
                    endHours: Math.min(totalHours, endHours),
                    name: h.name
                });
            }
        });

        return segments;
    }, [hotels, tripStartDate, totalHours, destTimeZone, homeTimeZone]);

    // Process travel legs from days
    const travelLegs = useMemo(() => {
        const legs = [];

        days.forEach((day, dayIdx) => {
            (day.legs || []).forEach(l => {
                if (l.type === 'flight') return;

                const isHome = l.from === 'Home' || l.to === 'Home';
                const legTZ = isHome ? homeTimeZone : destTimeZone;
                const shift = getTZOffset(day.date, legTZ, homeTimeZone);

                const startTime = parseTime(l.time) || 0;
                const duration = (l.duration || 30) / 60;

                const startHours = dayIdx * 24 + startTime + shift;
                const endHours = startHours + duration;

                legs.push({
                    id: l.id,
                    leg: l,
                    dayIndex: dayIdx,
                    startHours,
                    endHours,
                    isHome,
                    from: l.from,
                    to: l.to,
                    type: l.type
                });
            });
        });

        return legs;
    }, [days, homeTimeZone, destTimeZone]);

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
                <div className="side-col day-col left"><Calendar size={12} /></div>
                <div className="side-col time-col left"><Home size={14} /></div>
                <div className="center-spacer"></div>
                {isDifferentTZ && (
                    <>
                        <div className="side-col time-col right"><Briefcase size={14} /></div>
                        <div className="side-col day-col right"><Calendar size={12} style={{ opacity: 0.5 }} /></div>
                    </>
                )}
                {showMIE && <div style={{ width: '65px' }} />}
            </div>

            {/* Main Timeline Area */}
            <div className={`continuous-timeline ${isDifferentTZ ? 'dual-tz' : ''} ${showMIE ? 'with-mie' : ''}`}
                style={{ height: `${totalHeight}px`, position: 'relative', display: 'flex' }}>

                {/* Left Day Column - Home Time Zone Dates */}
                <div className="timeline-col day-col left" style={{ position: 'relative' }}>
                    {midnights.filter(m => m.tz === 'home').map((m, i) => (
                        <div key={`home-${i}`} className="midnight-label-stack home"
                            style={{ position: 'absolute', top: `${getPosition(m.hoursFromStart)}%` }}>
                            <div className="date-stack home">
                                <div className="tl-dw">{m.label.split('|')[0]}</div>
                                <div className="tl-dm">{m.label.split('|')[1]}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Left Time Column */}
                <div className="timeline-col time-col left" style={{ width: '55px', position: 'relative' }} />

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

                    {/* Flight Segments - Single blocks spanning multiple days */}
                    {flightSegments.map(seg => {
                        const startPos = getPosition(seg.startHours);
                        const endPos = getPosition(seg.endHours);
                        const height = endPos - startPos;

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
                                    padding: 0,
                                    minHeight: '24px'
                                }}
                            >
                                <div className="tl-f-main-wrap" style={{
                                    display: 'flex', width: '100%', alignItems: 'center',
                                    justifyContent: 'center', position: 'relative', height: '100%'
                                }}>
                                    <div className="tl-f-ports-stack" style={{
                                        position: 'absolute', left: '10px', display: 'flex',
                                        flexDirection: 'column', justifyContent: 'center', gap: '1px'
                                    }}>
                                        <div className="tl-f-port" style={{ fontSize: '0.7rem', fontWeight: 950, lineHeight: 1 }}>{seg.depPort}</div>
                                        <div className="tl-f-port" style={{ fontSize: '0.7rem', fontWeight: 950, lineHeight: 1 }}>{seg.arrPort}</div>
                                    </div>

                                    <div className="tl-f-info-stack" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                                        <div className="tl-f-mid" style={{ fontSize: '0.65rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                            ✈️ {seg.segment.airlineCode} {seg.segment.flightNumber}
                                        </div>
                                        {seg.segment.seat && <div className="tl-f-seat" style={{ fontSize: '0.55rem', opacity: 0.7 }}>Seat: {seg.segment.seat}</div>}
                                    </div>

                                    <div className="tl-f-rec" style={{
                                        position: 'absolute', right: '10px', opacity: 0.6, fontSize: '0.6rem', fontWeight: 950
                                    }}>
                                        {seg.parentFlight.confirmation || ''}
                                    </div>
                                </div>

                                {/* Time markers */}
                                <div className="flight-time-marker dep" style={{
                                    position: 'absolute', top: 0, left: '-55px', fontSize: '0.55rem',
                                    fontWeight: 950, color: '#a5b4fc', transform: 'translateY(-50%)'
                                }}>
                                    {formatTimeNum(seg.depTime)}
                                </div>
                                <div className="flight-time-marker arr" style={{
                                    position: 'absolute', bottom: 0, left: '-55px', fontSize: '0.55rem',
                                    fontWeight: 950, color: '#a5b4fc', transform: 'translateY(50%)'
                                }}>
                                    {formatTimeNum(seg.arrTime)}
                                </div>
                                {isDifferentTZ && (
                                    <>
                                        <div className="flight-time-marker dep dest" style={{
                                            position: 'absolute', top: 0, right: '-55px', fontSize: '0.55rem',
                                            fontWeight: 950, color: '#f59e0b', transform: 'translateY(-50%)'
                                        }}>
                                            {formatTimeNum(seg.depTime + getTZOffset(tripStartDate, destTimeZone, homeTimeZone))}
                                        </div>
                                        <div className="flight-time-marker arr dest" style={{
                                            position: 'absolute', bottom: 0, right: '-55px', fontSize: '0.55rem',
                                            fontWeight: 950, color: '#f59e0b', transform: 'translateY(50%)'
                                        }}>
                                            {formatTimeNum(seg.arrTime + getTZOffset(tripStartDate, destTimeZone, homeTimeZone))}
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
                                    borderLeft: '4px solid rgba(16, 185, 129, 0.7)',
                                    borderRadius: '8px',
                                    zIndex: 2,
                                    background: 'linear-gradient(to right, rgba(16, 185, 129, 0.85), rgba(16, 185, 129, 0.7) 20%, rgba(16, 185, 129, 0.65) 50%, rgba(16, 185, 129, 0.7) 80%, rgba(16, 185, 129, 0.85))',
                                    minHeight: '24px'
                                }}
                            >
                                <div className="tl-hotel-name" style={{
                                    position: 'absolute', top: '50%', left: 0, right: 0,
                                    textAlign: 'center', transform: 'translateY(-50%)', zIndex: 5
                                }}>
                                    <span style={{
                                        background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(10px)',
                                        padding: '5px 14px', borderRadius: '99px',
                                        border: '1.5px solid rgba(16, 185, 129, 0.5)',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.6)'
                                    }}>
                                        🏨 {seg.name || 'Hotel'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Travel Legs */}
                    {travelLegs.map(leg => {
                        const startPos = getPosition(leg.startHours);
                        const endPos = getPosition(leg.endHours);
                        const height = Math.max(endPos - startPos, 1);

                        return (
                            <div
                                key={leg.id}
                                className={`tl-event travel-event clickable ${leg.isHome ? 'home-side' : 'away-side'}`}
                                onClick={() => onEditEvent({ type: 'leg', dayIndex: leg.dayIndex, legId: leg.id })}
                                style={{
                                    position: 'absolute',
                                    top: `${startPos}%`,
                                    height: `${height}%`,
                                    minHeight: '6px'
                                }}
                            >
                                <div className={`tl-travel-meta ${leg.isHome ? 'home-side' : 'away-side'}`}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <span style={{ opacity: 0.8 }}>{getEmoji(leg.from, !leg.isHome)}</span>
                                        <span className={`time-item ${leg.isHome ? 'home' : 'dest'}`} style={{ fontSize: '0.6rem', fontWeight: 950 }}>
                                            {formatTimeNum(leg.startHours % 24)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <span style={{ opacity: 0.8 }}>{getEmoji(leg.to, !leg.isHome)}</span>
                                        <span className={`time-item ${leg.isHome ? 'home' : 'dest'}`} style={{ fontSize: '0.6rem', fontWeight: 950 }}>
                                            {formatTimeNum(leg.endHours % 24)}
                                        </span>
                                    </div>
                                </div>
                                <div className="car-icon-meta" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}>
                                    {leg.type === 'uber' ? '🚘' : (leg.type === 'drive' ? '🚗' : '📍')}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right Time Column (if different TZ) */}
                {isDifferentTZ && (
                    <div className="timeline-col time-col right" style={{ width: '55px', position: 'relative' }} />
                )}

                {/* Right Day Column - Dest Time Zone Dates */}
                {isDifferentTZ && (
                    <div className="timeline-col day-col right" style={{ position: 'relative' }}>
                        {midnights.filter(m => m.tz === 'dest').map((m, i) => (
                            <div key={`dest-${i}`} className="midnight-label-stack dest"
                                style={{ position: 'absolute', top: `${getPosition(m.hoursFromStart)}%` }}>
                                <div className="date-stack dest">
                                    <div className="tl-dw">{m.label.split('|')[0]}</div>
                                    <div className="tl-dm">{m.label.split('|')[1]}</div>
                                </div>
                            </div>
                        ))}
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
                                                    fontSize: '0.55rem', fontWeight: 950, color: day.meals[m] !== false ? '#fff' : '#64748b'
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
