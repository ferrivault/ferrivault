import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { parseBackendError } from "../../lib/utils";
import {
  createBlankCipher,
  useVaultStore,
} from "../../stores/vaultStore";
import type {
  CipherTypeNumber,
  CipherView,
  CustomFieldView,
} from "../../types/vault";

export const CipherForm: React.FC = () => {
  const { t } = useTranslation();
  const editingCipher = useVaultStore((s) => s.editingCipher);
  const isCreating = useVaultStore((s) => s.isCreatingCipher);
  const folders = useVaultStore((s) => s.folders);
  const saveCipher = useVaultStore((s) => s.saveCipher);
  const cancelEditCipher = useVaultStore((s) => s.cancelEditCipher);
  const openGenerator = useVaultStore((s) => s.openGenerator);
  const pushToast = useVaultStore((s) => s.pushToast);

  const [form, setForm] = useState<CipherView>(() =>
    editingCipher ? structuredClone(editingCipher) : createBlankCipher(1)
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTypeChange = (newType: CipherTypeNumber) => {
    const template = createBlankCipher(newType, form.folderId);
    setForm({
      ...template,
      id: form.id,
      name: form.name,
      notes: form.notes,
      favorite: form.favorite,
      fields: form.fields,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      pushToast(t("errors.validationRequired"), "error");
      return;
    }

    setIsSaving(true);
    try {
      await saveCipher(form);
      pushToast(t("notifications.itemSaved"), "success");
    } catch (err) {
      const parsed = parseBackendError(err);
      pushToast(
        t(parsed.errorKey, {
          message: parsed.message,
          defaultValue: parsed.message,
        }),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addCustomField = () => {
    const nextField: CustomFieldView = { name: "", value: "", type: 0 };
    setForm((prev) => ({
      ...prev,
      fields: [...prev.fields, nextField],
    }));
  };

  const updateCustomField = (
    idx: number,
    patch: Partial<CustomFieldView>
  ) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const removeCustomField = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx),
    }));
  };

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="flex flex-1 flex-col overflow-y-auto bg-slate-950 p-6 text-xs"
    >
      {/* Form Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white">
          {isCreating ? t("vault.newItem") : t("vault.editItem")}
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelEditCipher}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
            {t("common.cancel")}
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 font-semibold text-white shadow hover:bg-brand-500 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {t("common.save")}
          </button>
        </div>
      </div>

      {/* Main Fields */}
      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {isCreating && (
            <div>
              <label className="mb-1 block font-medium text-slate-300">
                {t("vault.itemType")}
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  handleTypeChange(Number(e.target.value) as CipherTypeNumber)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-brand-500 focus:outline-none"
              >
                <option value={1}>{t("sidebar.typeLogin")}</option>
                <option value={2}>{t("sidebar.typeNote")}</option>
                <option value={3}>{t("sidebar.typeCard")}</option>
                <option value={4}>{t("sidebar.typeIdentity")}</option>
              </select>
            </div>
          )}

          <div className={isCreating ? "" : "col-span-2"}>
            <label className="mb-1 block font-medium text-slate-300">
              {t("vault.folder")}
            </label>
            <select
              value={form.folderId ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  folderId: e.target.value || null,
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-brand-500 focus:outline-none"
            >
              <option value="">{t("sidebar.noFolder")}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="mb-1 block font-medium text-slate-300">
              {t("vault.itemName")} *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder={t("vault.itemNamePlaceholder")}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <label className="mb-2 flex items-center gap-2 font-medium text-slate-300">
            <input
              type="checkbox"
              checked={form.favorite}
              onChange={(e) =>
                setForm((p) => ({ ...p, favorite: e.target.checked }))
              }
              className="rounded border-slate-700 bg-slate-900 text-brand-600"
            />
            {t("vault.markFavorite")}
          </label>
        </div>

        {/* TYPE 1: LOGIN */}
        {form.type === 1 && form.login && (
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.login.sectionTitle")}
            </h3>

            <div>
              <label className="mb-1 block font-medium text-slate-300">
                {t("vault.login.username")}
              </label>
              <input
                type="text"
                value={form.login.username ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    login: { ...p.login!, username: e.target.value },
                  }))
                }
                placeholder={t("vault.login.usernamePlaceholder")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-300">
                {t("vault.login.password")}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.login.password ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        login: { ...p.login!, password: e.target.value },
                      }))
                    }
                    placeholder={t("vault.login.passwordPlaceholder")}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-3 pr-9 font-mono text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openGenerator((generated) => {
                      setForm((p) => ({
                        ...p,
                        login: { ...p.login!, password: generated },
                      }));
                    })
                  }
                  title={t("common.generate")}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-medium text-brand-300 hover:bg-slate-700"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {t("common.generate")}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-300">
                {t("vault.login.totpSecret")}
              </label>
              <input
                type="text"
                value={form.login.totp ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    login: { ...p.login!, totp: e.target.value },
                  }))
                }
                placeholder={t("vault.login.totpPlaceholder")}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100"
              />
            </div>

            {/* URIs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-300">
                  {t("vault.login.uris")}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      login: {
                        ...p.login!,
                        uris: [...p.login!.uris, { uri: "", match: null }],
                      },
                    }))
                  }
                  className="flex items-center gap-1 text-brand-400 hover:text-brand-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("vault.login.addUri")}
                </button>
              </div>

              {form.login.uris.map((u, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={u.uri}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((p) => ({
                        ...p,
                        login: {
                          ...p.login!,
                          uris: p.login!.uris.map((item, i) =>
                            i === idx ? { ...item, uri: val } : item
                          ),
                        },
                      }));
                    }}
                    placeholder={t("vault.login.uriPlaceholder")}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        login: {
                          ...p.login!,
                          uris: p.login!.uris.filter((_, i) => i !== idx),
                        },
                      }))
                    }
                    className="rounded p-1.5 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TYPE 3: CARD */}
        {form.type === 3 && form.card && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.card.sectionTitle")}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  {t("vault.card.cardholderName")}
                </label>
                <input
                  type="text"
                  value={form.card.cardholderName ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      card: { ...p.card!, cardholderName: e.target.value },
                    }))
                  }
                  placeholder={t("vault.card.cardholderPlaceholder")}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  {t("vault.card.brand")}
                </label>
                <select
                  value={form.card.brand ?? "Visa"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      card: { ...p.card!, brand: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                >
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Amex">American Express</option>
                  <option value="Discover">Discover</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-300">
                {t("vault.card.number")}
              </label>
              <input
                type="text"
                value={form.card.number ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    card: { ...p.card!, number: e.target.value },
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  {t("vault.card.expMonth")}
                </label>
                <input
                  type="text"
                  placeholder="MM"
                  value={form.card.expMonth ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      card: { ...p.card!, expMonth: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  {t("vault.card.expYear")}
                </label>
                <input
                  type="text"
                  placeholder="YYYY"
                  value={form.card.expYear ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      card: { ...p.card!, expYear: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  {t("vault.card.securityCode")}
                </label>
                <div className="relative">
                  <input
                    type={showCvv ? "text" : "password"}
                    value={form.card.code ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        card: { ...p.card!, code: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-3 pr-8 font-mono text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCvv((v) => !v)}
                    className="absolute right-2 top-2 text-slate-400"
                  >
                    {showCvv ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TYPE 4: IDENTITY */}
        {form.type === 4 && form.identity && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.identity.sectionTitle")}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.firstName")}
                </label>
                <input
                  type="text"
                  value={form.identity.firstName ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, firstName: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.middleName")}
                </label>
                <input
                  type="text"
                  value={form.identity.middleName ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, middleName: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.lastName")}
                </label>
                <input
                  type="text"
                  value={form.identity.lastName ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, lastName: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.email")}
                </label>
                <input
                  type="email"
                  value={form.identity.email ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, email: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.phone")}
                </label>
                <input
                  type="text"
                  value={form.identity.phone ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, phone: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.ssn")}
                </label>
                <input
                  type="text"
                  value={form.identity.ssn ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, ssn: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.passportNumber")}
                </label>
                <input
                  type="text"
                  value={form.identity.passportNumber ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: {
                        ...p.identity!,
                        passportNumber: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.address1")}
                </label>
                <input
                  type="text"
                  value={form.identity.address1 ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, address1: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-300">
                  {t("vault.identity.city")}
                </label>
                <input
                  type="text"
                  value={form.identity.city ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      identity: { ...p.identity!, city: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="mb-1 block font-medium text-slate-300">
            {t("vault.notes")}
          </label>
          <textarea
            rows={4}
            value={form.notes ?? ""}
            onChange={(e) =>
              setForm((p) => ({ ...p, notes: e.target.value }))
            }
            placeholder={t("vault.notesPlaceholder")}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Custom Fields */}
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              {t("vault.customFields")}
            </span>
            <button
              type="button"
              onClick={addCustomField}
              className="flex items-center gap-1 text-brand-400 hover:text-brand-300"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("vault.addCustomField")}
            </button>
          </div>

          {form.fields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={field.type}
                onChange={(e) =>
                  updateCustomField(idx, { type: Number(e.target.value) })
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
              >
                <option value={0}>{t("vault.fieldTypeText")}</option>
                <option value={1}>{t("vault.fieldTypeHidden")}</option>
              </select>
              <input
                type="text"
                value={field.name}
                onChange={(e) =>
                  updateCustomField(idx, { name: e.target.value })
                }
                placeholder={t("vault.fieldName")}
                className="w-1/3 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-100"
              />
              <input
                type={field.type === 1 ? "password" : "text"}
                value={field.value}
                onChange={(e) =>
                  updateCustomField(idx, { value: e.target.value })
                }
                placeholder={t("vault.fieldValue")}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-slate-100"
              />
              <button
                type="button"
                onClick={() => removeCustomField(idx)}
                className="rounded p-1.5 text-slate-500 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
};
