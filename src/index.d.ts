import type * as React from "react";
import type { BoardProps, BoardHandle } from "./board-types.js";
export type * from "./board-types.js";
export const Board: React.ForwardRefExoticComponent<
  BoardProps & React.RefAttributes<BoardHandle>
>;
export function fitBoardSize(availableWidth: number, maxSize?: number): number;
/** A binding owned and handled by the consumer. `key` uses aria-keyshortcuts syntax. */
export type ButtonShortcut = Readonly<{ key: string; label: string }>;
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: React.Ref<HTMLButtonElement>;
  variant?: string;
  size?: string;
  pending?: boolean;
  tooltip?: string;
  shortcut?: ButtonShortcut;
};
export const Button: React.ComponentType<ButtonProps>;
export const IconButton: React.ComponentType<
  ButtonProps & { label: string }
>;
export const PageHeader: React.ComponentType<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}>;
export const SectionHeader: React.ComponentType<{
  title: React.ReactNode;
  children?: React.ReactNode;
}>;
export const Surface: React.ComponentType<{
  children?: React.ReactNode;
  className?: string;
}>;
export const StatusNotice: React.ComponentType<{
  children?: React.ReactNode;
  kind?: string;
}>;
export const Dialog: React.ComponentType<{
  open: boolean;
  title: string;
  children?: React.ReactNode;
  onClose: () => void;
}>;
export type ToastNotification = Readonly<{ id: string | number; message: string }>;
export const Toast: React.ComponentType<{
  notification: ToastNotification | null;
  onDismiss: (id: ToastNotification["id"]) => void;
}>;
