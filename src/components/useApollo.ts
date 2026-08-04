import { createContext, useContext } from "react";

// Apollo's presence state. Kept separate from the orb's rendering so the visual
// treatment can change without touching anything that drives it.
export type ApolloState = "idle" | "listening" | "thinking" | "speaking";

export type Apollo = {
  state: ApolloState;
  /** 0..1 audio amplitude — the user's voice when listening, Apollo's when speaking. */
  level: number;
  /** What Apollo last looked at, e.g. "your chart, 4h XAUUSD" (§13.4 attribution). */
  saw: string | null;
  setState: (s: ApolloState) => void;
};

export const ApolloContext = createContext<Apollo>({
  state: "idle",
  level: 0,
  saw: null,
  setState: () => {},
});

export const useApollo = () => useContext(ApolloContext);
