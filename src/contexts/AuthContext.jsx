import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Detect mobile browser
const isMobileBrowser = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authDebug, setAuthDebug] = useState('Initializing...');

    useEffect(() => {
        setAuthDebug('Checking for redirect result...');

        // Handle redirect result (for mobile)
        getRedirectResult(auth)
            .then((result) => {
                if (result?.user) {
                    setAuthDebug(`Redirect success: ${result.user.displayName}`);
                    setUser(result.user);
                } else {
                    setAuthDebug('No redirect result');
                }
            })
            .catch((error) => {
                setAuthDebug(`Redirect error: ${error.code}`);
            });

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setAuthDebug(`Logged in: ${currentUser.displayName}`);
            } else {
                setAuthDebug('Not logged in');
            }
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Mobile-first login: use redirect on mobile, popup on desktop
    const login = async () => {
        const isMobile = isMobileBrowser();
        setAuthDebug(`Login starting (${isMobile ? 'mobile' : 'desktop'})...`);

        if (isMobile) {
            // Mobile: use redirect directly (popups often fail)
            setAuthDebug('Using redirect for mobile...');
            try {
                await signInWithRedirect(auth, googleProvider);
            } catch (error) {
                setAuthDebug(`Redirect failed: ${error.code}`);
                throw error;
            }
        } else {
            // Desktop: try popup first
            try {
                setAuthDebug('Trying popup...');
                const result = await signInWithPopup(auth, googleProvider);
                setAuthDebug(`Popup success: ${result.user.displayName}`);
            } catch (error) {
                setAuthDebug(`Popup failed: ${error.code}, trying redirect...`);
                // If popup blocked, try redirect
                if (error.code === 'auth/popup-blocked' ||
                    error.code === 'auth/popup-closed-by-user' ||
                    error.code === 'auth/cancelled-popup-request') {
                    await signInWithRedirect(auth, googleProvider);
                } else {
                    throw error;
                }
            }
        }
    };

    const logout = () => {
        setAuthDebug('Logging out...');
        return signOut(auth);
    };

    const value = {
        user,
        login,
        logout,
        loading,
        authDebug
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
