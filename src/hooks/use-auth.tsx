import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const PASSWORD_RECOVERY_KEY = "splity-password-recovery";

function isBrowserPasswordRecovery() {
  return (
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(PASSWORD_RECOVERY_KEY) === "true"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
    isBrowserPasswordRecovery,
  );

  useEffect(() => {
    const setRecoveryMode = (enabled: boolean) => {
      setIsPasswordRecovery(enabled);
      if (enabled) {
        window.sessionStorage.setItem(PASSWORD_RECOVERY_KEY, "true");
      } else {
        window.sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
      }
    };

    const handleAuthEvent = (event: AuthChangeEvent, newSession: Session | null) => {
      setSession(newSession);
      setLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        if (window.location.pathname !== "/reset-password") {
          window.location.replace("/reset-password");
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setIsPasswordRecovery(isBrowserPasswordRecovery());
      }
    };

    // Register listener first, then hydrate the current session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthEvent);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsPasswordRecovery(isBrowserPasswordRecovery());
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_KEY);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isPasswordRecovery,
        clearPasswordRecovery,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
