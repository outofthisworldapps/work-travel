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

const generateId = () => Math.random().toString(36).substr(2, 9);

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


  const totals = useMemo(() => {
    const base = days.reduce((acc, d, idx) => {
      const mie = calculateMIE(idx, days.length, d.mieBase, d.meals, d.isForeignMie !== false);
      let travel = 0;
      d.legs.forEach(l => travel += convertCurrency(l.amount * (l.type === 'drive' ? MI_RATE : 1), l.currency, 'USD', currentRates));

      const hotelTotal = d.hotelRate + d.hotelTax;
      const hotelInUSD = convertCurrency(hotelTotal, d.hotelCurrency || 'USD', 'USD', currentRates);

      acc.travel += travel;
      acc.mie += mie;
      acc.lodging += hotelInUSD;
      return acc;
    }, { travel: 0, mie: 0, lodging: 0 });

    const registrationInUSD = convertCurrency(registrationFee, registrationCurrency, 'USD', currentRates);

    return {
      ...base,
      fees: registrationInUSD,
      flights: flightTotal,
      grand: base.travel + base.mie + base.lodging + registrationInUSD + flightTotal
    };
  }, [days, registrationFee, registrationCurrency, flightTotal, currentRates]);

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
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="travel-app dark">
      <header className="main-header glass">
        <div className="header-layout">
          <div className="header-left">
            <div className="header-meta">
              <div className="trip-info">
                <div className="trip-name-wrap">
                  <input className="trip-name-input" value={tripName} onChange={e => {
                    saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                    setTripName(e.target.value);
                  }} style={{ minWidth: '300px' }} />
                  <div className="trip-dates">
                    <span className="dw">{format(days[0].date, 'EEE')}</span>
                    <DateInput
                      className="header-date-input"
                      value={days[0].date}
                      onChange={d => {
                        const duration = days.length - 1;
                        const newEnd = addDays(d, duration);
                        handleDateRangeChange(d, newEnd);
                      }}
                    />
                    <span className="date-sep">—</span>
                    <span className="dw">{format(days[days.length - 1].date, 'EEE')}</span>
                    <DateInput
                      className="header-date-input"
                      value={days[days.length - 1].date}
                      onChange={d => handleDateRangeChange(days[0].date, d)}
                    />
                    <span className="days-count">({days.length} {days.length === 1 ? 'day' : 'days'})</span>
                  </div>
                </div>
                <div className="history-controls">
                  <button className="icon-btn" onClick={undo} disabled={history.past.length === 0} title="Undo (Cmd+Z)">
                    <span className="icon-emoji">↩️</span>
                  </button>
                  <button className="icon-btn" onClick={redo} disabled={history.future.length === 0} title="Redo (Cmd+Shift+Z)">
                    <span className="icon-emoji">↪️</span>
                  </button>
                  <div className="v-divider" />
                  <button className="icon-btn" onClick={saveToFile} title="Save to File (Cmd+S)">
                    <span className="icon-emoji">💾</span>
                  </button>
                  <label className="icon-btn" title="Load from File">
                    <span className="icon-emoji">⬆️</span>
                    <input type="file" onChange={loadFromFile} style={{ display: 'none' }} accept=".json" />
                  </label>
                </div>
              </div>
            </div>
            <div className="summary-grid">
              <StatBox
                label="REGISTRATION"
                value={registrationFee}
                currency={registrationCurrency}
                altCurrency={altCurrency}
                onCurrencyChange={c => {
                  saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                  setRegistrationCurrency(c);
                }}
                onChange={v => {
                  saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                  setRegistrationFee(v);
                }}
                rates={currentRates}
              />
              <div className="v-divider-summary" />
              <StatBox label="FLIGHTS" value={totals.flights} rates={currentRates} />
              <div className="v-divider-summary" />
              <StatBox label="TRANSPORTATION" value={totals.travel} rates={currentRates} />
              <div className="v-divider-summary" />
              <StatBox label="M&IE" value={totals.mie} rates={currentRates} />
              <div className="v-divider-summary" />
              <StatBox label="LODGING" value={totals.lodging} rates={currentRates} />
              <div className="v-divider-summary" />
              <StatBox label="TOTAL" value={totals.grand} main rates={currentRates} />
            </div>
            <div className="x-rate-panel" style={{ marginTop: '1rem' }}>
              <div className="use-alt-toggle" onClick={() => setUseAlt(!useAlt)}>
                <span className="icon-emoji">{useAlt ? '🌍' : '$'}</span>
                <span className="toggle-label">{useAlt ? 'Global Rates On' : 'USD Only'}</span>
              </div>
              {useAlt && (
                <div className="rate-inputs">
                  <span className="rate-hint">1 USD = </span>
                  <input
                    className="custom-rate-input narrow-dark"
                    type="number"
                    value={customRates[altCurrency] || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setCustomRates(prev => ({ ...prev, [altCurrency]: val }));
                    }}
                  />
                  <input
                    className="custom-curr-name narrow-dark"
                    value={altCurrency}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      if (val.length <= 3) {
                        const old = altCurrency;
                        setAltCurrency(val);
                        setCustomRates(prev => {
                          const next = { ...prev };
                          next[val] = next[old];
                          if (val !== old) delete next[old];
                          return next;
                        });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="header-right">
            <FlightPanel
              flights={flights}
              totalCost={flightTotal}
              onUpdate={updateFlight}
              onDelete={deleteFlight}
              onAdd={addFlightLeg}
              dragEndHandler={handleFlightDragEnd}
            />
          </div>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="days-list">
          {days.map((day, dIdx) => {
            const mie = calculateMIE(dIdx, days.length, day.mieBase, day.meals, day.isForeignMie !== false);
            const hotelSubtotalRaw = day.hotelRate + day.hotelTax;
            const hotelTotalUSD = convertCurrency(hotelSubtotalRaw, day.hotelCurrency || 'USD', 'USD', currentRates);
            const hotelRateUSD = convertCurrency(day.hotelRate, day.hotelCurrency || 'USD', 'USD', currentRates);

            const lodgingOverageCap = day.overageCapPercent || 25;
            const valueToCompare = day.isForeignHotel !== false ? hotelTotalUSD : hotelRateUSD;
            const isOverMax = valueToCompare > day.maxLodging;
            const isRedZone = valueToCompare > (day.maxLodging * (1 + lodgingOverageCap / 100));

            return (
              <div key={day.id} className="day-card glass">
                <div className="day-meta">
                  <div className="date-badge">
                    <span className="dow">{format(day.date, 'EEE')}</span>
                    <span className="dom">{format(day.date, 'MMM d')}</span>
                  </div>
                  <div className="loc-pill">
                    <MapPin size={11} />
                    <input
                      className="loc-input"
                      value={day.location}
                      onChange={e => syncLocationField(day.location, 'location', e.target.value)}
                    />
                  </div>
                </div>

                <div className="travel-rail">
                  <SortableContext
                    id={day.id}
                    items={day.legs.map(l => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="legs-stack">
                      {day.legs.map((leg, lIdx) => (
                        <SortableTravelLeg
                          key={leg.id}
                          leg={leg}
                          isLockedStart={dIdx === 0 && lIdx === 0}
                          isLockedEnd={dIdx === days.length - 1 && lIdx === day.legs.length - 1}
                          onUpdate={(f, v) => updateLeg(day.id, leg.id, f, v)}
                          onDelete={() => deleteLeg(day.id, leg.id)}
                          onLinkToggle={() => toggleLink(leg.id)}
                          currentRates={currentRates}
                          flights={flights}
                        />

                      ))}
                      {day.legs.length === 0 && <div className="no-travel">No travel for this day</div>}
                    </div>
                  </SortableContext>
                  <button className="add-trip-btn" onClick={() => addLeg(dIdx)}>
                    <Plus size={12} /> ADD TRIP
                  </button>
                </div>

                <div className="per-diem-panel">
                  <div className="mie-header-compact">
                    <div className="p-label">M&IE</div>
                    <div className="rate-input-wrap">
                      <span className="unit">$</span>
                      <input
                        type="number"
                        className="mie-base-inp"
                        value={day.mieBase}
                        onChange={e => {
                          saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                          syncLocationField(day.location, 'mieBase', parseFloat(e.target.value) || 0);
                        }}
                      />
                    </div>
                    <span className={`day-status ${dIdx === 0 || dIdx === days.length - 1 ? 'q75' : 'full'}`}>
                      {dIdx === 0 || dIdx === days.length - 1 ? '75%' : '100%'}
                    </span>
                    <span className="mie-sep">=</span>
                    <strong className="mie-net">{formatCurrency(mie, 'USD')}</strong>
                    <div className="mie-toggle-small" onClick={() => {
                      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                      setDays(prev => prev.map(d => d.id === day.id ? { ...d, isForeignMie: !d.isForeignMie } : d));
                    }}>
                      <span className="icon-emoji">{day.isForeignMie ? '🌍' : '🇺🇸'}</span>
                    </div>
                  </div>

                  <div className="meal-controls compact-btns">
                    <MealChip label="B" active={day.meals.B} cost={getMealCost(day.mieBase, 'B', day.isForeignMie !== false)} onClick={() => {
                      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                      const m = { ...day.meals, B: !day.meals.B };
                      setDays(prev => prev.map(d => d.id === day.id ? { ...d, meals: m } : d));
                    }} />
                    <MealChip label="L" active={day.meals.L} cost={getMealCost(day.mieBase, 'L', day.isForeignMie !== false)} onClick={() => {
                      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                      const m = { ...day.meals, L: !day.meals.L };
                      setDays(prev => prev.map(d => d.id === day.id ? { ...d, meals: m } : d));
                    }} />
                    <MealChip label="D" active={day.meals.D} cost={getMealCost(day.mieBase, 'D', day.isForeignMie !== false)} onClick={() => {
                      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                      const m = { ...day.meals, D: !day.meals.D };
                      setDays(prev => prev.map(d => d.id === day.id ? { ...d, meals: m } : d));
                    }} />
                    <MealChip label="I" active={day.meals.I !== false} cost={getMealCost(day.mieBase, 'I', day.isForeignMie !== false)} onClick={() => {
                      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                      const m = { ...day.meals, I: day.meals.I === false };
                      setDays(prev => prev.map(d => d.id === day.id ? { ...d, meals: m } : d));
                    }} />
                  </div>
                </div>

                <div className="lodging-panel">
                  <div className="mie-header-compact">
                    <div className="p-label">HOTEL</div>
                    <input
                      className="hotel-name-inp"
                      placeholder="Hotel name..."
                      value={day.hotelName || ''}
                      onChange={e => {
                        saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                        syncLocationField(day.location, 'hotelName', e.target.value);
                      }}
                    />
                    {day.hotelRate !== null ? (
                      <button className="delete-leg-btn mini-del" style={{ opacity: 0.8 }} onClick={() => {
                        saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                        setDays(prev => prev.map(d => d.id === day.id ? { ...d, hotelRate: null, hotelTax: 0 } : d));
                      }}>
                        <Trash2 size={10} />
                      </button>
                    ) : null}
                    <div className="mie-toggle-small" onClick={() => {
                      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                      setDays(prev => prev.map(d => d.id === day.id ? {
                        ...d,
                        isForeignHotel: !d.isForeignHotel,
                        hotelCurrency: !d.isForeignHotel ? altCurrency : 'USD'
                      } : d));
                    }}>
                      <span className="icon-emoji">{day.isForeignHotel ? '🌍' : '🇺🇸'}</span>
                    </div>
                  </div>

                  {day.hotelRate !== null ? (
                    <div className="hotel-header-compact">
                      <div className="hotel-row">
                        <span className="h-lab">Room</span>
                        <div className="h-inp-wrap" style={(!day.isForeignHotel && isOverMax) ? { borderColor: isRedZone ? '#f43f5e' : '#f59e0b', background: isRedZone ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)' } : {}}>
                          <span className="h-unit">{day.hotelCurrency === 'EUR' ? '€' : (day.hotelCurrency === 'GBP' ? '£' : '$')}</span>
                          <input
                            type="number"
                            value={day.hotelRate === 0 ? '' : day.hotelRate}
                            placeholder="0"
                            onChange={e => {
                              saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                              setDays(prev => prev.map(d => d.id === day.id ? { ...d, hotelRate: parseFloat(e.target.value) || 0 } : d));
                            }}
                          />
                        </div>
                        <span className="h-op">+</span>
                        <span className="h-lab">Taxes</span>
                        <div className="h-inp-wrap">
                          <span className="h-unit">{day.hotelCurrency === 'EUR' ? '€' : (day.hotelCurrency === 'GBP' ? '£' : '$')}</span>
                          <input
                            type="number"
                            value={day.hotelTax === 0 ? '' : day.hotelTax}
                            placeholder="0"
                            onChange={e => {
                              saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                              setDays(prev => prev.map(d => d.id === day.id ? { ...d, hotelTax: parseFloat(e.target.value) || 0 } : d));
                            }}
                          />
                        </div>
                        <span className="h-op">=</span>
                        <span className="hotel-calc-val" style={(day.isForeignHotel && isOverMax) ? { color: isRedZone ? '#f43f5e' : '#f59e0b' } : {}}>
                          {formatCurrency(hotelTotalUSD, 'USD')}
                        </span>
                      </div>

                      <div className="hotel-row" title={day.isForeignHotel !== false ? "FOREIGN RULES: Cap includes taxes" : "DOMESTIC RULES: Cap excludes taxes"}>
                        <span className="h-lab">Max</span>
                        <div className="h-inp-wrap" style={{ borderColor: isRedZone ? '#f43f5e' : isOverMax ? '#f59e0b' : 'rgba(34, 197, 94, 0.3)' }}>
                          <span className="h-unit">$</span>
                          <input
                            type="number"
                            value={day.maxLodging}
                            onChange={e => {
                              saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                              syncLocationField(day.location, 'maxLodging', parseFloat(e.target.value) || 0);
                            }}
                          />
                        </div>
                        <span className="h-op">+</span>
                        <span className="h-lab">Extra</span>
                        <div className="h-inp-wrap">
                          <input
                            type="number"
                            value={day.overageCapPercent || 25}
                            onChange={e => {
                              saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                              const val = parseFloat(e.target.value) || 0;
                              setDays(prev => prev.map(d => d.id === day.id ? { ...d, overageCapPercent: val } : d));
                            }}
                          />
                          <span className="h-unit">%</span>
                        </div>
                        <span className="h-op">=</span>
                        <span className="hotel-calc-val">
                          {formatCurrency(day.maxLodging * (1 + (day.overageCapPercent || 25) / 100), 'USD')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="no-hotel-placeholder" onClick={() => {
                      saveToHistory(days, tripName, registrationFee, registrationCurrency, altCurrency, customRates, useAlt, flights, flightTotal);
                      setDays(prev => prev.map(d => d.id === day.id ? { ...d, hotelRate: 0, hotelTax: 0 } : d));
                    }}>
                      <Plus size={12} /> Add Hotel
                    </div>
                  )}
                </div>


                <div className="day-total-sum">
                  {formatCurrency(miesToDayTotal(day, mie, hotelSubtotalRaw, currentRates), 'USD')}
                </div>
              </div>
            );
          })}
          <button className="add-day-btn-wide" onClick={addDay}>
            <Plus size={20} /> ADD DAY
          </button>
        </div>

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
      </DndContext>

      <style>{`
        .travel-app { min-height: 100vh; background: #0f172a; padding: 1.5rem 1rem; color: #f8fafc; font-family: 'Outfit', sans-serif; }
        .glass { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); border-radius: 1.25rem; }
        
        .main-header { padding: 1.5rem 2rem; margin-bottom: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .header-layout { display: flex; gap: 2rem; justify-content: space-between; align-items: flex-start; }
        .header-left { flex: 1; min-width: 0; }
        .header-right { width: 440px; flex-shrink: 0; }

        .header-meta { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; }
        .trip-info { display: flex; align-items: flex-end; gap: 2rem; flex: 1; }
        .trip-name-wrap { display: flex; flex-direction: column; gap: 0.2rem; }
        .trip-name-input { background: transparent; border: none; font-size: 2rem; font-weight: 900; color: #fff; outline: none; background: linear-gradient(to right, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; width: auto; min-width: 400px; line-height: 1; }
        
        .trip-dates { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; font-weight: 600; color: #94a3b8; }
        .date-input-wrap { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.2s; cursor: text; }
        .header-date-input { background: transparent; border: none; color: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 700; outline: none; width: 62px; padding: 0; text-align: center; }
        .calendar-icon-wrap { position: relative; display: flex; align-items: center; cursor: pointer; opacity: 0.4; padding-left: 4px; border-left: 1px solid rgba(255,255,255,0.1); }
        .date-sep { opacity: 0.3; font-weight: 100; font-size: 1.2rem; }
        .days-count { color: #6366f1; font-weight: 800; }
        
        .summary-grid { display: flex; align-items: center; gap: 1rem; background: rgba(0,0,0,0.2); padding: 0.5rem 1rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; }
        .v-divider-summary { width: 1px; height: 20px; background: rgba(255,255,255,0.1); }
        .stat-box { display: flex; flex-direction: column; align-items: flex-start; min-width: 80px; }
        .stat-header-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
        .stat-label { font-size: 0.55rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 0px; }
        
        .stat-value-container { display: flex; align-items: center; gap: 6px; }
        .stat-mini-toggle { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 4px; color: #6366f1; font-size: 0.65rem; font-weight: 950; padding: 1px 4px; cursor: pointer; transition: all 0.2s; line-height: 1; height: 16px; display: flex; align-items: center; justify-content: center; }
        .stat-mini-toggle:hover { background: rgba(99, 102, 241, 0.2); border-color: #6366f1; }
        
        .stat-val { font-size: 1.25rem; font-weight: 900; color: #fff; white-space: nowrap; }
        .stat-box.main .stat-val { color: #6366f1; background: linear-gradient(to bottom, #fff, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.65rem; }
        
        .stat-input-wrap { display: flex; align-items: center; gap: 4px; }
        .stat-curr-label { font-size: 0.75rem; font-weight: 800; color: #64748b; margin-left: 2px; }
        .stat-equiv { font-size: 0.8rem; font-weight: 600; color: #64748b; margin-left: 4px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 8px; }

        .stat-input { background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff; font-weight: 900; font-size: 1.25rem; width: 65px; outline: none; padding: 0; }
        .history-controls { display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .icon-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        .v-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.1); margin: 0 4px; }

        .x-rate-panel { display: flex; align-items: center; gap: 1rem; }
        .rate-inputs { display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .rate-hint { font-size: 0.75rem; color: #64748b; font-weight: 600; }
        .custom-rate-input.narrow-dark { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); color: #6366f1; font-weight: 900; font-size: 0.85rem; width: 60px; border-radius: 4px; padding: 2px 6px; outline: none; }
        .custom-curr-name.narrow-dark { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); color: #fff; font-weight: 900; font-size: 0.85rem; width: 45px; border-radius: 4px; padding: 2px 6px; outline: none; text-transform: uppercase; }
        .trip-dates .dw { font-size: 0.85rem; font-weight: 800; color: #64748b; margin-right: -4px; }

        .flight-panel { padding: 1rem; border-radius: 1rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); }
        .f-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .f-title { font-size: 0.7rem; font-weight: 950; color: #6366f1; letter-spacing: 0.1em; display: flex; align-items: center; gap: 6px; }
        .f-total-wrap { display: flex; align-items: center; gap: 8px; }
        .f-total-label { font-size: 0.7rem; font-weight: 700; color: #94a3b8; }
        .f-total-inp-wrap { display: flex; align-items: center; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 4px; padding: 2px 6px; }
        .f-total-val { color: #fff; font-weight: 900; font-size: 0.9rem; width: 70px; text-align: right; }

        .f-list { display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 0.75rem; max-height: 400px; overflow-y: auto; padding-right: 4px; }
        .f-list::-webkit-scrollbar { width: 4px; }
        .f-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

        .flight-group { background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; }
        .f-group-header { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .f-grip-group { cursor: grab; opacity: 0.3; }
        .f-inp.g-air { font-weight: 900; width: 120px; font-size: 0.85rem; }
        .f-inp.g-conf { font-weight: 700; color: #94a3b8; width: 80px; font-size: 0.8rem; }
        .f-cost-wrap { display: flex; align-items: center; gap: 2px; margin-left: auto; background: rgba(0,0,0,0.2); padding: 1px 6px; border-radius: 4px; }
        .f-inp.g-cost { width: 60px; text-align: right; color: #6366f1; font-weight: 900; }
        .f-del-group { background: transparent; border: none; color: #f43f5e; opacity: 0.5; cursor: pointer; }

        .f-segments-list { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
        .f-segment { display: flex; flex-direction: column; gap: 2px; padding: 4px 6px; border-radius: 6px; transition: background 0.2s; }
        .f-segment:hover { background: rgba(255,255,255,0.02); }
        .f-seg-main { display: flex; align-items: center; gap: 12px; }
        .f-seg-info { display: flex; align-items: center; gap: 4px; width: 65px; flex-shrink: 0; }
        .f-seg-routes { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .f-row-line { display: flex; align-items: center; gap: 12px; }

        .f-inp { background: transparent; border: none; color: #fff; font-size: 0.75rem; font-weight: 700; outline: none; padding: 1px 2px; }
        .f-inp::placeholder { color: #475569; font-weight: 400; font-size: 0.7rem; }
        
        .f-inp.s-code { width: 22px; color: #6366f1; font-weight: 950; text-transform: uppercase; }
        .f-inp.s-num { width: 35px; }
        .f-inp.s-date { width: 85px; color: #94a3b8; }
        .f-inp.s-time { width: 55px; text-align: right; }
        .f-inp.s-port { width: 40px; font-weight: 900; color: #fff; text-transform: uppercase; }
        
        .f-seg-del { margin-left: auto; visibility: hidden; background: transparent; border: none; color: #f43f5e; padding: 2px; opacity: 0.5; }
        .f-segment:hover .f-seg-del { visibility: visible; }
        
        .f-layover { font-size: 0.65rem; color: #64748b; font-style: italic; padding-left: 77px; margin: 0px 0 4px 0; }

        .f-add-seg { background: transparent; border: 1px dashed rgba(255,255,255,0.05); color: #64748b; font-size: 0.6rem; padding: 2px 8px; border-radius: 4px; cursor: pointer; align-self: flex-start; margin-top: 4px; }
        .f-add-seg:hover { border-color: #6366f1; color: #fff; }

        .f-add-btn { background: transparent; border: 1px dashed rgba(255,255,255,0.1); color: #94a3b8; width: 100%; padding: 6px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; cursor: pointer; transition: all 0.2s; }
        .f-add-btn:hover { border-color: #6366f1; color: #fff; background: rgba(99, 102, 241, 0.05); }


        .themed-select-wrap { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 4px; padding-left: 4px; }
        .themed-select { background: transparent; border: none; color: #fff; font-size: 0.75rem; font-weight: 700; outline: none; padding: 2px; cursor: pointer; }

        .day-card { display: grid; grid-template-columns: 80px 1.4fr 180px 320px 140px; gap: 1rem; padding: 1.25rem 1rem; align-items: center; width: 100%; border-radius: 1.25rem; }
        .travel-rail { min-width: 400px; }
        
        .leg-content { display: flex; align-items: center; gap: 0.5rem; width: 100%; }
        .place-item.compact { background: rgba(0,0,0,0.3); border-radius: 6px; padding: 2px 6px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 4px; width: 105px; flex-shrink: 0; }
        .leg-input-text-compact { background: transparent; border: none; font-size: 0.8rem; color: #fff; width: 100%; outline: none; font-weight: 700; }
        
        .mode-box-compact { display: flex; align-items: center; flex-shrink: 0; }
        .leg-type-select-compact { font-size: 0.8rem !important; padding: 2px 4px !important; min-width: 90px; }

        .leg-money-compact { display: flex; align-items: center; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); gap: 4px; flex-shrink: 0; }
        .leg-amount-input-compact { background: transparent; border: none; color: #fff; font-weight: 900; font-size: 0.85rem; width: 45px; outline: none; text-align: right; }
        .leg-curr-label { font-size: 0.75rem; font-weight: 950; color: #6366f1; width: 12px; }
        .leg-calc-val { font-size: 0.7rem; font-weight: 900; color: #64748b; min-width: 50px; flex-shrink: 0; }

        .leg-actions-compact { display: flex; gap: 4px; align-items: center; margin-left: auto; }
        .delete-leg-btn-compact { color: #f43f5e; opacity: 0.3; }

        .legs-stack { display: flex; flex-direction: column; gap: 0.4rem; min-height: 44px; }
        .travel-leg-item { background: rgba(255,255,255,0.02); padding: 0.4rem 0.6rem; border-radius: 0.6rem; border: 1px solid rgba(255,255,255,0.04); transition: border-color 0.2s; }
        .drag-handle { cursor: grab; opacity: 0.2; }

        .per-diem-panel, .lodging-panel { background: rgba(255,255,255,0.01); border-radius: 12px; padding: 0.6rem; border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; }
        .mie-header-compact { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 800; color: #6366f1; margin-bottom: 0.4rem; white-space: nowrap; }
        .rate-input-wrap { display: flex; align-items: center; background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
        .mie-base-inp { background: transparent; border: none; color: #fff; font-weight: 900; font-size: 0.85rem; width: 35px; outline: none; text-align: center; }

        .hotel-header-compact { display: flex; flex-direction: column; gap: 0.4rem; }
        .hotel-row { display: grid; grid-template-columns: 40px 75px 15px 45px 75px 10px 1fr; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 800; color: #64748b; white-space: nowrap; }
        .h-lab { font-size: 0.65rem; text-transform: uppercase; opacity: 0.7; }
        .h-op { text-align: center; opacity: 0.4; font-weight: 400; }
        .h-inp-wrap { display: flex; align-items: center; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; padding: 0 4px; height: 24px; transition: all 0.2s; }
        .h-inp-wrap:focus-within { border-color: #6366f1; background: rgba(99, 102, 241, 0.05); }
        .h-inp-wrap input { background: transparent; border: none; color: #fff; font-weight: 900; font-size: 0.8rem; width: 100%; outline: none; padding: 0; }
        .h-unit { font-size: 0.7rem; color: #6366f1; font-weight: 900; margin-right: 2px; flex-shrink: 0; }
        .hotel-calc-val { font-size: 0.85rem; font-weight: 950; color: #6366f1; text-align: right; }
        .hotel-name-inp { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; color: #fff; font-size: 0.75rem; font-weight: 900; outline: none; width: 140px; padding: 2px 6px; }
        .hotel-name-inp:focus { border-color: #6366f1; }

        .meal-controls { display: flex; gap: 0.25rem; }
        .meal-chip { display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.03); padding: 3px 0; border-radius: 5px; cursor: pointer; border: 1px solid rgba(255,255,255,0.05); flex: 1; min-height: 32px; }
        .meal-chip.active { background: #6366f1; border-color: transparent; }
        .meal-chip .l { font-weight: 950; font-size: 0.65rem; color: #fff; line-height: 1; }
        .meal-chip .c { font-size: 0.5rem; color: #fff; opacity: 0.8; font-weight: 700; margin-top: 1px; }

        .no-travel { font-size: 0.7rem; color: #64748b; font-style: italic; opacity: 0.5; padding: 0.75rem; border: 1px dashed rgba(255,255,255,0.05); border-radius: 6px; text-align: center; cursor: default; flex: 1; display: flex; align-items: center; justify-content: center; }
        .add-day-btn-wide { background: rgba(99, 102, 241, 0.1); border: 1px dashed rgba(99, 102, 241, 0.4); color: #6366f1; padding: 1.25rem; border-radius: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.75rem; font-size: 1.1rem; font-weight: 900; letter-spacing: 0.1em; transition: all 0.2s; margin-top: 1rem; width: 100%; }
        .day-total-sum { text-align: right; font-size: 1.5rem; font-weight: 950; color: #6366f1; align-self: center; background: linear-gradient(to bottom, #fff, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; min-width: 120px; }

        .add-trip-btn { background: transparent; border: 1.25px dashed rgba(255,255,255,0.1); color: #64748b; border-radius: 6px; padding: 6px; width: 100%; margin-top: 0.6rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 900; letter-spacing: 0.05em; transition: all 0.2s; }

        .x-rate-panel { display: flex; align-items: center; gap: 1rem; }
        .use-alt-toggle { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .custom-rate-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); color: #6366f1; font-weight: 900; font-size: 0.85rem; width: 60px; border-radius: 4px; padding: 2px 6px; outline: none; }

        .leg-layover-faint { font-size: 0.65rem; color: #64748b; font-style: italic; margin-top: -4px; margin-bottom: 4px; padding-left: 24px; opacity: 0.8; }
        .leg-money-compact.grayed { opacity: 0.3; filter: grayscale(1); pointer-events: none; }

        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
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
