import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Plane, Train, Car, Navigation,
  Hotel, Utensils, CreditCard, ChevronRight,
  Download, RefreshCcw, DollarSign, MapPin,
  Bus, Info, Calendar, Home, GripVertical, X,
  Link2, Link2Off, Hash, AlertTriangle, Lock, Globe
} from 'lucide-react';
import { format, addDays, differenceInDays, parse } from 'date-fns';
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

// --- Vertical Timeline Components ---

const TimelineDay = ({ day, dayIndex, totalDays, flights, currentRates, onUpdateMeals, onAddLeg, hotels }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Calculate M&IE components
  const mieTotal = calculateMIE(dayIndex, totalDays, day.mieBase, day.meals, day.isForeignMie);

  // Get individual meal costs
  const isFirstOrLast = totalDays > 1 && (dayIndex === 0 || dayIndex === totalDays - 1);
  const getMealPrice = (meal) => {
    const dayFactor = isFirstOrLast ? 0.75 : 1.0;
    return getMealCost(day.mieBase, meal, day.isForeignMie) * dayFactor;
  };

  // Find flight segments for this day - match by yyyy-MM-dd
  const dayStr = format(day.date, 'yyyy-MM-dd');
  const dayFlights = [];
  flights.forEach(f => {
    (f.segments || []).forEach(s => {
      // Try to match segment dates with day - safely parse dates
      let segDepDate = null;
      let segArrDate = null;
      try {
        if (s.depDate) {
          const parsed = parse(s.depDate, 'M/d/yy', new Date());
          if (!isNaN(parsed.getTime())) {
            segDepDate = format(parsed, 'yyyy-MM-dd');
          }
        }
        if (s.arrDate) {
          const parsed = parse(s.arrDate, 'M/d/yy', new Date());
          if (!isNaN(parsed.getTime())) {
            segArrDate = format(parsed, 'yyyy-MM-dd');
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
      if (segDepDate === dayStr || segArrDate === dayStr) {
        dayFlights.push({ ...s, parentFlight: f, segDepDate, segArrDate, dayStr });
      }
    });
  });

  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    let t = timeStr.toLowerCase().replace(' ', '');
    // Handle formats like 2p, 2:30p, 11a
    let meridiem = t.slice(-1);
    if (meridiem !== 'a' && meridiem !== 'p') meridiem = 'p'; // Default to p if missing
    let timePart = t.endsWith('a') || t.endsWith('p') ? t.slice(0, -1) : t;
    let [h, m] = timePart.split(':').map(Number);
    if (meridiem === 'p' && h < 12) h += 12;
    if (meridiem === 'a' && h === 12) h = 0;
    return h + (m || 0) / 60;
  };

  const getPosition = (time) => (time / 24) * 100;

  return (
    <div className="timeline-day-row">
      <div className="timeline-date-side">
        <div className="tl-dw">{format(day.date, 'EEE')}</div>
        <div className="tl-dm">{format(day.date, 'M/d/yy')}</div>
        <button className="tl-add-btn" onClick={() => onAddLeg(dayIndex)} title="Add travel leg to this day">
          <Plus size={12} />
        </button>
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
          const start = s.segDepDate === dayStr ? parseTime(s.depTime) : 0;
          const end = s.segArrDate === dayStr ? parseTime(s.arrTime) : 23.99;
          if (start === null && end === null) return null;
          const startPos = start !== null ? start : 0;
          const endPos = end !== null ? end : 23.99;

          return (
            <div
              key={s.id}
              className="tl-event flight-event"
              style={{
                top: `${getPosition(startPos)}%`,
                height: `${Math.max(getPosition(endPos) - getPosition(startPos), 5)}%`
              }}
            >
              <div className="tl-event-label">✈️ {s.airlineCode || ''}{s.flightNumber || ''} {s.depPort || ''}→{s.arrPort || ''}</div>
            </div>
          );
        })}

        {/* Hotel Boxes from Bookings */}
        {hotels.map(h => {
          const checkInDate = format(h.checkIn, 'yyyy-MM-dd');
          const checkOutDate = format(h.checkOut, 'yyyy-MM-dd');
          const currDate = format(day.date, 'yyyy-MM-dd');

          const isCheckInDay = checkInDate === currDate;
          const isCheckOutDay = checkOutDate === currDate;
          const isMidStay = currDate > checkInDate && currDate < checkOutDate;

          if (!isCheckInDay && !isCheckOutDay && !isMidStay) return null;

          let start = 0;
          let end = 23.99;

          if (isCheckInDay) start = parseTime(h.checkInTime) || 14;
          if (isCheckOutDay) end = parseTime(h.checkOutTime) || 11;

          return (
            <div
              key={h.id}
              className="tl-event hotel-event"
              style={{
                top: `${getPosition(start)}%`,
                height: `${getPosition(end) - getPosition(start)}%`
              }}
            >
              <div className="tl-event-label">🏨 {h.name || 'Hotel'}</div>
            </div>
          );
        })}

        {/* Travel Legs (Uber, etc.) */}
        {day.legs.map(l => {
          if (!l.time || l.type === 'flight') return null;
          const start = parseTime(l.time);
          if (start === null) return null;

          return (
            <div
              key={l.id}
              className="tl-event travel-event"
              style={{
                top: `${getPosition(start)}%`,
                height: '20px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}
            >
              <div className="tl-event-label">
                {l.type === 'uber' ? '🚕' : (l.type === 'drive' ? '🚗' : '📍')} {l.from}→{l.to} {l.amount > 0 ? `(${formatCurrency(l.amount, l.currency || 'USD')})` : ''}
              </div>
            </div>
          );
        })}
      </div>

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
  // Parse string dates for DateInput - expecting M/d/yy format
  let depDate = new Date();
  let arrDate = new Date();
  try {
    if (segment.depDate) {
      const p = parse(segment.depDate, 'M/d/yy', new Date());
      if (!isNaN(p.getTime())) depDate = p;
    }
    if (segment.arrDate) {
      const p = parse(segment.arrDate, 'M/d/yy', new Date());
      if (!isNaN(p.getTime())) arrDate = p;
    }
  } catch (e) { }

  const handleDateChange = (field, date) => {
    onUpdate(field, format(date, 'M/d/yy'));
  };

  return (
    <div className="f-segment">
      <div className="f-seg-main">
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
        <DateInput value={depDate} onChange={(d) => handleDateChange('depDate', d)} className="s-date" />
        <input className="f-inp s-time" value={segment.depTime || ''} onChange={e => onUpdate('depTime', e.target.value)} placeholder="8:30p" />
        <input className="f-inp s-port" value={segment.depPort || ''} onChange={e => onUpdate('depPort', e.target.value)} placeholder="BWI" />
        <span className="seg-arrow">→</span>
        <input className="f-inp s-port" value={segment.arrPort || ''} onChange={e => onUpdate('arrPort', e.target.value)} placeholder="KEF" />
        <input className="f-inp s-time" value={segment.arrTime || ''} onChange={e => onUpdate('arrTime', e.target.value)} placeholder="6:25a" />
        <DateInput value={arrDate} onChange={(d) => handleDateChange('arrDate', d)} className="s-date" />
        <button className="f-seg-del" onClick={onDelete}><Trash2 size={10} /></button>
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
        const d = parse(dateStr, 'M/d/yy', new Date());
        let t = timeStr.toLowerCase().replace(' ', '');
        let meridiem = t.slice(-1);
        let time = t.slice(0, -1);
        let [h, m] = time.split(':').map(Number);
        if (meridiem === 'p' && h < 12) h += 12;
        if (meridiem === 'a' && h === 12) h = 0;
        d.setHours(h, m || 0, 0, 0);
        return d;
      };
      const arr = parseDateTime(s1.arrDate, s1.arrTime);
      const dep = parseDateTime(s2.depDate, s2.depTime);
      const diff = (dep - arr) / (1000 * 60);
      if (diff <= 0) return null;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return hours > 0 ? `${hours}h${mins}m` : `${mins}m`;
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
      <div className="h-row-main">
        <input
          className="f-inp h-name"
          value={hotel.name || ''}
          onChange={e => onUpdate(hotel.id, 'name', e.target.value)}
          placeholder="Hotel Name"
        />
        <div className="h-dates-group">
          <div className="h-date-line">
            <DateInput value={hotel.checkIn} onChange={(d) => handleDateChange('checkIn', d)} className="f-date-sel" />
            <input className="f-inp s-time h-time-col" value={hotel.checkInTime || ''} onChange={e => onUpdate(hotel.id, 'checkInTime', e.target.value)} placeholder="2:00p" />
          </div>
          <div className="h-date-line">
            <DateInput value={hotel.checkOut} onChange={(d) => handleDateChange('checkOut', d)} className="f-date-sel" />
            <input className="f-inp s-time h-time-col" value={hotel.checkOutTime || ''} onChange={e => onUpdate(hotel.id, 'checkOutTime', e.target.value)} placeholder="11:00a" />
          </div>
        </div>
        <div className="f-cost-row">
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

const DateInput = ({ value, onChange, className, displayFormat = 'EEE M/d/yy' }) => {
  const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

  const getFormattedValue = (date) => {
    if (!isValidDate(date)) return '';
    try {
      return format(date, displayFormat);
    } catch (e) {
      return '';
    }
  };

  const [localValue, setLocalValue] = useState(getFormattedValue(value));
  const dateInputRef = React.useRef(null);

  React.useEffect(() => {
    setLocalValue(getFormattedValue(value));
  }, [value, displayFormat]);

  const commit = () => {
    if (!localValue) {
      setLocalValue(getFormattedValue(value));
      return;
    }
    const formats = [
      'EEE M/d/yy', 'MM/dd/yy', 'M/d/yy', 'MM-dd-yy', 'M-d-yy', 'yyyy-MM-dd',
      'MMM d, yyyy', 'MMM d, yy', 'MMM d', 'MMMM d', 'MMMM d, yyyy',
      'EEE MM/dd/yy', 'EEE MMM d'
    ];
    let parsed = null;
    for (const f of formats) {
      try {
        const p = parse(localValue, f, new Date());
        if (!isNaN(p.getTime())) {
          parsed = p;
          break;
        }
      } catch (e) { }
    }

    if (parsed) {
      if (parsed.getFullYear() < 100) parsed.setFullYear(2000 + parsed.getFullYear());
      onChange(parsed);
    } else {
      setLocalValue(getFormattedValue(value));
    }
  };

  return (
    <div className="date-input-wrap">
      <input
        type="text"
        className={className}
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          }
        }}
      />
      <div className="calendar-trigger" onClick={() => dateInputRef.current?.showPicker()}>
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

// --- Main App ---

function App() {
  const [days, setDays] = useState([
    {
      id: "day-1",
      date: new Date('2025-04-21'),
      legs: [
        { id: "leg-1", from: 'Home', to: 'BWI', type: 'uber', amount: 95, currency: 'USD', mirrorId: 'm1' },
        { id: "leg-2", from: 'BWI', to: 'CPH', type: 'flight', amount: 1200, currency: 'USD', mirrorId: 'm2', layover: 'KEF' },
        { id: "leg-3", from: 'CPH', to: 'Hotel', type: 'uber', amount: 40, currency: 'EUR', mirrorId: 'm3' },
      ],
      mieBase: 105,
      meals: { B: true, L: true, D: true, I: true },
      hotelRate: 0, hotelTax: 0, hotelCurrency: 'USD',
      maxLodging: 200,
      registrationFee: 0,
      location: 'Copenhagen',
      isForeignMie: true,
      isForeignHotel: true,
      hotelName: '',
      overageCapPercent: 25
    },
    {
      id: "day-2",
      date: new Date('2025-04-22'),
      legs: [],
      mieBase: 105,
      meals: { B: true, L: false, D: true, I: true },
      hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
      maxLodging: 200,
      registrationFee: 750,
      location: 'Copenhagen',
      isForeignMie: true,
      isForeignHotel: true,
      hotelName: '',
      overageCapPercent: 25
    },
    {
      id: "day-3",
      date: new Date('2025-04-23'),
      legs: [],
      mieBase: 105,
      meals: { B: true, L: false, D: true, I: true },
      hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
      maxLodging: 200,
      registrationFee: 0,
      location: 'Copenhagen',
      isForeignMie: true,
      isForeignHotel: true,
      hotelName: '',
      overageCapPercent: 25
    },
    {
      id: "day-4",
      date: new Date('2025-04-24'),
      legs: [
        { id: "leg-4", from: 'Hotel', to: 'CPH', type: 'uber', amount: 40, currency: 'EUR', mirrorId: 'm3' },
        { id: "leg-5", from: 'CPH', to: 'BWI', type: 'flight', amount: 0, currency: 'USD', mirrorId: 'm2' },
        { id: "leg-6", from: 'BWI', to: 'Home', type: 'uber', amount: 95, currency: 'USD', mirrorId: 'm1' },
      ],
      mieBase: 105,
      meals: { B: true, L: true, D: true, I: true },
      hotelRate: 0, hotelTax: 0, hotelCurrency: 'USD',
      maxLodging: 200,
      location: 'Baltimore',
      isForeignMie: false,
      isForeignHotel: false,
      hotelName: '',
      overageCapPercent: 25
    },

  ]);

  const [altCurrency, setAltCurrency] = useState('EUR');
  const [useAlt, setUseAlt] = useState(true);
  const [customRates, setCustomRates] = useState(MOCK_RATES);
  const [tripName, setTripName] = useState('Global Tech Summit');
  const [registrationFee, setRegistrationFee] = useState(750);
  const [registrationCurrency, setRegistrationCurrency] = useState('USD');
  const [hotels, setHotels] = useState([
    {
      id: 'h-1',
      name: 'Stayberry Inn',
      checkIn: new Date('2025-04-21'),
      checkInTime: '2:00p',
      checkOut: new Date('2025-04-24'),
      checkOutTime: '11:00a',
      cost: 630,
      currency: 'USD'
    }
  ]);
  const [flights, setFlights] = useState([
    {
      id: 'f-1',
      airline: 'IcelandAir',
      confirmation: '2DUVM2',
      cost: 1200,
      segments: [
        { id: 's-1', airlineCode: 'FI', flightNumber: '642', depDate: 'Sun Apr 21', depTime: '8:30p', depPort: 'BWI', arrDate: 'Mon Apr 22', arrTime: '6:25a', arrPort: 'KEF' },
        { id: 's-2', airlineCode: 'FI', flightNumber: '204', depDate: 'Mon Apr 22', depTime: '7:40a', depPort: 'KEF', arrDate: 'Mon Apr 22', arrTime: '12:55p', arrPort: 'CPH' }
      ]
    },
    {
      id: 'f-2',
      airline: 'IcelandAir',
      confirmation: '2DUVM2',
      cost: 0,
      segments: [
        { id: 's-3', airlineCode: 'FI', flightNumber: '', depDate: 'Wed Apr 24', depTime: '', depPort: 'CPH', arrDate: 'Wed Apr 24', arrTime: '', arrPort: 'BWI' }
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
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
    const diff = differenceInDays(newStart, days[0].date);
    if (diff === 0) return;

    // Shift days
    setDays(prev => prev.map(d => ({ ...d, date: addDays(d.date, diff) })));

    // Shift flights
    setFlights(prev => prev.map(f => ({
      ...f,
      segments: (f.segments || []).map(s => {
        const updateSegDate = (dateStr) => {
          if (!dateStr) return '';
          try {
            const d = parse(dateStr, 'M/d/yy', new Date());
            return format(addDays(d, diff), 'M/d/yy');
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
    setHotels(prev => prev.map(h => ({
      ...h,
      checkIn: addDays(h.checkIn, diff),
      checkOut: addDays(h.checkOut, diff)
    })));
  };

  const handleEndDateChange = (newEnd) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
    const newCount = differenceInDays(newEnd, days[0].date) + 1;
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
        segments: [{ id: generateId(), airlineCode: '', flightNumber: '', depDate: '', depTime: '', depPort: '', arrDate: '', arrTime: '', arrPort: '' }]
      };
      const returnFlight = {
        id: generateId(),
        pairId,
        airline: '',
        confirmation: '',
        cost: 0,
        segments: [{ id: generateId(), airlineCode: '', flightNumber: '', depDate: '', depTime: '', depPort: '', arrDate: '', arrTime: '', arrPort: '' }]
      };

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
    setDays(prevDays => {
      let changed = false;
      const nextDays = prevDays.map((day, dIdx) => {
        const dayStr = format(day.date, 'M/d/yy');
        const newLegs = [...day.legs];

        flights.forEach(flight => {
          (flight.segments || []).forEach(seg => {
            // Uber to airport (2 hours before dep)
            if (seg.depDate === dayStr) {
              const hasUberTo = newLegs.some(l => l.type === 'uber' && l.to === seg.depPort);
              if (!hasUberTo) {
                const origin = dIdx === 0 ? 'Home' : 'Hotel';
                // Calculate time: 2 hours before flight
                const flTime = parseTime(seg.depTime);
                let uberTime = '8:00a';
                if (flTime !== null) {
                  const uT = (flTime - 2 + 24) % 24;
                  const h = Math.floor(uT);
                  const m = Math.round((uT - h) * 60);
                  const period = h >= 12 ? 'p' : 'a';
                  const dispH = h % 12 || 12;
                  uberTime = `${dispH}:${m.toString().padStart(2, '0')}${period}`;
                }

                newLegs.push({
                  id: generateId(),
                  from: origin,
                  to: seg.depPort,
                  type: 'uber',
                  time: uberTime,
                  amount: 25,
                  currency: 'USD',
                  isForeign: false
                });
                changed = true;
              }
            }
            // Uber from airport to hotel/home (on arrival)
            if (seg.arrDate === dayStr) {
              const hasUberFrom = newLegs.some(l => l.type === 'uber' && l.from === seg.arrPort);
              if (!hasUberFrom) {
                const dest = dIdx === prevDays.length - 1 ? 'Home' : 'Hotel';
                newLegs.push({
                  id: generateId(),
                  from: seg.arrPort,
                  to: dest,
                  type: 'uber',
                  time: seg.arrTime || '12:00p',
                  amount: 25,
                  currency: 'USD',
                  isForeign: false
                });
                changed = true;
              }
            }
          });
        });

        if (changed) return { ...day, legs: newLegs };
        return day;
      });

      if (changed) return nextDays;
      return prevDays;
    });
  }, [flights]);

  // Auto-populate Hotels based on Flights
  React.useEffect(() => {
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
            <div className="trip-header-main">
              <input
                className="trip-name-display"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
              />
              <div className="trip-meta-row">
                <div className="trip-dates-wrap">
                  <DateInput value={days[0].date} onChange={handleStartDateChange} className="header-date-input" />
                  <span className="date-sep">—</span>
                  <DateInput value={days[days.length - 1].date} onChange={handleEndDateChange} className="header-date-input" />
                  <span className="day-count">{days.length} Days</span>
                </div>
              </div>
            </div>

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
          </section>

          <section className="totals-section glass">
            <div className="main-total-card">
              <span className="total-label">Grand Total</span>
              <span className="total-value">{formatCurrency(totals.grand, 'USD')}</span>
            </div>
            <div className="totals-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <CreditCard size={12} />
                  <span className="stat-label">REGISTRATION</span>
                  <button
                    className={`currency-toggle-mini ${registrationCurrency !== 'USD' ? 'active' : ''}`}
                    onClick={() => setRegistrationCurrency(prev => prev === 'USD' ? altCurrency : 'USD')}
                  >
                    {registrationCurrency !== 'USD' ? <Globe size={11} /> : <span className="unit-mini">$</span>}
                  </button>
                </div>
                <input
                  type="number"
                  className="stat-inp"
                  value={registrationFee}
                  onChange={e => setRegistrationFee(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <Plane size={12} />
                  <span className="stat-label">FLIGHTS</span>
                </div>
                <span className="stat-value">{formatCurrency(totals.flights, 'USD')}</span>
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
                  <Navigation size={12} />
                  <span className="stat-label">TRAVEL</span>
                </div>
                <span className="stat-value">{formatCurrency(totals.travel, 'USD')}</span>
              </div>
            </div>
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

          <section className="timeline-section-panel glass">
            <div className="section-title"><Calendar size={16} /> TIMELINE</div>
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
                  onUpdateMeals={(dayId, meal) => {
                    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, hotels);
                    setDays(prev => prev.map(d => d.id === dayId ? { ...d, meals: { ...d.meals, [meal]: !d.meals[meal] } } : d));
                  }}
                  onAddLeg={(dIdx) => addLeg(dIdx)}
                />
              ))}
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
          --accent: #6366f1;
          --text: #f8fafc;
          --subtext: #94a3b8;
        }

        body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; -webkit-font-smoothing: antialiased; }
        
        .travel-app { min-height: 100vh; background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 40%), radial-gradient(circle at bottom left, rgba(79, 70, 229, 0.05), transparent 40%); padding: 2rem 1rem; }
        .one-column-layout { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
        .glass { background: var(--glass); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.4); border-radius: 1.5rem; }

        /* Header */
        .trip-header-section { padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; }
        .trip-header-main { flex: 1; }
        .trip-name-display { background: transparent; border: none; font-size: 2rem; font-weight: 950; color: #fff; width: 100%; outline: none; margin-bottom: 0.5rem; letter-spacing: -0.02em; text-align: left; }
        .trip-meta-row { display: flex; align-items: center; gap: 1.5rem; color: var(--subtext); font-weight: 600; font-size: 0.9rem; }
        .trip-dates-wrap { display: flex; align-items: center; gap: 0.5rem; color: var(--subtext); font-weight: 700; font-size: 0.85rem; }
        .date-sep { opacity: 0.3; }
        .day-count { background: var(--accent); color: white; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; margin-left: 0.5rem; font-weight: 950; }
        
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
        .stat-card { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 1rem; padding: 1rem; display: flex; flex-direction: column; gap: 8px; transition: all 0.2s; }
        .stat-card:hover { border-color: rgba(99, 102, 241, 0.3); background: rgba(0,0,0,0.4); }
        .stat-header { display: flex; align-items: center; gap: 6px; width: 100%; }
        .stat-label { font-size: 0.65rem; font-weight: 900; color: var(--subtext); flex: 1; letter-spacing: 0.05em; }
        .stat-value { font-size: 1rem; font-weight: 950; color: #fff; }
        .stat-inp { background: transparent; border: none; color: #fff; font-size: 1rem; font-weight: 950; width: 100%; outline: none; padding: 0; }
        .stat-card svg { color: var(--accent); }

        /* Shared Form Styling - darker inputs */
        .f-inp { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 3px 6px; color: #94a3b8; outline: none; font-size: 0.75rem; transition: all 0.2s; }
        .f-inp:focus { border-color: var(--accent); background: rgba(0,0,0,0.5); }
        .f-inp::placeholder { color: #475569; }
        .unit { color: var(--accent); font-weight: 900; font-size: 0.8rem; margin-right: 4px; }

        /* Flight Panel & Groups */
        .flight-panel, .hotel-panel { background: var(--glass); border: 1px solid var(--border); border-radius: 1rem; padding: 1rem; }
        .f-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .f-title { font-size: 0.7rem; font-weight: 900; color: var(--accent); letter-spacing: 0.08em; display: flex; align-items: center; gap: 6px; }
        .f-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .f-add-btn { width: 100%; margin-top: 0.75rem; padding: 0.5rem; background: transparent; border: 1px dashed rgba(99, 102, 241, 0.3); color: #6366f1; border-radius: 0.5rem; font-weight: 700; font-size: 0.65rem; cursor: pointer; transition: all 0.2s; }
        .f-add-btn:hover { background: rgba(99, 102, 241, 0.1); border-color: var(--accent); }

        .flight-group { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem; }
        .f-group-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .f-grip-group { color: #475569; cursor: grab; }
        .f-meta-primary { flex: 1; display: flex; gap: 0.5rem; }
        .g-air { width: 100px; }
        .g-conf { width: 80px; }
        .f-cost-row { display: flex; align-items: center; gap: 0.25rem; }
        .f-cost-box { display: flex; align-items: center; background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); padding: 0 4px; }
        .g-cost { background: transparent !important; border: none !important; width: 55px !important; color: var(--accent) !important; font-weight: 800 !important; text-align: right !important; font-size: 0.75rem !important; }
        .f-del-group { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; }
        .f-del-group:hover { color: #ef4444; }

        /* Flight Segment - Single Line */
        .f-segment { background: rgba(0,0,0,0.15); border-radius: 0.5rem; padding: 0.5rem; margin-bottom: 0.25rem; }
        .f-seg-main { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
        .s-full-num { width: 55px; font-weight: 800; color: var(--accent) !important; text-align: center; }
        .s-date { width: 55px; font-size: 0.7rem; }
        .s-time { width: 45px; font-size: 0.7rem; }
        .s-port { width: 35px; font-weight: 800; text-transform: uppercase; text-align: center; }
        .seg-arrow { color: #475569; font-size: 0.7rem; }
        .f-seg-del { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 2px; margin-left: auto; }
        .f-seg-del:hover { color: #ef4444; }
        .f-add-seg { background: transparent; border: none; color: #6366f1; font-size: 0.65rem; font-weight: 700; cursor: pointer; padding: 4px 8px; display: flex; align-items: center; gap: 4px; }
        .f-layover { font-size: 0.6rem; color: #64748b; padding: 2px 0 0 8px; display: flex; align-items: center; gap: 4px; }
        .f-layover-divider { padding: 0.25rem 0.5rem; font-size: 0.6rem; color: #64748b; display: flex; align-items: center; gap: 4px; }

        /* Currency Toggle */
        .currency-toggle-mini { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 2px; display: flex; align-items: center; }
        .currency-toggle-mini:hover, .currency-toggle-mini.active { color: var(--accent); }
        .unit-mini { font-size: 0.7rem; font-weight: 900; color: var(--accent); }

        /* Hotels */
        .hotel-row-item { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem; }
        .h-row-main { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .h-name { width: 120px; }
        .h-dates-group { display: flex; gap: 0.5rem; flex: 1; }
        .h-date-line { display: flex; align-items: center; gap: 4px; }
        .h-time-col { width: 50px; }
        .h-cost { width: 60px; font-weight: 800; color: var(--accent) !important; text-align: right; }

        /* Date Input */
        .date-input-wrap { display: flex; align-items: center; gap: 2px; }
        .calendar-trigger { cursor: pointer; color: #64748b; padding: 2px; display: flex; align-items: center; }
        .calendar-trigger:hover { color: var(--accent); }
        .hidden-date-picker { visibility: hidden; width: 0; height: 0; position: absolute; }
        .header-date-input { background: transparent !important; border: none !important; color: var(--accent) !important; font-weight: 800 !important; font-size: 0.85rem !important; width: 65px !important; text-align: center !important; cursor: pointer; }

        /* Timeline */
        .timeline-section-panel { padding: 1.5rem 1rem; background: var(--glass); border-radius: 1.5rem; border: 1px solid var(--border); overflow-x: auto; }
        .section-title { font-size: 0.75rem; font-weight: 900; color: var(--accent); letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; }
        .vertical-timeline { display: flex; flex-direction: column; gap: 0; position: relative; min-width: 600px; }
        
        .timeline-day-row { display: flex; gap: 0.5rem; border-bottom: 2px solid rgba(255,255,255,0.02); position: relative; min-height: 120px; }
        .timeline-day-row:last-child { border-bottom: none; }
        .timeline-date-side { width: 55px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 1rem; gap: 4px; }
        .tl-dw { font-weight: 950; color: var(--accent); font-size: 0.75rem; text-transform: uppercase; }
        .tl-dm { font-size: 0.65rem; color: var(--subtext); font-weight: 800; }
        .tl-add-btn { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: var(--accent); border-radius: 6px; padding: 4px; cursor: pointer; margin-top: 8px; transition: all 0.2s; }
        .tl-add-btn:hover { background: var(--accent); color: white; }

        .timeline-hours-container { flex: 1; position: relative; background: rgba(0,0,0,0.1); overflow: hidden; }
        .hour-line { position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.03); }
        .hour-label { position: absolute; left: 6px; font-size: 0.5rem; color: #475569; font-weight: 900; transform: translateY(-50%); text-transform: uppercase; }
        
        .tl-event { position: absolute; left: 4px; right: 4px; border-radius: 6px; padding: 4px 10px; font-size: 0.65rem; font-weight: 950; overflow: hidden; display: flex; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); }
        .tl-event-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
        .flight-event { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; }
        .hotel-event { background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1)); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }

        .timeline-mie-side { width: 85px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; padding-top: 1rem; padding-right: 0.5rem; gap: 4px; }
        .tl-mie-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .tl-mie-total { font-weight: 950; color: var(--accent); font-size: 0.85rem; }
        .tl-mie-75 { font-size: 0.55rem; font-weight: 900; color: #f97316; background: rgba(249, 115, 22, 0.2); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(249, 115, 22, 0.3); }
        .tl-mie-stack { display: flex; flex-direction: column; gap: 2px; width: 100%; }
        .tl-meal-chip { height: 22px; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .tl-meal-chip.active { background: var(--accent); border-color: transparent; box-shadow: 0 0 10px rgba(99, 102, 241, 0.4); }
        .tl-m-label { font-size: 0.6rem; font-weight: 950; color: #64748b; }
        .tl-m-price { font-size: 0.55rem; font-weight: 850; color: #475569; }
        .tl-meal-chip.active .tl-m-label, .tl-meal-chip.active .tl-m-price { color: #fff; }

        /* Travel Legs */
        .travel-leg-item { display: flex; align-items: center; background: rgba(0,0,0,0.15); border-radius: 0.5rem; padding: 0.4rem; margin-bottom: 0.25rem; gap: 0.4rem; }
        .leg-content { display: flex; align-items: center; gap: 0.4rem; flex: 1; flex-wrap: wrap; }
        .drag-handle { color: #475569; cursor: grab; }
        .drag-handle.locked { cursor: default; color: #334155; }
        .leg-input-text-compact { background: transparent; border: none; color: #94a3b8; font-weight: 600; font-size: 0.75rem; outline: none; width: 70px; }
        .leg-type-select-compact { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: #94a3b8; font-size: 0.7rem; padding: 2px 4px; outline: none; }
        .leg-money-compact { display: flex; align-items: center; gap: 2px; background: rgba(0,0,0,0.2); border-radius: 4px; padding: 2px 4px; }
        .leg-foreign-wrap { cursor: pointer; font-size: 0.7rem; }
        .leg-amount-input-compact { width: 40px; background: transparent; border: none; color: var(--accent); font-weight: 800; text-align: right; outline: none; font-size: 0.75rem; }
        .leg-curr-label { font-size: 0.65rem; color: #64748b; font-weight: 700; }
        .leg-calc-val { font-size: 0.6rem; color: #64748b; }
        .leg-layover-faint { font-size: 0.6rem; color: #475569; }
        .link-btn-compact, .delete-leg-btn-compact { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 2px; }
        .link-btn-compact.active { color: var(--accent); }
        .delete-leg-btn-compact:hover { color: #ef4444; }
        .locked-icon { font-size: 0.7rem; }
        `}</style>
      </div>
    </DndContext>
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
