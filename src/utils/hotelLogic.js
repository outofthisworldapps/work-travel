import { format, parse, addDays, isBefore, isAfter, differenceInDays } from 'date-fns';

export const autoPopulateHotels = (flights, days, currentHotelSettings = {}) => {
    if (!flights || flights.length === 0) return days;

    const parseFlightDate = (dateStr, timeStr) => {
        if (!dateStr) return null;
        try {
            let d;
            if (dateStr.includes('/')) {
                d = parse(dateStr, 'M/d/yy', new Date());
                if (isNaN(d.getTime())) d = parse(dateStr, 'M/d/yyyy', new Date());
            } else {
                // If we have a reference date from days, use its year
                const year = (days && days[0] && days[0].date) ? days[0].date.getFullYear() : new Date().getFullYear();
                d = parse(dateStr, 'EEE MMM d', new Date(year, 0, 1));
            }
            if (!d || isNaN(d.getTime())) d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;

            let t = (timeStr || '12:00p').toLowerCase().replace(' ', '');
            let meridiem = t.slice(-1);
            let timePart = t.endsWith('a') || t.endsWith('p') ? t.slice(0, -1) : t;
            let parts = timePart.split(':');
            let h = parseInt(parts[0]);
            let m = parseInt(parts[1]) || 0;
            if (isNaN(h)) h = 12;
            if (meridiem === 'p' && h < 12) h += 12;
            if (meridiem === 'a' && h === 12) h = 0;

            d.setHours(h, m, 0, 0);
            return d;
        } catch (e) {
            return null;
        }
    };

    // 1. Extract all arrival/departure segments that are NOT at 'Home'
    const nonHomeSegments = [];
    flights.forEach(f => {
        (f.segments || []).forEach(s => {
            if (s.arrPort && s.arrPort.toLowerCase() !== 'home') {
                nonHomeSegments.push({ type: 'arr', port: s.arrPort, date: s.arrDate, time: s.arrTime, raw: s });
            }
            if (s.depPort && s.depPort.toLowerCase() !== 'home') {
                nonHomeSegments.push({ type: 'dep', port: s.depPort, date: s.depDate, time: s.depTime, raw: s });
            }
        });
    });

    const sortedEvents = nonHomeSegments.map(s => ({
        ...s,
        dt: parseFlightDate(s.date, s.time)
    })).filter(s => s.dt && !isNaN(s.dt.getTime())).sort((a, b) => a.dt - b.dt);

    if (sortedEvents.length === 0) return days;

    const arrival = sortedEvents.find(e => e.type === 'arr');
    const departure = sortedEvents.filter(e => e.type === 'dep').pop();

    if (!arrival || !departure) return days;

    const stayStart = arrival.dt;
    const stayEnd = departure.dt;

    return days.map(day => {
        const dayStart = new Date(day.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day.date);
        dayEnd.setHours(23, 59, 59, 999);

        const isAtDestination = (isBefore(dayStart, stayEnd) && isAfter(dayEnd, stayStart));

        if (!isAtDestination) {
            return { ...day, hotelRate: null, hotelTax: 0, hotelName: '' };
        }

        if (!day.date || isNaN(day.date.getTime())) return { ...day, hotelRate: null };

        const dayKey = format(day.date, 'yyyy-MM-dd');
        const departureKey = format(departure.dt, 'yyyy-MM-dd');
        const arrivalKey = format(arrival.dt, 'yyyy-MM-dd');

        const isDepartureDay = dayKey === departureKey;
        const isArrivalDay = dayKey === arrivalKey;

        // Night is following the day.
        const nextDay = addDays(day.date, 1);
        const nightTime = new Date(day.date);
        nightTime.setHours(20, 0, 0, 0); // 8 PM

        const spendsNight = isBefore(nightTime, stayEnd) && isAfter(nightTime, stayStart);

        if (spendsNight && !isDepartureDay) {
            return {
                ...day,
                hotelRate: day.hotelRate ?? (currentHotelSettings.rate || 185),
                hotelTax: day.hotelTax ?? (currentHotelSettings.tax || 25),
                hotelName: day.hotelName || currentHotelSettings.name || '',
                hotelCurrency: day.hotelCurrency || currentHotelSettings.currency || 'USD'
            };
        } else {
            return { ...day, hotelRate: null, hotelTax: 0, hotelName: '' };
        }
    });
};
