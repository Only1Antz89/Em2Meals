"use client";
import { createContext, useContext } from "react";
import type { State } from "@/lib/domain";
export type Ops = {
  s: State;
  mode: string;
  enquiries: any[];
  integrations: Record<string, boolean>;
  run: (type: string, payload: any) => Promise<void>;
  api: (path: string, payload: any) => Promise<any>;
  href: (path: string) => string;
  reload: () => Promise<void>;
  busy: boolean;
  open: (e: Edit) => void;
};
export const Context = createContext<Ops>(null!);
export const useOps = () => useContext(Context);
export type Spec = {
  key: string;
  label: string;
  type?: string;
  options?: (string | { value: string; label: string })[];
  required?: boolean;
};
export type Edit = {
  title: string;
  action: string;
  fields: Spec[];
  values?: any;
  transform?: (v: any) => any;
};
