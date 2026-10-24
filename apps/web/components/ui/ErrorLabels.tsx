"use client";
import { createContext, useContext, type ReactNode } from "react";
type Labels = { error: string; retry: string };
const ErrorLabels = createContext<Labels>({
  error: "Error",
  retry: "Try again",
});
export function ErrorLabelsProvider({
  labels,
  children,
}: {
  labels: Labels;
  children: ReactNode;
}) {
  return <ErrorLabels.Provider value={labels}>{children}</ErrorLabels.Provider>;
}
export const useErrorLabels = () => useContext(ErrorLabels);
