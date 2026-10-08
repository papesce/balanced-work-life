/**
 * Overlay layering contract. Every floating UI element belongs to exactly
 * one layer — no ad-hoc z-index values outside this file.
 *
 * Why: glassmorphism (`backdrop-filter` on `.glass-card*`) turns every card
 * into its own stacking context, so `z-50` children can never paint above
 * sibling cards. Anything interactive must therefore portal to
 * `document.body` with `position: fixed` (the FLOATING layer) instead of
 * relying on in-flow `absolute` positioning.
 *
 * - INLINE: hover-only tooltips (`pointer-events-none`). The only overlays
 *   allowed to stay inline-absolute — no interaction, no clipping risk.
 * - FLOATING: every interactive overlay (menus, move/attach/link panels,
 *   all pickers, search dropdowns). Portaled + fixed. Sits above app
 *   chrome (header z-40, sidebar z-30, mobile nav z-40).
 * - MODAL: drawers, dialogs, delete confirms, quick-note panel, composer
 *   suggestions. Always topmost, above floating panels.
 */
export const LAYER_INLINE = 50;
export const LAYER_FLOATING = 9990;
export const LAYER_MODAL = 10000;
