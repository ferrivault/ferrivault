import React from "react";
import { useTranslation } from "react-i18next";
import { Trash2Icon, TriangleAlertIcon, XIcon } from "@animateicons/react/lucide";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  warningText?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  warningText,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
              <Trash2Icon size={16} />
            </div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3.5 p-5">
          <p className="text-xs leading-relaxed text-slate-300">
            {description}
          </p>

          {warningText && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3.5 text-xs text-amber-200">
              <TriangleAlertIcon
                size={16}
                className="mt-0.5 shrink-0 text-amber-400"
              />
              <span className="leading-relaxed">{warningText}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-red-500 disabled:opacity-50"
          >
            <Trash2Icon size={14} />
            <span>{confirmLabel ?? t("common.delete")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
