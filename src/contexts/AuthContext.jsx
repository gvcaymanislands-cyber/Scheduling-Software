import { createContext, useContext, useState, useEffect } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth,
} from 'firebase/auth'
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

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
    let profileUnsub = null

    const authUnsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      if (profileUnsub) { profileUnsub(); profileUnsub = null }

      if (user) {
        // Real-time listener — profile updates (schedule, allowances, etc)
        // reflect immediately without logging out and back in
        profileUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) setUserProfile({ id: snap.id, ...snap.data() })
          else setUserProfile(null)
          setLoading(false)
        })
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => {
      authUnsub()
      if (profileUnsub) profileUnsub()
    }
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const createEmployee = async (email, password, profileData) => {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
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
