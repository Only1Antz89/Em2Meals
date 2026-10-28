"use client";
import { createContext, useContext } from "react";
import type { State, Enquiry } from "@/lib/domain";
import type { Role } from "@/lib/access";

export type StoredEnquiry = {
  id: string;
  details: Enquiry;
  createdAt: string;
};
export type Option = string | { value: string; label: string };
export type Spec = {
  key: string;
  label: string;
  type?: string;
  // A function lets options depend on other values in the same editor.
  options?: Option[] | ((values: Record<string, unknown>) => Option[]);
  required?: boolean;
};

export type Edit = {
  title: string;
  action: string;
  fields: Spec[];
  values?: Record<string, unknown>;
  transform?: (v: Record<string, unknown>) => Record<string, unknown>;
};

export type Ops = {
  s: State;
  mode: string;
  enquiries: StoredEnquiry[];
  integrations: Record<string, boolean>;
  // Resolves with the workspace as saved.
  run: (type: string, payload: unknown) => Promise<State>;
  api: <T = unknown>(path: string, payload: unknown) => Promise<T>;
  href: (path: string) => string;
  reload: () => Promise<void>;
  busy: boolean;
  open: (e: Edit) => void;
  // The signed-in person's role and sign-in method.
  role: Role;
  email: string;
  authMode: "demo" | "clerk" | "chatgpt";
};

export const Context = createContext<Ops>(null!);
export const useOps = () => useContext(Context);

