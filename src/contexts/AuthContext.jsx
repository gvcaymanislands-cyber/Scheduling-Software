import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

// Secondary Firebase app — used ONLY for creating new employees.
// Keeps the admin signed in on the primary app while creating accounts.
// getApps() check prevents crash on hot-reload in development.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const secondaryApp = getApps().find(a => a.name === 'secondary') || initializeApp(firebaseConfig, 'secondary')
const secondaryAuth = getAuth(secondaryApp)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) setUserProfile({ id: snap.id, ...snap.data() })
        else setUserProfile(null)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const createEmployee = async (email, password, profileData) => {
    // Create on the SECONDARY app — admin stays logged in on primary
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)

    // Write the Firestore profile using the new UID
    const profile = {
      uid: cred.user.uid,
      email,
      role: 'employee',
      isActive: true,
      isHidden: false,
      createdAt: serverTimestamp(),
      leaveAllowances: { annual: 20, sick: 10 },
      workSchedule: { type: 'fixed', workingDays: [1, 2, 3, 4, 5] },
      ...profileData,
    }
    await setDoc(doc(db, 'users', cred.user.uid), profile)

    // Sign the secondary app back out immediately — keeps it clean
    await signOut(secondaryAuth)

    return cred
  }

  const isAdmin = userProfile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, login, logout, createEmployee, isAdmin }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
