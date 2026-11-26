import { createContext, useContext } from "react";
import type { QuickPreset } from "./QuickAdd";

export const QuickContext = createContext<(preset?: QuickPreset) => void>(() => {});
/** Opens the shared quick-add sheet, optionally pre-linked to a record. */
export const useQuickAdd = () => useContext(QuickContext);
