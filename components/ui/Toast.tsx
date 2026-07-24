"use client";

import { Toaster } from "react-hot-toast";

/** Central toast styling — Violet/Slate palette, matches DESIGN.md. Mount
 * once at the root layout. */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#0F172A",
          color: "#F8FAFC",
          fontSize: "14px",
          borderRadius: "10px",
          padding: "10px 14px",
        },
        success: {
          duration: 2500,
          iconTheme: { primary: "#16A34A", secondary: "#F8FAFC" },
        },
        error: {
          iconTheme: { primary: "#DC2626", secondary: "#F8FAFC" },
        },
      }}
    />
  );
}
