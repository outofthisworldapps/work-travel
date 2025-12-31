import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Plane, Train, Car, Navigation,
  Hotel, Utensils, CreditCard, ChevronRight,
  Download, RefreshCcw, DollarSign, MapPin,
  Bus, Info, Calendar, Home, GripVertical, X,
  Link2, Link2Off, Hash, AlertTriangle, Lock, Globe, Briefcase,
  Undo2, Redo2, FolderOpen, Save, Cloud, LogIn, LogOut, User, Check, FileText
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import CloudTrips from './components/CloudTrips';
import { format, addDays, addMonths, differenceInDays, differenceInCalendarDays, parse, startOfMonth, isSameDay, isAfter, isBefore, setYear, setMonth, setDate } from 'date-fns';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { calculateMIE, formatCurrency, MI_RATE, MOCK_RATES, convertCurrency, MEAL_RATIOS_FOREIGN, MEAL_RATIOS_US, getMealCost } from './utils/calculations';

import { autoPopulateHotels } from './utils/hotelLogic';
import ContinuousTimeline from './components/ContinuousTimeline';
import MIEPanel from './components/MIEPanel';
import { getAirportTimezone, AIRPORT_TIMEZONES, getAirportCity } from './utils/airportTimezones';
import { getCityFromAirport } from './utils/perDiemLookup';

const APP_VERSION = "2025-12-31 08:57 EST";


const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper function to advance to next input on Enter key
const handleEnterKeyAdvance = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const form = e.target.form || e.target.closest('.f-segment, .f-group-header, .h-row-line, .t-row-1, .t-row-2');
    if (!form) return;

    const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled])'));
    const currentIndex = inputs.indexOf(e.target);

    if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
      inputs[currentIndex + 1].focus();
    }
  }
};


// Parse a date string to a local Date at noon (avoids timezone shifting issues)
const parseLocalDate = (dateInput) => {
  if (!dateInput) return null;
  const dateStr = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
  // If it's an ISO string, first parse it as a Date to correctly interpret UTC,
  // then extract LOCAL date components to create a noon local date
  if (dateStr.includes('T')) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      // Extract the LOCAL year, month, day from the parsed UTC date
      const y = parsed.getFullYear();
      const m = parsed.getMonth();
      const d = parsed.getDate();
      return new Date(y, m, d, 12, 0, 0);
    }
    // Fallback: if parsing fails, try extracting date part (less accurate)
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  // If it's just a date string like "2025-08-08"
  if (dateStr.includes('-') && !dateStr.includes('T')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(dateStr);
};

const CUSTOM_TIME_ZONES = [
  { name: "Hawaii (HST) - Honolulu", tz: "Pacific/Honolulu", abbr: "HST", baseOffset: -5 },
  { name: "Alaska (AKST/AKDT) - Anchorage", tz: "America/Anchorage", abbr: "AKT", baseOffset: -4 },
  { name: "US Pacific (PST/PDT) - LA, Seattle, Vancouver", tz: "America/Los_Angeles", abbr: "PT", baseOffset: -3 },
  { name: "US Mountain (MST/MDT) - Denver, Salt Lake, Edmonton", tz: "America/Denver", abbr: "MT", baseOffset: -2 },
  { name: "US Arizona (MST) - Phoenix (No DST)", tz: "America/Phoenix", abbr: "MST", baseOffset: -2 },
  { name: "US Central (CST/CDT) - Chicago, Dallas, Winnipeg", tz: "America/Chicago", abbr: "CT", baseOffset: -1 },
  { name: "US East (EST/EDT) - NY, DC, Atlanta, Toronto", tz: "America/New_York", abbr: "ET", baseOffset: 0 },
  { name: "Atlantic (AST/ADT) - Halifax, Puerto Rico", tz: "America/Halifax", abbr: "AT", baseOffset: 1 },
  { name: "UK/Iceland (GMT/BST) - London, Reykjavik", tz: "Europe/London", abbr: "GMT", baseOffset: 5 },
  { name: "Central Europe (CET/CEST) - Paris, Berlin, Rome", tz: "Europe/Paris", abbr: "CET", baseOffset: 6 },
  { name: "Eastern Europe (EET/EEST) - Athens, Cairo, Israel", tz: "Europe/Athens", abbr: "EET", baseOffset: 7 },
  { name: "Arabia/East Africa - Dubai, Moscow, Nairobi", tz: "Europe/Moscow", abbr: "MSK", baseOffset: 8 },
  { name: "India (IST) - Mumbai, New Delhi", tz: "Asia/Kolkata", abbr: "IST", baseOffset: 10.5 },
  { name: "China/Singapore (CST/SGT) - Beijing, HK, Perth", tz: "Asia/Shanghai", abbr: "CST", baseOffset: 13 },
  { name: "Japan/Korea (JST/KST) - Tokyo, Seoul", tz: "Asia/Tokyo", abbr: "JST", baseOffset: 14 },
  { name: "Australia East (AEST/AEDT) - Sydney, Melbourne", tz: "Australia/Sydney", abbr: "AEST", baseOffset: 16 },
  { name: "New Zealand (NZST/NZDT) - Auckland", tz: "Pacific/Auckland", abbr: "NZST", baseOffset: 17 },
];

const TimeZoneSelector = ({ value, onChange, homeValue = null }) => {
  const homeTZ = homeValue ? CUSTOM_TIME_ZONES.find(z => z.tz === homeValue) : null;
  const homeOffset = homeTZ ? homeTZ.baseOffset : 0;

  return (
    <select
      className="tz-select"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {CUSTOM_TIME_ZONES.map(item => {
        let label = item.name;
        if (homeValue) {
          const diff = item.baseOffset - homeOffset;
          const sign = diff >= 0 ? '+' : '–';
          const absDiff = Math.abs(diff);
          label = `${sign}${absDiff}: ${item.name}`;
        }
        return (
          <option key={item.tz} value={item.tz}>
            {label}
          </option>
        );
      })}


    </select>
  );
};




const getTZOffset = (date, tz1, tz2) => {
  if (!tz1 || !tz2 || tz1 === tz2) return 0;
  try {
    const options = { hour: 'numeric', hour12: false, minute: 'numeric', second: 'numeric', year: 'numeric', month: 'numeric', day: 'numeric' };
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

const getPortTZ = (port, homeCity, destCity, homeTZ, destTZ, preferredTZ) => {
  if (!port) return preferredTZ || destTZ;
  const p = port.toUpperCase().trim();

  // First, try to get timezone from airport database
  const airportTZ = getAirportTimezone(p);
  if (airportTZ) return airportTZ;

  // Fallback to city matching for non-airport codes
  const hc = (homeCity || '').toUpperCase();
  const dc = (destCity || '').toUpperCase();
  if (hc.includes(p) || (p.length === 3 && hc.includes(p))) return homeTZ;
  if (dc.includes(p) || (p.length === 3 && dc.includes(p))) return destTZ;
  return preferredTZ || homeTZ;
};



// --- Utility Functions ---


const parseSegDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    let d = null;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      // Handle M/d/yy or M/d/yyyy
      let y = parseInt(parts[2]);
      if (y < 100) y += 2000;
      d = new Date(y, parseInt(parts[0]) - 1, parseInt(parts[1]), 12, 0, 0);
    } else {
      const formats = ['EEE MMM d yyyy', 'EEE MMM d', 'MMM d yyyy', 'MMM d'];
      for (const f of formats) {
        d = parse(dateStr, f, new Date(2026, 0, 1));
        if (!isNaN(d.getTime())) break;
      }
      if (!d || isNaN(d.getTime())) d = new Date(dateStr);
    }
    return (!d || isNaN(d.getTime())) ? null : format(d, 'yyyy-MM-dd');
  } catch (e) { return null; }
};

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
    return h + (m || 0) / 60;
  } catch (e) { return null; }
};

const formatTime = (timeNum) => {
  let h = Math.floor(timeNum);
  let m = Math.round((timeNum - h) * 60);
  h = (h + 24) % 24;
  let meridiem = h < 12 ? 'a' : 'p';
  let displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')}${meridiem}`;
};

const safeFormat = (date, fmt) => {
  if (!date || isNaN(date.getTime())) return '';
  return format(date, fmt);
};

const getPosition = (time) => {
  if (time === null || isNaN(time)) return 0;
  return (time / 24) * 100;
};

const getDualTime = (homeTime, date, homeTZ, destTZ, relevance, localTZ) => {
  if (homeTime === null || isNaN(homeTime)) return null;

  const dateStr = format(date, 'yyyy-MM-dd');

  const formatTimeNum = (num) => {
    let h = Math.floor(num);
    let m = Math.round((num % 1) * 60);
    while (h < 0) { h += 24; }
    while (h >= 24) { h -= 24; }
    const meridiem = h < 12 ? 'a' : 'p';
    const dispH = h % 12 || 12;
    return `${dispH}:${m.toString().padStart(2, '0')}${meridiem}`;
  };

  // homeTime is the time normalized to Home Time Zone
  const homeLabel = formatTimeNum(homeTime);

  // Calculate dest time from home time
  const homeToDestOffset = getTZOffset(new Date(dateStr + 'T12:00:00'), homeTZ, destTZ);
  const destTimeNum = homeTime - homeToDestOffset;
  const destLabel = formatTimeNum(destTimeNum);

  // If we have a local airport timezone, calculate which column it matches
  let localMatchesHome = false;
  let localMatchesDest = false;
  if (localTZ) {
    localMatchesHome = localTZ === homeTZ;
    localMatchesDest = localTZ === destTZ;
  }

  const dHome = new Date(dateStr + 'T00:00:00');
  const homeDateStr = format(dHome, 'MMM d');

  // Dest date shift
  let destShift = 0;
  if (destTimeNum < 0) destShift = -1;
  else if (destTimeNum >= 24) destShift = 1;
  const dDest = new Date(dHome.getTime() + destShift * 86400000);
  const destDateStr = format(dDest, 'MMM d');

  return {
    homeTime: homeLabel,
    destTime: destLabel,
    homeDate: homeDateStr,
    destDate: destDateStr,
    relevance,
    localMatchesHome,
    localMatchesDest,
    localTZ
  };
};




const DualTimeMarker = ({ timeNum, date, homeTZ, destTZ, relevance, isDifferentTZ, side, className, style, inline, localTZ }) => {
  const dt = getDualTime(timeNum, date, homeTZ, destTZ, relevance, localTZ);
  if (!dt) return null;

  const isHome = side === 'left';
  // Use destination side only if different TZ
  if (!isHome && !isDifferentTZ) return null;

  const label = isHome ? dt.homeTime : dt.destTime;

  // Bold if this column's timezone matches the local airport timezone
  // Or fall back to relevance-based bolding
  let isBold;
  if (localTZ) {
    isBold = isHome ? dt.localMatchesHome : dt.localMatchesDest;
  } else {
    isBold = isHome ? (dt.relevance === 'home') : (dt.relevance === 'dest');
  }

  const colorClass = isHome ? 'home' : 'dest';

  if (inline) {
    return (
      <span className={`time-item ${colorClass} ${isBold ? 'bold' : 'faint'}`} style={style}>
        {label}
      </span>
    );
  }

  return (
    <div className={`tl-marker-dual ${side} ${className || ''}`} style={style}>
      <div className={`time-item ${colorClass} ${isBold ? 'bold' : 'faint'}`}>
        {label}
      </div>
    </div>
  );
};






const getMidnights = (date, homeTZ, destTZ) => {
  const midnights = [];
  const homeStart = new Date(date);
  homeStart.setHours(0, 0, 0, 0);

  // Home midnight always at 0
  midnights.push({
    time: 0,
    tz: 'home',
    label: format(homeStart, 'EEE MMM d').toUpperCase()
  });

  if (homeTZ !== destTZ) {
    for (let h = 0; h < 24; h++) {
      const d1 = new Date(homeStart.getTime() + h * 3600000);
      const d2 = new Date(homeStart.getTime() + (h + 1) * 3600000);
      const s1 = d1.toLocaleDateString('en-US', { timeZone: destTZ });
      const s2 = d2.toLocaleDateString('en-US', { timeZone: destTZ });
      if (s1 !== s2) {
        for (let m = 0; m < 60; m++) {
          const m1 = new Date(d1.getTime() + m * 60000);
          const m2 = new Date(d1.getTime() + (m + 1) * 60000);
          if (m1.toLocaleDateString('en-US', { timeZone: destTZ }) !== m2.toLocaleDateString('en-US', { timeZone: destTZ })) {
            midnights.push({
              time: h + (m + 1) / 60,
              tz: 'dest',
              label: (new Date(m2).toLocaleDateString('en-US', { timeZone: destTZ, weekday: 'short' }) + ' ' + new Date(m2).toLocaleDateString('en-US', { timeZone: destTZ, month: 'short', day: 'numeric' })).toUpperCase()
            });
            break;
          }
        }
      }
    }
  }
  return midnights;
};


const TimelineHeader = ({ isDifferentTZ }) => (
  <div className={`timeline-header-icons ${isDifferentTZ ? 'dual-tz' : ''}`}>
    <div className="side-col left-combined"><Home size={14} /></div>
    <div className="center-spacer"></div>
    {isDifferentTZ && (
      <div className="side-col right-combined"><Briefcase size={14} /></div>
    )}
  </div>
);



const TimelineDay = ({ day, dayIndex, totalDays, flights, currentRates, onUpdateMeals, onAddLeg, hotels, onEditEvent, showMIE, homeTimeZone, destTimeZone, homeCity, destCity }) => {


  const hours = Array.from({ length: 24 }, (_, i) => i);
  const isDifferentTZ = homeTimeZone !== destTimeZone;

  // Calculate M&IE components
  const mieTotal = calculateMIE(dayIndex, totalDays, day.mieBase, day.meals, day.isForeignMie);

  // Get individual meal costs
  const isFirstOrLast = totalDays > 1 && (dayIndex === 0 || dayIndex === totalDays - 1);
  const getMealPrice = (meal) => {
    const dayFactor = isFirstOrLast ? 0.75 : 1.0;
    return getMealCost(day.mieBase, meal, day.isForeignMie) * dayFactor;
  };

  const dayStr = format(day.date, 'yyyy-MM-dd');

  const dayFlights = [];
  flights.forEach(f => {
    ['outbound', 'returnSegments'].forEach(type => {
      const segs = f[type] || [];
      const isOutbound = type === 'outbound';

      segs.forEach(s => {
        // depTZ: for outbound, usually home; for return, usually dest
        const depTZ = getPortTZ(s.depPort, homeCity, destCity, homeTimeZone, destTimeZone, isOutbound ? homeTimeZone : destTimeZone);
        // arrTZ: for outbound, usually dest; for return, usually home
        const arrTZ = getPortTZ(s.arrPort, homeCity, destCity, homeTimeZone, destTimeZone, isOutbound ? destTimeZone : homeTimeZone);

        const normDepShift = getTZOffset(new Date(day.date), depTZ, homeTimeZone);
        const normArrShift = getTZOffset(new Date(day.date), arrTZ, homeTimeZone);

        console.log('DEBUG TZ:', {
          port: s.arrPort,
          time: s.arrTime,
          arrTZ,
          homeTZ: homeTimeZone,
          shift: normArrShift,
          calcH: parseTime(s.arrTime) - normArrShift
        });

        const depH = parseTime(s.depTime) - normDepShift;
        const arrH = parseTime(s.arrTime) - normArrShift;

        const depDateStr = parseSegDate(s.depDate);
        const arrDateStr = parseSegDate(s.arrDate);

        if (!depDateStr || !arrDateStr) return;

        const d1 = new Date(depDateStr + 'T00:00:00');
        const d2 = new Date(arrDateStr + 'T00:00:00');

        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return;

        const homeDepDate = format(new Date(d1.getTime() + (depH < 0 ? -1 : (depH >= 24 ? 1 : 0)) * 86400000), 'yyyy-MM-dd');
        const homeArrDate = format(new Date(d2.getTime() + (arrH < 0 ? -1 : (arrH >= 24 ? 1 : 0)) * 86400000), 'yyyy-MM-dd');

        const finalDepH = (depH + 24) % 24;
        const finalArrH = (arrH + 24) % 24;

        if (homeDepDate === dayStr || homeArrDate === dayStr || (homeDepDate < dayStr && homeArrDate > dayStr)) {
          dayFlights.push({
            ...s,
            parentFlight: f,
            segmentType: type,
            homeDepDate,
            homeArrDate,
            finalDepH,
            finalArrH,
            // Store the actual timezone for each port for local time display
            depTZ,
            arrTZ,
            // Store original local times for display
            localDepTime: s.depTime,
            localArrTime: s.arrTime
          });
        }
      });
    });
  });

  const getEmoji = (loc, isAway = false) => {
    if (loc === 'Home') return '🏡';
    if (loc === 'Hotel') return '🏨';
    if (loc === 'Briefcase' || loc === 'Work' || loc === 'Office' || loc === 'Meeting' || loc === 'Conference') return '💼';
    if (isAway && loc !== 'Home') return '💼'; // Treat all away-side travel points (except Home) as work/briefcase
    return '✈️';
  };



  // Dedup markers logic
  const renderedMarkerPositions = [];
  const isPositionTaken = (pos) => {
    const threshold = 5;
    const taken = renderedMarkerPositions.some(p => Math.abs(p - pos) < threshold);
    if (!taken) renderedMarkerPositions.push(pos);
    return taken;
  };

  // Helper to get relevance for an event based on airport timezone
  const getEventRelevance = (type, data) => {
    // For flights, use the actual airport timezone to determine relevance
    if (type === 'flight-dep' && data.depTZ) {
      // If departure airport is in home timezone, show as home relevance
      return data.depTZ === homeTimeZone ? 'home' : 'dest';
    }
    if (type === 'flight-arr' && data.arrTZ) {
      // If arrival airport is in home timezone, show as home relevance
      return data.arrTZ === homeTimeZone ? 'home' : 'dest';
    }
    // Fallback to segment type logic
    const isOutbound = data.segmentType === 'outbound';
    if (type === 'flight-dep') return isOutbound ? 'home' : 'dest';
    if (type === 'flight-arr') return isOutbound ? 'dest' : 'home';
    if (type === 'hotel') return 'dest';
    if (type === 'leg') {
      if (data.from === 'Home' || data.to === 'Home') return 'home';
      return 'dest';
    }
    return 'dest';
  };

  const midnights = getMidnights(day.date, homeTimeZone, destTimeZone);

  return (
    <div className={`timeline-day-row ${showMIE ? 'with-mie' : ''} ${isDifferentTZ ? 'dual-tz' : ''}`}>
      {/* Left Column: Home dates and times merged */}
      <div className="timeline-col left-combined">
        {midnights.filter(m => m.tz === 'home').map((m, i) => (
          <div key={i} className="midnight-label-single home" style={{ top: `${getPosition(m.time)}%`, position: 'absolute' }}>
            {m.label}
          </div>
        ))}
      </div>


      <div className="timeline-hours-container">
        {midnights.map((m, i) => (
          <div
            key={`line-${i}`}
            className={`midnight-line ${m.tz}`}
            style={{ top: `${getPosition(m.time)}%` }}
          />
        ))}
        {hours.map(h => (
          <div key={h} className="hour-line" style={{ top: `${(h / 24) * 100}%` }} />
        ))}

        {/* Flight Boxes */}
        {dayFlights.map(s => {
          const isOvernight = s.homeDepDate !== s.homeArrDate;
          const isDeparturePart = s.homeDepDate === dayStr;
          const isArrivalPart = s.homeArrDate === dayStr;
          const isMiddlePart = s.homeDepDate < dayStr && s.homeArrDate > dayStr;

          const startPos = isDeparturePart ? s.finalDepH : 0;
          const endPos = isArrivalPart ? s.finalArrH : 24;


          return (
            <React.Fragment key={s.id + (isArrivalPart && !isDeparturePart ? '-arr' : '')}>
              {startPos > 0 && startPos < 24 && !isPositionTaken(getPosition(startPos)) && (
                <>
                  <DualTimeMarker
                    timeNum={startPos}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('flight-dep', s)}
                    isDifferentTZ={isDifferentTZ}
                    side="left"
                    localTZ={s.depTZ}
                    style={{ top: `${getPosition(startPos)}%`, zIndex: 12, left: '-60px' }}
                  />
                  <DualTimeMarker
                    timeNum={startPos}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('flight-dep', s)}
                    isDifferentTZ={isDifferentTZ}
                    side="right"
                    localTZ={s.depTZ}
                    style={{ top: `${getPosition(startPos)}%`, zIndex: 12, right: '-60px' }}
                  />
                </>
              )}
              {endPos > 0 && endPos < 24 && !isPositionTaken(getPosition(endPos)) && (
                <>
                  <DualTimeMarker
                    timeNum={endPos}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('flight-arr', s)}
                    isDifferentTZ={isDifferentTZ}
                    side="left"
                    className="arr"
                    localTZ={s.arrTZ}
                    style={{ top: `${getPosition(endPos)}%`, zIndex: 12, left: '-60px' }}
                  />
                  <DualTimeMarker
                    timeNum={endPos}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('flight-arr', s)}
                    isDifferentTZ={isDifferentTZ}
                    side="right"
                    className="arr"
                    localTZ={s.arrTZ}
                    style={{ top: `${getPosition(endPos)}%`, zIndex: 12, right: '-60px' }}
                  />
                </>
              )}





              <div
                className="tl-event flight-event clickable"
                onClick={() => onEditEvent({ type: 'flight', id: s.parentFlight.id, segmentId: s.id })}
                style={{
                  top: `${getPosition(startPos)}%`,
                  height: `${getPosition(endPos) - getPosition(startPos)}%`,
                  zIndex: 10,
                  borderRadius: isOvernight ? (isDeparturePart ? '8px 8px 0 0' : '0 0 8px 8px') : '8px',
                  borderBottom: (isOvernight && isDeparturePart) ? 'none' : undefined,
                  borderTop: (isOvernight && isArrivalPart) ? 'none' : undefined,
                  padding: 0
                }}
              >
                {(!isOvernight || isDeparturePart) && (
                  <div className="tl-f-main-wrap" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative', height: '100%' }}>
                    {/* Restructured content: Two rows for flight details */}
                    <div className="tl-f-content-stack" style={{
                      display: 'flex', flexDirection: 'column', gap: '1px',
                      width: '100%', padding: '0 10px', justifyContent: 'center'
                    }}>
                      {/* Row 1: departure time // airport // plane icon // airline */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, color: '#fff',
                          minWidth: '42px', textAlign: 'right', opacity: 0.95
                        }}>{s.localDepTime || ''}</span>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 950, lineHeight: 1, color: '#fff'
                        }}>{s.depPort}</span>
                        <span style={{ fontSize: '0.65rem' }}>✈️</span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap'
                        }}>{s.airlineCode}</span>
                      </div>
                      {/* Row 2: arrival time // airport // small space // flight number */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, color: '#fff',
                          minWidth: '42px', textAlign: 'right', opacity: 0.95
                        }}>{s.localArrTime || ''}</span>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 950, lineHeight: 1, color: '#fff'
                        }}>{s.arrPort}</span>
                        <span style={{ minWidth: '12px' }}></span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap'
                        }}>{s.flightNumber}</span>
                        {s.seat && <span style={{ fontSize: '0.55rem', opacity: 0.7, color: '#fff', marginLeft: 'auto', marginRight: '30px' }}>Seat: {s.seat}</span>}
                      </div>
                    </div>
                    <div className="tl-f-rec" style={{ position: 'absolute', right: '10px', opacity: 0.6, fontSize: '0.6rem', fontWeight: 950 }}>{s.parentFlight.confirmation || ''}</div>
                  </div>
                )}


              </div>
            </React.Fragment>
          );
        })}

        {/* Hotel Boxes from Bookings */}
        {hotels.map(h => {
          if (!h.checkIn || !h.checkOut || isNaN(h.checkIn.getTime()) || isNaN(h.checkOut.getTime())) return null;
          if (!day.date || isNaN(day.date.getTime())) return null;

          const checkInDate = safeFormat(h.checkIn, 'yyyy-MM-dd');
          const checkOutDate = safeFormat(h.checkOut, 'yyyy-MM-dd');
          const currDate = safeFormat(day.date, 'yyyy-MM-dd');

          const isCheckInDay = checkInDate === currDate;
          const isCheckOutDay = checkOutDate === currDate;
          const isMidStay = currDate > checkInDate && currDate < checkOutDate;

          if (!isCheckInDay && !isCheckOutDay && !isMidStay) return null;

          const hotelTZ = destTimeZone; // Hotels are ALWAYS at destination
          const shift = getTZOffset(day.date, hotelTZ, homeTimeZone);
          const startNum = (parseTime(h.checkInTime) || 14) - shift;
          const endNum = (parseTime(h.checkOutTime) || 11) - shift;

          // Normalized start/end
          const normStart = (startNum + 24) % 24;
          const normEnd = (endNum + 24) % 24;


          return (
            <React.Fragment key={h.id}>
              {isCheckInDay && !isPositionTaken(getPosition(normStart)) && (
                <>
                  <DualTimeMarker
                    timeNum={normStart}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('hotel', h)}
                    isDifferentTZ={isDifferentTZ}
                    side="left"
                    style={{ top: `${getPosition(normStart)}%`, left: '-60px' }}
                  />
                  <DualTimeMarker
                    timeNum={normStart}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('hotel', h)}
                    isDifferentTZ={isDifferentTZ}
                    side="right"
                    style={{ top: `${getPosition(normStart)}%`, right: '-60px' }}
                  />
                </>
              )}
              {isCheckOutDay && !isPositionTaken(getPosition(normEnd)) && (
                <>
                  <DualTimeMarker
                    timeNum={normEnd}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('hotel', h)}
                    isDifferentTZ={isDifferentTZ}
                    side="left"
                    className="arr"
                    style={{ top: `${getPosition(normEnd)}%`, left: '-60px' }}
                  />
                  <DualTimeMarker
                    timeNum={normEnd}
                    date={day.date}
                    homeTZ={homeTimeZone}
                    destTZ={destTimeZone}
                    relevance={getEventRelevance('hotel', h)}
                    isDifferentTZ={isDifferentTZ}
                    side="right"
                    className="arr"
                    style={{ top: `${getPosition(normEnd)}%`, right: '-60px' }}
                  />
                </>
              )}




              <div
                className="tl-event hotel-event clickable"
                onClick={() => onEditEvent({ type: 'hotel', id: h.id })}
                style={{
                  top: `${getPosition(isCheckInDay ? normStart : 0)}%`,
                  height: `${getPosition(isCheckOutDay ? normEnd : 24) - getPosition(isCheckInDay ? normStart : 0)}%`,
                  width: '50%',
                  left: '50%',
                  borderLeft: '4px solid rgba(16, 185, 129, 0.7)',
                  borderRadius: `${isCheckInDay ? '8px' : '0'} ${isCheckInDay ? '8px' : '0'} ${isCheckOutDay ? '8px' : '0'} ${isCheckOutDay ? '8px' : '0'}`,
                  borderTop: (isMidStay || (isCheckOutDay && !isCheckInDay)) ? 'none' : '1px solid rgba(16, 185, 129, 0.6)',
                  borderBottom: (isMidStay || (isCheckInDay && !isCheckOutDay)) ? 'none' : '1px solid rgba(16, 185, 129, 0.6)',
                  borderRight: '1px solid rgba(16, 185, 129, 0.6)',
                  zIndex: 2,
                  background: 'linear-gradient(to right, rgba(16, 185, 129, 0.4), rgba(16, 185, 129, 0.3) 20%, rgba(16, 185, 129, 0.25) 50%, rgba(16, 185, 129, 0.3) 80%, rgba(16, 185, 129, 0.4))'
                }}
              >
                {(isCheckInDay || (dayIndex === 0 && isMidStay)) && (
                  <div className="tl-hotel-name" style={{ top: isCheckInDay ? '40px' : '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', lineHeight: '1.2' }}>🏨</div>
                    <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600, marginTop: '4px' }}>
                      {h.name || 'Hotel'}
                    </div>
                  </div>
                )}


              </div>

            </React.Fragment>
          );
        })}

        {/* Travel Legs (Uber, etc.) - DEPRECATED: using transportation[] instead */}
        {(day.legs || []).map(l => {
          if (l.type === 'flight') return null;
          const relevance = getEventRelevance('leg', l);
          const legTZ = relevance === 'home' ? homeTimeZone : destTimeZone;
          const shift = getTZOffset(day.date, legTZ, homeTimeZone);
          const start = (parseTime(l.time) || 0) - shift;
          const end = (parseTime(l.time) + (l.duration || 0) / 60) - shift;

          const normStart = (start + 24) % 24;
          const normEnd = (end + 24) % 24;

          return (
            <React.Fragment key={l.id}>
              <div className="tl-abs-wrap" style={{
                top: `${getPosition(normStart)}%`,
                height: `${getPosition(normEnd) - getPosition(normStart)}%`,
                position: 'absolute', left: 0, right: 0
              }}>
                <div
                  className={`tl-event travel-event clickable ${l.type} ${relevance === 'home' ? 'home-side' : 'away-side'}`}
                  onClick={() => onEditEvent({ type: 'leg', dayIndex, legId: l.id })}
                  style={{ top: 0, height: '100%' }}
                >
                  <div className={`tl-travel-meta ${relevance === 'home' ? 'home-side' : 'away-side'}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <div className="loc-icon-meta" style={{ opacity: 0.8 }}>
                        {getEmoji(l.from, relevance === 'dest')}
                      </div>
                      <div className="inline-leg" style={{ display: 'flex', gap: '2px' }}>
                        <DualTimeMarker
                          timeNum={normStart}
                          date={day.date}
                          homeTZ={homeTimeZone}
                          destTZ={destTimeZone}
                          relevance={relevance}
                          isDifferentTZ={isDifferentTZ}
                          side={relevance === 'home' ? 'left' : 'right'}
                          className="inline"
                          inline={true}
                          style={{ fontSize: '0.6rem', fontWeight: 950, color: relevance === 'dest' ? '#f59e0b' : undefined }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <div className="loc-icon-meta" style={{ opacity: 0.8 }}>
                        {getEmoji(l.to, relevance === 'dest')}
                      </div>
                      <div className="inline-leg" style={{ display: 'flex', gap: '2px' }}>
                        <DualTimeMarker
                          timeNum={normEnd}
                          date={day.date}
                          homeTZ={homeTimeZone}
                          destTZ={destTimeZone}
                          relevance={relevance}
                          isDifferentTZ={isDifferentTZ}
                          side={relevance === 'home' ? 'left' : 'right'}
                          className="inline"
                          inline={true}
                          style={{ fontSize: '0.6rem', fontWeight: 950, color: relevance === 'dest' ? '#f59e0b' : undefined }}
                        />
                      </div>
                    </div>
                  </div>


                  <div className="tl-event-label travel-vertical-label">
                  </div>
                  <div className="car-icon-meta" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}>
                    {l.type === 'uber' ? '🚘' : (l.type === 'drive' ? '🚗' : '📍')}
                  </div>
                </div>

              </div>
            </React.Fragment>
          );
        })}

      </div>

      {isDifferentTZ && (
        <>
          {/* Right Column: Away times and dates merged */}
          <div className="timeline-col right-combined">
            {midnights.filter(m => m.tz === 'dest').map((m, i) => (
              <div key={i} className="midnight-label-single dest" style={{ top: `${getPosition(m.time)}%`, position: 'absolute' }}>
                {m.label}
              </div>
            ))}
          </div>
        </>
      )}



      {
        showMIE && (
          <div className="timeline-mie-side">
            <div className="tl-mie-header">
              <div className="tl-mie-total">{formatCurrency(mieTotal, 'USD')}</div>
              {isFirstOrLast && <span className="tl-mie-75">75%</span>}
            </div>
            <div className="tl-mie-stack">
              {['B', 'L', 'D', 'I'].map(m => (
                <div
                  key={m}
                  className={`tl-meal-chip ${day.meals[m] !== false ? 'active' : ''}`}
                  onClick={() => onUpdateMeals(day.id, m)}
                >
                  <span className="tl-m-label">{m}</span>
                  <span className="tl-m-price">${getMealPrice(m).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      }
    </div >
  );
};

// --- Components ---

const SortableTravelLeg = ({ leg, onUpdate, onDelete, onLinkToggle, isLockedStart, isLockedEnd, currentRates, flights }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: leg.id,
    disabled: isLockedStart || isLockedEnd
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 100 : 1,
  };

  const calculatedUSD = useMemo(() => {
    if (leg.type === 'flight') return null; // Flights are handled separately
    if (leg.currency === 'USD') return null;
    const rate = leg.type === 'drive' ? MI_RATE : 1;
    return convertCurrency(leg.amount * rate, leg.currency, 'USD', currentRates);
  }, [leg.amount, leg.currency, leg.type, currentRates]);

  const flightOptions = useMemo(() => {
    if (!flights) return [];
    return flights.map(f => {
      const allSegs = [...(f.outbound || []), ...(f.returnSegments || [])];
      const first = allSegs[0];
      const last = allSegs[allSegs.length - 1];
      const label = `${first?.depPort || '?'} – ${last?.arrPort || '?'} (${f.airline || 'Flight'})`;
      return { id: f.id, label, flight: f };
    });
  }, [flights]);

  const handleFlightSelect = (flightId) => {
    const f = flights.find(fl => fl.id === flightId);
    if (!f) return;
    const allSegs = [...(f.outbound || []), ...(f.returnSegments || [])];
    const first = allSegs[0];
    const last = allSegs[allSegs.length - 1];
    onUpdate('from', first?.depPort || '');
    onUpdate('to', last?.arrPort || '');
    onUpdate('amount', f.cost || 0);
    if (allSegs.length > 1) {
      onUpdate('layover', allSegs.slice(0, -1).map(s => s.arrPort).join(', '));
    } else {
      onUpdate('layover', '');
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="travel-leg-item">
      <div className="leg-content">
        <div className={`drag-handle ${isLockedStart || isLockedEnd ? 'locked' : ''}`} {...(isLockedStart || isLockedEnd ? {} : { ...attributes, ...listeners })}>
          {isLockedStart || isLockedEnd ? <Lock size={12} /> : <GripVertical size={12} />}
        </div>

        <div className="place-item compact">
          {isLockedStart ? <span className="locked-icon">🏠</span> : (leg.from.toLowerCase().includes('hotel') ? <span className="locked-icon">🏨</span> : null)}
          <input
            className="leg-input-text-compact"
            value={leg.from}
            onChange={(e) => onUpdate('from', e.target.value)}
            disabled={isLockedStart}
            placeholder="Origin"
            list={leg.type === 'flight' ? `fl-opts-${leg.id}` : undefined}
          />
        </div>

        <div className="mode-box-compact themed-select-wrap">
          <select
            className="leg-type-select-compact themed-select"
            value={leg.type}
            onChange={(e) => onUpdate('type', e.target.value)}
          >
            <option value="flight">✈️ Flight</option>
            <option value="uber">🚕 Uber</option>
            <option value="train">🚂 Train</option>
            <option value="bus">🚌 Bus</option>
            <option value="drive">🚗 Drive</option>
            <option value="walk">🚶 Walk</option>
          </select>
        </div>

        <div className="place-item compact">
          <input
            className="leg-input-text-compact"
            value={leg.to}
            onChange={(e) => onUpdate('to', e.target.value)}
            disabled={isLockedEnd}
            placeholder="Destination"
          />
          {isLockedEnd ? <span className="locked-icon">🏠</span> : (leg.to.toLowerCase().includes('hotel') ? <span className="locked-icon">🏨</span> : null)}
        </div>

        <input
          className="f-inp s-time h-time-col"
          value={leg.time || ''}
          onChange={e => onUpdate('time', e.target.value)}
          placeholder="Time"
        />

        {leg.type === 'flight' && leg.layover && (
          <div className="leg-layover-faint">via {leg.layover}</div>
        )}

        <div className="leg-money-compact">
          <button
            className={`currency-toggle-mini ${leg.isForeign ? 'active' : ''}`}
            onClick={() => onUpdate('isForeign', !leg.isForeign)}
            title="Toggle Foreign/Domestic"
          >
            {leg.isForeign ? <Globe size={11} /> : <span className="unit-mini">$</span>}
          </button>
          <input
            type="number"
            className="leg-amount-input-compact"
            value={leg.amount}
            onChange={(e) => onUpdate('amount', parseFloat(e.target.value) || 0)}
            disabled={leg.type === 'flight'}
          />
        </div>

        {calculatedUSD !== null && (
          <div className="leg-calc-val">
            =${formatCurrency(calculatedUSD, 'USD').replace('$', '')}
          </div>
        )}

        <div className="leg-actions-compact">
          <button
            className={`link-btn-compact ${leg.mirrorId ? 'active' : ''}`}
            onClick={onLinkToggle}
            title="Toggle Mirror Symmetry"
          >
            {leg.mirrorId ? <Link2 size={11} /> : <Link2Off size={11} />}
          </button>
          <button
            className="delete-leg-btn-compact"
            onClick={onDelete}
            disabled={isLockedStart || isLockedEnd}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {leg.type === 'flight' && (
        <datalist id={`fl-opts-${leg.id}`}>
          {flightOptions.map(opt => (
            <option key={opt.id} value={opt.label} onClick={() => handleFlightSelect(opt.id)} />
          ))}
        </datalist>
      )}
    </div>
  );
};


// --- Components ---

// Updated FlightSegmentRow component
// Simplified FlightSegmentRow with dropdown date selector
// Simplified FlightSegmentRow with dropdown date selector
const FlightSegmentRow = ({ segment, onUpdate, onDelete, isLast, layover, tripDates, homeCity, destCity, homeTimeZone, destTimeZone }) => {
  const parseFrag = (dateStr) => {
    if (!dateStr) return null;
    try {
      if (dateStr.includes('-')) {
        const d = parse(dateStr, 'yyyy-MM-dd', new Date());
        return isNaN(d.getTime()) ? null : d;
      }
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        let y = parseInt(parts[2]);
        if (y < 100) y += 2000;
        return new Date(y, parseInt(parts[0]) - 1, parseInt(parts[1]), 12, 0, 0);
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime()) && (d.getFullYear() < 2024 || d.getFullYear() > 2099)) {
        d.setFullYear(new Date().getFullYear());
      }
      return (!d || isNaN(d.getTime())) ? null : d;
    } catch (e) { return null; }
  };

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    try {
      let t = timeStr.toLowerCase().replace(' ', '');
      let meridiem = t.slice(-1);
      let timePart = t.endsWith('a') || t.endsWith('p') ? t.slice(0, -1) : t;
      let parts = timePart.split(':');
      let h = parseInt(parts[0]);
      let m = parseInt(parts[1]) || 0;
      if (isNaN(h)) return null;
      if (meridiem === 'p' && h < 12) h += 12;
      if (meridiem === 'a' && h === 12) h = 0;
      return h * 60 + m;
    } catch (e) {
      return null;
    }
  };

  const depDate = parseFrag(segment.depDate);
  const arrDate = parseFrag(segment.arrDate);

  // Helper to recalculate arrival date based on dep date and times
  const recalculateArrivalDate = (depDateStr, depTimeStr, arrTimeStr, depPort, arrPort) => {
    const date = parseFrag(depDateStr);
    const depMins = parseTimeToMinutes(depTimeStr);
    const arrMins = parseTimeToMinutes(arrTimeStr);

    if (depMins !== null && arrMins !== null && date) {
      const depTZ = getPortTZ(depPort, homeCity, destCity, homeTimeZone, destTimeZone);
      const arrTZ = getPortTZ(arrPort, homeCity, destCity, homeTimeZone, destTimeZone);

      // Offset shift in minutes (arrTZ vs depTZ)
      const shiftHours = getTZOffset(date, arrTZ, depTZ);
      const shiftMins = shiftHours * 60;

      // Effective arrival time in the same TZ as departure to check for midnight crossing
      const effectiveArrMins = arrMins - shiftMins;

      const daysToAdd = effectiveArrMins < depMins ? 1 : 0;
      const newArrDate = addDays(date, daysToAdd);
      return safeFormat(newArrDate, 'yyyy-MM-dd');
    }
    return null;
  };

  const handleDepDateChange = (dateStr) => {
    if (dateStr) {
      const newArrDate = recalculateArrivalDate(dateStr, segment.depTime, segment.arrTime, segment.depPort, segment.arrPort);
      const updates = { depDate: dateStr };
      if (newArrDate) {
        updates.arrDate = newArrDate;
      } else {
        updates.arrDate = dateStr;
      }
      onUpdate(updates);
    }
  };

  // Handler for departure time changes - recalculate arrival date
  const handleDepTimeChange = (timeStr) => {
    const updates = { depTime: timeStr };
    if (segment.depDate && segment.arrTime) {
      const newArrDate = recalculateArrivalDate(segment.depDate, timeStr, segment.arrTime, segment.depPort, segment.arrPort);
      if (newArrDate) {
        updates.arrDate = newArrDate;
      }
    }
    onUpdate(updates);
  };

  // Handler for arrival time changes - recalculate arrival date
  const handleArrTimeChange = (timeStr) => {
    const updates = { arrTime: timeStr };
    if (segment.depDate && segment.depTime) {
      const newArrDate = recalculateArrivalDate(segment.depDate, segment.depTime, timeStr, segment.depPort, segment.arrPort);
      if (newArrDate) {
        updates.arrDate = newArrDate;
      }
    }
    onUpdate(updates);
  };

  // REMOVED: Auto-update effect that was causing the date flipping bug
  // The auto-calculation now only happens when user explicitly changes dep date or times

  return (
    <div className="f-segment">
      {/* Row 1: Airline // Flight Number //  Seat // Trash */}
      <div className="f-row-1" style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
        <input
          className="f-inp"
          value={segment.airlineCode || ''}
          onChange={e => onUpdate('airlineCode', e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="Airline"
          style={{ flex: '0 0 36px' }}
        />
        <input
          className="f-inp s-full-num"
          value={segment.flightNumber || ''}
          onChange={e => onUpdate('flightNumber', e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="Flight #"
          style={{ flex: '1 1 80px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="seat-label" style={{ fontSize: '0.65rem', color: '#64748b' }}>SEAT:</span>
          <input
            className="f-inp s-seat"
            value={segment.seat || ''}
            onChange={e => onUpdate('seat', e.target.value)}
            onKeyDown={handleEnterKeyAdvance}
            placeholder=""
            style={{ width: '50px' }}
          />
        </div>
        <button className="f-seg-del" onClick={onDelete}><Trash2 size={12} /></button>
      </div>

      {/* Row 2: Departure Date // Time // Airport // Terminal */}
      <div className="f-row-2" style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '2px' }}>
        <select
          className="f-inp f-date-select monospace-font"
          value={depDate && !isNaN(depDate.getTime()) ? format(depDate, 'yyyy-MM-dd') : ''}
          onChange={e => handleDepDateChange(e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          style={{ fontFamily: 'monospace', fontSize: '0.65rem', flex: '0 0 95px' }}
        >
          <option value="">Select date</option>
          {tripDates && tripDates.map((date, idx) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const displayStr = safeFormat(date, 'EEE MMM d');
            return (
              <option key={idx} value={dateStr}>{displayStr}</option>
            );
          })}
        </select>
        <input
          className="f-inp s-time"
          value={segment.depTime || ''}
          onChange={e => handleDepTimeChange(e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder=""
          style={{ flex: '0 0 50px' }}
        />
        <input className="f-inp s-port" value={segment.depPort || ''} onChange={e => onUpdate('depPort', e.target.value)} onKeyDown={handleEnterKeyAdvance} placeholder="" style={{ flex: '0 0 45px' }} />
        <input className="f-inp s-term" value={segment.depTerminal || ''} onChange={e => onUpdate('depTerminal', e.target.value)} onKeyDown={handleEnterKeyAdvance} placeholder="" style={{ flex: '0 0 35px' }} />
      </div>

      {/* Row 3: Arrival Date // Time // Airport // Terminal */}
      <div className="f-row-3" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', flex: '0 0 95px', color: '#94a3b8' }}>
          {arrDate && !isNaN(arrDate.getTime()) ? format(arrDate, 'EEE MMM d') : 'Arrival'}
        </div>
        <input
          className="f-inp s-time"
          value={segment.arrTime || ''}
          onChange={e => handleArrTimeChange(e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder=""
          style={{ flex: '0 0 50px' }}
        />
        <input className="f-inp s-port" value={segment.arrPort || ''} onChange={e => onUpdate('arrPort', e.target.value)} onKeyDown={handleEnterKeyAdvance} placeholder="" style={{ flex: '0 0 45px' }} />
        <input className="f-inp s-term" value={segment.arrTerminal || ''} onChange={e => onUpdate('arrTerminal', e.target.value)} onKeyDown={handleEnterKeyAdvance} placeholder="" style={{ flex: '0 0 35px' }} />
      </div>

      {layover && (
        <div className="f-layover">
          <RefreshCcw size={10} /> {layover} layover
        </div>
      )}
    </div>
  );
};


const SortableFlightRow = ({ flight, onUpdate, onDelete, tripDates, homeCity, destCity, homeTimeZone, destTimeZone }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: flight.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  const calculateLayover = (s1, s2) => {
    if (!s1 || !s2 || !s1.arrDate || !s1.arrTime || !s2.depDate || !s2.depTime) return null;
    try {
      const parseDateTime = (dateStr, timeStr) => {
        let d;
        if (dateStr.includes('-')) {
          d = new Date(dateStr);
        } else if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          let y = parseInt(parts[2]);
          if (y < 100) y += 2000;
          d = new Date(y, parseInt(parts[0]) - 1, parseInt(parts[1]), 0, 0, 0);
        } else {
          d = new Date(dateStr);
        }
        if (!d || isNaN(d.getTime())) return null;

        let t = timeStr.toLowerCase().replace(' ', '');
        let meridiem = t.slice(-1);
        let timePart = t.endsWith('a') || t.endsWith('p') ? t.slice(0, -1) : t;
        let parts = timePart.split(':');
        let h = parseInt(parts[0]);
        let m = parseInt(parts[1]) || 0;
        if (isNaN(h)) return null;
        if (meridiem === 'p' && h < 12) h += 12;
        if (meridiem === 'a' && h === 12) h = 0;
        d.setHours(h, m, 0, 0);
        return d;
      };
      const arr = parseDateTime(s1.arrDate, s1.arrTime);
      const dep = parseDateTime(s2.depDate, s2.depTime);
      if (!arr || !dep || isNaN(arr.getTime()) || isNaN(dep.getTime())) return null;
      const diff = (dep - arr) / (1000 * 60);
      if (diff <= 0 || isNaN(diff)) return null;
      const hours = Math.floor(diff / 60);
      const mins = Math.round(diff % 60);
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    } catch (e) { return null; }
  };

  const addLeg = (type) => { // type is 'outbound' or 'returnSegments'
    const newLegs = [...(flight[type] || [])];
    const last = newLegs[newLegs.length - 1];
    newLegs.push({
      id: generateId(),
      airlineCode: last?.airlineCode || '',
      flightNumber: '',
      depDate: last?.arrDate || '',
      depTime: '',
      depPort: last?.arrPort || '',
      arrDate: last?.arrDate || '',
      arrTime: '',
      arrPort: ''
    });
    onUpdate(type, newLegs);
  };

  const updateLeg = (type, segId, fieldOrUpdates, val) => {
    let updates = {};
    if (typeof fieldOrUpdates === 'string') {
      updates[fieldOrUpdates] = val;
    } else {
      updates = fieldOrUpdates;
    }

    const newLegs = flight[type].map(s => s.id === segId ? { ...s, ...updates } : s);
    onUpdate(type, newLegs);
  };

  const deleteLeg = (type, segId) => {
    if ((flight.outbound.length + flight.returnSegments.length) <= 1) {
      onDelete();
      return;
    }
    onUpdate(type, flight[type].filter(s => s.id !== segId));
  };

  return (
    <div ref={setNodeRef} style={style} className="flight-group glass">
      <div className="f-group-header">
        <div className="drag-handle f-grip-group" {...attributes} {...listeners}><GripVertical size={12} /></div>
        <div className="f-meta-primary">
          <input className="f-inp g-air" value={flight.airline || ''} onChange={e => onUpdate('airline', e.target.value)} placeholder="Airline" />
          <input className="f-inp g-conf" value={flight.confirmation || ''} onChange={e => onUpdate('confirmation', e.target.value)} placeholder="Confirmation" />
          <div className="f-cost-box">
            <button
              className={`currency-toggle-mini ${flight.isForeign ? 'active' : ''}`}
              onClick={() => onUpdate('isForeign', !flight.isForeign)}
              title="Toggle Foreign/Domestic"
            >
              {flight.isForeign ? <Globe size={11} /> : <span className="unit-mini">$</span>}
            </button>
            <input className="f-inp g-cost" type="number" value={flight.cost || ''} onChange={e => onUpdate('cost', parseFloat(e.target.value) || 0)} placeholder="0" />
          </div>
          <button className="f-del-group" onClick={onDelete} title="Delete Flight Group"><Trash2 size={12} /></button>
        </div>
      </div>

      <div className="f-trip-section-compact">
        <div className="f-trip-header-with-action">
          <div className="f-trip-header">OUTBOUND</div>
          <button className="f-add-seg-inline" onClick={() => addLeg('outbound')}><Plus size={10} /> ADD LEG</button>
        </div>
        <div className="f-segments-list">
          {(flight.outbound || []).map((seg, idx) => (
            <React.Fragment key={seg.id}>
              {idx > 0 && calculateLayover(flight.outbound[idx - 1], seg) && (
                <div className="f-layover-divider">
                  <RefreshCcw size={10} /> <span>{calculateLayover(flight.outbound[idx - 1], seg)} layover</span>
                </div>
              )}
              <FlightSegmentRow
                segment={seg}
                onUpdate={(f, v) => updateLeg('outbound', seg.id, f, v)}
                onDelete={() => deleteLeg('outbound', seg.id)}
                isLast={idx === flight.outbound.length - 1}
                tripDates={tripDates}
                homeCity={homeCity}
                destCity={destCity}
                homeTimeZone={homeTimeZone}
                destTimeZone={destTimeZone}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="f-trip-section-compact" style={{ marginTop: '0.75rem' }}>
        <div className="f-trip-header-with-action">
          <div className="f-trip-header">RETURN</div>
          <button className="f-add-seg-inline" onClick={() => addLeg('returnSegments')}><Plus size={10} /> ADD LEG</button>
        </div>
        <div className="f-segments-list">
          {(flight.returnSegments || []).map((seg, idx) => (
            <React.Fragment key={seg.id}>
              {idx > 0 && calculateLayover(flight.returnSegments[idx - 1], seg) && (
                <div className="f-layover-divider">
                  <RefreshCcw size={10} /> <span>{calculateLayover(flight.returnSegments[idx - 1], seg)} layover</span>
                </div>
              )}
              <FlightSegmentRow
                segment={seg}
                onUpdate={(f, v) => updateLeg('returnSegments', seg.id, f, v)}
                onDelete={() => deleteLeg('returnSegments', seg.id)}
                isLast={idx === flight.returnSegments.length - 1}
                tripDates={tripDates}
                homeCity={homeCity}
                destCity={destCity}
                homeTimeZone={homeTimeZone}
                destTimeZone={destTimeZone}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};


const FlightPanel = ({ flights, totalCost, onUpdate, onDelete, onAdd, dragEndHandler, tripDates, homeCity, destCity, homeTimeZone, destTimeZone }) => {
  return (
    <div className="flight-panel glass">
      <div className="f-header">
        <div className="f-title"><Plane size={14} /> FLIGHTS</div>
      </div>
      <div className="f-list">
        {flights.map(f => (
          <SortableFlightRow
            key={f.id}
            flight={f}
            onUpdate={(field, val) => onUpdate(f.id, field, val)}
            onDelete={() => onDelete(f.id)}
            tripDates={tripDates}
            homeCity={homeCity}
            destCity={destCity}
            homeTimeZone={homeTimeZone}
            destTimeZone={destTimeZone}
          />
        ))}
        {flights.length === 0 && <div className="no-travel" style={{ padding: '1rem' }}>No flights added</div>}
      </div>
      <button className="f-add-btn" onClick={onAdd} title="Adds a booking with outbound and return legs">
        <Plus size={10} /> ADD BOOKING
      </button>
    </div>
  );
};

const HotelRow = ({ hotel, onUpdate, onDelete, tripDates }) => {
  const handleStartChange = (date) => {
    onUpdate(hotel.id, 'checkIn', new Date(date.toISOString().split('T')[0] + 'T00:00:00'));
  };

  const handleEndChange = (date) => {
    onUpdate(hotel.id, 'checkOut', new Date(date.toISOString().split('T')[0] + 'T00:00:00'));
  };

  // Calculate number of nights
  const nights = hotel.checkIn && hotel.checkOut
    ? differenceInCalendarDays(hotel.checkOut, hotel.checkIn)
    : 0;

  // Cost mode: 'perNight' (default), 'total', or 'perDay'
  const costMode = hotel.costMode || 'perNight';

  const toggleCostMode = () => {
    const modes = ['perNight', 'total', 'perDay'];
    const currentIndex = modes.indexOf(costMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    // When switching to perDay mode, auto-populate all nights with current cost value
    if (nextMode === 'perDay' && nights > 0) {
      const dailyCosts = {};
      const costPerNight = hotel.cost || 0;
      for (let i = 0; i < nights; i++) {
        dailyCosts[`day${i}`] = costPerNight;
      }
      onUpdate(hotel.id, 'dailyCosts', dailyCosts);
    }

    onUpdate(hotel.id, 'costMode', nextMode);
  };

  // Handle average rate change - update all nightly rates
  const handleAverageChange = (newAverage) => {
    onUpdate(hotel.id, 'cost', newAverage);
    if (costMode === 'perDay' && nights > 0) {
      const dailyCosts = {};
      for (let i = 0; i < nights; i++) {
        dailyCosts[`day${i}`] = newAverage;
      }
      onUpdate(hotel.id, 'dailyCosts', dailyCosts);
    }
  };

  // Handle individual nightly rate change - recalculate average
  const handleNightlyRateChange = (dayKey, newRate) => {
    const newDailyCosts = { ...(hotel.dailyCosts || {}) };
    newDailyCosts[dayKey] = newRate;
    onUpdate(hotel.id, 'dailyCosts', newDailyCosts);

    // Calculate new average from all nightly rates
    const total = Object.values(newDailyCosts).reduce((sum, rate) => sum + (rate || 0), 0);
    const average = nights > 0 ? total / nights : 0;
    onUpdate(hotel.id, 'cost', average);
  };

  return (
    <div className="hotel-row-item">
      {/* Row 1: Name / City / Map Link / Delete */}
      <div className="h-row-line h-row-1">
        <input
          className="f-inp h-name"
          value={hotel.name || ''}
          onChange={e => onUpdate(hotel.id, 'name', e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="Hotel Name"
        />
        <input
          className="f-inp h-city"
          value={hotel.city || ''}
          onChange={e => onUpdate(hotel.id, 'city', e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="City"
        />
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((hotel.name || '') + ' ' + (hotel.city || ''))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="conf-map-link"
          title="Open in Google Maps"
        >
          <MapPin size={12} />
        </a>
        <button className="f-seg-del" onClick={() => onDelete(hotel.id)}><Trash2 size={10} /></button>
      </div>

      {/* Row 2: Check-in Date / Time / Cost */}
      <div className="h-row-line h-row-2">
        <select
          className="f-inp f-date-select monospace-font h-date-select"
          value={hotel.checkIn ? format(hotel.checkIn, 'yyyy-MM-dd') : ''}
          onChange={e => handleStartChange(new Date(e.target.value))}
          onKeyDown={handleEnterKeyAdvance}
        >
          <option value="">Check-in</option>
          {tripDates && tripDates.map((date, idx) => (
            <option key={idx} value={format(date, 'yyyy-MM-dd')}>{format(date, 'EEE MMM d')}</option>
          ))}
        </select>
        <input
          className="f-inp s-time h-time"
          value={hotel.checkInTime || ''}
          onChange={e => onUpdate(hotel.id, 'checkInTime', e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="2:00p"
        />

        <div className="h-cost-group">
          <div className="f-cost-box">
            <button
              className={`currency-toggle-mini ${hotel.isForeign ? 'active' : ''}`}
              onClick={() => onUpdate(hotel.id, 'isForeign', !hotel.isForeign)}
              title="Toggle Foreign/Domestic"
            >
              {hotel.isForeign ? <Globe size={11} /> : <span className="unit-mini">$</span>}
            </button>
            <input
              className="f-inp h-cost"
              type="number"
              value={hotel.cost || ''}
              onChange={e => handleAverageChange(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <button
            className="h-cost-mode-toggle"
            onClick={toggleCostMode}
            title={`Cost mode: ${costMode === 'perNight' ? 'Per Night' : costMode === 'total' ? 'Total' : 'Average'}`}
          >
            {costMode === 'perNight' ? '/night' : costMode === 'total' ? 'total' : 'average'}
          </button>
        </div>


      </div>

      {/* Row 3: Check-out Date / Time / Duration */}
      <div className="h-row-line h-row-3">
        <select
          className="f-inp f-date-select monospace-font h-date-select"
          value={hotel.checkOut ? format(hotel.checkOut, 'yyyy-MM-dd') : ''}
          onChange={e => handleEndChange(new Date(e.target.value))}
          onKeyDown={handleEnterKeyAdvance}
        >
          <option value="">Check-out</option>
          {tripDates && tripDates.map((date, idx) => (
            <option key={idx} value={format(date, 'yyyy-MM-dd')}>{format(date, 'EEE MMM d')}</option>
          ))}
        </select>
        <input
          className="f-inp s-time h-time"
          value={hotel.checkOutTime || ''}
          onChange={e => onUpdate(hotel.id, 'checkOutTime', e.target.value)}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="11:00a"
        />

        <div className="h-duration-display">
          {nights > 0 && (
            <span className="h-nights-badge">
              {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          )}
        </div>
      </div>

      {/* Expanded per-day breakdown if costMode is 'perDay' */}
      {costMode === 'perDay' && nights > 0 && (
        <div className="h-perday-breakdown">
          <div className="h-perday-header">Nightly Rates:</div>
          {Array.from({ length: nights }, (_, i) => {
            const date = addDays(hotel.checkIn, i);
            const dateStr = format(date, 'EEE MMM d');
            const dayKey = `day${i}`;
            const dayCost = (hotel.dailyCosts && hotel.dailyCosts[dayKey]) || 0;

            return (
              <div key={i} className="h-perday-row">
                <span className="h-perday-date">{dateStr}</span>
                <div className="f-cost-box h-perday-cost-box">
                  <button
                    className={`currency-toggle-mini ${hotel.isForeign ? 'active' : ''}`}
                    onClick={() => onUpdate(hotel.id, 'isForeign', !hotel.isForeign)}
                    title="Toggle Foreign/Domestic"
                  >
                    {hotel.isForeign ? <Globe size={9} /> : <span className="unit-mini">$</span>}
                  </button>
                  <input
                    className="f-inp h-perday-input"
                    type="number"
                    value={dayCost || ''}
                    onChange={e => handleNightlyRateChange(dayKey, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div >
  );
};

const HotelPanel = ({ hotels, onUpdate, onDelete, onAdd, tripDates }) => {
  return (
    <div className="hotel-panel glass">
      <div className="f-header">
        <div className="f-title"><Hotel size={14} /> HOTELS</div>
      </div>
      <div className="f-list">
        {hotels.map(h => (
          <HotelRow
            key={h.id}
            hotel={h}
            onUpdate={onUpdate}
            onDelete={onDelete}
            tripDates={tripDates}
          />
        ))}
        {hotels.length === 0 && <div className="no-travel" style={{ padding: '1rem' }}>No hotels added</div>}
      </div>
      <button className="f-add-btn" onClick={onAdd}>
        <Plus size={10} /> ADD HOTEL
      </button>
    </div>
  );
};


// Transportation types with emojis
const TRANSPORT_TYPES = [
  { value: 'uber', label: '🚕 Uber/Taxi', emoji: '🚕' },
  { value: 'bus', label: '🚌 Bus', emoji: '🚌' },
  { value: 'train', label: '🚆 Train', emoji: '🚆' },
  { value: 'walk', label: '🚶 Walk', emoji: '🚶' },
];

// Place types with emojis for from/to selectors
const PLACE_TYPES = [
  { value: 'home', label: '🏡 Home', emoji: '🏡' },
  { value: 'airport', label: '✈️ Airport', emoji: '✈️' },
  { value: 'hotel', label: '🏨 Hotel', emoji: '🏨' },
  { value: 'work', label: '💼 Work', emoji: '💼' },
];
// Helper to determine if a transport time is "home" or "away" based on flights
const getTransportTimezoneContext = (transport, flights) => {
  if (!transport.date || !transport.time || !flights || flights.length === 0) {
    return transport.isHome ? 'home' : 'away';
  }

  // Parse the transport date/time
  const transportDate = transport.date instanceof Date ? transport.date : new Date(transport.date);
  if (isNaN(transportDate.getTime())) return transport.isHome ? 'home' : 'away';

  // Get all outbound and return flight segments
  let firstOutboundDep = null;
  let lastOutboundArr = null;
  let firstReturnDep = null;
  let lastReturnArr = null;

  flights.forEach(f => {
    // Outbound segments
    if (f.outbound && f.outbound.length > 0) {
      const first = f.outbound[0];
      const last = f.outbound[f.outbound.length - 1];
      if (first.depDate && first.depTime) {
        const dt = parseFlightDateTime(first.depDate, first.depTime);
        if (!firstOutboundDep || dt < firstOutboundDep) firstOutboundDep = dt;
      }
      if (last.arrDate && last.arrTime) {
        const dt = parseFlightDateTime(last.arrDate, last.arrTime);
        if (!lastOutboundArr || dt > lastOutboundArr) lastOutboundArr = dt;
      }
    }
    // Return segments
    if (f.returnSegments && f.returnSegments.length > 0) {
      const first = f.returnSegments[0];
      const last = f.returnSegments[f.returnSegments.length - 1];
      if (first.depDate && first.depTime) {
        const dt = parseFlightDateTime(first.depDate, first.depTime);
        if (!firstReturnDep || dt < firstReturnDep) firstReturnDep = dt;
      }
      if (last.arrDate && last.arrTime) {
        const dt = parseFlightDateTime(last.arrDate, last.arrTime);
        if (!lastReturnArr || dt > lastReturnArr) lastReturnArr = dt;
      }
    }
  });

  // Parse transport time to create a comparable datetime
  const transportDateTime = parseFlightDateTime(format(transportDate, 'yyyy-MM-dd'), transport.time);
  if (!transportDateTime) return transport.isHome ? 'home' : 'away';

  // Logic:
  // - If before first outbound departure → home
  // - If after last outbound arrival AND before first return departure → away
  // - If after last return arrival → home
  // - Otherwise, check which segment we're closest to

  if (firstOutboundDep && transportDateTime < firstOutboundDep) {
    return 'home';
  }
  if (lastReturnArr && transportDateTime > lastReturnArr) {
    return 'home';
  }
  if (lastOutboundArr && firstReturnDep && transportDateTime >= lastOutboundArr && transportDateTime <= firstReturnDep) {
    return 'away';
  }
  if (lastOutboundArr && !firstReturnDep && transportDateTime >= lastOutboundArr) {
    return 'away';
  }

  // Fallback to stored isHome value
  return transport.isHome ? 'home' : 'away';
};

// Helper to parse flight date/time strings
const parseFlightDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  try {
    // Parse the time string (e.g., "9:20a", "1:35p")
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*([aApP])?/);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const meridian = (timeMatch[3] || 'a').toLowerCase();

    if (meridian === 'p' && hours !== 12) hours += 12;
    if (meridian === 'a' && hours === 12) hours = 0;

    // Parse the date
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) return null;
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);

    return new Date(year, month, day, hours, minutes);
  } catch (e) {
    return null;
  }
};

// Sortable Transportation Row with 2-row layout and timezone awareness
const SortableTransportRow = ({ transport, onUpdate, onDelete, tripDates, altCurrency, customRates, flights }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: transport.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto'
  };

  // Handlers
  const handleTypeChange = (e) => onUpdate(transport.id, 'type', e.target.value);
  const handleDateChange = (e) => {
    if (e.target.value) {
      onUpdate(transport.id, 'date', new Date(e.target.value + 'T00:00:00'));
    }
  };
  const handleFromChange = (e) => onUpdate(transport.id, 'from', e.target.value);
  const handleToChange = (e) => onUpdate(transport.id, 'to', e.target.value);
  const handleStartTimeChange = (e) => {
    const newStartTime = e.target.value;
    onUpdate(transport.id, 'time', newStartTime);

    // Recalculate endTime from new startTime + duration
    if (transport.duration) {
      const startTime = parseTime(newStartTime);
      if (startTime !== null) {
        const endHours = startTime + transport.duration / 60;
        const endTimeStr = formatTime(endHours);
        onUpdate(transport.id, 'endTime', endTimeStr);
      }
    }
  };
  const handleEndTimeChange = (e) => {
    const newEndTime = e.target.value;
    onUpdate(transport.id, 'endTime', newEndTime);

    // Recalculate duration from startTime and new endTime
    if (transport.time) {
      const startTime = parseTime(transport.time);
      const endTime = parseTime(newEndTime);
      if (startTime !== null && endTime !== null) {
        let diffMinutes = Math.round((endTime - startTime) * 60);
        if (diffMinutes < 0) diffMinutes += 1440; // Handle overnight
        onUpdate(transport.id, 'duration', diffMinutes);
      }
    }
  };
  const handleDurationChange = (e) => {
    const newDuration = parseFloat(e.target.value) || 0;
    onUpdate(transport.id, 'duration', newDuration);

    // Recalculate endTime from startTime + duration
    if (transport.time) {
      const startTime = parseTime(transport.time);
      if (startTime !== null) {
        const endHours = startTime + newDuration / 60;
        const endTimeStr = formatTime(endHours);
        onUpdate(transport.id, 'endTime', endTimeStr);
      }
    }
  };
  const handleCostChange = (e) => onUpdate(transport.id, 'cost', parseFloat(e.target.value) || 0);
  const handleCurrencyToggle = () => {
    onUpdate(transport.id, 'currency', transport.currency === 'USD' ? altCurrency : 'USD');
  };

  // Determine timezone context
  const tzContext = getTransportTimezoneContext(transport, flights);
  const tzEmoji = tzContext === 'home' ? '🏡' : '💼';
  const tzLabel = tzContext === 'home' ? 'Home TZ' : 'Away TZ';

  // NOTE: Removed auto-update effect for isHome - it was causing race conditions
  // where the wrong value was calculated during initial render before flights loaded.
  // The isHome value should be set when the transport is created, not auto-calculated.

  const isForeign = transport.currency !== 'USD';
  const rate = customRates[transport.currency] || 1;
  const usdEquivalent = isForeign ? (transport.cost / rate) : transport.cost;

  // Get current from/to values, default to fromEmoji/toEmoji for legacy data
  const fromValue = transport.from || (transport.fromEmoji === '🏡' ? 'home' : transport.fromEmoji === '✈️' ? 'airport' : transport.fromEmoji === '🏨' ? 'hotel' : 'work');
  const toValue = transport.to || (transport.toEmoji === '🏡' ? 'home' : transport.toEmoji === '✈️' ? 'airport' : transport.toEmoji === '🏨' ? 'hotel' : 'work');

  return (
    <div ref={setNodeRef} style={style} className="transport-row">
      {/* Row 1: grip, date, tz icon, from place, departure time, price, trash */}
      <div className="t-row-1">
        <div className="t-grip" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </div>

        <select
          className="t-date-select"
          value={transport.date && !isNaN(transport.date.getTime()) ? format(transport.date, 'yyyy-MM-dd') : ''}
          onChange={handleDateChange}
          onKeyDown={handleEnterKeyAdvance}
        >
          <option value="">Date</option>
          {tripDates && tripDates.map((date, idx) => (
            <option key={idx} value={format(date, 'yyyy-MM-dd')}>{format(date, 'EEE M/d')}</option>
          ))}
        </select>


        <select className="t-place-select" value={fromValue} onChange={handleFromChange} onKeyDown={handleEnterKeyAdvance}>
          {PLACE_TYPES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <input
          className="t-time-input"
          value={transport.time || ''}
          onChange={handleStartTimeChange}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="9:00a"
        />

        <div className="t-cost-group">
          <button
            className={`t-currency-btn ${isForeign ? 'foreign' : 'domestic'}`}
            onClick={handleCurrencyToggle}
            title={isForeign ? `${altCurrency} → USD` : 'USD'}
          >
            {isForeign ? <Globe size={12} /> : <DollarSign size={12} />}
          </button>
          <input
            type="number"
            className="t-cost-input"
            value={transport.cost || ''}
            onChange={handleCostChange}
            placeholder="0"
            step="0.01"
          />
          {isForeign && (
            <span className="t-usd-equiv">≈ ${usdEquivalent.toFixed(2)}</span>
          )}
        </div>

        <button className="t-delete-btn" onClick={() => onDelete(transport.id)} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Row 2: spacer, type selector, to place, arrival time, duration */}
      <div className="t-row-2">
        <div className="t-row2-spacer"></div>

        <select className="t-type-select" value={transport.type || 'uber'} onChange={handleTypeChange} onKeyDown={handleEnterKeyAdvance}>
          {TRANSPORT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select className="t-place-select" value={toValue} onChange={handleToChange} onKeyDown={handleEnterKeyAdvance}>
          {PLACE_TYPES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <input
          className="t-time-input"
          value={transport.endTime || ''}
          onChange={handleEndTimeChange}
          onKeyDown={handleEnterKeyAdvance}
          placeholder="10:00a"
        />

        <div className="t-duration-group">
          <input
            type="number"
            className="t-duration-input"
            value={transport.duration || ''}
            onChange={handleDurationChange}
            placeholder="60"
            step="5"
          />
          <span className="t-duration-label">min</span>
        </div>
      </div>
    </div>
  );
};

// Transportation Panel
const TransportationPanel = ({
  transportation,
  onUpdate,
  onDelete,
  onAdd,
  onReorder,
  tripDates,
  altCurrency,
  customRates,
  flights
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = transportation.findIndex(t => t.id === active.id);
    const newIndex = transportation.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(transportation, oldIndex, newIndex));
    }
  };

  return (
    <div className="transport-panel glass">
      <div className="f-header">
        <div className="f-title"><Car size={14} /> TRANSPORTATION</div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={transportation.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="t-list">
            {transportation.map(t => (
              <SortableTransportRow
                key={t.id}
                transport={t}
                onUpdate={onUpdate}
                onDelete={onDelete}
                tripDates={tripDates}
                altCurrency={altCurrency}
                customRates={customRates}
                flights={flights}
              />
            ))}
            {transportation.length === 0 && (
              <div className="no-travel" style={{ padding: '1rem' }}>No transportation added</div>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <button className="f-add-btn" onClick={onAdd}>
        <Plus size={10} /> ADD TRIP
      </button>
    </div>
  );
};


// --- Components ---

// Parse flexible date input: supports "Jan 4", "1/4", "1-4", "1 4", "January 4", etc.
const parseDateInput = (input) => {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const currentYear = today.getFullYear();

  // Month name mapping
  const monthNames = {
    'jan': 0, 'january': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
    'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5, 'jul': 6, 'july': 6,
    'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8, 'oct': 9, 'october': 9,
    'nov': 10, 'november': 10, 'dec': 11, 'december': 11
  };

  let month = null;
  let day = null;

  // Try "Month Day" format first (Jan 4, January 4)
  const monthDayMatch = trimmed.match(/^([a-zA-Z]+)\s*(\d{1,2})$/);
  if (monthDayMatch) {
    const monthStr = monthDayMatch[1].toLowerCase();
    if (monthNames[monthStr] !== undefined) {
      month = monthNames[monthStr];
      day = parseInt(monthDayMatch[2], 10);
    }
  }

  // Try "M/D", "M-D", "M D" formats
  if (month === null) {
    const numericMatch = trimmed.match(/^(\d{1,2})[\/\-\s](\d{1,2})$/);
    if (numericMatch) {
      month = parseInt(numericMatch[1], 10) - 1; // Convert to 0-indexed
      day = parseInt(numericMatch[2], 10);
    }
  }

  if (month !== null && day !== null && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
    // Determine year: use next occurrence of this date
    let year = currentYear;
    let resultDate = new Date(year, month, day, 12, 0, 0);

    // If the date is in the past, use next year
    if (resultDate < today && !isSameDay(resultDate, today)) {
      year = currentYear + 1;
      resultDate = new Date(year, month, day, 12, 0, 0);
    }

    // Validate the date is real (e.g., Feb 30 doesn't exist)
    if (resultDate.getMonth() === month && resultDate.getDate() === day) {
      return resultDate;
    }
  }

  return null;
};

// Vertically scrolling date range picker with continuous flowing calendar
const DateRangePicker = ({ startDate, endDate, onStartChange, onEndChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStart, setTempStart] = useState(null);
  const [editingStart, setEditingStart] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [startInputValue, setStartInputValue] = useState('');
  const [endInputValue, setEndInputValue] = useState('');
  const [visibleYear, setVisibleYear] = useState(new Date().getFullYear());
  const popupRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const startRowRef = React.useRef(null);
  const startInputRef = React.useRef(null);
  const endInputRef = React.useRef(null);

  // Generate dates: from 1st of previous month up to 1 year from today
  const allDays = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    // Start from the 1st of previous month
    const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12, 0, 0);

    // End date is exactly 1 year from today (365 days)
    const endDate = addDays(today, 365);

    // Generate all days from start to end
    let currentDate = startDate;
    while (currentDate <= endDate) {
      result.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }
    return result;
  }, []);

  // Group days into weeks (Sunday-Saturday)
  const weeks = useMemo(() => {
    const result = [];
    let currentWeek = [];

    // Find the first Sunday on or before the first day
    const firstDay = allDays[0];
    const firstSunday = addDays(firstDay, -firstDay.getDay());

    // Start from first Sunday and go through all days
    let currentDate = firstSunday;
    const lastDay = allDays[allDays.length - 1];

    while (currentDate <= lastDay) {
      currentWeek.push(currentDate);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
      currentDate = addDays(currentDate, 1);
    }

    // Add remaining days
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [allDays]);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
        setTempStart(null);
        setSelectingStart(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Instantly scroll to start date's week when opening (no animation)
  React.useEffect(() => {
    if (isOpen && scrollRef.current && startRowRef.current) {
      // Use scrollTop for instant positioning
      const container = scrollRef.current;
      const row = startRowRef.current;
      const weekRowHeight = 40; // offset to prevent truncation and show context
      // Position so start week appears on second row with full visibility
      container.scrollTop = row.offsetTop - container.offsetTop - weekRowHeight;

      // Set initial visible year
      if (startDate) {
        setVisibleYear(startDate.getFullYear());
      }
    }
  }, [isOpen, startDate]);

  // Track visible year on scroll
  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isOpen) return;

    const handleScroll = () => {
      // Find the first visible week row
      const scrollTop = container.scrollTop;
      const weekRowHeight = 32; // approximate height of a week row
      const visibleWeekIndex = Math.floor(scrollTop / weekRowHeight);

      if (weeks[visibleWeekIndex]) {
        const firstVisibleDay = weeks[visibleWeekIndex][0];
        setVisibleYear(firstVisibleDay.getFullYear());
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen, weeks]);

  // Focus input when editing
  React.useEffect(() => {
    if (editingStart && startInputRef.current) {
      startInputRef.current.focus();
      startInputRef.current.select();
    }
  }, [editingStart]);

  React.useEffect(() => {
    if (editingEnd && endInputRef.current) {
      endInputRef.current.focus();
      endInputRef.current.select();
    }
  }, [editingEnd]);

  const openCalendar = () => {
    if (isOpen) {
      // If already open, close it
      setIsOpen(false);
    } else {
      // If closed, open it
      setTempStart(null);
      setSelectingStart(true);
      setIsOpen(true);
    }
  };

  const handleDayClick = (day) => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (isBefore(day, today) && !isSameDay(day, today)) return;

    if (selectingStart) {
      setTempStart(day);
      setSelectingStart(false);
    } else {
      if (tempStart && isBefore(day, tempStart)) {
        setTempStart(day);
      } else {
        const finalStart = tempStart || startDate;
        onStartChange(finalStart);
        onEndChange(day);
        setIsOpen(false);
        setTempStart(null);
        setSelectingStart(true);
      }
    }
  };

  const handleStartClick = (e) => {
    e.stopPropagation();
    setEditingStart(true);
    setStartInputValue(startDate ? format(startDate, 'MMM d') : '');
  };

  const handleEndClick = (e) => {
    e.stopPropagation();
    setEditingEnd(true);
    setEndInputValue(endDate ? format(endDate, 'MMM d') : '');
  };

  const handleStartInputChange = (e) => {
    setStartInputValue(e.target.value);
  };

  const handleEndInputChange = (e) => {
    setEndInputValue(e.target.value);
  };

  const handleStartInputBlur = () => {
    const parsed = parseDateInput(startInputValue);
    if (parsed) {
      onStartChange(parsed);
      // If new start is after end, adjust end
      if (endDate && isAfter(parsed, endDate)) {
        onEndChange(addDays(parsed, differenceInCalendarDays(endDate, startDate) || 0));
      }
    }
    setEditingStart(false);
  };

  const handleEndInputBlur = () => {
    const parsed = parseDateInput(endInputValue);
    if (parsed) {
      // Only accept if end is on or after start
      if (startDate && !isBefore(parsed, startDate)) {
        onEndChange(parsed);
      }
    }
    setEditingEnd(false);
  };

  const handleStartInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleStartInputBlur();
    } else if (e.key === 'Escape') {
      setEditingStart(false);
    }
  };

  const handleEndInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEndInputBlur();
    } else if (e.key === 'Escape') {
      setEditingEnd(false);
    }
  };

  // Find which week contains the start date for auto-scroll
  const startWeekIndex = useMemo(() => {
    if (!startDate) return 0;
    const idx = weeks.findIndex(week =>
      week.some(day => isSameDay(day, startDate))
    );
    return Math.max(0, idx);
  }, [startDate, weeks]);

  // Calculate number of days in range
  const dayCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInCalendarDays(endDate, startDate) + 1;
  }, [startDate, endDate]);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const activeStart = tempStart || startDate;
  const activeEnd = tempStart ? null : endDate;

  // Render continuous calendar
  const renderCalendar = () => {
    return (
      <div className="cc-calendar">
        {/* Weekday headers */}
        <div className="cc-header-row">
          <div className="cc-year-cell">{visibleYear}</div>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="cc-weekday">{d}</div>
          ))}
        </div>

        {/* Week rows */}
        <div className="cc-weeks-container" ref={scrollRef}>
          {weeks.map((week, weekIdx) => {
            const sundayDate = week[0];
            const monthAbbr = format(sundayDate, 'MMM').toUpperCase();
            const sundayMonth = sundayDate.getMonth();
            const isSundayEvenMonth = sundayMonth % 2 === 0;
            const isStartRow = weekIdx === startWeekIndex;

            return (
              <div
                key={weekIdx}
                className="cc-week-row"
                ref={isStartRow ? startRowRef : null}
              >
                <div className={`cc-month-label-cell ${isSundayEvenMonth ? 'even-month' : 'odd-month'}`}>
                  <span className="cc-month-label">{monthAbbr}</span>
                </div>
                {week.map((day, dayIdx) => {
                  const isPast = isBefore(day, today) && !isSameDay(day, today);
                  const isBeforeRange = isBefore(day, allDays[0]);
                  const isStart = activeStart && isSameDay(day, activeStart);
                  const isEnd = activeEnd && isSameDay(day, activeEnd);
                  // Strict exclusive range check
                  const isInRange = activeStart && activeEnd &&
                    isAfter(startOfDay(day), startOfDay(activeStart)) &&
                    isBefore(startOfDay(day), startOfDay(activeEnd));
                  const isToday = isSameDay(day, today);
                  const dayNum = day.getDate();
                  // Per-day month shading based on this day's own month
                  const dayMonth = day.getMonth();
                  const isEvenMonth = dayMonth % 2 === 0;

                  return (
                    <div
                      key={dayIdx}
                      className={`cc-day ${isEvenMonth ? 'even-month' : 'odd-month'} ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${isInRange ? 'in-range' : ''} ${isPast || isBeforeRange ? 'past' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => !isPast && !isBeforeRange && handleDayClick(day)}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Format display for dates
  const fmtDate = (d) => {
    const dow = format(d, 'EEE');
    const mon = format(d, 'MMM').toUpperCase();
    const day = format(d, 'd');
    return <><span className="dow">{dow}</span> <span className="mon">{mon}</span> <span className="day">{day}</span></>;
  };

  return (
    <div className="date-range-picker" ref={popupRef}>
      <button className="cal-icon-btn" onClick={openCalendar} type="button" title="Select date range">
        <span className="cal-emoji">🗓️</span>
      </button>
      <div className="date-range-display">
        {!startDate || !endDate ? (
          <span className="date-range-placeholder" onClick={openCalendar}>Select dates</span>
        ) : (
          <>
            {editingStart ? (
              <input
                ref={startInputRef}
                className="date-edit-input"
                value={startInputValue}
                onChange={handleStartInputChange}
                onBlur={handleStartInputBlur}
                onKeyDown={handleStartInputKeyDown}
                placeholder="Jan 4"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="date-clickable" onClick={handleStartClick} title="Click to edit">
                {fmtDate(startDate)}
              </span>
            )}
            <span className="range-dash">–</span>
            {editingEnd ? (
              <input
                ref={endInputRef}
                className="date-edit-input"
                value={endInputValue}
                onChange={handleEndInputChange}
                onBlur={handleEndInputBlur}
                onKeyDown={handleEndInputKeyDown}
                placeholder="Jan 8"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="date-clickable" onClick={handleEndClick} title="Click to edit">
                {fmtDate(endDate)}
              </span>
            )}
            <span className="day-count-badge">({dayCount} day{dayCount !== 1 ? 's' : ''})</span>
          </>
        )}
      </div>

      {isOpen && (
        <div className="cc-popup">
          {renderCalendar()}
          <div className="cal-hint">
            {selectingStart ? 'Select departure date' : 'Select return date'}
          </div>
        </div>
      )}
    </div>
  );
};
// Single date picker (for flight departure dates)
const SingleDatePicker = ({ value, onChange, className, placeholder = "Select date" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const startMonthRef = React.useRef(null);

  // Generate 13 months: current month + 12 months ahead
  const months = useMemo(() => {
    const result = [];
    const today = new Date();
    const firstMonth = startOfMonth(today);
    for (let i = 0; i < 13; i++) {
      result.push(addMonths(firstMonth, i));
    }
    return result;
  }, []);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to the selected date's month when opening
  React.useEffect(() => {
    if (isOpen && scrollRef.current && startMonthRef.current) {
      setTimeout(() => {
        startMonthRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }, 50);
    }
  }, [isOpen]);

  const openCalendar = () => {
    setIsOpen(true);
  };

  const handleDayClick = (day) => {
    onChange(day);
    setIsOpen(false);
  };

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const renderMonth = (monthDate, isStartMonth) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const cells = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    // Empty cells for days before the 1st
    for (let i = 0; i < startDay; i++) {
      cells.push(<div key={`empty-${i}`} className="cal-day empty" />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d, 12, 0, 0);
      const isPast = isBefore(date, today) && !isSameDay(date, today);
      const isSelected = value && isSameDay(date, value);
      const isToday = isSameDay(date, today);

      cells.push(
        <div
          key={d}
          className={`cal-day ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => !isPast && handleDayClick(date)}
        >
          {d}
        </div>
      );
    }

    return (
      <div
        key={format(monthDate, 'yyyy-MM')}
        className="cal-month-block"
        ref={isStartMonth ? startMonthRef : null}
      >
        <div className="cal-month-header">
          {format(monthDate, 'MMMM yyyy')}
        </div>
        <div className="cal-weekdays">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="cal-grid">
          {cells}
        </div>
      </div>
    );
  };

  // Find which month the value is in for scrolling
  const valueMonthIndex = useMemo(() => {
    if (!value) return 0;
    const valueMo = startOfMonth(value);
    const idx = months.findIndex(m => isSameDay(startOfMonth(m), valueMo));
    return idx >= 0 ? idx : 0;
  }, [value, months]);

  // Format display
  const formatDisplay = () => {
    if (!value || isNaN(value.getTime())) {
      return <span className="date-single-placeholder">{placeholder}</span>;
    }
    const dow = format(value, 'EEE');
    const mon = format(value, 'MMM').toUpperCase();
    const day = format(value, 'd');
    return (
      <>
        <span className="dow">{dow}</span> <span className="mon">{mon}</span> <span className="day">{day}</span>
      </>
    );
  };

  return (
    <div className={`single-date-picker ${className || ''}`} ref={popupRef}>
      <div className="date-single-display" onClick={openCalendar}>
        {formatDisplay()}
      </div>

      {isOpen && (
        <div className="cal-popup vertical-scroll single">
          <div className="cal-scroll-container" ref={scrollRef}>
            {months.map((monthDate, idx) => renderMonth(monthDate, idx === valueMonthIndex))}
          </div>
        </div>
      )}
    </div>
  );
};


// Compact trip date range picker for hotels (only shows trip week(s))
const TripDateRangePicker = ({ startDate, endDate, onStartChange, onEndChange, tripDates }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStart, setTempStart] = useState(null);
  const popupRef = React.useRef(null);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
        setTempStart(null);
        setSelectingStart(true);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openCalendar = () => {
    setTempStart(null);
    setSelectingStart(true);
    setIsOpen(true);
  };

  const handleDayClick = (day) => {
    if (selectingStart) {
      setTempStart(day);
      setSelectingStart(false);
    } else {
      if (tempStart && isBefore(day, tempStart)) {
        setTempStart(day);
      } else {
        const finalStart = tempStart || startDate;
        onStartChange(finalStart);
        onEndChange(day);
        setIsOpen(false);
        setTempStart(null);
        setSelectingStart(true);
      }
    }
  };

  // Calculate number of days in range
  const dayCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return differenceInCalendarDays(endDate, startDate) + 1;
  }, [startDate, endDate]);

  // Format display
  const formatDisplay = () => {
    if (!startDate || !endDate) {
      return <span className="date-range-placeholder">Select dates</span>;
    }
    const fmtDate = (d) => {
      const dow = format(d, 'EEE');
      const mon = format(d, 'MMM').toUpperCase();
      const day = format(d, 'd');
      return <><span className="dow">{dow}</span> <span className="mon">{mon}</span> <span className="day">{day}</span></>;
    };
    return (
      <>
        {fmtDate(startDate)} <span className="range-dash">–</span> {fmtDate(endDate)} <span className="day-count-badge">({dayCount} day{dayCount !== 1 ? 's' : ''})</span>
      </>
    );
  };

  // Render compact trip calendar
  const renderTripCalendar = () => {
    if (!tripDates || tripDates.length === 0) return null;

    const activeStart = tempStart || startDate;
    const activeEnd = tempStart ? null : endDate;

    return (
      <div className="trip-cal-grid">
        <div className="trip-cal-weekdays">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="trip-cal-days">
          {tripDates.map((date, idx) => {
            const isStart = activeStart && isSameDay(date, activeStart);
            const isEnd = activeEnd && isSameDay(date, activeEnd);
            const isInRange = activeStart && activeEnd && isAfter(date, activeStart) && isBefore(date, activeEnd);
            const dayOfWeek = date.getDay();

            // Add empty cells for proper alignment (only for first week)
            if (idx === 0 && dayOfWeek > 0) {
              return (
                <React.Fragment key={`frag-${idx}`}>
                  {[...Array(dayOfWeek)].map((_, i) => <div key={`empty-${i}`} className="trip-day empty" />)}
                  <div
                    className={`trip-day ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${isInRange ? 'in-range' : ''}`}
                    onClick={() => handleDayClick(date)}
                  >
                    {format(date, 'd')}
                  </div>
                </React.Fragment>
              );
            }

            return (
              <div
                key={idx}
                className={`trip-day ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${isInRange ? 'in-range' : ''}`}
                onClick={() => handleDayClick(date)}
              >
                {format(date, 'd')}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="trip-date-range-picker" ref={popupRef}>
      <button className="cal-icon-btn trip-cal-btn" onClick={openCalendar} type="button" title="Select date range">
        <span className="cal-emoji">🗓️</span>
      </button>
      <div className="date-range-display trip-display" onClick={openCalendar}>
        {formatDisplay()}
      </div>

      {isOpen && (
        <div className="trip-cal-popup">
          {renderTripCalendar()}
          <div className="cal-hint">
            {selectingStart ? 'Select check-in date' : 'Select check-out date'}
          </div>
        </div>
      )}
    </div>
  );
};

const SegmentedDateInput = ({ value, onChange, className }) => {
  const [mon, setMon] = useState(safeFormat(value, 'M'));
  const [day, setDay] = useState(safeFormat(value, 'd'));
  const [year, setYear] = useState(safeFormat(value, 'yy'));
  const [wd, setWd] = useState(safeFormat(value, 'EEE'));
  const [isMonFocused, setIsMonFocused] = useState(false);

  const dateInputRef = React.useRef(null);
  const monRef = React.useRef(null);
  const dayRef = React.useRef(null);
  const yearRef = React.useRef(null);
  const wdRef = React.useRef(null);
  const isInternalChange = React.useRef(false);

  const monthsAbbr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  React.useEffect(() => {
    if (!value || isNaN(value.getTime())) {
      setMon(''); setDay(''); setYear(''); setWd('');
      return;
    }
    const isFocused = [monRef.current, dayRef.current, yearRef.current, wdRef.current].includes(document.activeElement);
    if (!isFocused && !isInternalChange.current) {
      setMon(format(value, 'M'));
      setDay(format(value, 'd'));
      setYear(format(value, 'yy'));
      setWd(format(value, 'EEE'));
    }
  }, [value]);

  const commitParts = (newMon, newDay, newYear) => {
    if (newMon.length === 0 || newDay.length === 0 || (newYear && newYear.length < 2)) return;
    const m = parseInt(newMon);
    const d = parseInt(newDay);
    let y = parseInt(newYear);

    if (isNaN(m) || m < 1 || m > 12) return;
    if (isNaN(d) || d < 1 || d > 31) return;

    // If year is empty, use current year or value year
    if (isNaN(y)) {
      y = value ? value.getFullYear() : new Date().getFullYear();
    } else if (y < 100) {
      y += 2000;
    }

    // Use local time precisely
    const newDate = new Date(y, m - 1, d, 12, 0, 0);
    if (!isNaN(newDate.getTime())) {
      const currentValStr = safeFormat(value, 'yyyy-MM-dd');
      if (format(newDate, 'yyyy-MM-dd') !== currentValStr) {
        isInternalChange.current = true;
        onChange(newDate);
        setTimeout(() => { isInternalChange.current = false; }, 100);
      }
    }
  };

  const handleWdChange = (newWdStr) => {
    setWd(newWdStr);
    const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const search = newWdStr.toLowerCase().trim();
    if (search.length < 2) return;

    const targetIdx = weekdays.findIndex(w => w.startsWith(search.substring(0, 3)));
    if (targetIdx !== -1) {
      const currentIdx = value.getDay();
      let diff = targetIdx - currentIdx;
      // Find closest (max 3 days away)
      if (diff > 3) diff -= 7;
      if (diff < -3) diff += 7;

      if (diff !== 0) {
        const next = addDays(value, diff);
        onChange(next);
        if (next && !isNaN(next.getTime())) setWd(format(next, 'EEE'));
      }
    }
  };

  const handleFocus = (e) => {
    e.target.select();
  };

  const displayMon = isMonFocused ? mon : monthsAbbr[parseInt(mon) - 1] || mon;

  return (
    <div className={`segmented-date-input ${className || ''}`}>
      <input
        ref={wdRef}
        className="si-wd"
        value={wd}
        onChange={e => handleWdChange(e.target.value)}
        onBlur={() => {
          if (value && !isNaN(value.getTime())) setWd(format(value, 'EEE'));
        }}
        onFocus={handleFocus}
        spellCheck="false"
        placeholder="WED"
      />
      <div className="si-parts">
        <input
          ref={monRef}
          className={`si-num ${!isMonFocused ? 'si-mon-abbr' : ''}`}
          value={displayMon}
          onFocus={(e) => { setIsMonFocused(true); handleFocus(e); }}
          onBlur={() => {
            setIsMonFocused(false);
            if (value && !isNaN(value.getTime())) {
              const v = format(value, 'M');
              setMon(v);
              commitParts(v, day, year);
            }
          }}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').substring(0, 2);
            setMon(val);
            const isComplete = val.length === 2 || (val.length === 1 && parseInt(val) > 1 && val !== '0');
            if (isComplete) {
              dayRef.current?.focus();
              commitParts(val, day, year);
            }
          }}
          placeholder="M"
        />
        <span className="si-sep">/</span>
        <input
          ref={dayRef}
          className="si-num"
          value={day}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').substring(0, 2);
            setDay(val);
            const isComplete = val.length === 2 || (val.length === 1 && parseInt(val) > 3);
            if (isComplete) {
              yearRef.current?.focus();
              commitParts(mon, val, year);
            }
          }}
          onBlur={() => {
            if (value && !isNaN(value.getTime())) {
              const v = format(value, 'd');
              setDay(v);
              commitParts(mon, v, year);
            }
          }}
          onFocus={handleFocus}
          maxLength={2}
          placeholder="D"
        />
        <span className="si-sep">/</span>
        <input
          ref={yearRef}
          className="si-num si-year"
          value={year}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').substring(0, 2);
            setYear(val);
            if (val.length === 2) {
              commitParts(mon, day, val);
            }
          }}
          onBlur={() => {
            if (value && !isNaN(value.getTime())) {
              const v = format(value, 'yy');
              setYear(v);
              commitParts(mon, day, v);
            }
          }}
          onFocus={handleFocus}
          maxLength={2}
          placeholder="YY"
        />
      </div>
      <div className="si-cal" onClick={() => dateInputRef.current?.showPicker()}>
        <Calendar size={12} />
        <input
          type="date"
          ref={dateInputRef}
          className="hidden-date-picker"
          onChange={(e) => {
            if (e.target.value) {
              onChange(new Date(e.target.value + 'T12:00:00'));
            }
          }}
        />
      </div>
    </div>
  );
};

// Map DateInput to SegmentedDateInput for now
const DateInput = SegmentedDateInput;

// --- Main App ---

function App() {

  // --- Initial State from LocalStorage ---
  const getInitialState = () => {
    const saved = localStorage.getItem('work-travel-state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { return {}; }
    }
    return {};
  };
  const initialState = getInitialState();
  const { user, login, logout } = useAuth();

  const [tripName, setTripName] = useState(initialState.tripName || 'Global Tech Summit');
  const [tripWebsite, setTripWebsite] = useState(initialState.tripWebsite || '');
  const [homeCity, setHomeCity] = useState(initialState.homeCity || 'Washington, DC');
  const [homeTimeZone, setHomeTimeZone] = useState(initialState.homeTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [destCity, setDestCity] = useState(initialState.destCity || '');
  const [destTimeZone, setDestTimeZone] = useState(initialState.destTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [registrationFee, setRegistrationFee] = useState(initialState.registrationFee || 0);
  const [registrationCurrency, setRegistrationCurrency] = useState(initialState.registrationCurrency || 'USD');
  const [altCurrency, setAltCurrency] = useState(initialState.altCurrency || 'EUR');
  const [customRates, setCustomRates] = useState(initialState.customRates || MOCK_RATES);
  const [useAlt, setUseAlt] = useState(initialState.useAlt !== undefined ? initialState.useAlt : true);
  const [conferenceCenter, setConferenceCenter] = useState(initialState.conferenceCenter || 'Conference Center');
  const [tripCity, setTripCity] = useState(initialState.tripCity || '');

  const [days, setDays] = useState(() => {
    if (initialState.days) {
      // Strip legs field entirely - transportation is now in separate array
      return initialState.days.map(d => {
        // eslint-disable-next-line no-unused-vars
        const { legs, ...dayWithoutLegs } = d;
        return {
          ...dayWithoutLegs,
          date: new Date(d.date)
        };
      });
    }
    return [
      {
        id: "day-0",
        date: new Date(2026, 3, 12),
        mieBase: 105,
        meals: { B: true, L: true, D: true, I: true },
        hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
        maxLodging: 200,
        registrationFee: 0,
        location: 'Washington DC',
        isForeignMie: false,
        isForeignHotel: false,
        hotelName: 'Stayberry Inn',
        overageCapPercent: 25
      },
      {
        id: "day-1",
        date: new Date(2026, 3, 13),
        mieBase: 105,
        meals: { B: true, L: true, D: true, I: true },
        hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
        maxLodging: 200,
        registrationFee: 750,
        location: 'Washington DC',
        isForeignMie: false,
        isForeignHotel: false,
        hotelName: 'Stayberry Inn',
        overageCapPercent: 25
      },
      {
        id: "day-2",
        date: new Date(2026, 3, 14),
        mieBase: 105,
        meals: { B: true, L: true, D: true, I: true },
        hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
        maxLodging: 200,
        registrationFee: 0,
        location: 'Washington DC',
        isForeignMie: false,
        isForeignHotel: false,
        hotelName: 'Stayberry Inn',
        overageCapPercent: 25
      },
      {
        id: "day-3",
        date: new Date(2026, 3, 15),
        mieBase: 105,
        meals: { B: true, L: true, D: true, I: true },
        hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
        maxLodging: 200,
        registrationFee: 0,
        location: 'Washington DC',
        isForeignMie: false,
        isForeignHotel: false,
        hotelName: 'Stayberry Inn',
        overageCapPercent: 25
      },
      {
        id: "day-4",
        date: new Date(2026, 3, 16),
        mieBase: 105,
        meals: { B: true, L: true, D: true, I: true },
        hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
        maxLodging: 200,
        registrationFee: 0,
        location: 'Washington DC',
        isForeignMie: false,
        isForeignHotel: false,
        hotelName: 'Stayberry Inn',
        overageCapPercent: 25
      },
      {
        id: "day-5",
        date: new Date(2026, 3, 17),
        mieBase: 105,
        meals: { B: true, L: true, D: true, I: true },
        hotelRate: 0, hotelTax: 0, hotelCurrency: 'USD',
        maxLodging: 200,
        location: 'Washington DC',
        isForeignMie: false,
        isForeignHotel: false,
        hotelName: '',
        overageCapPercent: 25
      },
    ];
  });

  const [flights, setFlights] = useState(initialState.flights || []);
  const [hotels, setHotels] = useState(() => {
    if (initialState.hotels) {
      return initialState.hotels.map(h => ({ ...h, checkIn: new Date(h.checkIn), checkOut: new Date(h.checkOut) }));
    }
    return [];
  });

  const [transportation, setTransportation] = useState(() => {
    if (initialState.transportation) {
      return initialState.transportation.map(t => ({
        ...t,
        date: parseLocalDate(t.date) || new Date()
      }));
    }
    return [];
  });

  const flightTotal = useMemo(() => {
    return flights.reduce((sum, f) => sum + (f.cost || 0), 0);
  }, [flights]);

  const [activeId, setActiveId] = useState(null);

  const currentRates = useMemo(() => {
    return useAlt ? customRates : { ...customRates, [altCurrency]: customRates[altCurrency] };
  }, [useAlt, customRates, altCurrency]);

  const currencyOptions = useMemo(() => Object.keys(customRates), [customRates]);

  // --- History Management ---
  const [history, setHistory] = useState({
    past: [],
    future: []
  });

  const saveToHistory = useCallback((currentDays, currentTripName, currentRegistrationFee, currentRegistrationCurrency, currentAltCurrency, currentCustomRates, currentUseAlt, currentFlights, currentFlightTotal, currentHotels, currentHomeCity, currentHomeTZ, currentDestCity, currentDestTZ, currentWebsite, currentConf) => {
    setHistory(prev => ({
      past: [...prev.past.slice(-50), {
        days: currentDays,
        tripName: currentTripName,
        tripWebsite: currentWebsite || tripWebsite,
        registrationFee: currentRegistrationFee,
        registrationCurrency: currentRegistrationCurrency,
        altCurrency: currentAltCurrency,
        customRates: currentCustomRates,
        useAlt: currentUseAlt,
        flights: currentFlights,
        flightTotal: currentFlightTotal,
        hotels: currentHotels,
        homeCity: currentHomeCity,
        homeTimeZone: currentHomeTZ,
        destCity: currentDestCity,
        destTimeZone: currentDestTZ,
        conferenceCenter: currentConf || conferenceCenter
      }],
      future: []
    }));
  }, [tripWebsite, conferenceCenter]);


  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

      setDays(previous.days);
      setTripName(previous.tripName);
      setRegistrationFee(previous.registrationFee);
      setRegistrationCurrency(previous.registrationCurrency);
      setAltCurrency(previous.altCurrency);
      setCustomRates(previous.customRates);
      setUseAlt(previous.useAlt);
      if (previous.flights) setFlights(previous.flights);
      if (previous.hotels) setHotels(previous.hotels.map(h => ({ ...h, checkIn: new Date(h.checkIn), checkOut: new Date(h.checkOut) })));
      // Removed setFlightTotal as it's a derived state (useMemo)

      if (previous.tripWebsite !== undefined) setTripWebsite(previous.tripWebsite);
      if (previous.conferenceCenter !== undefined) setConferenceCenter(previous.conferenceCenter);

      return {
        past: newPast,
        future: [{ days, tripName, tripWebsite, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, conferenceCenter }, ...prev.future]
      };
    });
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone]);


  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      setDays(next.days);
      setTripName(next.tripName);
      setRegistrationFee(next.registrationFee);
      setRegistrationCurrency(next.registrationCurrency);
      setAltCurrency(next.altCurrency);
      setCustomRates(next.customRates);
      setUseAlt(next.useAlt);
      if (next.flights) setFlights(next.flights);
      if (next.hotels) setHotels(next.hotels.map(h => ({ ...h, checkIn: new Date(h.checkIn), checkOut: new Date(h.checkOut) })));
      setHomeCity(next.homeCity);
      setHomeTimeZone(next.homeTimeZone);
      setDestCity(next.destCity);
      setDestTimeZone(next.destTimeZone);
      if (next.tripWebsite !== undefined) setTripWebsite(next.tripWebsite);
      if (next.conferenceCenter !== undefined) setConferenceCenter(next.conferenceCenter);
      // Removed setFlightTotal as it's a derived state (useMemo)

      return {
        past: [...prev.past, { days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter }],
        future: newFuture
      };
    });
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone]);

  const [showMIE, setShowMIE] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Removed mount-time load effect as initialization is now synchronous in useState

  // Auto-save to localStorage
  React.useEffect(() => {
    try {
      const stateData = {
        days,
        tripName,
        tripWebsite,
        homeCity,
        homeTimeZone,
        destCity,
        destTimeZone,
        registrationFee,
        registrationCurrency,
        altCurrency,
        customRates,
        useAlt,
        flights,
        hotels,
        conferenceCenter,
        tripCity,
        transportation
      };
      localStorage.setItem('work-travel-state', JSON.stringify(stateData));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
  }, [days, tripName, tripWebsite, homeCity, homeTimeZone, destCity, destTimeZone, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, hotels, conferenceCenter, transportation]);

  // Debounced Auto-save to Cloud
  React.useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      const tripData = getTripData();
      saveTripToCloud(user, tripData);
    }, 5000); // 5 second debounce for cloud save

    return () => clearTimeout(timer);
  }, [days, tripName, tripWebsite, homeCity, homeTimeZone, destCity, destTimeZone, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, hotels, conferenceCenter, transportation, user]);

  const loadData = useCallback((data) => {
    try {
      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);

      // Only support version 2 (category-based) format
      if (data.version !== 2) {
        alert('This file uses an outdated format. Please export a new file from a recent version of the app.');
        return;
      }

      // Trip metadata
      if (data.trip) {
        if (data.trip.name) setTripName(data.trip.name);
        if (data.trip.website) setTripWebsite(data.trip.website);
        if (data.trip.home?.city) setHomeCity(data.trip.home.city);
        if (data.trip.home?.timeZone) setHomeTimeZone(data.trip.home.timeZone);
        if (data.trip.destination?.city) setDestCity(data.trip.destination.city);
        if (data.trip.destination?.timeZone) setDestTimeZone(data.trip.destination.timeZone);
        if (data.trip.conferenceCenter) setConferenceCenter(data.trip.conferenceCenter);
        if (data.trip.city) setTripCity(data.trip.city);
      }

      // Reconstruct days from mie and lodging arrays (NO legs - deprecated)
      if (data.mie && data.lodging && data.mie.length === data.lodging.length) {
        const reconstructedDays = data.mie.map((m, idx) => {
          const l = data.lodging[idx] || {};
          return {
            id: `day-${idx}`,
            date: new Date(m.date),
            // legs field removed - transportation is in separate array
            mieBase: m.baseRate || 0,
            meals: m.meals || { B: true, L: true, D: true, I: true },
            location: m.location || '',
            isForeignMie: m.isForeign || false,
            hotelRate: l.rate || 0,
            hotelTax: l.tax || 0,
            hotelCurrency: l.currency || 'USD',
            maxLodging: l.maxLodging || 200,
            overageCapPercent: l.overageCapPercent || 25,
            isForeignHotel: l.isForeign || false,
            hotelName: l.hotelName || '',
            registrationFee: 0
          };
        });
        setDays(reconstructedDays);
      }

      // Registration
      if (data.registration) {
        if (data.registration.fee !== undefined) setRegistrationFee(data.registration.fee);
        if (data.registration.currency) setRegistrationCurrency(data.registration.currency);
      }

      // Currency settings
      if (data.currency) {
        if (data.currency.altCurrency) setAltCurrency(data.currency.altCurrency);
        if (data.currency.customRates) setCustomRates(data.currency.customRates);
        if (data.currency.useAlt !== undefined) setUseAlt(data.currency.useAlt);
      }

      // Flights, hotels, transportation
      if (data.flights) setFlights(data.flights);
      if (data.hotels) setHotels(data.hotels.map(h => ({ ...h, checkIn: new Date(h.checkIn), checkOut: new Date(h.checkOut) })));
      if (data.transportation) setTransportation(data.transportation.map(t => ({ ...t, date: parseLocalDate(t.date) || new Date() })));
    } catch (err) {
      console.error('Error loading data:', err);
      alert('Error loading data');
    }
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, saveToHistory, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter]);

  // Handle Keyboard Shortcuts & Drag and Drop
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        document.getElementById('file-input-trigger')?.click();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveToFile();
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/json") {
        if (confirm("Load this trip file? Current state will be saved to history.")) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target.result);
              loadData(data);
            } catch (err) {
              alert('Invalid JSON file');
            }
          };
          reader.readAsText(file);
        }
      }
    };

    const handleDragOver = (e) => e.preventDefault();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [undo, redo, days, tripName, loadData, flights, hotels]);

  const [showCloudPanel, setShowCloudPanel] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const saveTripToCloud = async (user, tripData) => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const { db } = await import('./firebase');
      const { collection, query, where, getDocs, updateDoc, addDoc, doc, serverTimestamp } = await import('firebase/firestore');

      const tripName = tripData.trip.name || 'Untitled Trip';
      const tripDataToSave = {
        ...tripData,
        updatedAt: serverTimestamp(),
        tripName: tripName
      };

      const tripsRef = collection(db, 'users', user.uid, 'trips');
      const q = query(tripsRef, where("tripName", "==", tripName));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docId = querySnapshot.docs[0].id;
        await updateDoc(doc(db, 'users', user.uid, 'trips', docId), tripDataToSave);
        console.log("Auto-saved to cloud:", tripName);
      } else {
        await addDoc(tripsRef, tripDataToSave);
        console.log("Created new cloud trip:", tripName);
      }
      setLastSync(new Date());
    } catch (err) {
      console.error("Cloud auto-save error:", err);
    } finally {
      setIsSyncing(false);
    }
  };


  const getTripData = () => {
    // Build category-based JSON structure
    const tripMeta = {
      name: tripName,
      website: tripWebsite,
      startDate: days[0]?.date?.toISOString() || null,
      endDate: days[days.length - 1]?.date?.toISOString() || null,
      totalDays: days.length,
      home: {
        city: homeCity,
        timeZone: homeTimeZone
      },
      destination: {
        city: destCity,
        timeZone: destTimeZone
      },
      conferenceCenter: conferenceCenter,
      city: tripCity
    };

    // M&IE per-day entries with dates
    const mie = days.map(d => ({
      date: d.date?.toISOString() || null,
      location: d.location,
      baseRate: d.mieBase,
      meals: { ...d.meals },
      isForeign: d.isForeignMie
    }));

    // Lodging per-day entries (for per diem calculations)
    const lodging = days.map(d => ({
      date: d.date?.toISOString() || null,
      rate: d.hotelRate,
      tax: d.hotelTax,
      currency: d.hotelCurrency,
      maxLodging: d.maxLodging,
      overageCapPercent: d.overageCapPercent,
      isForeign: d.isForeignHotel,
      hotelName: d.hotelName
    }));

    // Registration info
    const registration = {
      fee: registrationFee,
      currency: registrationCurrency
    };

    // Currency settings
    const currency = {
      altCurrency: altCurrency,
      customRates: customRates,
      useAlt: useAlt
    };

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      trip: tripMeta,
      flights: flights,
      hotels: hotels.map(h => ({
        ...h,
        checkIn: h.checkIn?.toISOString() || h.checkIn,
        checkOut: h.checkOut?.toISOString() || h.checkOut
      })),
      transportation: transportation.map(t => ({
        ...t,
        date: t.date?.toISOString() || t.date
      })),
      mie: mie,
      lodging: lodging,
      registration: registration,
      currency: currency
    };
  };

  const saveToFile = () => {
    const exportData = getTripData();

    const data = JSON.stringify(exportData, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `travel_${tripName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
    link.click();
  };

  const loadFromFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        loadData(data);
      } catch (err) {
        alert('Error loading file');
      }
    };
    reader.readAsText(file);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setDays((prev) => {
      const activeIdx = prev.findIndex(d => d.id === activeContainer);
      const overIdx = prev.findIndex(d => d.id === overContainer);

      const activeItems = [...(prev[activeIdx].legs || [])];
      const overItems = [...(prev[overIdx].legs || [])];

      const activeItemIdx = activeItems.findIndex(l => l.id === active.id);
      const overItemIdx = overItems.findIndex(l => l.id === over.id);

      let newIndex;
      if (overItems.some(l => l.id === over.id)) {
        newIndex = overItemIdx;
      } else {
        newIndex = overItems.length;
      }

      // Constraints for locked legs
      if (overIdx === 0 && newIndex === 0) {
        newIndex = 1;
      }
      if (overIdx === prev.length - 1 && newIndex >= overItems.length && overItems.length > 0) {
        newIndex = Math.max(0, overItems.length - 1);
      }

      const [item] = activeItems.splice(activeItemIdx, 1);
      overItems.splice(newIndex, 0, item);

      const newDays = [...prev];
      newDays[activeIdx] = { ...prev[activeIdx], legs: activeItems };
      newDays[overIdx] = { ...prev[overIdx], legs: overItems };
      return newDays;
    });
  };

  const findContainer = (id) => {
    if (days.some(d => d.id === id)) return id;
    for (const d of days) {
      if ((d.legs || []).some(l => l.id === id)) return d.id;
    }
    return null;
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (activeContainer && overContainer && activeContainer === overContainer) {
      const dayIdx = days.findIndex(d => d.id === activeContainer);
      const oldIndex = (days[dayIdx].legs || []).findIndex(l => l.id === active.id);
      let newIndex = (days[dayIdx].legs || []).findIndex(l => l.id === over.id);

      // Constraints for locked legs within the same day
      if (dayIdx === 0 && newIndex === 0) newIndex = 1;
      if (dayIdx === days.length - 1 && newIndex === (days[dayIdx].legs || []).length - 1) {
        newIndex = (days[dayIdx].legs || []).length - 2;
      }

      if (oldIndex !== newIndex && newIndex >= 0) {
        setDays((prev) => {
          const newDays = [...prev];
          const updatedLegs = arrayMove(newDays[dayIdx].legs || [], oldIndex, newIndex);
          newDays[dayIdx] = { ...prev[dayIdx], legs: updatedLegs };
          return newDays;
        });
      }
    }

    setActiveId(null);
  };

  const addLeg = (dayIdx) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    setDays(prev => {
      const newDays = [...prev];
      const day = newDays[dayIdx];
      const lastLeg = (day.legs || [])[(day.legs || []).length - 1];
      const newLeg = {
        id: generateId(),
        from: lastLeg?.to || 'Hotel',
        to: 'Site',
        type: 'uber',
        amount: 0,
        currency: 'USD',
        isForeign: false
      };
      newDays[dayIdx] = { ...day, legs: [...(day.legs || []), newLeg] };
      return newDays;
    });
  };

  const addDay = () => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    setDays(prev => {
      const lastDay = prev[prev.length - 1];
      const newDate = addDays(lastDay?.date || new Date(), 1);
      const newDay = {
        ...lastDay,
        id: generateId(),
        date: newDate,
        // NOTE: legs field removed - transportation uses separate array
        registrationFee: 0,
        hotelRate: lastDay?.hotelRate || 0,
        hotelTax: lastDay?.hotelTax || 0,
        hotelCurrency: lastDay?.hotelCurrency || 'USD',
        hotelName: lastDay?.hotelName || '',
      };
      return [...prev, newDay];
    });
  };

  const syncLocationField = (location, field, value) => {
    setDays(prev => prev.map(d => {
      if (d.location === location) {
        return { ...d, [field]: value };
      }
      return d;
    }));
  };

  const toggleLink = (legId) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    setDays(prev => {
      const newDays = JSON.parse(JSON.stringify(prev));
      let targetLeg = null;
      newDays.forEach(d => (d.legs || []).forEach(l => { if (l.id === legId) targetLeg = l }));

      if (targetLeg.mirrorId) {
        const currentMid = targetLeg.mirrorId;
        newDays.forEach(d => (d.legs || []).forEach(l => { if (l.mirrorId === currentMid) l.mirrorId = null }));
      }
      return newDays;
    });
  };

  const updateLeg = useCallback((dayId, legId, field, value) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    setDays((prev) => {
      const newDays = JSON.parse(JSON.stringify(prev));
      const day = newDays.find(d => d.id === dayId);
      const leg = day?.legs.find(l => l.id === legId);
      if (!leg) return prev;

      leg[field] = value;

      // Handle Flight Sync back to main panel
      if (leg.type === 'flight' && (field === 'from' || field === 'to')) {
        if (value.includes(' – ') && value.includes('(')) {
          const match = flights.find(f => {
            const allSegs = [...(f.outbound || []), ...(f.returnSegments || [])];
            const first = allSegs[0];
            const last = allSegs[allSegs.length - 1];
            return `${first?.depPort} – ${last?.arrPort} (${f.airline})` === value;
          });
          if (match) {
            const allSegs = [...(match.outbound || []), ...(match.returnSegments || [])];
            const first = allSegs[0];
            const last = allSegs[allSegs.length - 1];
            leg.from = first?.depPort || '';
            leg.to = last?.arrPort || '';
            leg.amount = match.cost || 0;
            if (allSegs.length > 1) {
              leg.layover = allSegs.slice(0, -1).map(s => s.arrPort).join(', ');
            } else {
              leg.layover = '';
            }

            if (leg.mirrorId) {
              newDays.forEach(d => (d.legs || []).forEach(m => {
                if (m.mirrorId === leg.mirrorId && m.id !== leg.id) {
                  m.from = leg.to;
                  m.to = leg.from;
                  m.amount = 0;
                  m.layover = leg.layover;
                }
              }));
            }
          }
        } else {
          const otherField = field === 'from' ? 'to' : 'from';
          if (leg[otherField]) {
            setFlights(prevFlights => {
              const exists = prevFlights.find(f => {
                const allSegs = [...(f.outbound || []), ...(f.returnSegments || [])];
                const first = allSegs[0];
                const last = allSegs[allSegs.length - 1];
                return first?.depPort === leg.from && last?.arrPort === leg.to;
              });
              if (!exists) {
                return [...prevFlights, {
                  id: generateId(),
                  airline: 'Manual',
                  confirmation: '',
                  cost: 0,
                  outbound: [{
                    id: generateId(),
                    airlineCode: '',
                    flightNumber: '',
                    depDate: format(day.date, 'yyyy-MM-dd'),
                    depTime: '',
                    depPort: leg.from,
                    arrDate: format(day.date, 'yyyy-MM-dd'),
                    arrTime: '',
                    arrPort: leg.to
                  }],
                  returnSegments: []
                }];
              }
              return prevFlights;
            });
          }
        }
      }

      if (field === 'isForeign') {
        leg.currency = value ? altCurrency : 'USD';
      }

      if (leg.mirrorId) {
        newDays.forEach(d => (d.legs || []).forEach(m => {
          if (m.mirrorId === leg.mirrorId && m.id !== leg.id) {
            if (field === 'from') m.to = value;
            if (field === 'to') m.from = value;
            if (field === 'type' || field === 'amount' || field === 'currency' || field === 'isForeign') m[field] = value;
          }
        }));
      }

      const lIdx = (day.legs || []).findIndex(l => l.id === legId);
      if (field === 'to' && (day.legs || [])[lIdx + 1]) {
        (day.legs || [])[lIdx + 1].from = value;
      }
      if (field === 'from' && (day.legs || [])[lIdx - 1]) {
        (day.legs || [])[lIdx - 1].to = value;
      }

      return newDays;
    });
  }, [tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, saveToHistory, hotels]);

  const handleStartDateChange = (newStart) => {
    if (!newStart || isNaN(newStart.getTime())) return;
    const oldStart = (days && days[0]) ? days[0].date : null;
    if (!oldStart || isNaN(oldStart.getTime())) return;

    const diff = differenceInCalendarDays(newStart, oldStart);
    if (diff === 0 || isNaN(diff)) return;

    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);

    const updateSegDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        let d = null;
        if (dateStr.includes('-')) {
          d = parse(dateStr, 'yyyy-MM-dd', new Date());
        } else if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          let y = parseInt(parts[2]);
          if (y < 100) y += 2000;
          d = new Date(y, parseInt(parts[0]) - 1, parseInt(parts[1]), 12, 0, 0);
        } else {
          const year = oldStart.getFullYear();
          d = parse(dateStr, 'EEE MMM d', new Date(year, 0, 1));
          if (isNaN(d.getTime())) d = new Date(dateStr + ', ' + year);
        }
        if (!d || isNaN(d.getTime())) return dateStr;

        const shifted = addDays(d, diff);
        return format(shifted, 'yyyy-MM-dd');
      } catch (e) { return dateStr; }
    };

    // Update Days
    setDays(prev => prev.map(d => ({ ...d, date: addDays(d.date, diff) })));

    // Update Hotels
    setHotels(prev => prev.map(h => ({
      ...h,
      checkIn: addDays(h.checkIn, diff),
      checkOut: addDays(h.checkOut, diff)
    })));

    // Update Flights
    setFlights(prev => prev.map(f => ({
      ...f,
      outbound: (f.outbound || []).map(s => ({
        ...s,
        depDate: updateSegDate(s.depDate),
        arrDate: updateSegDate(s.arrDate)
      })),
      returnSegments: (f.returnSegments || []).map(s => ({
        ...s,
        depDate: updateSegDate(s.depDate),
        arrDate: updateSegDate(s.arrDate)
      }))
    })));

    // Shift hotels
    setHotels(prev => (prev || []).map(h => ({
      ...h,
      checkIn: addDays(h.checkIn, diff),
      checkOut: addDays(h.checkOut, diff)
    })));
  };

  const handleEndDateChange = (newEnd) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    const newCount = differenceInCalendarDays(newEnd, days[0].date) + 1;
    if (newCount <= 0) return;

    setDays(prev => {
      if (newCount > prev.length) {
        let last = prev[prev.length - 1];
        let added = [];
        for (let i = 1; i <= newCount - prev.length; i++) {
          added.push({
            ...last,
            id: generateId(),
            date: addDays(last.date, i),
            // NOTE: legs field removed - transportation uses separate array
            registrationFee: 0
          });
        }
        return [...prev, ...added];
      } else {
        return prev.slice(0, newCount);
      }
    });
  };

  const addFlightLeg = () => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    setFlights(prev => {

      const outboundDate = days[0] ? format(days[0].date, 'yyyy-MM-dd') : '';
      const returnDate = days[days.length - 1] ? format(days[days.length - 1].date, 'yyyy-MM-dd') : '';

      const newFlight = {
        id: generateId(),
        airline: '',
        confirmation: '',
        cost: 0,
        outbound: [
          {
            id: generateId(),
            airlineCode: '',
            flightNumber: '',
            seat: '',
            depDate: outboundDate,
            depTime: '10:00a',
            depPort: '',
            arrDate: outboundDate,
            arrTime: '2:00p',
            arrPort: ''
          }
        ],
        returnSegments: [
          {
            id: generateId(),
            airlineCode: '',
            flightNumber: '',
            seat: '',
            depDate: returnDate,
            depTime: '4:00p',
            depPort: '',
            arrDate: returnDate,
            arrTime: '8:00p',
            arrPort: ''
          }
        ]
      };

      // Auto-update hotel dates when flights are added
      setHotels(hPrev => {
        if (hPrev.length === 0) return hPrev;
        return hPrev.map((h, idx) => {
          if (idx === 0) {
            return { ...h, checkIn: days[0].date, checkOut: days[days.length - 1].date };
          }
          return h;
        });
      });

      return [...prev, newFlight];
    });
  };



  const deleteFlight = (id) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    setFlights(prev => prev.filter(f => f.id !== id));
  };

  const updateFlight = (id, updatesOrField, value) => {
    setFlights(prev => {
      return prev.map(f => {
        if (f.id !== id) return f;

        // Support both (field, value) and (updatesObject) patterns
        let updates = {};
        if (typeof updatesOrField === 'string') {
          updates[updatesOrField] = value;
        } else {
          updates = updatesOrField;
        }

        let newF = { ...f, ...updates };

        // Only deep-clone and mirror for segment array updates
        if (updates.outbound || updates.returnSegments) {
          // Clone the updated arrays
          const out = (newF.outbound || []).map(s => ({ ...s }));
          const ret = (newF.returnSegments || []).map(s => ({ ...s }));

          // Only run mirroring logic if both legs exist
          if (out.length > 0 && ret.length > 0) {
            const sOut = out[0];
            const sRet = ret[ret.length - 1];

            const mirror = (src, tgt) => {
              if (!src) return tgt;
              if (!tgt || src.startsWith(tgt) || tgt.startsWith(src)) return src;
              return tgt;
            };

            sRet.arrPort = mirror(sOut.depPort, sRet.arrPort);
            ret[0].depPort = mirror(out[out.length - 1].arrPort, ret[0].depPort);
          }

          newF.outbound = out;
          newF.returnSegments = ret;
        }
        return newF;
      });
    });
  };


  const handleFlightDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFlights((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const next = arrayMove(items, oldIndex, newIndex);
        return next;
      });
    }
  };

  // Auto-populate Travel Legs based on Flights
  React.useEffect(() => {
    if (!days || days.length === 0 || !flights) return;

    let globalChanged = false;
    const nextDays = days.map((day, dIdx) => {
      const dayStr = safeFormat(day.date, 'yyyy-MM-dd');
      let currentNonAutoLegs = (day.legs || []).filter(l => !l.auto);
      const neededAutoLegs = [];

      flights.forEach((f) => {
        const allSegments = [...(f.outbound || []), ...(f.returnSegments || [])];
        allSegments.forEach((seg, sIdx) => {
          if (!seg.depPort || !seg.arrPort) return;

          const segDepDateStr = parseSegDate(seg.depDate);
          const segArrDateStr = parseSegDate(seg.arrDate);
          if (!segDepDateStr || !segArrDateStr) return;

          const isOutbound = f.outbound && f.outbound.includes(seg);
          const isReturn = f.returnSegments && f.returnSegments.includes(seg);

          // Get timezones for ports using airport database
          const depPortTZ = getPortTZ(seg.depPort, homeCity, destCity, homeTimeZone, destTimeZone);
          const arrPortTZ = getPortTZ(seg.arrPort, homeCity, destCity, homeTimeZone, destTimeZone);

          // Determine if departure/arrival is from/to home based on timezone
          let isDepHome = depPortTZ === homeTimeZone;
          if (isOutbound && sIdx === 0) isDepHome = true;
          if (isReturn && sIdx === allSegments.length - 1) isDepHome = false;

          let isArrHome = arrPortTZ === homeTimeZone;
          if (isOutbound && sIdx === (f.outbound.length - 1)) isArrHome = false;
          if (isReturn && seg === f.returnSegments[f.returnSegments.length - 1]) isArrHome = true;

          // Parse flight times
          const flDepTime = parseTime(seg.depTime);
          const flArrTime = parseTime(seg.arrTime);
          if (flDepTime === null || flArrTime === null) return;

          // Calculate uber ride start time in the appropriate LOCAL airport time
          // Departure: ride starts rideDur + waitAtAirport hours BEFORE flight
          // The ride is in the departure port's timezone
          const depRideDur = isDepHome ? 1 : 0.5;  // 1hr from home, 30min from hotel
          const waitAtAirport = 3;  // WORK TRAVEL.md: Get to airport 3 hours before
          const depRideStartLocal = (flDepTime - waitAtAirport - depRideDur + 24) % 24;

          // Arrival: ride starts waitAfterArrival hours AFTER arrival
          // The ride is in the arrival port's timezone
          const arrRideDur = isArrHome ? 1 : 0.5;  // 1hr to home, 30min to hotel
          const waitAfterArrival = 1;  // WORK TRAVEL.md: Leave airport 1 hour after arrival
          const arrRideStartLocal = (flArrTime + waitAfterArrival) % 24;

          // Convert departure local time to home timezone to determine the calendar day
          // The ride START time determines which day it appears on
          // Create a date at the local departure time, then convert to home TZ
          const depDate = new Date(segDepDateStr + 'T12:00:00');
          const depShift = getTZOffset(depDate, depPortTZ, homeTimeZone);
          const depRideHomeTime = (depRideStartLocal - depShift + 24) % 24;
          // If the home time goes past midnight, adjust the day
          const depDayAdjust = depRideHomeTime < depRideStartLocal && depShift > 0 ? 1 :
            depRideHomeTime > depRideStartLocal && depShift < 0 ? -1 : 0;
          const depHomeDateStr = (() => {
            const d = new Date(segDepDateStr + 'T12:00:00');
            d.setDate(d.getDate() + depDayAdjust);
            return format(d, 'yyyy-MM-dd');
          })();

          // Similarly for arrival
          const arrDate = new Date(segArrDateStr + 'T12:00:00');
          const arrShift = getTZOffset(arrDate, arrPortTZ, homeTimeZone);
          const arrRideHomeTime = (arrRideStartLocal - arrShift + 24) % 24;
          // If the home time goes past midnight, adjust the day
          const arrDayAdjust = arrRideHomeTime < arrRideStartLocal && arrShift > 0 ? 1 :
            arrRideHomeTime > arrRideStartLocal && arrShift < 0 ? -1 : 0;
          const arrHomeDateStr = (() => {
            const d = new Date(segArrDateStr + 'T12:00:00');
            d.setDate(d.getDate() + arrDayAdjust);
            return format(d, 'yyyy-MM-dd');
          })();

          // Add departure leg (ride to airport) on the appropriate home-timezone day
          if (depHomeDateStr === dayStr) {
            neededAutoLegs.push({
              from: isDepHome ? 'Home' : 'Hotel',
              to: seg.depPort,
              type: 'uber',
              time: formatTime(depRideStartLocal),  // Store in local airport time
              duration: depRideDur * 60,
              amount: 45,
              currency: 'USD',
              auto: true,
              isHome: isDepHome  // Flag for timezone handling
            });
          }

          // Add arrival leg (ride from airport) on the appropriate home-timezone day
          if (arrHomeDateStr === dayStr) {
            neededAutoLegs.push({
              from: seg.arrPort,
              to: isArrHome ? 'Home' : 'Hotel',
              type: 'uber',
              time: formatTime(arrRideStartLocal),  // Store in local airport time
              duration: arrRideDur * 60,
              amount: 45,
              currency: 'USD',
              auto: true,
              isHome: isArrHome  // Flag for timezone handling
            });
          }
        });
      });

      // Match needed with existing to preserve IDs
      let dayChanged = false;
      const existingAutoLegs = (day.legs || []).filter(l => l.auto);
      const finalLegs = [...currentNonAutoLegs];

      neededAutoLegs.forEach(needed => {
        const foundIdx = existingAutoLegs.findIndex(ex => ex.from === needed.from && ex.to === needed.to);
        if (foundIdx >= 0) {
          const matched = existingAutoLegs.splice(foundIdx, 1)[0];
          if (matched.time !== needed.time || matched.duration !== needed.duration || matched.from !== needed.from || matched.to !== needed.to) {
            dayChanged = true;
          }
          finalLegs.push({ ...matched, ...needed });
        } else {
          finalLegs.push({ id: generateId(), ...needed });
          dayChanged = true;
        }
      });

      if (existingAutoLegs.length > 0) dayChanged = true;

      if (dayChanged) {
        globalChanged = true;
        return { ...day, legs: finalLegs };
      }
      return day;
    });

    if (globalChanged) {
      setDays(nextDays);
      saveToHistory(nextDays, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
    }
  }, [flights, homeCity, destCity, homeTimeZone, destTimeZone, days.length]);

  // Ensure trip covers all flight segments
  React.useEffect(() => {
    if (days.length === 0) return;
    let maxDateStr = format(days[days.length - 1].date, 'yyyy-MM-dd');
    let needsUpdate = false;
    let newEnd = days[days.length - 1].date;

    flights.forEach(f => {
      const allSegs = [...(f.outbound || []), ...(f.returnSegments || [])];
      allSegs.forEach(s => {
        const arrDateStr = parseSegDate(s.arrDate);
        if (arrDateStr && arrDateStr > maxDateStr) {
          needsUpdate = true;
          maxDateStr = arrDateStr;
          newEnd = parse(arrDateStr, 'yyyy-MM-dd', new Date());
        }
      });
    });

    if (needsUpdate) {
      handleEndDateChange(newEnd);
    }
  }, [flights, days.length]);


  // Auto-populate Hotels based on Flights
  React.useEffect(() => {
    let arrivalDate = null;
    let departureDate = null;
    let hotelName = 'Stayberry Inn';

    const segments = flights.flatMap(f => [...(f.outbound || []), ...(f.returnSegments || [])]);
    if (segments.length === 0) return;

    const sorted = segments.map(s => {
      const dep = parseSegDate(s.depDate);
      const arr = parseSegDate(s.arrDate);
      return { dep, arr, ...s };
    })
      .filter(s => s.dep && s.arr) // Filter out segments with null dates
      .sort((a, b) => a.arr.localeCompare(b.arr));

    const firstArrSeg = sorted.find(s => s.arrPort && s.arrPort.toLowerCase() !== 'home');
    const lastDepSeg = [...sorted].reverse().find(s => s.depPort && s.depPort.toLowerCase() !== 'home');

    if (firstArrSeg && lastDepSeg && firstArrSeg.arr && lastDepSeg.dep) {
      arrivalDate = parse(firstArrSeg.arr, 'yyyy-MM-dd', new Date());
      departureDate = parse(lastDepSeg.dep, 'yyyy-MM-dd', new Date());
    }


    if (arrivalDate && departureDate) {
      setHotels(prev => {
        if (prev.length === 0) {
          return [{
            id: 'h-auto',
            name: hotelName,
            checkIn: arrivalDate,
            checkInTime: '2:00p',
            checkOut: departureDate,
            checkOutTime: '11:00a',
            cost: 185 * Math.max(1, differenceInDays(departureDate, arrivalDate)),
            currency: 'USD'
          }];
        }
        return prev;
      });
    }

    setDays(prevDays => {
      const updatedDays = autoPopulateHotels(flights, prevDays, {
        rate: prevDays.find(d => d.hotelRate > 0)?.hotelRate || 185,
        tax: prevDays.find(d => d.hotelTax > 0)?.hotelTax || 25,
        currency: prevDays.find(d => d.hotelCurrency)?.hotelCurrency || 'USD'
      });
      if (JSON.stringify(updatedDays) !== JSON.stringify(prevDays)) {
        return updatedDays;
      }
      return prevDays;
    });
  }, [flights, days]);

  // Auto-detect time zones and destination city from airports
  React.useEffect(() => {
    if (flights.length === 0) return;

    // Find first outbound departure airport for home timezone
    const firstOutbound = flights.find(f => f.outbound && f.outbound.length > 0);
    if (firstOutbound && firstOutbound.outbound[0]?.depPort) {
      const homeAirportTZ = getAirportTimezone(firstOutbound.outbound[0].depPort);
      if (homeAirportTZ && homeAirportTZ !== homeTimeZone) {
        setHomeTimeZone(homeAirportTZ);
      }
    }

    // Find last arrival airport of outbound for destination timezone and city
    if (firstOutbound && firstOutbound.outbound.length > 0) {
      const lastOutboundSeg = firstOutbound.outbound[firstOutbound.outbound.length - 1];
      if (lastOutboundSeg?.arrPort) {
        const destAirportTZ = getAirportTimezone(lastOutboundSeg.arrPort);
        if (destAirportTZ && destAirportTZ !== destTimeZone) {
          setDestTimeZone(destAirportTZ);
        }
        // Auto-detect destination city from airport for per diem lookups
        const detectedCity = getCityFromAirport(lastOutboundSeg.arrPort) || getAirportCity(lastOutboundSeg.arrPort);
        if (detectedCity && detectedCity !== destCity) {
          setDestCity(detectedCity);
        }
      }
    }
  }, [flights]);

  // Auto-populate Transportation based on Flights
  // Rules from WORK TRAVEL.md:
  // - Get to airport 3 hours before flight (in local time zone)
  // - Leave airport 1 hour after arrival
  // - Home <-> Airport takes 1 hour
  // - Hotel <-> Airport takes 30 minutes
  React.useEffect(() => {
    if (flights.length === 0) return;

    const allSegments = flights.flatMap(f => [
      ...(f.outbound || []).map(s => ({ ...s, isOutbound: true })),
      ...(f.returnSegments || []).map(s => ({ ...s, isOutbound: false }))
    ]).filter(s => s.depDate && s.depTime);

    if (allSegments.length === 0) return;

    // Helper to parse date and time
    const parseFlightDateTime = (dateStr, timeStr) => {
      if (!dateStr || !timeStr) return null;
      const date = parseSegDate(dateStr);
      if (!date) return null;
      const time = parseTime(timeStr);
      if (time === null) return null;
      const d = new Date(date + 'T00:00:00');
      d.setHours(Math.floor(time), Math.round((time % 1) * 60), 0, 0);
      return d;
    };

    // Helper to subtract hours and get new time string
    const subtractHours = (timeStr, hours) => {
      const t = parseTime(timeStr);
      if (t === null) return timeStr;
      return formatTime(t - hours);
    };

    // Helper to add hours and get new time string
    const addHoursToTime = (timeStr, hours) => {
      const t = parseTime(timeStr);
      if (t === null) return timeStr;
      return formatTime(t + hours);
    };

    // Generate transportation items
    const newTransport = [];

    // Group segments by departure date
    const firstOutbound = allSegments.find(s => s.isOutbound);
    const lastReturn = [...allSegments].reverse().find(s => !s.isOutbound);
    const firstArrival = allSegments.find(s => s.isOutbound && s.arrDate);
    const lastDeparture = [...allSegments].reverse().find(s => !s.isOutbound && s.depDate);

    // Outbound: Home -> Airport (arrive 3 hours before flight, 1 hour drive)
    if (firstOutbound && firstOutbound.depDate && firstOutbound.depTime) {
      const depTime = parseTime(firstOutbound.depTime);
      if (depTime !== null) {
        // Leave home 3+1=4 hours before flight
        const leaveHomeTime = formatTime(depTime - 4);
        const arriveAirportTime = formatTime(depTime - 3);
        const depDate = parseSegDate(firstOutbound.depDate);

        newTransport.push({
          id: 't-out-home-airport',
          type: 'uber',
          fromEmoji: '🏡',
          toEmoji: '✈️',
          description: `To ${firstOutbound.depPort || 'Airport'}`,
          date: depDate ? new Date(depDate + 'T00:00:00') : new Date(),
          time: leaveHomeTime,
          endTime: arriveAirportTime,
          duration: 60,
          cost: 0,
          currency: 'USD',
          isHome: true
        });
      }
    }

    // First arrival at destination: Airport -> Hotel (1 hour after arrival, 30 min ride)
    if (firstArrival && firstArrival.arrDate && firstArrival.arrTime) {
      const arrTime = parseTime(firstArrival.arrTime);
      if (arrTime !== null) {
        const leaveAirportTime = formatTime(arrTime + 1);
        const arriveHotelTime = formatTime(arrTime + 1.5);
        const arrDate = parseSegDate(firstArrival.arrDate);

        newTransport.push({
          id: 't-out-airport-hotel',
          type: 'uber',
          fromEmoji: '✈️',
          toEmoji: '🏨',
          description: `From ${firstArrival.arrPort || 'Airport'}`,
          date: arrDate ? new Date(arrDate + 'T00:00:00') : new Date(),
          time: leaveAirportTime,
          endTime: arriveHotelTime,
          duration: 30,
          cost: 0,
          currency: 'USD',
          isHome: false
        });
      }
    }

    // Return: Hotel -> Airport (3 hours before return flight, 30 min ride)
    if (lastDeparture && lastDeparture.depDate && lastDeparture.depTime) {
      const depTime = parseTime(lastDeparture.depTime);
      if (depTime !== null) {
        const leaveHotelTime = formatTime(depTime - 3.5);
        const arriveAirportTime = formatTime(depTime - 3);
        const depDate = parseSegDate(lastDeparture.depDate);

        newTransport.push({
          id: 't-ret-hotel-airport',
          type: 'uber',
          fromEmoji: '🏨',
          toEmoji: '✈️',
          description: `To ${lastDeparture.depPort || 'Airport'}`,
          date: depDate ? new Date(depDate + 'T00:00:00') : new Date(),
          time: leaveHotelTime,
          endTime: arriveAirportTime,
          duration: 30,
          cost: 0,
          currency: 'USD',
          isHome: false
        });
      }
    }

    // Last arrival home: Airport -> Home (1 hour after arrival, 1 hour drive)
    if (lastReturn && lastReturn.arrDate && lastReturn.arrTime) {
      const arrTime = parseTime(lastReturn.arrTime);
      if (arrTime !== null) {
        const leaveAirportTime = formatTime(arrTime + 1);
        const arriveHomeTime = formatTime(arrTime + 2);
        const arrDate = parseSegDate(lastReturn.arrDate);

        newTransport.push({
          id: 't-ret-airport-home',
          type: 'uber',
          fromEmoji: '✈️',
          toEmoji: '🏡',
          description: `From ${lastReturn.arrPort || 'Airport'}`,
          date: arrDate ? new Date(arrDate + 'T00:00:00') : new Date(),
          time: leaveAirportTime,
          endTime: arriveHomeTime,
          duration: 60,
          cost: 0,
          currency: 'USD',
          isHome: true
        });
      }
    }

    // Only auto-populate if transportation is empty
    setTransportation(prev => {
      if (prev.length === 0 && newTransport.length > 0) {
        return newTransport;
      }
      // Update existing auto-generated items but keep user-added ones
      const userItems = prev.filter(t => !t.id.startsWith('t-out-') && !t.id.startsWith('t-ret-'));
      const existingAutoIds = prev.filter(t => t.id.startsWith('t-out-') || t.id.startsWith('t-ret-')).map(t => t.id);

      // If user has deleted an auto item, don't re-add it
      // Only update times for existing auto items
      if (existingAutoIds.length > 0 || userItems.length > 0) {
        const updatedAuto = newTransport.filter(nt => existingAutoIds.includes(nt.id)).map(nt => {
          const existing = prev.find(p => p.id === nt.id);
          // Preserve user edits to cost, currency, and date; update times from flights
          return existing ? { ...nt, cost: existing.cost, currency: existing.currency, date: existing.date } : nt;
        });
        return [...userItems, ...updatedAuto];
      }
      return prev;
    });
  }, [flights]);


  const totals = useMemo(() => {
    let registration = convertCurrency(registrationFee, registrationCurrency, 'USD', currentRates);
    let fl = flights.reduce((sum, f) => sum + (f.cost || 0), 0);
    let travel = 0;
    let mieTotal = 0;

    days.forEach((day, idx) => {
      // M&IE
      mieTotal += calculateMIE(idx, days.length, day.mieBase, day.meals, day.isForeignMie);

      // Travel legs
      (day.legs || []).forEach(l => {
        if (l.type !== 'flight') {
          travel += convertCurrency(l.amount * (l.type === 'drive' ? MI_RATE : 1), l.currency, 'USD', currentRates);
        }
      });
    });

    // Hotels - handle different cost modes
    const hotelTotal = hotels.reduce((acc, h) => {
      const costMode = h.costMode || 'perNight';
      let totalCost = 0;

      if (costMode === 'perNight') {
        // Multiply cost by number of nights
        const nights = h.checkIn && h.checkOut
          ? differenceInCalendarDays(h.checkOut, h.checkIn)
          : 0;
        totalCost = (h.cost || 0) * nights;
      } else if (costMode === 'total') {
        // Use cost as total
        totalCost = h.cost || 0;
      } else if (costMode === 'perDay') {
        // Sum up daily costs
        const dailyCosts = h.dailyCosts || {};
        totalCost = Object.values(dailyCosts).reduce((sum, dayCost) => sum + (dayCost || 0), 0);
      }

      return acc + convertCurrency(totalCost, h.currency || 'USD', 'USD', currentRates);
    }, 0);

    // Transportation (from new Transportation panel)
    const transportTotal = transportation.reduce((acc, t) => {
      return acc + convertCurrency(t.cost || 0, t.currency || 'USD', 'USD', currentRates);
    }, 0);

    return {
      grand: registration + fl + travel + mieTotal + hotelTotal + transportTotal,
      registration,
      flights: fl,
      travel: travel + transportTotal,
      mie: mieTotal,
      lodging: hotelTotal,
    };
  }, [days, flights, hotels, transportation, registrationFee, registrationCurrency, currentRates]);

  const isDifferentTZ = homeTimeZone !== destTimeZone;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="travel-app dark">
        <main className="one-column-layout">
          <section className="trip-header-section glass">
            <div className="app-version" style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '4px', textAlign: 'center', width: '100%', fontFamily: 'monospace' }}>Work Travel: version {APP_VERSION}</div>

            <div className="action-bar" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button
                className="action-btn"
                onClick={undo}
                disabled={history.past.length === 0}
                title="Undo (Cmd/Ctrl+Z)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: history.past.length === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '6px',
                  color: history.past.length === 0 ? '#64748b' : '#a5b4fc',
                  cursor: history.past.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  opacity: history.past.length === 0 ? 0.5 : 1
                }}
              >
                <Undo2 size={14} /> Undo
              </button>
              <button
                className="action-btn"
                onClick={redo}
                disabled={history.future.length === 0}
                title="Redo (Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: history.future.length === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '6px',
                  color: history.future.length === 0 ? '#64748b' : '#a5b4fc',
                  cursor: history.future.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  opacity: history.future.length === 0 ? 0.5 : 1
                }}
              >
                <Redo2 size={14} /> Redo
              </button>
              <button
                onClick={() => {
                  if (confirm('Start a new trip? Your current trip will be saved to history (Undo will bring it back).')) {
                    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels, homeCity, homeTimeZone, destCity, destTimeZone, tripWebsite, conferenceCenter);
                    // Reset to default state
                    setTripName('New Trip');
                    setTripWebsite('');
                    setConferenceCenter('Conference Center');
                    setDays([{
                      id: "day-0",
                      date: new Date(),
                      mieBase: 105,
                      meals: { B: true, L: true, D: true, I: true },
                      hotelRate: 0, hotelTax: 0, hotelCurrency: 'USD',
                      maxLodging: 200,
                      registrationFee: 0,
                      location: '',
                      isForeignMie: false,
                      isForeignHotel: false,
                      hotelName: '',
                      overageCapPercent: 25
                    }]);
                    setFlights([]);
                    setHotels([]);
                    setTransportation([]);
                  }
                }}
                title="Start a new trip"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '6px',
                  color: '#a5b4fc',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                <FileText size={14} /> New
              </button>
              <label
                className="hide-on-mobile"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '6px',
                  color: '#a5b4fc',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                title="Load from file"
              >
                <FolderOpen size={14} /> Load
                <input type="file" id="file-input-trigger" accept="application/json" onChange={loadFromFile} style={{ display: 'none' }} />
              </label>
              <button
                className="action-btn hide-on-mobile"
                onClick={saveToFile}
                title="Save to file (Cmd/Ctrl+S)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '6px',
                  color: '#a5b4fc',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                <Save size={14} /> Save
              </button>

              {/* Cloud Button with Status Indicator */}
              <button
                className={`action-btn ${showCloudPanel ? 'active' : ''}`}
                onClick={() => setShowCloudPanel(!showCloudPanel)}
                title={user ? (isSyncing ? 'Syncing...' : lastSync ? `Last synced: ${lastSync.toLocaleTimeString()}` : 'Cloud Trips') : 'Sign in to sync'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  background: showCloudPanel ? 'rgba(129, 140, 248, 0.4)' : 'rgba(129, 140, 248, 0.1)',
                  border: `1px solid ${user && lastSync ? 'rgba(16, 185, 129, 0.4)' : 'rgba(129, 140, 248, 0.3)'}`,
                  borderRadius: '6px',
                  color: user && lastSync ? '#10b981' : '#818cf8',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {isSyncing ? (
                  <RefreshCcw size={14} className="spin" />
                ) : (
                  <Cloud size={14} fill={user && lastSync && !isSyncing ? 'currentColor' : 'none'} />
                )}
                Cloud
              </button>
            </div>

            {showCloudPanel && (
              <CloudTrips
                currentTripData={getTripData()}
                isSyncing={isSyncing}
                lastSync={lastSync}
                onLoadTrip={(data) => {
                  loadData(data);
                  setShowCloudPanel(false);
                }}
              />
            )}

            <div className="trip-header-container">
              <div className="trip-header-main">
                <input
                  className="trip-name-display"
                  value={tripName}
                  onChange={e => setTripName(e.target.value)}
                />

                <div className="website-row">
                  <Link2 size={14} className="web-icon" />
                  <input
                    className="trip-web-input"
                    value={tripWebsite}
                    onChange={e => setTripWebsite(e.target.value)}
                    placeholder="Website (Optional)"
                  />
                </div>

                <div className="trip-meta-row-vertical">
                  <div className="header-dates-row">
                    <DateRangePicker
                      startDate={days[0].date}
                      endDate={days[days.length - 1].date}
                      onStartChange={handleStartDateChange}
                      onEndChange={handleEndDateChange}
                    />
                  </div>
                  <div className="city-block" style={{ width: '100%', marginTop: '8px' }}>
                    <div className="city-row" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '6px' }}>
                      <span className="city-icon"><MapPin size={12} /></span>
                      <input
                        className="city-input"
                        value={tripCity}
                        onChange={(e) => setTripCity(e.target.value)}
                        placeholder="City (e.g. Paris, London)"
                        style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                  <div className="conf-center-block" style={{ width: '100%' }}>
                    <div className="conf-center-row" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '6px' }}>
                      <span className="conf-icon"><Briefcase size={12} /></span>
                      <input
                        className="conf-input"
                        value={conferenceCenter}
                        onChange={(e) => setConferenceCenter(e.target.value)}
                        placeholder="Conference Center"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(conferenceCenter + (tripCity ? ', ' + tripCity : ''))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="conf-map-link"
                        title="Open in Google Maps"
                      >
                        <Navigation size={12} />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Location and timezone selectors removed - now auto-detected from airport codes */}
              </div>


            </div>
          </section>

          <section className="timeline-section-panel glass">
            <div className="timeline-header-row">
              <div className="section-title"><Calendar size={16} /> TIMELINE</div>
            </div>
            <ContinuousTimeline
              days={days}
              flights={flights}
              hotels={hotels}
              transportation={transportation}
              showMIE={false}
              onEditEvent={(ev) => setEditingEvent(ev)}
              onUpdateMeals={(dayId, meal) => {
                setDays(prev => prev.map(d => d.id === dayId ? { ...d, meals: { ...d.meals, [meal]: !d.meals[meal] } } : d));
              }}
              homeTimeZone={homeTimeZone}
              destTimeZone={destTimeZone}
              homeCity={homeCity}
              destCity={destCity}
              currentRates={currentRates}
            />

            {editingEvent && (
              <div className="edit-overlay glass" onClick={() => setEditingEvent(null)}>
                <div className="edit-modal" onClick={e => e.stopPropagation()}>
                  <div className="edit-modal-header">
                    <h3>EDIT {editingEvent.type.toUpperCase()}</h3>
                    <button className="close-btn" onClick={() => setEditingEvent(null)}><X size={16} /></button>
                  </div>
                  <div className="edit-modal-content">
                    {editingEvent.type === 'flight' && (
                      <div className="simple-edit-form">
                        <p>Go to the <b>Flights</b> section below to edit this flight ({editingEvent.id})</p>
                        <button className="btn-primary" onClick={() => {
                          document.querySelector('.flights-section-panel').scrollIntoView({ behavior: 'smooth' });
                          setEditingEvent(null);
                        }}>GO TO FLIGHTS</button>
                      </div>
                    )}
                    {editingEvent.type === 'hotel' && (
                      <div className="simple-edit-form">
                        <p>Go to the <b>Hotels</b> section below to edit this hotel ({editingEvent.id})</p>
                        <button className="btn-primary" onClick={() => {
                          document.querySelector('.hotels-section-panel').scrollIntoView({ behavior: 'smooth' });
                          setEditingEvent(null);
                        }}>GO TO HOTELS</button>
                      </div>
                    )}
                    {editingEvent.type === 'leg' && (
                      <div className="simple-edit-form">
                        <p>Travel legs can be edited in the daily plan sections (not implemented as separate section yet, please use main panel if available)</p>
                        {/* For now just a placeholder */}
                      </div>
                    )}
                    {editingEvent.type === 'transportation' && (
                      <div className="simple-edit-form">
                        <p>Go to the <b>Transportation</b> section below to edit this trip ({editingEvent.id})</p>
                        <button className="btn-primary" onClick={() => {
                          document.querySelector('.transportation-section-panel').scrollIntoView({ behavior: 'smooth' });
                          setEditingEvent(null);
                        }}>GO TO TRANSPORTATION</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="flights-section-panel">
            <FlightPanel
              flights={flights}
              totalCost={flightTotal}
              onUpdate={updateFlight}
              onDelete={deleteFlight}
              onAdd={addFlightLeg}
              dragEndHandler={handleFlightDragEnd}
              tripDates={days.map(d => d.date)}
              homeCity={homeCity}
              destCity={destCity}
              homeTimeZone={homeTimeZone}
              destTimeZone={destTimeZone}
            />
          </section>

          <section className="hotels-section-panel">
            <HotelPanel
              hotels={hotels}
              onUpdate={(id, f, v) => setHotels(prev => prev.map(h => h.id === id ? { ...h, [f]: v } : h))}
              onDelete={(id) => setHotels(prev => prev.filter(h => h.id !== id))}
              onAdd={() => setHotels(prev => [...prev, { id: generateId(), name: '', checkIn: new Date(), checkInTime: '2:00p', checkOut: new Date(), checkOutTime: '11:00a', cost: 0, currency: 'USD' }])}
              tripDates={days.map(d => d.date)}
            />
          </section>

          <section className="transportation-section-panel">
            <TransportationPanel
              transportation={transportation}
              onUpdate={(id, field, value) => setTransportation(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))}
              onDelete={(id) => setTransportation(prev => prev.filter(t => t.id !== id))}
              onAdd={() => setTransportation(prev => [...prev, {
                id: generateId(),
                type: 'uber',
                from: 'home',
                to: 'airport',
                description: '',
                date: days[0]?.date || new Date(),
                time: '9:00a',
                endTime: '10:00a',
                duration: 60,
                cost: 0,
                currency: 'USD',
                isHome: true
              }])}
              onReorder={(newOrder) => setTransportation(newOrder)}
              tripDates={days.map(d => d.date)}
              altCurrency={altCurrency}
              customRates={customRates}
              flights={flights}
            />
          </section>

          <section className="mie-section-panel">
            <MIEPanel
              days={days}
              destCity={destCity}
              isForeign={useAlt}
              onUpdateMeals={(dayId, meal) => {
                setDays(prev => prev.map(d => d.id === dayId ? { ...d, meals: { ...d.meals, [meal]: !d.meals[meal] } } : d));
              }}
              onUpdateLocation={(dayId, location) => {
                setDays(prev => prev.map(d => d.id === dayId ? { ...d, location } : d));
              }}
              onUpdateLodging={(dayId, lodging) => {
                setDays(prev => prev.map(d => d.id === dayId ? { ...d, lodging } : d));
              }}
              onUpdateMie={(dayId, mie) => {
                setDays(prev => prev.map(d => d.id === dayId ? { ...d, mie } : d));
              }}
              onRefreshLocations={() => {
                const firstOutbound = flights.find(f => f.outbound && f.outbound.length > 0);
                let detectedCity = destCity;
                if (firstOutbound && firstOutbound.outbound.length > 0) {
                  const lastSeg = firstOutbound.outbound[firstOutbound.outbound.length - 1];
                  if (lastSeg?.arrPort) {
                    detectedCity = getCityFromAirport(lastSeg.arrPort) || getAirportCity(lastSeg.arrPort) || destCity;
                  }
                }
                if (detectedCity) {
                  setDestCity(detectedCity);
                  setDays(prev => prev.map(d => ({ ...d, location: '', lodging: undefined, mie: undefined })));
                  console.log(`[MIE] Refreshed all locations to: ${detectedCity}`);
                }
              }}
            />
          </section>

          <section className="totals-section glass">
            <div className="totals-header-row">
              <div className="currency-controls">
                <div className="curr-toggle-group">
                  <button
                    className={`btn-toggle ${!useAlt ? 'active' : ''}`}
                    onClick={() => setUseAlt(false)}
                  >
                    <DollarSign size={14} /> DOMESTIC
                  </button>
                  <button
                    className={`btn-toggle ${useAlt ? 'active' : ''}`}
                    onClick={() => setUseAlt(true)}
                  >
                    <Navigation size={14} /> FOREIGN
                  </button>
                </div>
                {useAlt && (
                  <div className="alt-curr-inp">
                    <select value={altCurrency} onChange={e => setAltCurrency(e.target.value)} className="curr-sel">
                      {currencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="number"
                      className="rate-inp"
                      value={customRates[altCurrency]}
                      onChange={e => setCustomRates({ ...customRates, [altCurrency]: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="main-total-card">
              <span className="total-label">Grand Total</span>
              <span className="total-value">{formatCurrency(totals.grand, 'USD')}</span>
            </div>
            <div className="totals-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <Plane size={12} />
                  <span className="stat-label">FLIGHTS</span>
                </div>
                <span className="stat-value">{formatCurrency(totals.flights, 'USD')}</span>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <Navigation size={12} />
                  <span className="stat-label">TRAVEL</span>
                </div>
                <span className="stat-value">{formatCurrency(totals.travel, 'USD')}</span>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <Hotel size={12} />
                  <span className="stat-label">HOTELS</span>
                </div>
                <span className="stat-value">{formatCurrency(totals.lodging, 'USD')}</span>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <Utensils size={12} />
                  <span className="stat-label">M&IE</span>
                </div>
                <span className="stat-value">{formatCurrency(totals.mie, 'USD')}</span>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <CreditCard size={12} />
                  <span className="stat-label">REGISTRATION</span>
                  <button
                    className={`currency-toggle-mini ${registrationCurrency !== 'USD' ? 'active' : ''}`}
                    onClick={() => setRegistrationCurrency(prev => prev === 'USD' ? altCurrency : 'USD')}
                  >
                    {registrationCurrency !== 'USD' ? <Globe size={11} /> : <Hash size={11} />}
                  </button>
                </div>
                <div className="reg-fee-input-wrap">
                  <span className="reg-sym">$</span>
                  <input
                    type="number"
                    className="stat-inp reg-inp"
                    value={registrationFee}
                    onChange={e => setRegistrationFee(parseFloat(e.target.value) || 0)}
                  />
                  {registrationCurrency !== 'USD' && <span className="reg-unit">{registrationCurrency}</span>}
                </div>
                {registrationCurrency !== 'USD' && registrationFee > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                    ≈ ${Math.round(convertCurrency(registrationFee, registrationCurrency, 'USD', currentRates))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </main >

        <DragOverlay>
          {activeId ? (
            <div className="travel-leg-item dragging glass" style={{ width: '380px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid #6366f1' }}>
              <div className="leg-content" style={{ opacity: 0.8 }}>
                <GripVertical size={12} style={{ opacity: 0.5 }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#6366f1' }}>Moving Travel Leg...</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>

        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;950&family=JetBrains+Mono:wght@500;800&display=swap');

        :root {
          --bg: #020617;
          --glass: rgba(15, 23, 42, 0.6);
          --border: rgba(255, 255, 255, 0.08);
          --accent: #a5b4fc;
          --text: #f8fafc;
          --subtext: #94a3b8;
        }

        body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; -webkit-font-smoothing: antialiased; }
        
        .travel-app { min-height: 100vh; background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 40%), radial-gradient(circle at bottom left, rgba(79, 70, 229, 0.05), transparent 40%); padding: 2rem 1rem; }
        .one-column-layout { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
        .glass { background: var(--glass); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.4); border-radius: 1.5rem; content-visibility: visible; }

        /* Header */
        .trip-header-section { padding: 1.5rem 2rem; overflow: visible; position: relative; z-index: 100; }
        .trip-header-main { width: 100%; }

        .trip-name-display { background: transparent; border: none; font-size: 2rem; font-weight: 950; color: #fff; width: 100%; outline: none; margin-bottom: 0rem; letter-spacing: -0.02em; text-align: left; }
        .website-row { display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; opacity: 0.6; }
        .web-icon { color: var(--accent); }
        .trip-web-input { background: transparent; border: none; color: #fff; font-size: 0.8rem; outline: none; width: 100%; }
        
        .location-grid-vertical { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
        .location-block { display: flex; flex-direction: column; gap: 4px; }
        .location-block .location-input-row { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 8px; padding: 4px 10px; }
        .location-block .tz-select { padding-left: 28px; opacity: 0.8; }
        .location-block.home-block { opacity: 0.6; }
        .location-block.home-block .loc-icon { color: var(--subtext); }

        .trip-meta-row-vertical { display: flex; flex-direction: column; gap: 0.5rem; color: var(--subtext); font-weight: 600; font-size: 0.9rem; margin-bottom: 1.5rem; }
        .day-count-row { font-size: 0.75rem; font-weight: 900; color: var(--accent); opacity: 0.8; }
        .conf-center-block { margin-top: 2px; }
        .conf-icon { color: var(--accent); opacity: 0.8; display: flex; align-items: center; }
        .conf-input { background: transparent; border: none; color: #fff; font-size: 0.85rem; font-weight: 600; outline: none; flex: 1; }
        .conf-map-link { color: var(--subtext); opacity: 0.5; transition: opacity 0.2s; }
        .conf-map-link:hover { opacity: 1; color: var(--accent); }
        .trip-dates-vertical-wrap { display: flex; flex-direction: column; gap: 0.75rem; }
        .header-dates-row { display: flex; align-items: center; gap: 0.5rem; }
        .header-sub-row { display: flex; align-items: center; gap: 1rem; }

        .timeline-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .totals-header-row { display: flex; justify-content: flex-end; margin-bottom: 1.5rem; }


        /* Segmented Date Input */
        .segmented-date-input {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 4px 8px;
        }
        .segmented-date-input:focus-within {
          border-color: var(--accent);
          background: rgba(0,0,0,0.4);
        }
        .si-wd {
          width: 32px;
          background: transparent !important;
          border: none !important;
          color: var(--accent);
          font-weight: 800;
          font-size: 0.8rem;
          text-transform: uppercase;
          outline: none;
          cursor: text;
          text-align: left;
          padding: 0 !important;
        }
        .si-parts { display: flex; align-items: center; color: var(--subtext); font-size: 0.8rem; font-weight: 600; }
        .si-num {
          width: 20px;
          background: transparent !important;
          border: none !important;
          color: #fff !important;
          text-align: center !important;
          outline: none !important;
          font-family: inherit;
          padding: 0 !important;
          font-weight: 600;
        }
        .si-year { width: 24px; }
        .si-mon-abbr { width: 32px !important; color: var(--accent) !important; font-weight: 800 !important; cursor: pointer; text-align: left !important; }
        .si-sep { color: rgba(255,255,255,0.2); margin: 0 1px; font-weight: 300; }
        .si-cal { margin-left: 6px; color: #475569; cursor: pointer; display: flex; align-items: center; transition: color 0.2s; }
        .si-cal:hover { color: var(--accent); }
        .hidden-date-picker { visibility: hidden; width: 0; min-width: 0; height: 0; padding: 0; margin: 0; position: absolute; }

        /* DateRangePicker Styles */
        .date-range-picker { position: relative; display: flex; align-items: center; gap: 8px; z-index: 50; }
        .cal-icon-btn { 
          background: transparent; 
          border: none; 
          cursor: pointer; 
          padding: 4px; 
          display: flex; 
          align-items: center; 
          transition: all 0.2s; 
          border-radius: 6px; 
          font-size: 1.3rem;
        }
        .cal-icon-btn:hover { background: rgba(99, 102, 241, 0.15); transform: scale(1.1); }
        .cal-emoji { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
        
        .date-range-display { 
          display: flex; 
          align-items: center; 
          gap: 6px; 
          cursor: pointer; 
          padding: 6px 12px; 
          background: rgba(0,0,0,0.3); 
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          transition: all 0.2s;
          font-size: 0.85rem;
        }
        .date-range-display:hover { 
          border-color: var(--accent); 
          background: rgba(0,0,0,0.4);
        }
        .date-range-display .dow { color: var(--accent); font-weight: 700; }
        .date-range-display .mon { color: #fff; font-weight: 900; }
        .date-range-display .day { color: #fff; font-weight: 600; }
        .date-range-display .range-dash { color: rgba(255,255,255,0.4); margin: 0 2px; }
        .date-range-display .day-count-badge { 
          color: var(--accent); 
          font-weight: 800; 
          font-size: 0.75rem;
          opacity: 0.8;
          margin-left: 4px;
        }
        .date-range-placeholder { color: #64748b; font-style: italic; }
        
        .cal-popup.vertical-scroll { 
          position: absolute; 
          top: 100%; 
          left: 0; 
          margin-top: 8px; 
          background: rgba(15, 23, 42, 0.98); 
          border: 1px solid rgba(255,255,255,0.15); 
          border-radius: 16px; 
          padding: 0; 
          z-index: 1000; 
          box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1); 
          width: 300px;
          overflow: hidden;
        }
        .cal-scroll-container { 
          max-height: 400px; 
          overflow-y: auto; 
          padding: 12px;
          scroll-behavior: smooth;
        }
        .cal-scroll-container::-webkit-scrollbar { width: 6px; }
        .cal-scroll-container::-webkit-scrollbar-track { background: transparent; }
        .cal-scroll-container::-webkit-scrollbar-thumb { 
          background: rgba(99, 102, 241, 0.3); 
          border-radius: 3px; 
        }
        .cal-scroll-container::-webkit-scrollbar-thumb:hover { 
          background: rgba(99, 102, 241, 0.5); 
        }
        
        .cal-month-block { margin-bottom: 20px; }
        .cal-month-block:last-child { margin-bottom: 8px; }
        .cal-month-header { 
          font-weight: 800; 
          color: #fff; 
          font-size: 0.9rem; 
          margin-bottom: 10px;
          padding: 8px 4px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          position: sticky;
          top: -12px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(4px);
          z-index: 1;
        }
        
        .cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 6px; }
        .cal-weekdays div { text-align: center; font-size: 0.55rem; font-weight: 800; color: #475569; text-transform: uppercase; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .cal-day { 
          text-align: center; 
          padding: 10px 4px; 
          font-size: 0.8rem; 
          font-weight: 600; 
          cursor: pointer; 
          border-radius: 8px; 
          color: #94a3b8; 
          transition: all 0.15s; 
        }
        .cal-day:hover:not(.empty):not(.past) { background: rgba(99, 102, 241, 0.3); color: #fff; }
        .cal-day.empty { cursor: default; }
        .cal-day.past { color: #334155; cursor: not-allowed; }
        .cal-day.today { border: 2px solid var(--accent); }
        .cal-day.start { 
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); 
          color: #fff; 
          font-weight: 900; 
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }
        .cal-day.end { 
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
          color: #fff; 
          font-weight: 900; 
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }
        .cal-day.in-range { background: rgba(99, 102, 241, 0.2); color: #a5b4fc; }
        .cal-day.selected { 
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); 
          color: #fff; 
          font-weight: 900; 
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }
        .cal-hint { 
          text-align: center; 
          font-size: 0.7rem; 
          color: #6366f1; 
          font-weight: 700; 
          padding: 12px 16px; 
          text-transform: uppercase; 
          background: rgba(99, 102, 241, 0.1);
          border-top: 1px solid rgba(99, 102, 241, 0.2);
        }

        /* Continuous Calendar Styles */
        .cc-popup {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 8px;
          background: rgba(15, 23, 42, 0.98);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          padding: 0;
          z-index: 10001;
          box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1);
          width: 340px;
          overflow: hidden;
        }
        .cc-calendar {
          display: flex;
          flex-direction: column;
        }
        .cc-header-row {
          display: grid;
          grid-template-columns: 40px repeat(7, 1fr);
          gap: 2px;
          padding: 10px 8px 6px;
          background: rgba(15, 23, 42, 0.98);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .cc-weekday {
          text-align: center;
          font-size: 0.55rem;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
        }
        .cc-year-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 900;
          color: #a5b4fc;
          min-width: 40px;
        }
        .cc-weeks-container {
          max-height: 195px;
          overflow-y: auto;
          padding: 4px 8px;
        }
        .cc-weeks-container::-webkit-scrollbar { width: 6px; }
        .cc-weeks-container::-webkit-scrollbar-track { background: transparent; }
        .cc-weeks-container::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.3);
          border-radius: 3px;
        }
        .cc-weeks-container::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.5);
        }
        .cc-week-row {
          display: grid;
          grid-template-columns: 40px repeat(7, 1fr);
          gap: 2px;
          padding: 2px 0;
          margin-bottom: 1px;
        }
        .cc-month-label-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 40px;
          border-radius: 4px;
          padding: 2px;
        }
        /* Month label shading to match days */
        .cc-month-label-cell.even-month {
          background: rgba(99, 102, 241, 0.35);
        }
        .cc-month-label-cell.odd-month {
          background: rgba(30, 41, 59, 0.8);
        }
        .cc-month-label {
          font-size: 0.5rem;
          font-weight: 900;
          color: #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .cc-day {
          text-align: center;
          padding: 8px 3px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 6px;
          color: #94a3b8;
          transition: all 0.15s;
        }
        /* Per-day month shading - MUCH higher contrast */
        .cc-day.even-month {
          background: rgba(99, 102, 241, 0.35);
        }
        .cc-day.odd-month {
          background: rgba(30, 41, 59, 0.8);
        }
        .cc-day:hover:not(.past) { 
          background: rgba(99, 102, 241, 0.6); 
          color: #fff; 
        }
        .cc-day.past { 
          color: #334155; 
          cursor: not-allowed; 
        }
        .cc-day.past.even-month {
          background: rgba(99, 102, 241, 0.12);
        }
        .cc-day.past.odd-month {
          background: rgba(30, 41, 59, 0.4);
        }
        .cc-day.today { 
          border: 2px solid var(--accent); 
        }
        /* Start date is filled */
        .cc-day.cc-day.start {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          color: #fff !important;
          font-weight: 950;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
          border: 2px solid #10b981;
        }
        /* End date is outline only */
        .cc-day.cc-day.end {
          background: transparent !important;
          color: #10b981 !important;
          font-weight: 950;
          border: 2px solid #10b981;
          box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
        }
        .cc-day.in-range {
          background: rgba(16, 185, 129, 0.35);
          color: #d1fae5;
          font-weight: 700;
        }
        
        /* Editable date input in display */
        .date-clickable {
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          transition: all 0.15s;
        }
        .date-clickable:hover {
          background: rgba(99, 102, 241, 0.2);
        }
        .date-edit-input {
          width: 70px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid var(--accent);
          border-radius: 4px;
          color: #fff;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 2px 6px;
          outline: none;
          font-family: inherit;
        }
        .date-edit-input::placeholder {
          color: #6b7280;
          font-style: italic;
        }

        /* SingleDatePicker Styles */
        .single-date-picker { position: relative; display: inline-block; width: 100%; }
        .date-single-display { 
          display: flex; 
          align-items: center; 
          gap: 4px; 
          cursor: pointer; 
          padding: 4px 8px; 
          background: rgba(0,0,0,0.3); 
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          transition: all 0.2s;
          font-size: 0.7rem;
          min-height: 24px;
        }
        .date-single-display:hover { 
          border-color: var(--accent); 
          background: rgba(0,0,0,0.4);
        }
        .date-single-placeholder { color: #475569; font-style: italic; font-size: 0.65rem; }
        
        /* Override for single date picker popup - ensure proper sizing */
        .single-date-picker .cal-popup.vertical-scroll.single { 
          width: 300px; 
          z-index: 10000 !important;
        }

        /* Flight arrival date display */
        .f-arr-date-display {
          padding: 4px 8px;
          background: rgba(0,0,0,0.2);
          border-radius: 6px;
          min-height: 24px;
          display: flex;
          align-items: center;
        }
        .arr-date-text {
          color: #94a3b8;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .arr-date-placeholder {
          color: #475569;
          font-style: italic;
          font-size: 0.65rem;
        }

        /* Hotel date range styles */
        .h-row-dates-range {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          position: relative;
          z-index: 1;
        }
        .h-times-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .time-sep {
          color: rgba(255,255,255,0.3);
          font-weight: 300;
        }
        
        /* Ensure date-range-picker in hotels has high z-index */
        .hotel-row-item .date-range-picker {
          position: relative;
          z-index: 1;
        }
        .hotel-row-item .cal-popup.vertical-scroll {
          z-index: 10000 !important;
        }
        

        /* Flight date dropdown */
        .f-date-select {
          width: 100% !important;
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
        }

        /* Trip date range picker (compact, for hotels) */
        .trip-date-range-picker { position: relative; display: flex; align-items: center; gap: 8px; }
        .trip-cal-btn { 
          background: transparent; 
          border: none; 
          cursor: pointer; 
          padding: 4px; 
          display: flex; 
          align-items: center; 
          transition: all 0.2s; 
          border-radius: 6px; 
          font-size: 1.3rem;
        }
        .trip-cal-btn:hover { background: rgba(99, 102, 241, 0.15); transform: scale(1.1); }
        
        .trip-display { 
          display: flex; 
          align-items: center; 
          gap: 6px; 
          cursor: pointer; 
          padding: 6px 12px; 
          background: rgba(0,0,0,0.3); 
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          transition: all 0.2s;
          font-size: 0.85rem;
        }
        .trip-display:hover { 
          border-color: var(--accent); 
          background: rgba(0,0,0,0.4);
        }

        .trip-cal-popup {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 8px;
          background: rgba(15, 23, 42, 0.98);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          padding: 12px;
          z-index: 10000;
          box-shadow: 0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1);
          min-width: 280px;
        }

        .trip-cal-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .trip-cal-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          margin-bottom: 6px;
        }
        .trip-cal-weekdays div {
          text-align: center;
          font-size: 0.55rem;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
        }

        .trip-cal-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 3px;
        }

        .trip-day {
          text-align: center;
          padding: 10px 4px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          color: #94a3b8;
          transition: all 0.15s;
        }
        .trip-day:hover:not(.empty) {
          background: rgba(99, 102, 241, 0.3);
          color: #fff;
        }
        .trip-day.empty {
          cursor: default;
        }
        .trip-day.start {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #fff;
          font-weight: 900;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
        }
        .trip-day.end {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #fff;
          font-weight: 900;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }
        .trip-day.in-range {
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
        }
        
        .currency-controls { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-end; }
        .curr-toggle-group { display: flex; background: rgba(0,0,0,0.2); padding: 3px; border-radius: 8px; border: 1px solid var(--border); }
        .btn-toggle { background: transparent; border: none; color: var(--subtext); font-size: 0.65rem; font-weight: 900; padding: 6px 12px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
        .btn-toggle.active { background: var(--accent); color: white; }
        
        .alt-curr-inp { display: flex; gap: 4px; }
        .curr-sel { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 0 4px; outline: none; }
        .rate-inp { width: 60px; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; color: var(--accent); font-size: 0.75rem; font-weight: 950; text-align: center; padding: 4px; outline: none; }

        /* Totals */
        .totals-section { padding: 1.5rem; }
        .main-total-card { margin-bottom: 2rem; display: flex; flex-direction: column; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
        .main-total-card .total-label { font-size: 0.8rem; font-weight: 900; color: var(--subtext); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
        .main-total-card .total-value { font-size: 3rem; font-weight: 1000; color: #fff; text-shadow: 0 0 30px rgba(99, 102, 241, 0.4); letter-spacing: -0.02em; }
        
        .totals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; }
        .stat-card { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 1rem; padding: 1rem; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; position: relative; }
        .stat-card:hover { border-color: rgba(99, 102, 241, 0.3); background: rgba(0,0,0,0.4); }
        .stat-header { display: flex; align-items: center; gap: 6px; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px; margin-bottom: 4px; }
        .stat-label { font-size: 0.65rem; font-weight: 900; color: var(--subtext); flex: 1; letter-spacing: 0.05em; }
        .stat-value { font-size: 1.2rem; font-weight: 950; color: #fff; }
        .stat-inp { background: transparent !important; border: none !important; color: var(--accent) !important; font-size: 1.2rem; font-weight: 950; width: 100%; outline: none; padding: 0; }
        .stat-card svg { color: var(--accent); opacity: 0.8; }

        .reg-fee-input-wrap { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
        .reg-sym { font-size: 1rem; font-weight: 950; color: #64748b; }
        .reg-unit { font-size: 0.65rem; color: #64748b; font-weight: 850; margin-left: 4px; }

        /* Shared Form Styling */
        .f-inp { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.25); border-radius: 4px; padding: 3px 6px; color: #fff; outline: none; font-size: 0.75rem; transition: all 0.2s; }
        .f-inp:focus { border-color: var(--accent); background: rgba(0,0,0,0.5); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); }
        .f-inp::placeholder { color: #475569; }

        /* Flight Panel & Groups */
        .flight-panel, .hotel-panel, .transport-panel { background: var(--glass); border: 1px solid var(--border); border-radius: 1.5rem; padding: 1.5rem; overflow: visible; }
        
        /* Transportation Panel Styles */
        .transport-panel .t-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .transport-row { 
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: rgba(0,0,0,0.2); 
          border: 1px solid rgba(255,255,255,0.05); 
          border-radius: 0.75rem; 
          padding: 0.6rem 0.75rem;
        }
        .t-row-1, .t-row-2 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .t-grip { color: #475569; cursor: grab; display: flex; align-items: center; }
        .t-grip:active { cursor: grabbing; }
        .t-type-select { 
          background: rgba(0,0,0,0.4); 
          border: 1px solid rgba(255,255,255,0.15); 
          border-radius: 6px; 
          padding: 4px 8px; 
          color: #fff; 
          font-size: 0.65rem;
          width: 90px;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .t-type-select {
            width: 90px;
          }
        }
        .t-date-select { 
          background: rgba(0,0,0,0.4); 
          border: 1px solid rgba(255,255,255,0.15); 
          border-radius: 4px; 
          padding: 3px 6px; 
          color: #fff; 
          font-size: 0.65rem;
          font-family: 'JetBrains Mono', monospace;
          width: 90px;
          box-sizing: border-box;
        }
        .t-time-input { 
          width: 60px !important; 
          font-size: 0.7rem; 
          text-align: center; 
          font-weight: 600;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          padding: 3px 6px;
          color: #fff;
        }
        .t-duration-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .t-duration-input {
          width: 40px !important;
          font-size: 0.7rem;
          text-align: right;
          font-weight: 600;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          padding: 3px 6px;
          color: #fff;
          box-sizing: border-box;
        }
        .t-duration-label {
          font-size: 0.65rem;
          color: #64748b;
          font-weight: 700;
        }
        .t-cost-group { 
          display: flex; 
          align-items: center; 
          gap: 4px; 
          background: rgba(0,0,0,0.3); 
          border-radius: 6px; 
          border: 1px solid rgba(255,255,255,0.08); 
          padding: 2px 6px;
        }
        .t-currency-btn { 
          background: transparent; 
          border: none; 
          color: #64748b; 
          cursor: pointer; 
          padding: 4px; 
          display: flex; 
          align-items: center;
          transition: color 0.2s;
        }
        .t-currency-btn:hover { color: var(--accent); }
        .t-currency-btn.foreign { color: var(--warning); }
        .t-cost-input { 
          background: transparent !important; 
          border: none !important; 
          width: 40px !important; 
          color: var(--accent) !important; 
          font-weight: 800 !important; 
          text-align: right !important; 
          font-size: 0.8rem !important;
          box-sizing: border-box;
        }
        .t-usd-equiv { 
          font-size: 0.6rem; 
          color: #64748b; 
          white-space: nowrap;
        }
        .t-delete-btn { 
          background: transparent; 
          border: none; 
          color: #64748b; 
          cursor: pointer; 
          padding: 4px; 
          display: flex;
          transition: color 0.2s;
        }
        .t-delete-btn:hover { color: var(--error); }
        
        /* Timezone indicator */
        .t-tz-indicator {
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          min-width: 24px;
          border-radius: 4px;
          background: rgba(0,0,0,0.2);
        }
        .t-tz-indicator.home { background: rgba(99, 102, 241, 0.2); }
        .t-tz-indicator.away { background: rgba(251, 146, 60, 0.2); }
        
        /* Place selector */
        .t-place-select {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          padding: 3px 6px;
          color: #fff;
          font-size: 0.65rem;
          min-width: 80px;
        }
        
        /* Row 2 spacer for alignment */
        .t-row2-spacer {
          width: 14px;
          flex-shrink: 0;
        }
        .f-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
        .f-title { font-size: 0.8rem; font-weight: 900; color: var(--accent); letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; text-transform: uppercase; }
        
        .flight-group { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; transition: all 0.2s; overflow: visible; }
        .f-group-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.75rem; }
        .f-grip-group { color: #475569; cursor: grab; }
        .f-meta-primary { flex: 1; display: flex; gap: 0.75rem; align-items: center; }
        .g-air { width: 72px; font-weight: 800; }
        .g-conf { width: 100px; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; }
        
        .f-cost-row { display: flex; align-items: center; gap: 0.5rem; }
        .f-cost-box { display: flex; align-items: center; background: rgba(0,0,0,0.3); border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); padding: 0 8px; }
        .currency-toggle-mini { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; display: flex; align-items: center; }
        .currency-toggle-mini:hover, .currency-toggle-mini.active { color: var(--accent); }
        .unit-mini { font-size: 0.8rem; font-weight: 950; }
        .g-cost { background: transparent !important; border: none !important; width: 70px !important; color: var(--accent) !important; font-weight: 950 !important; text-align: right !important; font-size: 0.9rem !important; }

        /* Flight Segment */
        .f-segment { background: rgba(0,0,0,0.15); border-radius: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.03); }
        .f-seg-row { display: grid; grid-template-columns: 90px 1fr 30px; align-items: center; gap: 1rem; }
        .f-num-col { font-weight: 950; color: var(--accent); font-size: 0.85rem; }
        .s-full-num { background: transparent !important; border: none !important; width: 100%; color: inherit !important; font-weight: inherit !important; text-align: left !important; }
        
        .f-route-display { display: grid; grid-template-columns: 120px 60px 50px 20px 50px 60px 120px; align-items: center; gap: 6px; }
        .s-date { font-size: 0.7rem; width: 100% !important; }
        .s-time { width: 55px !important; font-size: 0.75rem; text-align: center; font-weight: 600; }
        .s-port { width: 50px !important; font-weight: 900; text-transform: uppercase; text-align: center; color: #fff !important; }
        .seg-arrow { color: #475569; font-size: 0.8rem; font-weight: 900; text-align: center; }

        .f-segment { background: rgba(0,0,0,0.15); border-radius: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.03); }
        .f-seg-grid { display: grid; grid-template-columns: 75px 120px 70px 1fr 32px; gap: 4px 6px; align-items: center; }
        .f-grid-col { display: flex; flex-direction: column; gap: 4px; overflow: hidden; }
        .f-sub-label { display: flex; align-items: center; gap: 4px; font-size: 0.6rem; color: #94a3b8; font-family: 'JetBrains Mono', monospace; opacity: 0.7; }
        .s-full-num { background: transparent !important; border: none !important; width: 100%; color: var(--accent) !important; font-weight: 950 !important; text-align: left !important; font-size: 0.8rem !important; overflow: hidden; text-overflow: ellipsis; }
        .s-date { font-size: 0.65rem; width: 100% !important; }
        .s-time { width: 100% !important; font-size: 0.7rem; font-weight: 600; background: transparent !important; border: none !important; color: #94a3b8; text-align: right !important; }
        .s-port { width: 38px !important; font-weight: 950; text-transform: uppercase; color: #fff !important; background: transparent !important; border: none !important; text-align: center !important; font-size: 0.75rem; padding: 2px 2px !important; }
        .s-term { width: 32px !important; font-weight: 700; text-transform: uppercase; color: #64748b !important; background: transparent !important; border: none !important; border-bottom: 1px dashed rgba(255,255,255,0.1) !important; text-align: center !important; font-size: 0.6rem; padding: 1px 2px !important; }
        .seat-label { font-weight: 950; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.55rem; }
        .s-seat { width: 40px !important; border-bottom: 1px dashed rgba(255,255,255,0.1) !important; text-align: left !important; background: transparent !important; color: #fff !important; font-weight: 800 !important; border-radius: 0 !important; padding: 0 !important; font-size: 0.7rem !important; }
        .f-seg-del { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 2px; grid-row: 1 / span 2; grid-column: 5; align-self: center; transition: color 0.2s; }
        .f-seg-del:hover { color: var(--error); }
        .f-del-group { background: transparent; border: none; color: #475569; cursor: pointer; padding: 4px; transition: color 0.2s; margin-left: 4px; }
        .f-del-group:hover { color: var(--error); }

        .f-add-seg, .f-add-btn {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          color: #818cf8;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.7rem;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          margin-top: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .f-add-seg:hover, .f-add-btn:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-1px);
        }
        .f-add-btn {
          width: 100%;
          justify-content: center;
          padding: 12px;
          margin-top: 1.5rem;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.1));
        }

        .f-trip-header { font-size: 0.65rem; font-weight: 900; color: #64748b; letter-spacing: 0.1em; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 2px; }
        .f-trip-section { background: rgba(0,0,0,0.1); border-radius: 0.5rem; padding: 0.75rem; }
        
        /* Compact flight section styling (similar to M&IE) */
        .f-trip-section-compact { margin-bottom: 0.5rem; }
        .f-trip-header-with-action { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 0.5rem; 
          padding-bottom: 6px;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 0.75rem;
        }
        .f-add-seg-inline {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.2);
          color: #818cf8;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 0.6rem;
          font-weight: 900;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .f-add-seg-inline:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-1px);
        }
        
        /* Narrower cost input */
        .g-cost { background: transparent !important; border: none !important; width: 50px !important; color: var(--accent) !important; font-weight: 950 !important; text-align: right !important; font-size: 0.9rem !important; }
        
        /* More compact date selector */
        .f-date-select { width: 100% !important; font-size: 0.65rem; font-weight: 600; cursor: pointer; max-width: 95px; }
        
        .g-air { width: 54px !important; }

        .trip-header-section { padding: 2rem; border-radius: 2rem; margin-bottom: 2rem; overflow: visible; position: relative; z-index: 100; }
        .trip-header-container { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; }
        .trip-header-main { flex: 1; }
        .header-actions { display: flex; flex-direction: column; gap: 1rem; align-items: flex-end; }
        
        .mie-toggle-btn { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 8px 16px; color: #94a3b8; font-weight: 900; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .mie-toggle-btn.active { background: var(--accent); color: #fff; border-color: transparent; }
        .mie-toggle-btn:hover { background: rgba(255,255,255,0.05); }
        .mie-toggle-btn.active:hover { background: var(--accent); opacity: 0.9; }

        .timeline-section-panel { padding: 2rem; background: var(--glass); border-radius: 1.5rem; border: 1px solid var(--border); margin-bottom: 2rem; overflow: visible; }
        
        /* Continuous Timeline Styles */
        .continuous-timeline-wrapper { overflow: visible; }
        .continuous-timeline { overflow: visible; display: flex; position: relative; }
        .continuous-timeline .timeline-col { flex-shrink: 0; position: relative; }
        .continuous-timeline .combined-col { width: 5%; min-width: 65px; }
        .continuous-timeline .combined-col.left { border-right: 1px solid rgba(255,255,255,0.1); }
        .continuous-timeline .combined-col.right { border-left: 1px solid rgba(255,255,255,0.1); }
        .continuous-timeline .timeline-hours-container { flex-grow: 1; position: relative; background: repeating-linear-gradient(to bottom, transparent, transparent 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 5px); overflow: visible; }
        
        .midnight-line-continuous { pointer-events: none; }
        .midnight-line-continuous.home { border-color: #6366f1 !important; }
        .midnight-line-continuous.dest { border-color: #f59e0b !important; }
        
        .timeline-mie-column { border-left: 1px solid rgba(255,255,255,0.05); }
        .mie-day-block { border-bottom: 1px solid rgba(255,255,255,0.05); }
        
        .vertical-timeline { overflow: visible; display: flex; flex-direction: column; }
        .timeline-day-row { display: flex; min-height: 80px; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative; }
        .timeline-col { flex-shrink: 0; position: relative; }
        
        /* Combined column structure (3-column layout) */
        .combined-col { width: 5%; min-width: 65px; }
        .combined-col.left { border-right: 1px solid rgba(255,255,255,0.1); }
        .combined-col.right { border-left: 1px solid rgba(255,255,255,0.1); }
        
        /* Header combined column styling */
        .side-col.combined-col { min-width: 65px; }
        .side-col.combined-col.left { color: var(--accent); }
        .side-col.combined-col.right { color: #f59e0b; }

        .timeline-header-icons { display: flex; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); height: 32px; }
        .side-col { display: flex; align-items: center; justify-content: center; color: #64748b; }
        .center-spacer { flex-grow: 1; }
        
        .midnight-line { position: absolute; left: 0; right: 0; height: 0; border-top: 2px solid currentColor; z-index: 5; opacity: 0.5; }
        .midnight-line.home { color: var(--accent); }
        .midnight-line.dest { color: #f59e0b; border-top-style: dashed; }
        
        .midnight-label-single { 
          width: 100%; 
          pointer-events: none; 
          padding: 2px 4px; 
          font-size: 0.7rem; 
          font-weight: 800; 
          text-align: center; 
          line-height: 1.2; 
          white-space: nowrap;
        }
        .midnight-label-single.home { color: var(--accent); }
        .midnight-label-single.dest { color: #f59e0b; text-align: right; }
        
        .midnight-label-stack { width: 100%; pointer-events: none; padding: 0 4px; }
        .midnight-label-stack.home { color: var(--accent); }
        .midnight-label-stack.dest { color: #f59e0b; }
        
        .date-stack { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 0; white-space: nowrap; height: auto; text-align: center; gap: 2px; }
        .tl-dw { font-size: 0.7rem; font-weight: 950; color: inherit; text-transform: uppercase; line-height: 1; }
        .tl-dm { font-size: 0.7rem; font-weight: 800; color: inherit; line-height: 1; }

        .timeline-hours-container { flex-grow: 1; position: relative; background: repeating-linear-gradient(to bottom, transparent, transparent 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 5px); overflow: visible; }
        .hour-line { position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.04); }
        
        .tl-marker-dual { position: absolute; width: 60px; transform: translateY(-50%); pointer-events: none; z-index: 50; display: flex; justify-content: center; line-height: 1; }
        /* time bits are relative to the grid center, so -60px to put in time-col */
        .tl-marker-dual.left { left: -60px; }
        .tl-marker-dual.right { right: -60px; }
        
        .time-item { font-size: 0.55rem; font-weight: 950; text-align: center; width: 55px; flex-shrink: 0; }
        .time-item.home { color: var(--accent); }
        .time-item.dest { color: #f59e0b; }
        .time-item.bold { font-weight: 950; opacity: 1; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5)); }
        .time-item.faint { font-weight: 500; opacity: 0.35; font-size: 0.5rem; }
        
        .tl-event { position: absolute; border-radius: 6px; padding: 4px 8px; font-size: 0.62rem; font-weight: 950; overflow: visible; display: flex; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s; }
        .tl-event.flight-event { width: auto; left: 0; right: 0; z-index: 10; padding: 2px 8px; background: rgba(99, 102, 241, 0.4); justify-content: center; backdrop-filter: blur(4px); }
        .tl-event.travel-event { width: 45%; z-index: 25; box-shadow: 0 4px 10px rgba(0,0,0,0.4); height: 6px; padding: 0 !important; border-radius: 4px !important; }
        .tl-event.travel-event.home-side { left: 4px !important; right: auto !important; background: linear-gradient(to right, rgba(99, 102, 241, 0.9), rgba(99, 102, 241, 0.6)); }
        .tl-event.travel-event.away-side { right: 4px !important; left: auto !important; background: linear-gradient(to left, rgba(245, 158, 11, 0.9), rgba(245, 158, 11, 0.6)); }
        .tl-event.hotel-event { width: 50%; left: 50%; right: 0; opacity: 1.0; z-index: 2; background: linear-gradient(to right, rgba(16, 185, 129, 0.85), rgba(16, 185, 129, 0.7) 20%, rgba(16, 185, 129, 0.65) 50%, rgba(16, 185, 129, 0.7) 80%, rgba(16, 185, 129, 0.85)); border: 1px solid rgba(16, 185, 129, 0.6); justify-content: center; }




        .tl-hotel-name { font-size: 0.7rem; font-weight: 950; color: #10b981; pointer-events: none; position: absolute; left: 0; right: 0; text-align: center; z-index: 5; }
        
        .tl-travel-meta { position: absolute; top: 50%; display: flex; flex-direction: column; gap: 0; fontSize: 0.55rem; fontWeight: 950; color: #fff; white-space: nowrap; zIndex: 50; transform: translateY(-50%); }
        .tl-travel-meta.home-side { right: 100%; margin-right: 8px; text-align: right; }
        .tl-travel-meta.away-side { left: 100%; margin-left: 8px; text-align: left; }
        
        .tl-travel-meta.away-side .inline-leg { justify-content: flex-start; }
        .tl-travel-meta.home-side .inline-leg { justify-content: flex-end; }
        .car-icon-meta { position: absolute; font-size: 0.7rem; z-index: 30; }
        .tl-event.travel-event.home-side .car-icon-meta { left: -18px; }
        .tl-event.travel-event.away-side .car-icon-meta { right: -18px; }












        .tl-event.clickable { cursor: pointer; }
        .tl-event.clickable:hover { transform: scale(1.005); filter: brightness(1.1); z-index: 30 !important; }
        .flight-event { background: linear-gradient(to right, var(--accent), #4f46e5); color: #fff; }
        .hotel-event { background: linear-gradient(to right, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.2)); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.5); }
        .travel-event { background: linear-gradient(to right, rgba(129, 140, 248, 0.5), rgba(129, 140, 248, 0.3)); }




        .hotel-label-wrap { display: flex; flex-direction: column; gap: 2px; line-height: 1.1; }
        .tl-h-name { font-weight: 950; font-size: 0.75rem; }

        .timeline-mie-side { width: 65px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; padding-top: 1.5rem; padding-right: 0.5rem; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .tl-mie-total { font-weight: 950; color: var(--accent); font-size: 0.85rem; margin-bottom: 4px; }
        
        .tl-mie-stack { display: flex; flex-direction: column; gap: 4px; width: 100%; }
        .tl-meal-chip { display: flex; justify-content: space-between; align-items: center; padding: 2px 4px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; cursor: pointer; transition: all 0.2s; }
        .tl-meal-chip.active { background: var(--accent); border-color: transparent; }
        .tl-m-label { font-size: 0.65rem; font-weight: 950; color: #64748b; }
        .tl-m-price { font-size: 0.5rem; font-weight: 850; color: #475569; font-family: 'JetBrains Mono', monospace; display: none; }
        .tl-meal-chip.active .tl-m-label, .tl-meal-chip.active .tl-m-price { color: #fff; }
        .tl-meal-chip:hover:not(.active) { background: rgba(255,255,255,0.05); }

        .flight-label-compact { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 24px; padding: 4px; overflow: visible; position: relative; justify-content: center; }
        .tl-f-rec { position: absolute; top: 2px; right: 4px; font-size: 0.55rem; color: rgba(255,255,255,0.6); font-family: 'JetBrains Mono', monospace; font-weight: 700; background: rgba(0,0,0,0.3); padding: 1px 3px; border-radius: 3px; }
        .tl-f-main-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; height: 100%; }
        .tl-f-ports-stack { display: flex; flex-direction: column; gap: 2px; }
        .tl-f-info-stack { display: flex; flex-direction: column; gap: 1px; }
        .tl-f-port { font-size: 0.75rem; font-weight: 950; color: rgba(255,255,255,0.95); line-height: 1; }
        .tl-f-mid { font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.9); display: flex; align-items: center; gap: 4px; white-space: nowrap; }
        .tl-f-seat { font-size: 0.55rem; color: rgba(255,255,255,0.6); font-weight: 600; text-transform: uppercase; }

        .travel-vertical-label { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 0.6rem; line-height: 1.1; }
        .tl-v-icon { font-size: 0.9rem; margin: 0; display: flex; align-items: center; justify-content: center; height: 100%; }
        .travel-vertical-label { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 0.6rem; line-height: 1.1; }
        .tl-v-icon { font-size: 0.9rem; margin: 0; display: flex; align-items: center; justify-content: center; height: 100%; }



        /* Hotel Row Styling - New 3-Row Layout */
        .hotel-row-item { background: rgba(0,0,0,0.2); border-radius: 1rem; padding: 1rem; margin-bottom: 0.75rem; border: 1px solid rgba(255,255,255,0.03); overflow: visible; }
        .h-row-line { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        
        /* Row 1: Name / City / Map / Delete */
        .h-row-1 { justify-content: flex-start; }
        .h-name { flex: 1; max-width: 140px; font-weight: 800; }
        .h-city { flex: 1; max-width: 90px; font-weight: 600; opacity: 0.8; }
        
        /* Row 2: Check-in / Time / Cost Mode / Cost / Tax */
        .h-row-2 { align-items: center; flex-wrap: wrap; }
        .h-date-select { max-width: 95px !important; font-size: 0.65rem; }
        .h-time { width: 50px !important; }
        .h-cost { width: 50px !important; box-sizing: border-box; }
        
        .h-cost-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .h-cost-mode-toggle {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          color: #64748b;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 4px 6px;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: lowercase;
        }
        .h-cost-mode-toggle:hover {
          background: rgba(99, 102, 241, 0.2);
          color: var(--accent);
          border-color: rgba(99, 102, 241, 0.3);
        }
        
        
        /* Row 3: Check-out / Time / Duration */
        .h-row-3 { align-items: center; }
        .h-duration-display {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding-left: 0.5rem;
        }
        .h-nights-badge {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #818cf8;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.65rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        /* Per-Day Breakdown (when costMode is 'perDay') */
        .h-perday-breakdown {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255,255,255,0.08);\n        }
        .h-perday-header {
          font-size: 0.65rem;
          font-weight: 900;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }
        .h-perday-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          background: rgba(0,0,0,0.15);
          border-radius: 6px;
          margin-bottom: 4px;
          border: 1px solid rgba(255,255,255,0.03);
        }
        .h-perday-row:hover {
          background: rgba(99, 102, 241, 0.08);
          border-color: rgba(99, 102, 241, 0.15);
        }
        .h-perday-date {
          font-size: 0.7rem;
          font-family: 'JetBrains Mono', monospace;
          color: #94a3b8;
          font-weight: 600;
        }
        .h-perday-cost-box {
          min-width: 80px;
        }
        .h-perday-input {
          width: 50px !important;
          background: transparent !important;
          border: none !important;
          color: var(--accent) !important;
          font-weight: 900 !important;
          text-align: right !important;
          font-size: 0.75rem !important;
        }
        
        .h-cost-actions { display: flex; align-items: center; gap: 0.5rem; }
        .h-row-date { font-size: 0.75rem; color: var(--subtext); }
        .h-label { width: 65px; font-weight: 900; color: #475569; text-transform: uppercase; font-size: 0.6rem; }

        /* Missing styles for Travel Legs */
        .leg-amount-input-compact { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 3px 4px; color: var(--accent); outline: none; font-size: 0.75rem; width: 50px; font-weight: 900; text-align: right; }
        .currency-toggle-mini { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; display: flex; align-items: center; }
        .currency-toggle-mini.active { color: var(--accent); }

        /* Edit Modal */
        .edit-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
        .edit-modal { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 1.5rem; width: 90%; max-width: 500px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        .edit-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .edit-modal-header h3 { font-size: 0.9rem; font-weight: 950; letter-spacing: 0.1em; color: var(--accent); margin: 0; }
        .close-btn { background: transparent; border: none; color: #64748b; cursor: pointer; }
        .edit-modal-content { color: #f8fafc; font-size: 0.9rem; line-height: 1.6; }
        .simple-edit-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .simple-edit-form b { color: var(--accent); }

        /* Responsive */
        @media (max-width: 700px) {
          /* Hide Load and Save buttons on mobile */
          .hide-on-mobile { display: none !important; }
          
          .trip-header-container { flex-direction: column; }
          .header-actions { width: 100%; align-items: stretch; }
          .mie-toggle-btn { justify-content: center; }
          .trip-header-section { padding: 1.5rem; }
          .trip-header-main { margin-bottom: 0; }
          .trip-header-container { align-items: flex-start; gap: 1rem; }

          .header-sub-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
          .day-count { margin-left: 0; width: fit-content; }
          .currency-controls { align-items: center; width: 100%; border-top: 1px solid var(--border); padding-top: 1.5rem; }
          .totals-grid { grid-template-columns: repeat(2, 1fr); }
          .main-total-card .total-value { font-size: 2.2rem; }
          .timeline-section-panel { padding: 0.75rem; overflow: visible; }
          .timeline-date-side { width: 50px; }
          .tl-dw { font-size: 0.75rem; }
          .tl-dm { font-size: 0.65rem; }
          .timeline-hours-container { padding-left: 0; margin: 0 4px; }
          .tl-marker-time { width: 28px; font-size: 0.5rem; left: 0; }
          .tl-event.flight-event { left: 0; right: 0; width: auto; }
          .timeline-day-row { padding-left: 0; padding-right: 0; }
          .day-col { width: 40px; }
          .time-col { width: 35px; }
          .timeline-section-panel { padding: 0.25rem; }
          .tl-travel-meta.home-side { margin-left: 2px; }
          .tl-travel-meta.away-side { margin-right: 2px; }

          
          /* Flight Row Mobile Fixes */
          .flight-panel, .hotel-panel, .transport-panel { padding: 0.6rem !important; }
          .transport-row { gap: 0.4rem !important; padding: 0.4rem !important; }
          .t-row-1 { gap: 0.4rem !important; }
          .t-row-2 { gap: 0.4rem !important; flex-wrap: wrap; }
          .flight-group { padding: 0.4rem !important; }
          .f-segment { padding: 0.4rem 0.2rem !important; }
          
          .segmented-date-input { padding: 3px 4px !important; gap: 3px !important; }
          .si-wd { width: 26px !important; font-size: 0.65rem !important; }
          .si-num { width: 15px !important; font-size: 0.7rem !important; }
          .si-year { width: 18px !important; }
          .si-parts { font-size: 0.7rem !important; }
          .si-mon-abbr { width: 28px !important; font-size: 0.65rem !important; }
          .si-cal { margin-left: 2px !important; }
          
          .f-seg-grid { 
            grid-template-columns: 60px 110px 50px 1fr 22px !important;
            gap: 4px 4px !important;
          }
          .f-date-col { display: flex !important; flex-direction: column !important; gap: 4px !important; }
          .f-time-col { display: flex !important; flex-direction: column !important; gap: 4px !important; }
          .f-port-col { display: flex !important; flex-direction: column !important; gap: 4px !important; }
          
          .f-group-header { flex-wrap: wrap; gap: 0.4rem !important; }
          .f-meta-primary { width: 100%; order: 1; display: flex; flex-wrap: wrap; gap: 0.4rem !important; align-items: center; }
          .f-del-group { margin-left: auto; }
          
          .g-air { width: 60px !important; }
          .g-conf { width: 90px !important; }
          
          .s-full-num { font-size: 0.75rem !important; }
          .s-port { font-size: 0.7rem !important; }
          .s-time { font-size: 0.65rem !important; }
          .s-date { font-size: 0.6rem !important; }
          
          .f-route-display { grid-template-columns: 1fr auto 1fr; gap: 0.5rem; }
        }

        /* M&IE Panel Styles */
        .mie-section-panel {
          margin-bottom: 1.5rem;
        }
        .mie-panel {
          padding: 1.5rem;
        }
        .mie-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .mie-total-badge {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          padding: 0.5rem 1rem;
          border-radius: 99px;
          font-weight: 800;
          font-size: 0.9rem;
          color: white;
        }
        .mie-table-wrapper {
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .mie-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
        }
        .mie-table thead {
          background: rgba(0,0,0,0.3);
        }
        .mie-table th {
          padding: 0.75rem 0.5rem;
          text-align: center;
          font-weight: 800;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #a5b4fc;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .mie-table td {
          padding: 0.5rem;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-weight: 600;
        }
        .mie-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.1);
        }
        .mie-row-travel-day {
          background: rgba(245, 158, 11, 0.08);
        }
        .mie-row-travel-day:hover {
          background: rgba(245, 158, 11, 0.15) !important;
        }
        .mie-col-date {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          text-align: left !important;
          white-space: nowrap;
        }
        .mie-col-location {
          text-align: left !important;
          font-size: 0.7rem;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mie-col-lodging, .mie-col-mie {
          font-family: 'JetBrains Mono', monospace;
          color: #a5b4fc;
        }
        .mie-col-mie.travel-day-rate {
          color: #f59e0b;
        }
        .rate-input-wrapper {
          display: flex;
          align-items: center;
          gap: 1px;
          justify-content: flex-start;
        }
        .rate-currency-prefix {
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          user-select: none;
          width: 8px;
        }
        .rate-input {
          background: transparent;
          border: none;
          border-bottom: 1px dashed rgba(255,255,255,0.2);
          color: #a5b4fc;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          padding: 2px 0;
          width: 40px;
          text-align: left;
          outline: none;
        }
        .rate-input:focus {
          border-bottom: 1px solid #6366f1;
          background: rgba(99, 102, 241, 0.1);
        }
        .rate-input.inherited {
          color: #64748b;
          font-style: italic;
        }
        .rate-input.first-rate {
          color: #a5b4fc;
          font-weight: 600;
        }
        .rate-input::placeholder {
          color: #475569;
        }
        .mie-col-meal {
          padding: 0.25rem !important;
        }
        .meal-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 6px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 28px;
        }
        .meal-chip.active {
          background: #6366f1;
          color: white;
        }
        .meal-chip.inactive {
          background: rgba(0,0,0,0.3);
          color: #64748b;
          text-decoration: line-through;
        }
        .meal-chip:hover {
          transform: scale(1.1);
        }
        .mie-totals-row {
          background: rgba(0,0,0,0.4) !important;
          font-weight: 900;
        }
        .mie-totals-row td {
          border-top: 2px solid rgba(99, 102, 241, 0.3);
          padding: 0.75rem 0.5rem;
        }
        .mie-totals-label {
          text-align: right !important;
          padding-right: 1rem !important;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #a5b4fc;
        }
        .mie-legend {
          display: flex;
          gap: 1.5rem;
          align-items: center;
          justify-content: center;
          padding: 0.75rem;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          font-size: 0.65rem;
          color: #94a3b8;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }
        .legend-color.travel-day {
          background: rgba(245, 158, 11, 0.3);
          border: 1px solid #f59e0b;
        }
        .legend-color.full-day {
          background: rgba(99, 102, 241, 0.3);
          border: 1px solid #6366f1;
        }
        .legend-tip {
          font-style: italic;
          color: #64748b;
        }
        .location-editable {
          display: flex;
          align-items: center;
          gap: 4px;
          position: relative;
        }
        .location-input {
          background: transparent;
          border: none;
          border-bottom: 1px dashed rgba(255,255,255,0.2);
          color: #fff;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 4px;
          width: 100%;
          max-width: 130px;
          outline: none;
          transition: all 0.2s;
        }
        .location-input:focus {
          border-bottom: 1px solid #6366f1;
          background: rgba(99, 102, 241, 0.1);
        }
        .location-input::placeholder {
          color: #64748b;
          font-style: italic;
        }
        .location-editable .edit-icon {
          color: #64748b;
          opacity: 0.5;
          position: absolute;
          right: 2px;
          pointer-events: none;
        }
        .location-editable:focus-within .edit-icon {
          opacity: 0;
        }
        .clear-location {
          color: #64748b;
          cursor: pointer;
          font-size: 1rem;
          font-weight: bold;
          opacity: 0.5;
          transition: opacity 0.2s;
          margin-left: 4px;
        }
        .clear-location:hover {
          opacity: 1;
        }
        
        /* Autocomplete styles */
        .autocomplete-wrapper {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .autocomplete-input-container {
          position: relative;
          flex: 1;
        }
        .autocomplete-suggestion {
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          font-size: 0.7rem;
          font-weight: 600;
        }
        .autocomplete-suggestion .typed-part {
          color: transparent;
        }
        .autocomplete-suggestion .suggestion-part {
          color: #64748b;
          opacity: 0.7;
        }
        
        /* Inline refresh button next to Location header */
        .mie-col-location {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .refresh-locations-btn-inline {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(99, 102, 241, 0.3);
          border: none;
          color: #a5b4fc;
          padding: 3px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .refresh-locations-btn-inline:hover {
          background: rgba(99, 102, 241, 0.6);
          transform: rotate(180deg);
        }
        
        /* First city vs inherited cities */
        .location-input.first-city {
          color: #fff;
          font-weight: 600;
          font-style: normal;
        }
        .location-input.inherited {
          color: #64748b;
          font-style: italic;
          font-weight: 400;
        }
        .location-input.inherited:focus {
          color: #fff;
          font-style: normal;
          font-weight: 600;
        }
        
        @media (max-width: 768px) {
          .travel-app {
            padding: 0.5rem 0;
          }
          .one-column-layout {
            gap: 0.75rem;
            max-width: 100%;
          }
          .glass {
            border-radius: 0;
            border-left: none;
            border-right: none;
          }
          .trip-header-section,
          .date-range-section,
          .flights-section,
          .hotels-section,
          .totals-section {
            padding: 1rem 0.5rem;
          }
          /* Eliminate all side margins for these sections */
          .transportation-section-panel,
          .mie-section-panel {
            padding: 0;
            margin: 0;
            width: 100%;
          }
          .transport-panel,
          .mie-panel {
            width: 100% !important;
            padding: 1rem 0.5rem !important;
            margin: 0 !important;
            box-sizing: border-box;
          }
          .mie-table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 0 -0.5rem; /* Allow table to scroll edge-to-edge if needed */
            padding: 0 0.5rem;
          }
          .mie-table {
            font-size: 0.65rem;
            width: 100%;
          }
          .mie-table th, .mie-table td {
            padding: 0.4rem 0.2rem;
            text-align: left !important; /* Align $ under H in HOTEL */
          }
          .mie-col-date {
            font-size: 0.55rem; /* Decreased date font size */
            min-width: 55px;
            max-width: 55px;
          }
          .mie-col-location {
            max-width: 115px; /* Increased location width again */
            min-width: 115px;
          }
          .mie-col-lodging {
            min-width: 45px;
          }
          .mie-col-mie {
            min-width: 40px;
          }
          .meal-chip {
            min-width: 20px;
            padding: 2px 3px;
            font-size: 0.55rem;
          }
          .mie-legend {
            flex-wrap: wrap;
            gap: 0.5rem;
            font-size: 0.6rem;
            padding-top: 0.5rem;
          }
        }
        `}</style>
      </div >
    </DndContext >
  );
}

function StatBox({ label, value, main, onChange, currency, altCurrency, onCurrencyChange, rates }) {
  const isUSD = !currency || currency === 'USD';
  const usdEquiv = isUSD ? value : convertCurrency(value, currency, 'USD', rates);

  return (
    <div className={`stat - box ${main ? 'main' : ''} `}>
      <span className="stat-label">{label}</span>

      <div className="stat-value-container">
        {onCurrencyChange && (
          <div className="stat-mini-toggle" onClick={() => onCurrencyChange?.(isUSD ? altCurrency : 'USD')}>
            {isUSD ? '$' : '🌍'}
          </div>
        )}

        {onChange ? (
          <div className="stat-input-wrap">
            <input
              className="stat-input"
              type="number"
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            />
            {!isUSD && <span className="stat-curr-label">{currency}</span>}
          </div>
        ) : (
          <span className="stat-val">
            {isUSD ? formatCurrency(value, 'USD') : `${value} ${currency} `}
          </span>
        )}

        {!isUSD && (
          <span className="stat-equiv">
            = {formatCurrency(usdEquiv, 'USD')}
          </span>
        )}
      </div>
    </div>
  );
}

function MealChip({ label, active, onClick, cost, isForeign }) {
  return (
    <div className={`meal - chip ${active ? 'active' : ''} `} onClick={onClick} title={label === 'I' ? 'Incidentals' : label}>
      <span className="l">{label}</span>
      <span className="c">{formatCurrency(cost, 'USD')}</span>
    </div>
  );
}

function miesToDayTotal(day, mie, hotelTotal, rates) {
  let travel = 0;
  (day.legs || []).forEach(l => {
    if (l.type !== 'flight') {
      travel += convertCurrency(l.amount * (l.type === 'drive' ? MI_RATE : 1), l.currency, 'USD', rates);
    }
  });
  const hotelInUSD = convertCurrency(hotelTotal, day.hotelCurrency || 'USD', 'USD', rates);
  return travel + mie + hotelInUSD;
}


export default App;
