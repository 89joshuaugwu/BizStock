"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";
import { onUserSnapshot } from "@/lib/users";
import { onBusinessSnapshot } from "@/lib/business";
import { clearSessionCookie, syncSessionCookie } from "@/lib/auth";
import type { AppUser } from "@/types/user";
import type { Business } from "@/types/business";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  business: Business | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isOwnerOrAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  business: null,
  loading: true,
  isOwner: false,
  isAdmin: false,
  isOwnerOrAdmin: false,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // firebase Auth state — the entry point that tells us whether ANYONE is
  // signed in at all.
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user) {
        await syncSessionCookie();
      } else {
        clearSessionCookie();
        setAppUser(null);
      }
    });
    return () => unsubAuth();
  }, []);

  // Firestore /users/{uid} doc — role, active status, display name. All
  // updates to appUser happen inside the onSnapshot callback (a genuine
  // subscription to an external system), never synchronously in the
  // effect body itself.
  useEffect(() => {
    if (!firebaseUser) return;

    let deactivatedHandled = false;

    const unsubUser = onUserSnapshot(firebaseUser.uid, (user) => {
      if (user && !user.active && !deactivatedHandled) {
        deactivatedHandled = true;
        toast.error("Your account has been deactivated. Contact your business owner.");
        auth.signOut();
        clearSessionCookie();
        router.replace("/auth/login");
        return;
      }

      setAppUser(user);
    });

    return () => unsubUser();
  }, [firebaseUser, router]);

  useEffect(() => {
    const unsubBusiness = onBusinessSnapshot(setBusiness);
    return () => unsubBusiness();
  }, []);

  // We're still "loading" the user doc if we know someone is signed in
  // but appUser hasn't caught up to that uid yet (e.g. right after
  // switching accounts, or on first load before the snapshot arrives).
  // Derived at render time rather than tracked as its own state — this
  // is equivalent to the previous separate `userDocLoading` flag, but
  // avoids a synchronous setState-in-effect for the same result.
  const userDocLoading = !!firebaseUser && appUser?.uid !== firebaseUser.uid;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        business,
        loading: authLoading || userDocLoading,
        isOwner: appUser?.role === "owner",
        isAdmin: appUser?.role === "admin",
        isOwnerOrAdmin: appUser?.role === "owner" || appUser?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
