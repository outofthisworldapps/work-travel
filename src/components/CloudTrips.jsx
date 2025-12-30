import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Save, Download, Trash2, Cloud, RotateCw } from 'lucide-react';
import { format } from 'date-fns';

const CloudTrips = ({ currentTripData, onLoadTrip, onSaveSuccess }) => {
    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

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
        } catch (err) {
            console.error("Error fetching trips:", err);
            // Fallback if index is missing (often happens with new queries)
            try {
                const tripsRef = collection(db, 'users', user.uid, 'trips');
                const querySnapshot = await getDocs(tripsRef);
                const tripsList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Client-side sort if server sort fails
                tripsList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
                setTrips(tripsList);
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

    const handleSaveTrip = async () => {
        if (!user) return;
        setSaving(true);
        setError('');
        try {
            const tripName = currentTripData.trip.name || 'Untitled Trip';

            // Check if we should update an existing trip or create a new one
            // For now, let's simple create/update logic based on name matching could be risky.
            // Better to just save as new or allow overwriting if we tracked ID. 
            // Since App.jsx doesn't track a "cloudID", we'll just add a new doc or maybe matches by name?
            // Let's just Add New for safety, or check if name exists.

            const tripDataToSave = {
                ...currentTripData,
                updatedAt: serverTimestamp(),
                tripName: tripName // valid top-level field for easy access
            };

            const tripsRef = collection(db, 'users', user.uid, 'trips');

            // Optional: Check existence by name?
            // For this implementation, I'll essentially "upsert" if I can find a trip with the EXACT same name, otherwise create new.
            const q = query(tripsRef, where("tripName", "==", tripName));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                if (!confirm(`Overwrite existing trip "${tripName}"?`)) {
                    setSaving(false);
                    return;
                }
                const docId = querySnapshot.docs[0].id;
                await updateDoc(doc(db, 'users', user.uid, 'trips', docId), tripDataToSave);
            } else {
                await addDoc(tripsRef, tripDataToSave);
            }

            await fetchTrips();
            if (onSaveSuccess) onSaveSuccess();
        } catch (err) {
            console.error("Error saving trip:", err);
            setError('Failed to save trip.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTrip = async (tripId) => {
        if (!confirm('Are you sure you want to delete this trip?')) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'trips', tripId));
            setTrips(trips.filter(t => t.id !== tripId));
        } catch (err) {
            console.error("Error deleting trip:", err);
            setError('Failed to delete trip.');
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        // Handle Firestore Timestamp
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, 'MMM d, yyyy HH:mm');
    };

    if (!user) return <div className="p-4 text-center">Please log in to save trips.</div>;

    return (
        <div className="cloud-trips-panel glass" style={{ padding: '1rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cloud size={16} /> Cloud Trips
                </h3>
                <button
                    className="btn-primary"
                    onClick={handleSaveTrip}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
                >
                    {saving ? <RotateCw className="spin" size={14} /> : <Save size={14} />}
                    Save Current
                </button>
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '0.5rem', fontSize: '0.8rem' }}>{error}</div>}

            <div className="trips-list" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {loading ? (
                    <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.6 }}>Loading trips...</div>
                ) : trips.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>No saved trips found.</div>
                ) : (
                    trips.map(trip => (
                        <div key={trip.id} className="cloud-trip-item glass" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{trip.tripName || trip.trip?.name || 'Untitled'}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{formatDate(trip.updatedAt)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => onLoadTrip(trip)}
                                    title="Load Trip"
                                    style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '4px' }}
                                >
                                    <Download size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteTrip(trip.id)}
                                    title="Delete Trip"
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CloudTrips;
