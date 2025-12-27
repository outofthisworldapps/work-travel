import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Plane, Train, Car, Navigation,
  Hotel, Utensils, CreditCard, ChevronRight,
  Download, RefreshCcw, DollarSign, MapPin,
  Bus, Info, Calendar, Home, GripVertical, X,
  Link2, Link2Off, Hash, AlertTriangle, Lock, Globe
} from 'lucide-react';
import { format, addDays, differenceInDays, differenceInCalendarDays, parse } from 'date-fns';
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

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Utility Functions ---

const parseSegDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    let d = null;
    if (dateStr.includes('/')) {
      d = parse(dateStr, 'M/d/yy', new Date());
      if (isNaN(d.getTime())) d = parse(dateStr, 'M/d/yyyy', new Date());
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

// --- Vertical Timeline Components ---

const TimelineDay = ({ day, dayIndex, totalDays, flights, currentRates, onUpdateMeals, onAddLeg, hotels, onEditEvent, showMIE }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

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
    (f.segments || []).forEach(s => {
      const segDepDate = parseSegDate(s.depDate);
      const segArrDate = parseSegDate(s.arrDate);
      if (segDepDate === dayStr || segArrDate === dayStr) {
        dayFlights.push({ ...s, parentFlight: f, segDepDate, segArrDate, dayStr });
      }
    });
  });

  return (
    <div className={`timeline-day-row ${showMIE ? 'with-mie' : ''}`}>
      <div className="timeline-date-side">
        <div className="tl-dw">{format(day.date, 'EEE')}</div>
        <div className="tl-dm">{format(day.date, 'MMM d')}</div>
      </div>

      <div className="timeline-hours-container">
        {hours.map(h => (
          <div key={h} className="hour-line" style={{ top: `${(h / 24) * 100}%` }}>
            {h % 6 === 0 && (
              <span className="hour-label">{h % 12 || 12}{h < 12 ? 'a' : 'p'}</span>
            )}
          </div>
        ))}

        {/* Flight Boxes */}
        {dayFlights.map(s => {
          const isOvernight = s.segDepDate !== s.segArrDate;
          const isDeparturePart = s.segDepDate === dayStr;
          const isArrivalPart = s.segArrDate === dayStr;

          const start = isDeparturePart ? parseTime(s.depTime) : 0;
          const end = isArrivalPart ? parseTime(s.arrTime) : 24;

          const startPos = (start !== null && !isNaN(start)) ? start : 0;
          const endPos = (end !== null && !isNaN(end)) ? end : 24;

          return (
            <React.Fragment key={s.id + (isArrivalPart && !isDeparturePart ? '-arr' : '')}>
              <div className="tl-marker-time" style={{ top: `${getPosition(startPos)}%`, zIndex: 3 }}>{s.depTime.toLowerCase()}</div>
              <div className="tl-marker-time arr" style={{ top: `${getPosition(endPos)}%`, zIndex: 3 }}>{s.arrTime.toLowerCase()}</div>
              <div
                className="tl-event flight-event clickable"
                onClick={() => onEditEvent({ type: 'flight', id: s.parentFlight.id, segmentId: s.id })}
                style={{
                  top: `${getPosition(startPos)}%`,
                  height: `${Math.max(getPosition(endPos) - getPosition(startPos), 3)}%`,
                  zIndex: 2,
                  borderRadius: isOvernight ? (isDeparturePart ? '8px 8px 0 0' : '0 0 8px 8px') : '8px',
                  borderBottom: (isOvernight && isDeparturePart) ? 'none' : undefined,
                  borderTop: (isOvernight && isArrivalPart) ? 'none' : undefined,
                }}
              >
                {(!isOvernight || isDeparturePart) && (
                  <div className="tl-event-label flight-label-compact">
                    <div className="tl-f-top">{s.depTime.toLowerCase()} {s.airlineCode}{s.flightNumber} {s.depPort}</div>
                    <div className="tl-f-bottom">{s.arrTime.toLowerCase()} {s.arrPort}</div>
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

          let start = 14;
          let end = 11;
          if (isCheckInDay) start = parseTime(h.checkInTime) ?? 14;
          if (isCheckOutDay) end = parseTime(h.checkOutTime) ?? 11;
          if (isMidStay) { start = 0; end = 24; }
          if (isCheckInDay && !isCheckOutDay) end = 24;
          if (isCheckOutDay && !isCheckInDay) start = 0;

          const borderRadius = `${isCheckInDay ? '6px' : '0'} ${isCheckInDay ? '6px' : '0'} ${isCheckOutDay ? '6px' : '0'} ${isCheckOutDay ? '6px' : '0'}`;

          return (
            <React.Fragment key={h.id}>
              {isCheckInDay && (
                <div className="tl-marker-time hotel" style={{ top: `${getPosition(start)}%` }}>{h.checkInTime?.toLowerCase() || '2:00p'}</div>
              )}
              {isCheckOutDay && (
                <div className="tl-marker-time hotel arr" style={{ top: `${getPosition(end)}%` }}>{h.checkOutTime?.toLowerCase() || '11:00a'}</div>
              )}
              <div
                className="tl-event hotel-event clickable"
                onClick={() => onEditEvent({ type: 'hotel', id: h.id })}
                style={{
                  top: `${getPosition(start)}%`,
                  height: `${getPosition(end) - getPosition(start)}%`,
                  borderRadius,
                  borderTop: (isMidStay || (isCheckOutDay && !isCheckInDay)) ? 'none' : undefined,
                  borderBottom: (isMidStay || (isCheckInDay && !isCheckOutDay)) ? 'none' : undefined,
                  left: '60px',
                  right: 0,
                  zIndex: 1
                }}
              >
                {(isCheckInDay || (isMidStay && start === 0)) && (
                  <div className="tl-event-label hotel-label-wrap">
                    <div className="tl-h-name">🏨 {h.name || 'Hotel'}</div>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Travel Legs (Uber, etc.) */}
        {day.legs.map(l => {
          if (!l.time || l.type === 'flight') return null;
          const start = parseTime(l.time);
          if (start === null || isNaN(start)) return null;

          return (
            <React.Fragment key={l.id}>
              <div className="tl-marker-time travel" style={{ top: `${getPosition(start)}%` }}>{l.time.toLowerCase()}</div>
              <div
                className="tl-event travel-event clickable"
                onClick={() => onEditEvent({ type: 'leg', id: l.id, dayId: day.id })}
                style={{
                  top: `${getPosition(start)}%`,
                  height: '24px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  left: '60px',
                  zIndex: 4
                }}
              >
                <div className="tl-event-label">
                  {l.type === 'uber' ? '🚕' : (l.type === 'drive' ? '🚗' : '📍')} {l.from}→{l.to}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {showMIE && (
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
      )}
    </div>
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
      const first = f.segments?.[0];
      const last = f.segments?.[f.segments.length - 1];
      const label = `${first?.depPort || '?'} – ${last?.arrPort || '?'} (${f.airline || 'Flight'})`;
      return { id: f.id, label, flight: f };
    });
  }, [flights]);

  const handleFlightSelect = (flightId) => {
    const f = flights.find(fl => fl.id === flightId);
    if (!f) return;
    const first = f.segments?.[0];
    const last = f.segments?.[f.segments.length - 1];
    onUpdate('from', first?.depPort || '');
    onUpdate('to', last?.arrPort || '');
    onUpdate('amount', f.cost || 0);
    if (f.segments.length > 1) {
      onUpdate('layover', f.segments.slice(0, -1).map(s => s.arrPort).join(', '));
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

const FlightSegmentRow = ({ segment, onUpdate, onDelete, isLast, layover }) => {
  const parseFrag = (dateStr) => {
    if (!dateStr) return new Date();
    try {
      let d = null;
      if (dateStr.includes('/')) {
        d = parse(dateStr, 'M/d/yy', new Date());
        if (isNaN(d.getTime())) d = parse(dateStr, 'M/d/yyyy', new Date());
      } else {
        d = new Date(dateStr);
        // Fix year if missing or defaults to 2001
        if (!isNaN(d.getTime()) && (d.getFullYear() < 2024 || d.getFullYear() > 2099)) {
          d.setFullYear(new Date().getFullYear());
        }
      }
      return (!d || isNaN(d.getTime())) ? new Date() : d;
    } catch (e) { return new Date(); }
  };

  const depDate = parseFrag(segment.depDate);
  const arrDate = parseFrag(segment.arrDate);

  const handleDateChange = (field, date) => {
    if (date && !isNaN(date.getTime())) {
      onUpdate(field, safeFormat(date, 'M/d/yy'));
    }
  };

  return (
    <div className="f-segment">
      <div className="f-seg-grid">
        <div className="f-grid-col f-id-col">
          <input
            className="f-inp s-full-num"
            value={`${segment.airlineCode || ''} ${segment.flightNumber || ''}`.trim()}
            onChange={e => {
              const parts = e.target.value.split(' ');
              onUpdate('airlineCode', parts[0] || '');
              onUpdate('flightNumber', parts.slice(1).join(' ') || '');
            }}
            placeholder="FI 642"
          />
          <div className="f-sub-label">
            <span className="seat-label">SEAT:</span>
            <input
              className="f-inp s-seat"
              value={segment.seat || ''}
              onChange={e => onUpdate('seat', e.target.value)}
              placeholder="—"
            />
          </div>
        </div>

        <div className="f-grid-col f-date-col">
          <DateInput value={depDate} onChange={(d) => handleDateChange('depDate', d)} className="s-date" />
          <DateInput value={arrDate} onChange={(d) => handleDateChange('arrDate', d)} className="s-date" />
        </div>

        <div className="f-grid-col f-time-col">
          <input className="f-inp s-time" value={segment.depTime || ''} onChange={e => onUpdate('depTime', e.target.value)} placeholder="8:30p" />
          <input className="f-inp s-time" value={segment.arrTime || ''} onChange={e => onUpdate('arrTime', e.target.value)} placeholder="6:25a" />
        </div>

        <div className="f-grid-col f-port-col">
          <input className="f-inp s-port" value={segment.depPort || ''} onChange={e => onUpdate('depPort', e.target.value)} placeholder="BWI" />
          <input className="f-inp s-port" value={segment.arrPort || ''} onChange={e => onUpdate('arrPort', e.target.value)} placeholder="KEF" />
        </div>

        <button className="f-seg-del" onClick={onDelete}><Trash2 size={12} /></button>
      </div>
      {layover && (
        <div className="f-layover">
          <RefreshCcw size={10} /> {layover} layover
        </div>
      )}
    </div>
  );
};


const SortableFlightRow = ({ flight, onUpdate, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: flight.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  const calculateLayover = (s1, s2) => {
    if (!s1 || !s2 || !s1.arrDate || !s1.arrTime || !s2.depDate || !s2.depTime) return null;
    try {
      const parseDateTime = (dateStr, timeStr) => {
        let d;
        if (dateStr.includes('/')) {
          d = parse(dateStr, 'M/d/yy', new Date());
          if (isNaN(d.getTime())) d = parse(dateStr, 'M/d/yyyy', new Date());
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

  const addSegment = () => {
    const newSegments = [...(flight.segments || [])];
    const last = newSegments[newSegments.length - 1];
    newSegments.push({
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
    onUpdate('segments', newSegments);
  };

  const updateSegment = (segId, field, val) => {
    const newSegments = flight.segments.map(s => s.id === segId ? { ...s, [field]: val } : s);
    onUpdate('segments', newSegments);
  };

  const deleteSegment = (segId) => {
    if (flight.segments.length <= 1) {
      onDelete();
      return;
    }
    onUpdate('segments', flight.segments.filter(s => s.id !== segId));
  };

  return (
    <div ref={setNodeRef} style={style} className="flight-group glass">
      <div className="f-group-header">
        <div className="drag-handle f-grip-group" {...attributes} {...listeners}><GripVertical size={12} /></div>
        <div className="f-meta-primary">
          <input className="f-inp g-air" value={flight.airline || ''} onChange={e => onUpdate('airline', e.target.value)} placeholder="Airline" />
          <input className="f-inp g-conf" value={flight.confirmation || ''} onChange={e => onUpdate('confirmation', e.target.value)} placeholder="Confirmation" />
        </div>
        <div className="f-cost-row">
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
          <button className="f-del-group" onClick={onDelete}><Trash2 size={12} /></button>
        </div>
      </div>
      <div className="f-segments-list">
        {(flight.segments || []).map((seg, idx) => (
          <React.Fragment key={seg.id}>
            {idx > 0 && calculateLayover(flight.segments[idx - 1], seg) && (
              <div className="f-layover-divider">
                <RefreshCcw size={10} /> <span>{calculateLayover(flight.segments[idx - 1], seg)} layover</span>
              </div>
            )}
            <FlightSegmentRow
              segment={seg}
              onUpdate={(f, v) => updateSegment(seg.id, f, v)}
              onDelete={() => deleteSegment(seg.id)}
              isLast={idx === flight.segments.length - 1}
            />
          </React.Fragment>
        ))}
        <button className="f-add-seg" onClick={addSegment}><Plus size={10} /> Add Leg</button>
      </div>
    </div>
  );
};


const FlightPanel = ({ flights, totalCost, onUpdate, onDelete, onAdd, dragEndHandler }) => {
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
          />
        ))}
        {flights.length === 0 && <div className="no-travel" style={{ padding: '1rem' }}>No flights added</div>}
      </div>
      <button className="f-add-btn" onClick={onAdd} title="Adds an outbound and its reverse return leg">
        <Plus size={10} /> ADD OUTBOUND + RETURN PAIR
      </button>
    </div>
  );
};

const HotelRow = ({ hotel, onUpdate, onDelete }) => {
  const handleDateChange = (field, date) => {
    onUpdate(hotel.id, field, date);
  };

  return (
    <div className="hotel-row-item">
      <div className="h-row-line h-row-top">
        <input
          className="f-inp h-name"
          value={hotel.name || ''}
          onChange={e => onUpdate(hotel.id, 'name', e.target.value)}
          placeholder="Hotel Name"
        />
        <div className="h-cost-actions">
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
              onChange={e => onUpdate(hotel.id, 'cost', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <button className="f-seg-del" onClick={() => onDelete(hotel.id)}><Trash2 size={10} /></button>
        </div>
      </div>
      <div className="h-row-line h-row-date">
        <div className="h-label">Arrival:</div>
        <DateInput value={hotel.checkIn} onChange={(d) => handleDateChange('checkIn', d)} className="f-date-sel" />
        <input className="f-inp s-time h-time" value={hotel.checkInTime || ''} onChange={e => onUpdate(hotel.id, 'checkInTime', e.target.value)} placeholder="2:00p" />
      </div>
      <div className="h-row-line h-row-date">
        <div className="h-label">Departure:</div>
        <DateInput value={hotel.checkOut} onChange={(d) => handleDateChange('checkOut', d)} className="f-date-sel" />
        <input className="f-inp s-time h-time" value={hotel.checkOutTime || ''} onChange={e => onUpdate(hotel.id, 'checkOutTime', e.target.value)} placeholder="11:00a" />
      </div>
    </div>
  );
};

const HotelPanel = ({ hotels, onUpdate, onDelete, onAdd }) => {
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


// --- Components ---


const SegmentedDateInput = ({ value, onChange, className }) => {
  const [mon, setMon] = useState(safeFormat(value, 'M'));
  const [day, setDay] = useState(safeFormat(value, 'd'));
  const [year, setYear] = useState(safeFormat(value, 'yy'));
  const [wd, setWd] = useState(safeFormat(value, 'EEE'));

  const dateInputRef = React.useRef(null);
  const monRef = React.useRef(null);
  const dayRef = React.useRef(null);
  const yearRef = React.useRef(null);
  const wdRef = React.useRef(null);
  const isInternalChange = React.useRef(false);

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
    if (newMon.length === 0 || newDay.length === 0 || newYear.length < 2) return;
    const m = parseInt(newMon);
    const d = parseInt(newDay);
    let y = parseInt(newYear);

    if (isNaN(m) || m < 1 || m > 12) return;
    if (isNaN(d) || d < 1 || d > 31) return;
    if (isNaN(y)) return;

    if (y < 100) y += 2000;

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
          className="si-num"
          value={mon}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').substring(0, 2);
            setMon(val);
            const isComplete = val.length === 2 || (val.length === 1 && parseInt(val) > 1 && val !== '0');
            if (isComplete) {
              dayRef.current?.focus();
              commitParts(val, day, year);
            }
          }}
          onBlur={() => {
            if (value && !isNaN(value.getTime())) {
              const v = format(value, 'M');
              setMon(v);
              commitParts(v, day, year);
            }
          }}
          onFocus={handleFocus}
          maxLength={2}
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
  const [days, setDays] = useState([
    {
      id: "day-0",
      date: new Date(2026, 3, 12),
      legs: [],
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
      legs: [],
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
      legs: [],
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
      legs: [],
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
      legs: [],
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
      legs: [],
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
  ]);

  const [conferenceCenter, setConferenceCenter] = useState('Conference Center');

  const [altCurrency, setAltCurrency] = useState('EUR');
  const [useAlt, setUseAlt] = useState(true);
  const [customRates, setCustomRates] = useState(MOCK_RATES);
  const [tripName, setTripName] = useState('Global Tech Summit');
  const [registrationFee, setRegistrationFee] = useState(750);
  const [registrationCurrency, setRegistrationCurrency] = useState('USD');
  const [hotels, setHotels] = useState([]);
  const [flights, setFlights] = useState([
    {
      id: 'f-1',
      pairId: 'p-1',
      airline: 'United',
      confirmation: 'CONF123',
      cost: 450,
      segments: [
        { id: 's-1', airlineCode: 'UA', flightNumber: '123', seat: '12A', depDate: 'Sun Apr 12 2026', depTime: '2:00p', depPort: 'SFO', arrDate: 'Sun Apr 12 2026', arrTime: '10:00p', arrPort: 'IAD' }
      ]
    },
    {
      id: 'f-2',
      pairId: 'p-1',
      airline: 'United',
      confirmation: 'CONF123',
      cost: 0,
      segments: [
        { id: 's-3', airlineCode: 'UA', flightNumber: '456', seat: '14C', depDate: 'Fri Apr 17 2026', depTime: '6:00p', depPort: 'IAD', arrDate: 'Sat Apr 18 2026', arrTime: '1:00a', arrPort: 'SFO' }
      ]
    }
  ]);

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

  const saveToHistory = useCallback((currentDays, currentTripName, currentRegistrationFee, currentRegistrationCurrency, currentAltCurrency, currentCustomRates, currentUseAlt, currentFlights, currentFlightTotal, currentHotels) => {
    setHistory(prev => ({
      past: [...prev.past.slice(-50), {
        days: currentDays,
        tripName: currentTripName,
        registrationFee: currentRegistrationFee,
        registrationCurrency: currentRegistrationCurrency,
        altCurrency: currentAltCurrency,
        customRates: currentCustomRates,
        useAlt: currentUseAlt,
        flights: currentFlights,
        flightTotal: currentFlightTotal,
        hotels: currentHotels
      }],
      future: []
    }));
  }, []);

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

      return {
        past: newPast,
        future: [{ days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels }, ...prev.future]
      };
    });
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels]);

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
      // Removed setFlightTotal as it's a derived state (useMemo)

      return {
        past: [...prev.past, { days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels }],
        future: newFuture
      };
    });
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels]);

  const [showMIE, setShowMIE] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const loadData = useCallback((data) => {
    try {
      if (data.days) {
        saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
        setDays(data.days.map(d => ({ ...d, date: new Date(d.date) })));
        if (data.tripName) setTripName(data.tripName);
        if (data.registrationFee !== undefined) setRegistrationFee(data.registrationFee);
        if (data.registrationCurrency) setRegistrationCurrency(data.registrationCurrency);
        if (data.altCurrency) setAltCurrency(data.altCurrency);
        if (data.customRates) setCustomRates(data.customRates);
        if (data.useAlt !== undefined) setUseAlt(data.useAlt);
        if (data.flights) setFlights(data.flights);
        if (data.hotels) setHotels(data.hotels.map(h => ({ ...h, checkIn: new Date(h.checkIn), checkOut: new Date(h.checkOut) })));
      }
    } catch (err) {
      alert('Error loading data');
    }
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, saveToHistory, flights, flightTotal, hotels]);

  // Handle Keyboard Shortcuts & Drag and Drop
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
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

  const saveToFile = () => {
    const data = JSON.stringify({ days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, hotels }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tripName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.json`;
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

      const activeItems = [...prev[activeIdx].legs];
      const overItems = [...prev[overIdx].legs];

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
      if (d.legs.some(l => l.id === id)) return d.id;
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
      const oldIndex = days[dayIdx].legs.findIndex(l => l.id === active.id);
      let newIndex = days[dayIdx].legs.findIndex(l => l.id === over.id);

      // Constraints for locked legs within the same day
      if (dayIdx === 0 && newIndex === 0) newIndex = 1;
      if (dayIdx === days.length - 1 && newIndex === days[dayIdx].legs.length - 1) {
        newIndex = days[dayIdx].legs.length - 2;
      }

      if (oldIndex !== newIndex && newIndex >= 0) {
        setDays((prev) => {
          const newDays = [...prev];
          const updatedLegs = arrayMove(newDays[dayIdx].legs, oldIndex, newIndex);
          newDays[dayIdx] = { ...prev[dayIdx], legs: updatedLegs };
          return newDays;
        });
      }
    }

    setActiveId(null);
  };

  const addLeg = (dayIdx) => {
    setDays(prev => {
      saveToHistory(prev, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
      const newDays = [...prev];
      const day = newDays[dayIdx];
      const lastLeg = day.legs[day.legs.length - 1];
      const newLeg = {
        id: generateId(),
        from: lastLeg?.to || 'Hotel',
        to: 'Site',
        type: 'uber',
        amount: 0,
        currency: 'USD',
        isForeign: false
      };
      newDays[dayIdx] = { ...day, legs: [...day.legs, newLeg] };
      return newDays;
    });
  };

  const addDay = () => {
    setDays(prev => {
      saveToHistory(prev, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
      const lastDay = prev[prev.length - 1];
      const newDate = addDays(lastDay?.date || new Date(), 1);
      const newDay = {
        ...lastDay,
        id: generateId(),
        date: newDate,
        legs: [],
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
    setDays(prev => {
      saveToHistory(prev, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
      const newDays = JSON.parse(JSON.stringify(prev));
      let targetLeg = null;
      newDays.forEach(d => d.legs.forEach(l => { if (l.id === legId) targetLeg = l }));

      if (targetLeg.mirrorId) {
        const currentMid = targetLeg.mirrorId;
        newDays.forEach(d => d.legs.forEach(l => { if (l.mirrorId === currentMid) l.mirrorId = null }));
      }
      return newDays;
    });
  };

  const updateLeg = useCallback((dayId, legId, field, value) => {
    setDays((prev) => {
      saveToHistory(prev, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
      const newDays = JSON.parse(JSON.stringify(prev));
      const day = newDays.find(d => d.id === dayId);
      const leg = day?.legs.find(l => l.id === legId);
      if (!leg) return prev;

      leg[field] = value;

      // Handle Flight Sync back to main panel
      if (leg.type === 'flight' && (field === 'from' || field === 'to')) {
        if (value.includes(' – ') && value.includes('(')) {
          const match = flights.find(f => {
            const first = f.segments?.[0];
            const last = f.segments?.[f.segments.length - 1];
            return `${first?.depPort} – ${last?.arrPort} (${f.airline})` === value;
          });
          if (match) {
            const first = match.segments?.[0];
            const last = match.segments?.[match.segments.length - 1];
            leg.from = first?.depPort || '';
            leg.to = last?.arrPort || '';
            leg.amount = match.cost || 0;
            if (match.segments.length > 1) {
              leg.layover = match.segments.slice(0, -1).map(s => s.arrPort).join(', ');
            } else {
              leg.layover = '';
            }

            if (leg.mirrorId) {
              newDays.forEach(d => d.legs.forEach(m => {
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
                const first = f.segments?.[0];
                const last = f.segments?.[f.segments.length - 1];
                return first?.depPort === leg.from && last?.arrPort === leg.to;
              });
              if (!exists) {
                return [...prevFlights, {
                  id: generateId(),
                  airline: 'Manual',
                  confirmation: '',
                  cost: 0,
                  segments: [{ id: generateId(), airlineCode: '', flightNumber: '', depDate: format(day.date, 'EEE MMM d'), depTime: '', depPort: leg.from, arrDate: format(day.date, 'EEE MMM d'), arrTime: '', arrPort: leg.to }]
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
        newDays.forEach(d => d.legs.forEach(m => {
          if (m.mirrorId === leg.mirrorId && m.id !== leg.id) {
            if (field === 'from') m.to = value;
            if (field === 'to') m.from = value;
            if (field === 'type' || field === 'amount' || field === 'currency' || field === 'isForeign') m[field] = value;
          }
        }));
      }

      const lIdx = day.legs.findIndex(l => l.id === legId);
      if (field === 'to' && day.legs[lIdx + 1]) {
        day.legs[lIdx + 1].from = value;
      }
      if (field === 'from' && day.legs[lIdx - 1]) {
        day.legs[lIdx - 1].to = value;
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

    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);

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
      segments: (f.segments || []).map(s => {
        const updateSegDate = (dateStr) => {
          if (!dateStr) return '';
          try {
            let d = null;
            if (dateStr.includes('/')) {
              d = parse(dateStr, 'M/d/yy', new Date());
              if (isNaN(d.getTime())) d = parse(dateStr, 'M/d/yyyy', new Date());
            } else {
              const year = oldStart.getFullYear();
              d = parse(dateStr, 'EEE MMM d', new Date(year, 0, 1));
              if (isNaN(d.getTime())) d = new Date(dateStr + ', ' + year);
            }
            if (!d || isNaN(d.getTime())) return dateStr;

            const shifted = addDays(d, diff);
            return safeFormat(shifted, 'M/d/yy');
          } catch (e) { return dateStr; }
        };
        return {
          ...s,
          depDate: updateSegDate(s.depDate),
          arrDate: updateSegDate(s.arrDate)
        };
      })
    })));

    // Shift hotels
    setHotels(prev => (prev || []).map(h => ({
      ...h,
      checkIn: addDays(h.checkIn, diff),
      checkOut: addDays(h.checkOut, diff)
    })));
  };

  const handleEndDateChange = (newEnd) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
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
            legs: [],
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
    setFlights(prev => {
      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
      const pairId = generateId();
      const newFlight = {
        id: generateId(),
        pairId,
        airline: '',
        confirmation: '',
        cost: 0,
        segments: [{
          id: generateId(),
          airlineCode: '',
          flightNumber: '',
          seat: '',
          depDate: days[0] ? format(days[0].date, 'M/d/yy') : '',
          depTime: '',
          depPort: '',
          arrDate: days[0] ? format(days[0].date, 'M/d/yy') : '',
          arrTime: '',
          arrPort: ''
        }]
      };
      const returnFlight = {
        id: generateId(),
        pairId,
        airline: '',
        confirmation: '',
        cost: 0,
        segments: [{
          id: generateId(),
          airlineCode: '',
          flightNumber: '',
          seat: '',
          depDate: days[days.length - 1] ? format(days[days.length - 1].date, 'M/d/yy') : '',
          depTime: '',
          depPort: '',
          arrDate: days[days.length - 1] ? format(days[days.length - 1].date, 'M/d/yy') : '',
          arrTime: '',
          arrPort: ''
        }]
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

      const updated = [...prev];
      updated.push(newFlight);
      updated.push(returnFlight);
      return updated;
    });
  };



  const deleteFlight = (id) => {
    setFlights(prev => {
      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFlight = (id, field, value) => {
    setFlights(prev => {
      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
      const updated = prev.map(f => f.id === id ? { ...f, [field]: value } : f);

      const current = updated.find(f => f.id === id);
      if (current.pairId) {
        return updated.map(f => {
          if (f.pairId === current.pairId && f.id !== id) {
            if (field === 'airline' || field === 'confirmation' || field === 'cost') {
              return { ...f, [field]: value };
            }
            if (field === 'segments') {
              const partners = value.map((s, idx) => {
                const counterpart = value[value.length - 1 - idx];
                return {
                  ...s,
                  id: generateId(),
                  depDate: '', depTime: '', depPort: counterpart.arrPort,
                  arrDate: '', arrTime: '', arrPort: counterpart.depPort
                };
              });
              return { ...f, segments: partners };
            }
          }
          return f;
        });
      }
      return updated;
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
    let globalChanged = false;
    const nextDays = days.map((day, dIdx) => {
      const dayStr = format(day.date, 'yyyy-MM-dd');
      let newLegs = [...day.legs];
      let dayChanged = false;

      flights.forEach(flight => {
        (flight.segments || []).forEach((seg, sIdx) => {
          const segDepDate = parseSegDate(seg.depDate);
          const segArrDate = parseSegDate(seg.arrDate);

          // Determine if this is an outbound trip (to destination) or return trip (to home)
          // Rough heuristic: first segment of first flight is usually outbound home->airport
          // last segment of last flight is usually return airport->home
          const isOutbound = dIdx < days.length / 2;

          if (segDepDate === dayStr) {
            const hasUberTo = newLegs.some(l => l.type === 'uber' && l.to === seg.depPort);
            if (!hasUberTo) {
              const flTime = parseTime(seg.depTime);
              // Outbound: 45 min drive (0.75h) arriving 3h before -> start 3.75h before
              // Return: 30 min drive (0.5h) arriving 3h before -> start 3.5h before
              const leadTime = isOutbound ? 3.75 : 3.5;
              const uberTimeNum = flTime ? (flTime - leadTime + 24) % 24 : 11;

              newLegs.push({
                id: generateId(),
                from: dIdx === 0 ? 'Home' : 'Hotel',
                to: seg.depPort,
                type: 'uber',
                time: formatTime(uberTimeNum),
                amount: 45,
                currency: 'USD'
              });
              dayChanged = true;
            }
          }

          if (segArrDate === dayStr) {
            const hasUberFrom = newLegs.some(l => l.type === 'uber' && l.from === seg.arrPort);
            if (!hasUberFrom) {
              const flArrTime = parseTime(seg.arrTime);
              // Start 1h after arrival
              const uberStart = flArrTime ? (flArrTime + 1) : 12;

              newLegs.push({
                id: generateId(),
                from: seg.arrPort,
                to: dIdx === days.length - 1 ? 'Home' : 'Hotel',
                type: 'uber',
                time: formatTime(uberStart),
                amount: 45,
                currency: 'USD'
              });
              dayChanged = true;
            }
          }
        });
      });

      if (dayChanged) {
        globalChanged = true;
        return { ...day, legs: newLegs };
      }
      return day;
    });

    if (globalChanged) {
      setDays(nextDays);
    }
  }, [flights, days.length]);

  // Ensure trip covers all flight segments
  React.useEffect(() => {
    if (days.length === 0) return;
    let maxDateStr = format(days[days.length - 1].date, 'yyyy-MM-dd');
    let needsUpdate = false;
    let newEnd = days[days.length - 1].date;

    flights.forEach(f => {
      (f.segments || []).forEach(s => {
        const arrDateStr = parseSegDate(s.arrDate);
        if (arrDateStr && arrDateStr > maxDateStr) {
          needsUpdate = true;
          maxDateStr = arrDateStr;
          newEnd = new Date(arrDateStr);
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

    const segments = flights.flatMap(f => f.segments || []);
    if (segments.length === 0) return;

    const sorted = segments.map(s => {
      const dep = parseSegDate(s.depDate);
      const arr = parseSegDate(s.arrDate);
      return { dep, arr, ...s };
    }).sort((a, b) => a.arr.localeCompare(b.arr));

    const firstArrSeg = sorted.find(s => s.arrPort && s.arrPort.toLowerCase() !== 'home');
    const lastDepSeg = [...sorted].reverse().find(s => s.depPort && s.depPort.toLowerCase() !== 'home');

    if (firstArrSeg && lastDepSeg) {
      const arrDateObj = new Date(firstArrSeg.arr);
      const depDateObj = new Date(lastDepSeg.dep);

      arrivalDate = arrDateObj;
      departureDate = depDateObj;
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

  const totals = useMemo(() => {
    let registration = convertCurrency(registrationFee, registrationCurrency, 'USD', currentRates);
    let fl = flights.reduce((sum, f) => sum + (f.cost || 0), 0);
    let travel = 0;
    let mieTotal = 0;

    days.forEach((day, idx) => {
      // M&IE
      mieTotal += calculateMIE(idx, days.length, day.mieBase, day.meals, day.isForeignMie);

      // Travel legs
      day.legs.forEach(l => {
        if (l.type !== 'flight') {
          travel += convertCurrency(l.amount * (l.type === 'drive' ? MI_RATE : 1), l.currency, 'USD', currentRates);
        }
      });
    });

    // Hotels
    const hotelTotal = hotels.reduce((acc, h) => {
      return acc + convertCurrency(h.cost, h.currency || 'USD', 'USD', currentRates);
    }, 0);

    return {
      registration,
      flights: fl,
      travel,
      mie: mieTotal,
      lodging: hotelTotal,
      grand: registration + fl + travel + mieTotal + hotelTotal
    };
  }, [days, flights, hotels, registrationFee, registrationCurrency, currentRates]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="travel-app dark">
        <main className="one-column-layout">
          <section className="trip-header-section glass">
            <div className="trip-header-container">
              <div className="trip-header-main">
                <input
                  className="trip-name-display"
                  value={tripName}
                  onChange={e => setTripName(e.target.value)}
                />
                <div className="trip-meta-row">
                  <div className="trip-dates-vertical-wrap">
                    <div className="header-dates-row">
                      <DateInput value={days[0].date} onChange={handleStartDateChange} className="header-date-input" />
                      <span className="date-sep">—</span>
                      <DateInput value={days[days.length - 1].date} onChange={handleEndDateChange} className="header-date-input" />
                    </div>
                    <div className="header-sub-row">
                      <span className="day-count">{days.length} Days</span>
                      <div className="conf-center-row">
                        <span className="conf-icon"><MapPin size={12} /></span>
                        <input
                          className="conf-input"
                          value={conferenceCenter}
                          onChange={(e) => setConferenceCenter(e.target.value)}
                          placeholder="Conference Center"
                        />
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(conferenceCenter)}`}
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
                </div>
              </div>


            </div>
          </section>

          <section className="timeline-section-panel glass">
            <div className="timeline-header-row">
              <div className="section-title"><Calendar size={16} /> TIMELINE</div>
              <button className={`mie-toggle-btn ${showMIE ? 'active' : ''}`} onClick={() => setShowMIE(!showMIE)}>
                {showMIE ? <Utensils size={14} /> : <CreditCard size={14} />} M&IE
              </button>
            </div>
            <div className="vertical-timeline">
              {days.map((day, idx) => (
                <TimelineDay
                  key={day.id}
                  day={day}
                  dayIndex={idx}
                  totalDays={days.length}
                  flights={flights}
                  hotels={hotels}
                  currentRates={currentRates}
                  showMIE={showMIE}
                  onEditEvent={(ev) => setEditingEvent(ev)}
                />
              ))}
            </div>
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
            />
          </section>

          <section className="hotels-section-panel">
            <HotelPanel
              hotels={hotels}
              onUpdate={(id, f, v) => setHotels(prev => prev.map(h => h.id === id ? { ...h, [f]: v } : h))}
              onDelete={(id) => setHotels(prev => prev.filter(h => h.id !== id))}
              onAdd={() => setHotels(prev => [...prev, { id: generateId(), name: '', checkIn: new Date(), checkInTime: '2:00p', checkOut: new Date(), checkOutTime: '11:00a', cost: 0, currency: 'USD' }])}
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
              </div>
            </div>
          </section>
        </main>

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
        .glass { background: var(--glass); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.4); border-radius: 1.5rem; }

        /* Header */
        .trip-header-section { padding: 1.5rem 2rem; }
        .trip-header-main { width: 100%; }

        .trip-name-display { background: transparent; border: none; font-size: 2rem; font-weight: 950; color: #fff; width: 100%; outline: none; margin-bottom: 0.5rem; letter-spacing: -0.02em; text-align: left; }
        .trip-meta-row { display: flex; align-items: center; gap: 2rem; color: var(--subtext); font-weight: 600; font-size: 0.9rem; }
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
          padding: 4px 12px;
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
        .si-sep { color: rgba(255,255,255,0.2); margin: 0 1px; font-weight: 300; }
        .si-cal { margin-left: 6px; color: #475569; cursor: pointer; display: flex; align-items: center; transition: color 0.2s; }
        .si-cal:hover { color: var(--accent); }
        .hidden-date-picker { visibility: hidden; width: 0; min-width: 0; height: 0; padding: 0; margin: 0; position: absolute; }
        
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
        .main-total-card .total-label { font-size: 0.8rem; font-weight: 900; color: var(--subtext); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 0.5rem; }
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
        .f-inp { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 3px 6px; color: #fff; outline: none; font-size: 0.75rem; transition: all 0.2s; }
        .f-inp:focus { border-color: var(--accent); background: rgba(0,0,0,0.5); }
        .f-inp::placeholder { color: #475569; }

        /* Flight Panel & Groups */
        .flight-panel, .hotel-panel { background: var(--glass); border: 1px solid var(--border); border-radius: 1.5rem; padding: 1.5rem; }
        .f-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
        .f-title { font-size: 0.8rem; font-weight: 900; color: var(--accent); letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; text-transform: uppercase; }
        
        .flight-group { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 1rem; padding: 1rem; margin-bottom: 1rem; transition: all 0.2s; }
        .f-group-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.75rem; }
        .f-grip-group { color: #475569; cursor: grab; }
        .f-meta-primary { flex: 1; display: flex; gap: 0.75rem; }
        .g-air { width: 120px; font-weight: 800; }
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
        .s-port { width: 45px !important; font-weight: 900; text-transform: uppercase; text-align: center; color: #fff !important; }
        .seg-arrow { color: #475569; font-size: 0.8rem; font-weight: 900; text-align: center; }

        .f-segment { background: rgba(0,0,0,0.15); border-radius: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.03); }
        .f-seg-grid { display: grid; grid-template-columns: 100px 140px 70px 60px 30px; gap: 4px 12px; align-items: center; }
        .f-grid-col { display: flex; flex-direction: column; gap: 4px; }
        .f-sub-label { display: flex; align-items: center; gap: 4px; font-size: 0.65rem; color: #94a3b8; font-family: 'JetBrains Mono', monospace; opacity: 0.7; }
        .s-full-num { background: transparent !important; border: none !important; width: 100%; color: var(--accent) !important; font-weight: 950 !important; text-align: left !important; font-size: 0.85rem !important; }
        .s-date { font-size: 0.7rem; width: 100% !important; }
        .s-time { width: 100% !important; font-size: 0.75rem; font-weight: 600; background: transparent !important; border: none !important; color: #94a3b8; }
        .s-port { width: 100% !important; font-weight: 900; text-transform: uppercase; color: #fff !important; background: transparent !important; border: none !important; text-align: left !important; font-size: 0.8rem; }
        .seat-label { font-weight: 950; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.6rem; }
        .s-seat { width: 45px !important; border-bottom: 1px dashed rgba(255,255,255,0.1) !important; text-align: left !important; background: transparent !important; color: #fff !important; font-weight: 800 !important; border-radius: 0 !important; padding: 0 !important; }
        .f-seg-del { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; grid-row: 1 / span 2; align-self: center; }

        .trip-header-section { padding: 2rem; border-radius: 2rem; margin-bottom: 2rem; }
        .trip-header-container { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; }
        .trip-header-main { flex: 1; }
        .header-actions { display: flex; flex-direction: column; gap: 1rem; align-items: flex-end; }
        
        .mie-toggle-btn { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 8px 16px; color: #94a3b8; font-weight: 900; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .mie-toggle-btn.active { background: var(--accent); color: #fff; border-color: transparent; }
        .mie-toggle-btn:hover { background: rgba(255,255,255,0.05); }
        .mie-toggle-btn.active:hover { background: var(--accent); opacity: 0.9; }

        .timeline-section-panel { padding: 2rem; background: var(--glass); border-radius: 1.5rem; border: 1px solid var(--border); margin-bottom: 2rem; overflow: visible; }
        .vertical-timeline { overflow: visible; }
        .timeline-date-side { width: 70px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; padding-top: 1.5rem; gap: 2px; border-bottom: 1px solid rgba(255,255,255,0.05); }

        .tl-dw { font-weight: 950; color: var(--accent); font-size: 0.85rem; text-transform: uppercase; }
        .tl-dm { font-size: 0.75rem; color: var(--subtext); font-weight: 800; font-family: 'JetBrains Mono', monospace; }
        
        .timeline-hours-container { flex: 1; position: relative; background: rgba(0,0,0,0.1); margin: 0; border-bottom: 1px solid rgba(255,255,255,0.05); padding-left: 60px; overflow: visible; }
        .hour-line { position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.04); }
        .hour-label { position: absolute; left: 70px; font-size: 0.55rem; color: #475569; font-weight: 950; transform: translateY(-50%); text-transform: uppercase; }
        
        .tl-marker-time { position: absolute; left: 5px; width: 45px; font-size: 0.65rem; font-weight: 950; color: var(--accent); transform: translateY(-50%); text-align: right; pointer-events: none; z-index: 50; text-shadow: 0 0 10px rgba(0,0,0,0.8); }
        .tl-marker-time.arr { color: #f8fafc; opacity: 0.9; }
        .tl-marker-time.hotel { color: #4ade80; }
        .tl-marker-time.travel { color: #818cf8; }

        .tl-event { position: absolute; left: 60px; right: 6px; border-radius: 8px; padding: 6px 12px; font-size: 0.7rem; font-weight: 950; overflow: hidden; display: flex; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s; }
        .tl-event.clickable { cursor: pointer; }
        .tl-event.clickable:hover { transform: scale(1.005); filter: brightness(1.1); z-index: 30 !important; }
        .flight-event { background: linear-gradient(135deg, var(--accent), #4f46e5); color: #fff; }
        .hotel-event { background: linear-gradient(135deg, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.2)); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.5); }

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

        .flight-label-compact { display: flex; flex-direction: column; width: 100%; height: 100%; justify-content: space-between; padding: 2px 0; }
        .tl-f-top { font-size: 0.65rem; font-weight: 950; }
        .tl-f-bottom { font-size: 0.65rem; font-weight: 950; text-align: right; }

        /* Hotel Row Fixes */
        .hotel-row-item { background: rgba(0,0,0,0.2); border-radius: 1rem; padding: 1rem; margin-bottom: 0.75rem; border: 1px solid rgba(255,255,255,0.03); }
        .h-row-line { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .h-row-top { justify-content: space-between; }
        .h-name { flex: 1; max-width: 200px; font-weight: 800; }
        .h-cost-actions { display: flex; align-items: center; gap: 0.5rem; }
        .h-row-date { font-size: 0.75rem; color: var(--subtext); }
        .h-label { width: 65px; font-weight: 900; color: #475569; text-transform: uppercase; font-size: 0.6rem; }
        .h-time { width: 60px !important; }

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
          .timeline-date-side { width: 55px; }
          .tl-dw { font-size: 0.7rem; }
          .tl-dm { font-size: 0.6rem; }
          .timeline-hours-container { padding-left: 45px; }
          .tl-marker-time { width: 35px; font-size: 0.55rem; left: 2px; }
          .tl-event { left: 45px; }

          
          /* Flight Row Mobile Fixes */
          .f-seg-grid { 
            grid-template-columns: 1fr auto;
            grid-template-areas: 
              "id del"
              "dates dates"
              "time port";
            gap: 12px 8px;
          }
          .f-id-col { grid-area: id; }
          .f-date-col { grid-area: dates; display: flex !important; flex-direction: row; gap: 12px; }
          .f-time-col { grid-area: time; display: flex; flex-direction: row; gap: 8px; }
          .f-port-col { grid-area: port; display: flex; flex-direction: row; gap: 8px; }
          .f-seg-del { grid-area: del; justify-self: end; align-self: start; }
          
          .f-route-display { grid-template-columns: 1fr auto 1fr; gap: 0.5rem; }
        }
        `}</style>
      </div>
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
  day.legs.forEach(l => {
    if (l.type !== 'flight') {
      travel += convertCurrency(l.amount * (l.type === 'drive' ? MI_RATE : 1), l.currency, 'USD', rates);
    }
  });
  const hotelInUSD = convertCurrency(hotelTotal, day.hotelCurrency || 'USD', 'USD', rates);
  return travel + mie + hotelInUSD;
}


export default App;
