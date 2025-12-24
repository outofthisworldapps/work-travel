import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Plane, Train, Car, Navigation,
  Hotel, Utensils, CreditCard, ChevronRight,
  Download, RefreshCcw, DollarSign, MapPin,
  Bus, Info, Calendar, Home, GripVertical, X,
  Link2, Link2Off, Hash, AlertTriangle, Lock
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

const TimelineDay = ({ day, dayIndex, totalDays, flights, currentRates, onUpdateMeals, onAddLeg, checkInTime, checkOutTime }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Calculate M&IE components
  const mieTotal = calculateMIE(dayIndex, totalDays, day.mieBase, day.meals, day.isForeignMie);

  // Find flight segments for this day
  const dayStr = format(day.date, 'EEE MMM d');
  const dayFlights = [];
  flights.forEach(f => {
    f.segments.forEach(s => {
      if (s.depDate === dayStr || s.arrDate === dayStr) {
        dayFlights.push({ ...s, parentFlight: f });
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

  const checkInPos = parseTime(checkInTime) || 14;
  const checkOutPos = parseTime(checkOutTime) || 11;

  return (
    <div className="timeline-day-row">
      <div className="timeline-date-side">
        <div className="tl-dw">{format(day.date, 'EEE')}</div>
        <div className="tl-dm">{format(day.date, 'MMM d')}</div>
        <button className="tl-add-btn" onClick={() => onAddLeg(dayIndex)} title="Add travel leg to this day">
          <Plus size={10} />
        </button>
      </div>

      <div className="timeline-hours-container">
        {hours.map(h => (
          <div key={h} className="hour-line" style={{ top: `${(h / 24) * 100}%` }}>
            <span className="hour-label">{h % 12 || 12}{h < 12 ? 'a' : 'p'}</span>
          </div>
        ))}

        {/* Flight Boxes */}
        {dayFlights.map(s => {
          const start = s.depDate === dayStr ? parseTime(s.depTime) : 0;
          const end = s.arrDate === dayStr ? parseTime(s.arrTime) : 23.99;
          if (start === null || end === null) return null;

          return (
            <div
              key={s.id}
              className="tl-event flight-event"
              style={{
                top: `${getPosition(start)}%`,
                height: `${getPosition(end) - getPosition(start)}%`
              }}
            >
              <div className="tl-event-label">✈️ {s.airlineCode}{s.flightNumber} {s.depPort}→{s.arrPort}</div>
            </div>
          );
        })}

        {/* Hotel Boxes */}
        {day.hotelRate !== null && (
          <>
            <div
              className="tl-event hotel-event"
              style={{
                top: `${getPosition(checkInPos)}%`,
                height: `${getPosition(24) - getPosition(checkInPos)}%`
              }}
            >
              <div className="tl-event-label">🏨 {day.hotelName || 'Hotel'}</div>
            </div>
          </>
        )}
        {/* Morning part of hotel if day before had a hotel */}
        {day.prevHadHotel && (
          <div
            className="tl-event hotel-event"
            style={{
              top: `0%`,
              height: `${getPosition(checkOutPos)}%`
            }}
          >
            <div className="tl-event-label">🏨 {day.hotelName || 'Hotel'} (Out)</div>
          </div>
        )}
      </div>

      <div className="timeline-mie-side">
        <div className="tl-mie-total">{formatCurrency(mieTotal, 'USD')}</div>
        <div className="tl-mie-stack">
          {['B', 'L', 'D', 'I'].map(m => (
            <div
              key={m}
              className={`tl-meal-chip ${day.meals[m] !== false ? 'active' : ''}`}
              onClick={() => onUpdateMeals(day.id, m)}
            >
              {m}
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

        {leg.type === 'flight' && leg.layover && (
          <div className="leg-layover-faint">via {leg.layover}</div>
        )}

        <div className={`leg-money-compact ${leg.type === 'flight' ? 'grayed' : ''}`}>
          <div className="leg-foreign-wrap" onClick={() => onUpdate('isForeign', !leg.isForeign)}>
            <span className="icon-emoji">{leg.isForeign ? '🌍' : '🇺🇸'}</span>
          </div>
          <input
            type="number"
            className="leg-amount-input-compact"
            value={leg.amount}
            onChange={(e) => onUpdate('amount', parseFloat(e.target.value) || 0)}
            disabled={leg.type === 'flight'}
          />
          <span className="leg-curr-label">{leg.currency === 'USD' ? '$' : (leg.currency === 'EUR' ? '€' : (leg.currency === 'GBP' ? '£' : leg.currency))}</span>
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
  return (
    <div className="f-segment">
      <div className="f-seg-main">
        <div className="f-seg-info">
          <input className="f-inp s-code" value={segment.airlineCode || ''} onChange={e => onUpdate('airlineCode', e.target.value)} placeholder="FI" />
          <input className="f-inp s-num" value={segment.flightNumber || ''} onChange={e => onUpdate('flightNumber', e.target.value)} placeholder="642" />
        </div>
        <div className="f-seg-routes">
          <div className="f-row-line">
            <input className="f-inp s-date" value={segment.depDate || ''} onChange={e => onUpdate('depDate', e.target.value)} placeholder="Sun Apr 21" />
            <input className="f-inp s-time" value={segment.depTime || ''} onChange={e => onUpdate('depTime', e.target.value)} placeholder="8:30p" />
            <input className="f-inp s-port" value={segment.depPort || ''} onChange={e => onUpdate('depPort', e.target.value)} placeholder="BWI" />
          </div>
          <div className="f-row-line">
            <input className="f-inp s-date" value={segment.arrDate || ''} onChange={e => onUpdate('arrDate', e.target.value)} placeholder="Mon Apr 22" />
            <input className="f-inp s-time" value={segment.arrTime || ''} onChange={e => onUpdate('arrTime', e.target.value)} placeholder="6:25a" />
            <input className="f-inp s-port" value={segment.arrPort || ''} onChange={e => onUpdate('arrPort', e.target.value)} placeholder="KEF" />
          </div>
        </div>
        <button className="f-seg-del" onClick={onDelete}><Trash2 size={10} /></button>
      </div>
      {layover && <div className="f-layover">(layover {layover})</div>}
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
        const d = parse(dateStr, 'EEE MMM d', new Date());
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
        <input className="f-inp g-air" value={flight.airline || ''} onChange={e => onUpdate('airline', e.target.value)} placeholder="Airline" />
        <input className="f-inp g-conf" value={flight.confirmation || ''} onChange={e => onUpdate('confirmation', e.target.value)} placeholder="Conf#" />
        <div className="f-cost-wrap">
          <span className="unit">$</span>
          <input className="f-inp g-cost" type="number" value={flight.cost || ''} onChange={e => onUpdate('cost', parseFloat(e.target.value) || 0)} placeholder="0" />
        </div>
        <button className="f-del-group" onClick={onDelete}><X size={14} /></button>
      </div>
      <div className="f-segments-list">
        {(flight.segments || []).map((seg, idx) => (
          <FlightSegmentRow
            key={seg.id}
            segment={seg}
            onUpdate={(f, v) => updateSegment(seg.id, f, v)}
            onDelete={() => deleteSegment(seg.id)}
            isLast={idx === flight.segments.length - 1}
            layover={idx > 0 ? calculateLayover(flight.segments[idx - 1], seg) : null}
          />
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
        <div className="f-total-wrap">
          <span className="f-total-label">Total Flight Cost:</span>
          <div className="f-total-inp-wrap">
            <span className="unit">$</span>
            <span className="f-total-val">{totalCost}</span>
          </div>
        </div>
      </div>
      <DndContext collisionDetection={closestCorners} onDragEnd={dragEndHandler}>
        <SortableContext items={flights.map(f => f.id)} strategy={verticalListSortingStrategy}>
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
        </SortableContext>
      </DndContext>
      <button className="f-add-btn" onClick={onAdd} title="Adds an outbound and its reverse return leg">
        <Plus size={10} /> ADD OUTBOUND + RETURN PAIR
      </button>
    </div>
  );
};


// --- Components ---

const DateInput = ({ value, onChange, className }) => {
  const [localValue, setLocalValue] = useState(format(value, 'MM/dd/yy'));

  React.useEffect(() => {
    setLocalValue(format(value, 'MM/dd/yy'));
  }, [value]);

  const commit = () => {
    if (!localValue) {
      setLocalValue(format(value, 'MM/dd/yy'));
      return;
    }
    const formats = ['MM/dd/yy', 'M/d/yy', 'MM-dd-yy', 'M-d-yy', 'yyyy-MM-dd', 'MMM d, yyyy', 'MMM d, yy', 'EEE MM/dd/yy'];
    let parsed = null;
    for (const f of formats) {
      // Try parsing with each format
      try {
        const p = parse(localValue, f, new Date());
        if (!isNaN(p.getTime())) {
          parsed = p;
          break;
        }
      } catch (e) { }
    }

    if (parsed) {
      if (parsed.getFullYear() < 100) {
        parsed.setFullYear(2000 + parsed.getFullYear());
      }
      onChange(parsed);
    } else {
      setLocalValue(format(value, 'MM/dd/yy'));
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
  const [checkInTime, setCheckInTime] = useState('2:00p');
  const [checkOutTime, setCheckOutTime] = useState('11:00a');
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

  const saveToHistory = useCallback((currentDays, currentTripName, currentRegistrationFee, currentRegistrationCurrency, currentAltCurrency, currentCustomRates, currentUseAlt, currentFlights, currentFlightTotal) => {
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
        flightTotal: currentFlightTotal
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
      if (previous.flightTotal !== undefined) setFlightTotal(previous.flightTotal);

      return {
        past: newPast,
        future: [{ days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal }, ...prev.future]
      };
    });
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal]);

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
      if (next.flightTotal !== undefined) setFlightTotal(next.flightTotal);

      return {
        past: [...prev.past, { days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal }],
        future: newFuture
      };
    });
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal]);

  const loadData = useCallback((data) => {
    try {
      if (data.days) {
        saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
        setDays(data.days.map(d => ({ ...d, date: new Date(d.date) })));
        if (data.tripName) setTripName(data.tripName);
        if (data.registrationFee !== undefined) setRegistrationFee(data.registrationFee);
        if (data.registrationCurrency) setRegistrationCurrency(data.registrationCurrency);
        if (data.altCurrency) setAltCurrency(data.altCurrency);
        if (data.customRates) setCustomRates(data.customRates);
        if (data.useAlt !== undefined) setUseAlt(data.useAlt);
      }
    } catch (err) {
      alert('Error loading data');
    }
  }, [days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, saveToHistory]);

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
  }, [undo, redo, days, tripName, loadData]);

  const saveToFile = () => {
    const data = JSON.stringify({ days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt }, null, 2);
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

  const addDay = () => {
    setDays(prev => {
      saveToHistory(prev, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
      const lastDay = prev[prev.length - 1];
      const newDate = addDays(lastDay?.date || new Date(), 1);
      const newDay = {
        id: generateId(),
        date: newDate,
        legs: [],
        mieBase: 105,
        meals: { B: true, L: true, D: true, I: true },
        hotelRate: 185, hotelTax: 25, hotelCurrency: 'USD',
        maxLodging: 200,
        registrationFee: 0,
        location: lastDay?.location || '',
        isForeignMie: true,
        isForeignHotel: true,
        hotelName: '',
        overageCapPercent: 25
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
      saveToHistory(prev, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
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
      saveToHistory(prev, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
      const newDays = JSON.parse(JSON.stringify(prev));
      const day = newDays.find(d => d.id === dayId);
      const leg = day?.legs.find(l => l.id === legId);
      if (!leg) return prev;

      leg[field] = value;

      // Handle Flight Sync back to main panel
      if (leg.type === 'flight' && (field === 'from' || field === 'to')) {
        // If the value contains "–" and "()", it's likely a flight selection
        if (value.includes(' – ') && value.includes('(')) {
          // Extract flight info or find it
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

            // Sync mirrored leg
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
          // Freehand entry
          // If both from and to are set, check if we need to add to flights panel
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

      // Flip currency if toggling isForeign
      if (field === 'isForeign') {
        leg.currency = value ? altCurrency : 'USD';
      }

      // Symmetry
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
  }, [tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal, saveToHistory]);




  const handleDateRangeChange = (newStart, newEnd) => {
    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);

    const currentCount = days.length;
    const newCount = differenceInDays(newEnd, newStart) + 1;

    let newDays = [...days];

    if (newCount > currentCount) {
      // Add days in the middle (before the last day)
      const daysToAdd = newCount - currentCount;
      for (let i = 0; i < daysToAdd; i++) {
        // Use the second to last day as template if possible, else first day
        const templateIdx = currentCount > 1 ? currentCount - 2 : 0;
        const templateDay = days[templateIdx];

        const newDay = {
          ...templateDay,
          id: generateId(),
          legs: [],
          // Keep other settings like location, M&IE base, max lodging
        };
        // Insert before the last day
        newDays.splice(newDays.length - 1, 0, newDay);
      }
    } else if (newCount < currentCount) {
      // Remove days from the middle
      const daysToRemove = currentCount - newCount;
      for (let i = 0; i < daysToRemove; i++) {
        if (newDays.length > 2) {
          // Remove second-to-last day until only first and last remain
          newDays.splice(newDays.length - 2, 1);
        } else if (newDays.length > 1) {
          // If only 2 days left, remove the last one (becomes 1 day trip)
          newDays.splice(1, 1);
        }
      }
    }

    // Update all dates and IDs
    newDays = newDays.map((d, idx) => ({
      ...d,
      date: addDays(newStart, idx)
    }));

    setDays(newDays);
  };

  const addFlightLeg = () => {
    setFlights(prev => {
      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
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
      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFlight = (id, field, value) => {
    setFlights(prev => {
      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
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

  // Auto-populate Hotels based on Flights
  React.useEffect(() => {
    setDays(prevDays => {
      const updatedDays = autoPopulateHotels(flights, prevDays, {
        rate: prevDays.find(d => d.hotelRate > 0)?.hotelRate || 185,
        tax: prevDays.find(d => d.hotelTax > 0)?.hotelTax || 25,
        currency: prevDays.find(d => d.hotelCurrency)?.hotelCurrency || 'USD'
      });
      // Only update if something actually changed to avoid loops
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
    let lodging = 0;

    days.forEach((day, idx) => {
      // M&IE
      mieTotal += calculateMIE(idx, days.length, day.mieBase, day.meals, day.isForeignMie);

      // Lodging
      if (day.hotelRate !== null) {
        lodging += convertCurrency(day.hotelRate + day.hotelTax, day.hotelCurrency || 'USD', 'USD', currentRates);
      }

      // Travel legs
      day.legs.forEach(l => {
        if (l.type !== 'flight') {
          travel += convertCurrency(l.amount * (l.type === 'drive' ? MI_RATE : 1), l.currency, 'USD', currentRates);
        }
      });
    });

    return {
      registration,
      flights: fl,
      travel,
      mie: mieTotal,
      lodging,
      grand: registration + fl + travel + mieTotal + lodging
    };
  }, [days, flights, registrationFee, registrationCurrency, currentRates]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="travel-app dark">
        <main className="one-column-layout">
          <section className="trip-header-section glass">
            <input
              className="trip-name-display"
              value={tripName}
              onChange={e => setTripName(e.target.value)}
            />
            <div className="trip-meta-row">
              <div className="trip-dates-display">
                {format(days[0].date, 'EEE MMM d')} — {format(days[days.length - 1].date, 'EEE MMM d')}
              </div>
              <div className="trip-location-display">
                <MapPin size={14} />
                <span>{days[1]?.location || 'Multiple Locations'}</span>
              </div>
            </div>
          </section>

          <section className="totals-section glass">
            <div className="total-row main-total">
              <span className="total-label">Grand Total</span>
              <span className="total-value">{formatCurrency(totals.grand, 'USD')}</span>
            </div>
            <div className="totals-column">
              <div className="total-row">
                <span className="total-label">Registration</span>
                <span className="total-value">{formatCurrency(registrationFee, 'USD')}</span>
              </div>
              <div className="total-row">
                <span className="total-label">Flights</span>
                <span className="total-value">{formatCurrency(totals.flights, 'USD')}</span>
              </div>
              <div className="total-row">
                <span className="total-label">Hotels</span>
                <span className="total-value">{formatCurrency(totals.lodging, 'USD')}</span>
              </div>
              <div className="total-row">
                <span className="total-label">M&IE</span>
                <span className="total-value">{formatCurrency(totals.mie, 'USD')}</span>
              </div>
              <div className="total-row">
                <span className="total-label">Transportation</span>
                <span className="total-value">{formatCurrency(totals.travel, 'USD')}</span>
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

          <section className="hotels-section-panel glass">
            <div className="section-title"><Hotel size={16} /> HOTELS</div>
            <div className="hotel-settings-compact">
              <div className="h-sett">
                <span>In:</span>
                <input type="text" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} className="mini-inp" />
              </div>
              <div className="h-sett">
                <span>Out:</span>
                <input type="text" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} className="mini-inp" />
              </div>
            </div>
            <div className="hotel-list">
              {days.filter(d => d.hotelRate !== null).map(d => (
                <div key={d.id} className="hotel-entry-row">
                  <div className="h-date">{format(d.date, 'MMM d')}</div>
                  <input
                    className="h-name-input"
                    value={d.hotelName || ''}
                    onChange={e => syncLocationField(d.location, 'hotelName', e.target.value)}
                    placeholder="Hotel Name"
                  />
                  <div className="h-price">
                    {formatCurrency((d.hotelRate || 0) + (d.hotelTax || 0), 'USD')}
                  </div>
                </div>
              ))}
              {days.filter(d => d.hotelRate !== null).length === 0 && (
                <div className="no-hotels-msg">No hotels booked yet. Update flights to auto-populate.</div>
              )}
            </div>
          </section>

          <section className="timeline-section-panel glass">
            <div className="section-title"><Calendar size={16} /> TIMELINE</div>
            <div className="vertical-timeline">
              {days.map((day, idx) => (
                <TimelineDay
                  key={day.id}
                  day={{ ...day, prevHadHotel: idx > 0 && days[idx - 1].hotelRate !== null }}
                  dayIndex={idx}
                  totalDays={days.length}
                  flights={flights}
                  currentRates={currentRates}
                  checkInTime={checkInTime}
                  checkOutTime={checkOutTime}
                  onUpdateMeals={(dayId, meal) => {
                    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
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
        .travel-app { min-height: 100vh; background: #020617; padding: 1rem; color: #f8fafc; font-family: 'Outfit', sans-serif; }
        .glass { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 1.5rem; }
        
        .one-column-layout { max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
        
        /* Header Section */
        .trip-header-section { padding: 1.5rem; text-align: center; }
        .trip-name-display { background: transparent; border: none; font-size: 1.75rem; font-weight: 900; color: #fff; text-align: center; width: 100%; outline: none; margin-bottom: 0.5rem; }
        .trip-meta-row { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: #94a3b8; font-size: 0.9rem; }
        .trip-dates-display { font-weight: 700; color: #6366f1; }
        .trip-location-display { display: flex; align-items: center; gap: 4px; font-weight: 600; }

        /* Totals Section */
        .totals-section { padding: 1.5rem; }
        .total-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .total-row:last-child { border-bottom: none; }
        .total-label { font-size: 0.8rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .total-value { font-weight: 800; color: #fff; }
        .main-total { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid #6366f1; }
        .main-total .total-label { font-size: 1rem; color: #fff; }
        .main-total .total-value { font-size: 1.5rem; color: #6366f1; }

        .section-title { font-size: 0.75rem; font-weight: 900; color: #6366f1; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; }

        /* Flights Panel Overrides */
        .flight-panel { background: rgba(15, 23, 42, 0.4) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 1.5rem !important; }
        
        /* Hotels Section */
        .hotels-section-panel { padding: 1.5rem; }
        .hotel-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .hotel-entry-row { display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 0.75rem; }
        .h-date { font-size: 0.75rem; font-weight: 800; color: #64748b; width: 50px; }
        .h-name-input { background: transparent; border: none; font-weight: 700; color: #fff; flex: 1; outline: none; font-size: 0.9rem; }
        .h-price { font-weight: 800; color: #6366f1; }

        /* Timeline Section */
        .timeline-section-panel { padding: 1.5rem; }
        .vertical-timeline { position: relative; display: flex; flex-direction: column; border-left: 2px solid rgba(255,255,255,0.05); margin-left: 10px; }
        
        .timeline-day-row { display: flex; gap: 1rem; padding: 1.5rem 0; border-bottom: 1px dashed rgba(255,255,255,0.1); position: relative; }
        .timeline-date-side { width: 50px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; pt: 0.5rem; gap: 0.5rem; }
        .tl-dw { font-weight: 900; color: #6366f1; font-size: 0.8rem; text-transform: uppercase; }
        .tl-dm { font-size: 0.7rem; color: #94a3b8; font-weight: 600; }
        .tl-add-btn { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); color: #6366f1; border-radius: 4px; padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .tl-add-btn:hover { background: #6366f1; color: #fff; }

        .timeline-hours-container { flex: 1; height: 350px; position: relative; background: rgba(0,0,0,0.1); border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.03); }
        
        /* Hotel Settings */
        .hotel-settings-compact { display: flex; gap: 1rem; margin-bottom: 1rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 0.5rem; }
        .h-sett { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
        .mini-inp { background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff; width: 45px; text-align: center; font-weight: 800; }
        .no-hotels-msg { font-size: 0.8rem; color: #475569; font-style: italic; text-align: center; padding: 1rem; }
        .hour-line { position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.02); display: flex; align-items: center; }
        .hour-label { position: absolute; left: -25px; font-size: 0.55rem; color: #475569; font-weight: 700; }
        
        .tl-event { position: absolute; left: 10%; right: 5%; border-radius: 6px; padding: 4px 8px; font-size: 0.7rem; font-weight: 800; overflow: hidden; display: flex; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .flight-event { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border-left: 3px solid #fff; }
        .hotel-event { background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1)); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); border-left: 3px solid #4ade80; }
        .tl-event-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .timeline-mie-side { width: 80px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .tl-mie-total { font-weight: 900; color: #6366f1; font-size: 0.9rem; }
        .tl-mie-stack { display: flex; flex-direction: column; gap: 4px; width: 100%; }
        .tl-meal-chip { height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; font-size: 0.75rem; font-weight: 900; cursor: pointer; color: #94a3b8; transition: all 0.2s; }
        .tl-meal-chip.active { background: #6366f1; color: #fff; border-color: transparent; box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3); }

        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      </div>
    </DndContext>
  );
}

function StatBox({ label, value, main, onChange, currency, altCurrency, onCurrencyChange, rates }) {
  const isUSD = !currency || currency === 'USD';
  const usdEquiv = isUSD ? value : convertCurrency(value, currency, 'USD', rates);

  return (
    <div className={`stat-box ${main ? 'main' : ''}`}>
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
            {isUSD ? formatCurrency(value, 'USD') : `${value} ${currency}`}
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
    <div className={`meal-chip ${active ? 'active' : ''}`} onClick={onClick} title={label === 'I' ? 'Incidentals' : label}>
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
