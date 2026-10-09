"use client";

interface PrimaryOption {
  value: string;
  label: string;
}

interface LensEditPanelProps {
  /** Draft name/description of the lens under edit (owned by the parent). */
  draftName: string;
  draftDescription: string;
  onDraftNameChange: (value: string) => void;
  onDraftDescriptionChange: (value: string) => void;
  /** Group-by (primary) options: built-in lens names + un-lensed schemes. */
  primaryOptions: PrimaryOption[];
  /** Live primary scheme key of the board (editor changes it directly). */
  livePrimary: string;
  onPrimaryChange: (scheme: string) => void;
  /** True when the lens under edit keeps its grouping fixed (id-addressed). */
  primaryLocked: boolean;
  hasUnsavedEdits: boolean;
  /** Focus the name input (set when an edit session starts). */
  nameAutoFocus: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800";

/** Below-header lens editor: name, description and primary grouping with
 *  live board preview. Split (secondary) editing lives on each primary
 *  box header while the session is active. */
export function LensEditPanel({
  draftName,
  draftDescription,
  onDraftNameChange,
  onDraftDescriptionChange,
  primaryOptions,
  livePrimary,
  onPrimaryChange,
  primaryLocked,
  hasUnsavedEdits,
  nameAutoFocus,
  onSave,
  onCancel,
}: LensEditPanelProps) {
  return (
    <div className="glass-card mb-4 rounded-2xl p-4">
      <div>
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Edit lens</h2>
        <p className="mt-1 text-xs text-gray-500">
          Changes apply live on the board. Save keeps them, Cancel reverts.
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          Name
          <input
            autoFocus={nameAutoFocus}
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            placeholder="e.g. Attention"
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          Description
          <input
            value={draftDescription}
            onChange={(event) => onDraftDescriptionChange(event.target.value)}
            placeholder="e.g. What needs my focus now"
            className={fieldClass}
          />
        </label>
      </div>
      <label className="mt-3 block max-w-sm space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
        Group by (primary)
        <select
          value={livePrimary}
          disabled={primaryLocked}
          title={
            primaryLocked
              ? "Built-in lenses keep their grouping; create a lens to regroup"
              : undefined
          }
          onChange={(event) => onPrimaryChange(event.target.value)}
          className={`${fieldClass} disabled:opacity-60`}
        >
          {primaryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3 dark:border-white/5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-black/[0.04]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!hasUnsavedEdits || !draftName.trim()}
          onClick={onSave}
          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save lens
        </button>
      </div>
    </div>
  );
}
