import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Handle redirect result (for mobile fallback)
        getRedirectResult(auth)
            .then((result) => {
                if (result?.user) {
                    console.log("Redirect login successful:", result.user.displayName);
                    setUser(result.user);
                }
            })
            .catch((error) => {
                console.error("Redirect login error:", error);
            });

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            console.log("Auth state changed:", currentUser?.displayName || "null");
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Hybrid login: try popup first, fallback to redirect if blocked
    const login = async () => {
        try {
            // Try popup first (works better on desktop)
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Popup login successful:", result.user.displayName);
        } catch (error) {
            console.log("Popup failed, trying redirect:", error.code);
            // If popup blocked or failed, try redirect
            if (error.code === 'auth/popup-blocked' ||
                error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request') {
                signInWithRedirect(auth, googleProvider);
            } else {
                console.error("Login error:", error);
            }
        }
    };

    const logout = () => signOut(auth);

    const value = {
        user,
        login,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
