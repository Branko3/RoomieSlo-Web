"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSupabaseConfig } from "../lib/config";
import {
  addFavorite,
  removeFavorite,
  type FavoritesClient,
} from "../lib/favorites/favorites-api";
import {
  adoptServerFavorites,
  LOCAL_FAVORITES_KEY,
  readLocalFavorites,
  toggleFavoriteOptimistically,
} from "../lib/favorites/favorites-sync";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { CloseIcon } from "./icons";

type FavoriteContextValue = {
  favorites: string[];
  isFavorite: (listingId: string) => boolean;
  toggleFavorite: (listingId: string) => void;
  /** Clears in-memory favorites (used by logout). */
  resetFavorites: () => void;
  /** Signed-in favorites are stored in Supabase; otherwise in this browser. */
  storage: "local" | "remote";
  userId: string | null;
  favoriteError: string | null;
  dismissFavoriteError: () => void;
};

const FavoriteContext = createContext<FavoriteContextValue | null>(null);

export function useFavorites() {
  const context = useContext(FavoriteContext);
  if (!context) {
    throw new Error("useFavorites must be used inside Providers");
  }
  return context;
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
        },
      }),
  );
  const [favorites, setFavorites] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const favoritesRef = useRef<string[]>([]);
  const clientRef = useRef<FavoritesClient | null>(null);

  const applyFavorites = useCallback((next: string[]) => {
    favoritesRef.current = next;
    setFavorites(next);
  }, []);

  useEffect(() => {
    if (!getSupabaseConfig().configured) {
      applyFavorites(readLocalFavorites(browserStorage()));
      setFavoritesLoaded(true);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    clientRef.current = supabase as unknown as FavoritesClient;
    let active = true;

    const adopt = async (session: Session | null) => {
      const uid = session?.user.id ?? null;
      if (!uid) {
        if (!active) return;
        setUserId(null);
        applyFavorites(readLocalFavorites(browserStorage()));
        setFavoritesLoaded(true);
        return;
      }
      try {
        const ids = await adoptServerFavorites(
          supabase as unknown as FavoritesClient,
          uid,
          browserStorage(),
        );
        if (!active) return;
        setUserId(uid);
        applyFavorites(ids);
      } catch {
        if (!active) return;
        // Keep the user's local favorites visible instead of an empty list.
        setUserId(null);
        applyFavorites(readLocalFavorites(browserStorage()));
        setFavoriteError(
          "Priljubljenih ni bilo mogoče naložiti s strežnika. Prikazani so shranjeni v tem brskalniku.",
        );
      }
      setFavoritesLoaded(true);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => adopt(data.session))
      .catch(() => adopt(null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void adopt(session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applyFavorites]);

  // Browser-only favorites (signed out or Supabase not configured) persist locally.
  useEffect(() => {
    if (!favoritesLoaded || userId) return;
    try {
      window.localStorage.setItem(
        LOCAL_FAVORITES_KEY,
        JSON.stringify(favorites),
      );
    } catch {
      // Storage may be unavailable (private mode); favorites stay in memory.
    }
  }, [favorites, favoritesLoaded, userId]);

  const toggleFavorite = useCallback(
    (listingId: string) => {
      const client = clientRef.current;
      if (!userId || !client) {
        const current = favoritesRef.current;
        applyFavorites(
          current.includes(listingId)
            ? current.filter((id) => id !== listingId)
            : [...current, listingId],
        );
        return;
      }
      setFavoriteError(null);
      void toggleFavoriteOptimistically(
        favoritesRef.current,
        listingId,
        applyFavorites,
        (id, favorite) =>
          favorite
            ? addFavorite(client, userId, id)
            : removeFavorite(client, userId, id),
        () => favoritesRef.current,
      ).then((result) => {
        if (!result.ok) setFavoriteError(result.error.message);
      });
    },
    [applyFavorites, userId],
  );

  const favoriteValue = useMemo<FavoriteContextValue>(
    () => ({
      favorites,
      isFavorite: (listingId: string) => favorites.includes(listingId),
      toggleFavorite,
      resetFavorites: () => applyFavorites([]),
      storage: userId ? "remote" : "local",
      userId,
      favoriteError,
      dismissFavoriteError: () => setFavoriteError(null),
    }),
    [applyFavorites, favorites, favoriteError, toggleFavorite, userId],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FavoriteContext.Provider value={favoriteValue}>
        {children}
        {favoriteError && (
          <div className="favorite-toast" role="alert">
            <span>{favoriteError}</span>
            <button
              type="button"
              className="text-link"
              onClick={() => setFavoriteError(null)}
              aria-label="Zapri obvestilo"
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </FavoriteContext.Provider>
    </QueryClientProvider>
  );
}
