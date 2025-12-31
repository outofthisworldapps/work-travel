import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Save, Download, Trash2, Cloud, RotateCw, LogIn, LogOut, User as UserIcon, CloudUpload, CloudDownload } from 'lucide-react';
import { format } from 'date-fns';

const CloudTrips = ({ currentTripData, onLoadTrip, isSyncing, lastSync }) => {
    const { user, login, logout, authDebug } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Load cached trips from localStorage
    useEffect(() => {
        const cached = localStorage.getItem('cloudTripsCache');
        if (cached) {
            try {
                setTrips(JSON.parse(cached));
            } catch (e) {
                console.error('Error loading cached trips:', e);
            }
        }
    }, []);

    const fetchTrips = async () => {
        if (!user) return;
        setLoading(true);
        setError('');
        try {
            const tripsRef = collection(db, 'users', user.uid, 'trips');
            const q = query(tripsRef, orderBy('updatedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const tripsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTrips(tripsList);
            // Cache in localStorage
            localStorage.setItem('cloudTripsCache', JSON.stringify(tripsList));
        } catch (err) {
            console.error("Error fetching trips:", err);
            // Fallback if index is missing
            try {
                const tripsRef = collection(db, 'users', user.uid, 'trips');
                const querySnapshot = await getDocs(tripsRef);
                const tripsList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                tripsList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
                setTrips(tripsList);
                localStorage.setItem('cloudTripsCache', JSON.stringify(tripsList));
            } catch (retryErr) {
                setError('Failed to load trips.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchTrips();
        }
    }, [user]);

    const handleSaveTripById = async (tripId, tripName) => {
        if (!user) return;

        // Check if trying to save to a different project
        const currentName = currentTripData.trip.name || 'Untitled Trip';
        if (tripName !== currentName) {
            if (!confirm(`Save current trip "${currentName}" to "${tripName}"? This will overwrite the destination trip.`)) {
                return;
            }
        }

        try {
            const tripDataToSave = {
                ...currentTripData,
                updatedAt: serverTimestamp(),
                tripName: currentTripData.trip.name || 'Untitled Trip'
            };
            await updateDoc(doc(db, 'users', user.uid, 'trips', tripId), tripDataToSave);
            await fetchTrips();
        } catch (err) {
            console.error("Error saving trip:", err);
            setError('Failed to save trip.');
        }
    };

    const handleDeleteTrip = async (tripId) => {
        if (!confirm('Are you sure you want to delete this trip?')) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'trips', tripId));
            const updated = trips.filter(t => t.id !== tripId);
            setTrips(updated);
            localStorage.setItem('cloudTripsCache', JSON.stringify(updated));
        } catch (err) {
            console.error("Error deleting trip:", err);
            setError('Failed to delete trip.');
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'MMM d, yyyy');
    };

    const formatDateRange = (trip) => {
        if (!trip.trip?.startDate || !trip.trip?.endDate) return '';
        const start = new Date(trip.trip.startDate);
        const end = new Date(trip.trip.endDate);
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    };

    const formatSyncTime = (timestamp) => {
        if (!timestamp) return '';
        const now = new Date();
        const isToday = now.toDateString() === timestamp.toDateString();

        if (isToday) {
            return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else {
            return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    };

    const formatDateTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'MMM d, yyyy') + ' ' + format(date, 'h:mm a');
    };

    const [authStatus, setAuthStatus] = useState('');
    const [authError, setAuthError] = useState('');

    const handleLogin = async () => {
        setAuthStatus('Starting login...');
        setAuthError('');
        try {
            await login();
            setAuthStatus('Login initiated');
        } catch (err) {
            setAuthError(`Error: ${err.code || err.message}`);
            setAuthStatus('');
        }
    };

    const handleSignOut = () => {
        if (confirm('Sign out of cloud sync?')) {
            logout();
        }
    };

    const isCurrentTrip = (trip) => {
        return trip.tripName === currentTripData.trip.name;
    };

    if (!user) {
        return (
            <div className="cloud-trips-panel glass" style={{ padding: '2rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <Cloud size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                <h3>Cloud Sync</h3>
                <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1.5rem' }}>Log in to sync your trips across all devices.</p>

                {authStatus && (
                    <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', color: '#818cf8' }}>
                        {authStatus}
                    </div>
                )}

                {authError && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '8px 12px', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', color: '#f87171' }}>
                        {authError}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    className="btn-primary"
                    style={{ margin: '0 auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <LogIn size={18} /> Sign In with Google
                </button>

                <p style={{ opacity: 0.4, fontSize: '0.7rem', marginTop: '1rem' }}>
                    Debug: {navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'} detected
                </p>
                <p style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px' }}>
                    Auth: {authDebug}
                </p>
            </div>
        );
    }

    return (
        <div className="cloud-trips-panel glass" style={{ padding: '1rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <div
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', flex: 1 }}
                    onClick={handleSignOut}
                    title="Click to sign out"
                >
                    <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '8px', borderRadius: '50%' }}>
                        <UserIcon size={16} color="#818cf8" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.displayName || 'Traveler'}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {isSyncing ? (
                                <><RotateCw size={10} className="spin" /> Syncing...</>
                            ) : lastSync ? (
                                <>✓ Synced {formatSyncTime(lastSync)}</>
                            ) : (
                                <>✓ Ready</>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '0.5rem', fontSize: '0.8rem' }}>{error}</div>}

            <div className="trips-list" style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {loading ? (
                    <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.6 }}>Loading trips...</div>
                ) : trips.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>No saved trips found.</div>
                ) : (
                    trips.map(trip => {
                        const isCurrent = isCurrentTrip(trip);
                        return (
                            <div
                                key={trip.id}
                                className="cloud-trip-item glass"
                                style={{
                                    padding: '10px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderRadius: '6px',
                                    background: isCurrent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                                    border: isCurrent ? '1px solid rgba(16, 185, 129, 0.3)' : 'none'
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{trip.tripName || trip.trip?.name || 'Untitled'}</span>
                                        {isCurrent && <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600 }}>● CURRENT</span>}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '2px' }}>
                                        <div style={{ marginBottom: '2px' }}>
                                            {formatDateRange(trip)}
                                            {trip.trip?.city && (
                                                <span style={{ marginLeft: '8px', opacity: 0.8 }}>📍 {trip.trip.city}</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>
                                            Saved: {formatDateTime(trip.updatedAt)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handleSaveTripById(trip.id, trip.tripName)}
                                        title="Save current trip here"
                                        style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                    >
                                        <CloudUpload size={16} />
                                    </button>
                                    <button
                                        onClick={() => onLoadTrip(trip)}
                                        title="Load this trip"
                                        style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                    >
                                        <CloudDownload size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTrip(trip.id)}
                                        title="Delete Trip"
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CloudTrips;
