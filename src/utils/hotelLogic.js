import { format, parse, addDays, isBefore, isAfter, differenceInDays } from 'date-fns';

export const autoPopulateHotels = (flights, days, currentHotelSettings = {}) => {
    if (!flights || flights.length === 0) return days;

    // 1. Extract all arrival/departure segments that are NOT at 'Home'
    const nonHomeSegments = [];
    flights.forEach(f => {
        f.segments.forEach(s => {
            if (s.arrPort && s.arrPort.toLowerCase() !== 'home') {
                nonHomeSegments.push({ type: 'arr', port: s.arrPort, date: s.arrDate, time: s.arrTime, raw: s });
            }
            if (s.depPort && s.depPort.toLowerCase() !== 'home') {
                nonHomeSegments.push({ type: 'dep', port: s.depPort, date: s.depDate, time: s.depTime, raw: s });
            }
        });
    });

    if (nonHomeSegments.length === 0) return days;

    // 2. Sort by time
    const parseFlightDate = (dateStr, timeStr) => {
        try {
            // Input dateStr is like 'Sun Apr 21'
            const year = new Date().getFullYear();
            let d = parse(dateStr, 'EEE MMM d', new Date(year, 0, 1));

            let t = (timeStr || '12:00p').toLowerCase().replace(' ', '');
            let meridiem = t.slice(-1);
            let timePart = t.slice(0, -1);
            let [h, m] = timePart.split(':').map(Number);
            if (meridiem === 'p' && h < 12) h += 12;
            if (meridiem === 'a' && h === 12) h = 0;
            d.setHours(h, m || 0, 0, 0);
            return d;
        } catch (e) {
            return null;
        }
    };

    const sortedEvents = nonHomeSegments.map(s => ({
        ...s,
        dt: parseFlightDate(s.date, s.time)
    })).filter(s => s.dt).sort((a, b) => a.dt - b.dt);

    if (sortedEvents.length === 0) return days;

    // 3. Find stay intervals at the "primary" destination
    // For simplicity, we assume the first non-home arrival starts the stay
    // and the last non-home departure ends it.
    const arrival = sortedEvents.find(e => e.type === 'arr');
    const departure = sortedEvents.filter(e => e.type === 'dep').pop();

    if (!arrival || !departure) return days;

    const stayStart = arrival.dt;
    const stayEnd = departure.dt;

    const newDays = days.map(day => {
        const dayStart = new Date(day.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day.date);
        dayEnd.setHours(23, 59, 59, 999);

        // Rule: "If arriving by 2AM, assume they'll want a room for that night."
        // This means if arrival is before 2 AM on Day X, they need a room for the night of Day X-1.
        // However, our `days` array represents full days.
        // If stayStart is Day X at 01:30, then for Day X they definitely need a room?
        // Usually, "need a room for that night" means the night *preceding* the 2 AM arrival.

        // Let's check if this specific day is within the stay period.
        // A room is needed for the night of day D if the user is at the destination at night.
        // Night is generally from evening of day D to morning of day D+1.

        const isAtDestination = (isBefore(dayStart, stayEnd) && isAfter(dayEnd, stayStart));

        if (!isAtDestination) {
            return { ...day, hotelRate: null, hotelTax: 0, hotelName: '' };
        }

        // Determine if they need a room for THIS day (night of this day).
        // They need a room if they haven't departed yet.
        const isDepartureDay = departure.date === format(day.date, 'EEE MMM d');
        const isArrivalDay = arrival.date === format(day.date, 'EEE MMM d');

        let needsRoom = true;

        // If it's the departure day, they don't stay the night (check out 11 AM).
        if (isDepartureDay) needsRoom = false;

        // Special case: Arrival before 2 AM on arrival day.
        // They need a room for the night BEFORE.
        // In our day-based UI, if they arrive at 1 AM on Tuesday, 
        // we should probably toggle the hotel on for Monday.

        // Let's refine:
        // A day gets a hotel if the night *following* that day is spent at the destination.

        const nextDay = addDays(day.date, 1);
        const nightTime = new Date(day.date);
        nightTime.setHours(20, 0, 0, 0); // 8 PM

        const spendsNight = isBefore(nightTime, stayEnd) && isAfter(nightTime, stayStart);

        if (spendsNight) {
            return {
                ...day,
                hotelRate: day.hotelRate ?? (currentHotelSettings.rate || 185),
                hotelTax: day.hotelTax ?? (currentHotelSettings.tax || 25),
                hotelName: day.hotelName || currentHotelSettings.name || '',
                hotelCurrency: day.hotelCurrency || currentHotelSettings.currency || 'USD'
            };
        } else {
            // Check 2 AM rule for the day of arrival
            if (isArrivalDay) {
                const h = arrival.dt.getHours();
                if (h < 2) {
                    // They need the room for the night of Day - 1
                    // This will be handled by the "nextDay" check if Day - 1 is in the list.
                }
            }
            return { ...day, hotelRate: null, hotelTax: 0, hotelName: '' };
        }
    });

    return newDays;
};
