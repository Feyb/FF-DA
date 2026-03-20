# The Design System: Editorial Precision & Tonal Depth

## 1. Overview & Creative North Star: "The Digital Curator"
The Creative North Star for this design system is **The Digital Curator**. We are moving away from the "utility-first" aesthetic of standard Material Design and toward a high-end, editorial experience. This system treats the interface not as a grid of buttons, but as a series of curated layers.

By leaning into intentional asymmetry, expansive breathing room, and a sophisticated "tonal-only" hierarchy, we transform M3’s functional foundations into a signature visual identity. We favor **Tonal Layering** over structural lines, creating a UI that feels grown, not built.

---

## 2. Colors: The Palette of Softness
Our color strategy relies on the interplay between deep violets (`primary`) and the airy, desaturated pales of our surface tokens.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be achieved solely through background color shifts. Use `surface-container-low` for large sectioning against a `surface` background. If a boundary feels invisible, increase the contrast between surface tiers, do not add a line.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of fine paper. 
- **Base:** `surface` (#fdf8fb)
- **Secondary Content:** `surface-container-low` (#f7f2f5)
- **Interactive Floating Elements:** `surface-container-lowest` (#ffffff)
- **Deep Inset/Accents:** `surface-container-high` (#ebe7e9)

### The "Glass & Gradient" Rule
To elevate the "Digital Curator" aesthetic, use Glassmorphism for floating navigation and overlays. Apply `surface` at 70% opacity with a `20px` backdrop-blur. 
*   **Signature Textures:** For Hero CTAs, use a linear gradient from `primary` (#4c22bd) to `primary_container` (#6442d6) at a 135-degree angle. This adds "soul" and prevents the flat, synthetic look of standard UI kits.

---

## 3. Typography: The Editorial Voice
We utilize a pairing of **Plus Jakarta Sans** for expressive displays and **Inter** for high-utility reading.

*   **Display & Headlines (Plus Jakarta Sans):** Used for "The Hook." High-contrast scaling (e.g., `display-lg` at 3.5rem) creates an authoritative, editorial feel. Use `on_surface` (#1c1b1d) with a slight tracking reduction (-2%) for a premium, "ink-on-paper" look.
*   **Body & Labels (Inter):** Used for "The Narrative." Inter provides the technical clarity required for complex data. 
*   **The Hierarchy Goal:** Use size and weight—not color—to denote importance. A `display-sm` headline in `on_surface` should always command more attention than a `title-md` in the same color.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are largely deprecated in this system in favor of **Tonal Lift**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. The subtle shift from #ffffff to #f7f2f5 creates a natural, soft lift that is more accessible and modern than a heavy shadow.
*   **Ambient Shadows:** For high-elevation elements (Modals, Floating Action Buttons), use a "Global Glow."
    *   **Blur:** 40px - 60px
    *   **Opacity:** 6%
    *   **Color:** `primary` (#4c22bd). Never use pure black for shadows; tinting the shadow with the primary brand color ensures the depth feels integrated into the atmosphere.
*   **The Ghost Border Fallback:** If a container absolutely requires a boundary for accessibility, use a **Ghost Border**: `outline_variant` at 15% opacity. It should be felt, not seen.

---

## 5. Components: Refined Primitives

### Buttons
*   **Primary:** Filled with the signature gradient (`primary` to `primary_container`). Roundedness: `full`. No shadow.
*   **Secondary:** Tonal fill using `secondary_container`. Use for high-frequency actions that shouldn't compete with the Hero.
*   **Tertiary:** Text-only in `primary` (#4c22bd). Use `3.5` (1.2rem) horizontal padding to give the label room to breathe.

### Cards & Lists
*   **Rule:** Forbid divider lines. 
*   **Implementation:** Separate list items using `2.5` (0.85rem) of vertical whitespace. If items need distinct separation, alternate backgrounds between `surface` and `surface-container-low`.
*   **Cards:** Use `lg` (2rem) rounded corners. Cards should never have a stroke; use the Layering Principle (e.g., White card on a #f7f2f5 background).

### Input Fields
*   **Style:** Modern "Soft Box." Use `surface-container-highest` (#e6e1e4) as the fill color. 
*   **Focus State:** Instead of a heavy border, use a `2px` solid `primary` line only at the bottom, or a subtle `primary` outer glow.

### Additional Signature Component: The "Curator Glass Header"
A persistent top navigation bar using `surface` at 60% opacity, `backdrop-blur: 16px`, and no bottom border. This allows content to scroll "under" the UI, creating a sense of infinite depth.

---

## 6. Do’s and Don'ts

### Do:
*   **Do** use extreme whitespace. If a layout feels "crowded," double the spacing token (e.g., move from `8` to `16`).
*   **Do** use asymmetrical layouts. Align a headline to the far left and the body text to a center-right column to create editorial tension.
*   **Do** use the `full` roundedness scale for interactive elements (buttons, chips) and `lg` for structural elements (cards, containers).

### Don’t:
*   **Don’t** use 100% opaque black (#000000) for text. Always use `on_surface` (#1c1b1d) to maintain tonal softness.
*   **Don’t** use standard M3 "Elevated" cards with heavy shadows. They break the "Digital Curator" aesthetic.
*   **Don’t** use dividers to separate content. If you feel the need for a line, your spacing or background tonal shifts are insufficient. 

---

## 7. Token Quick Reference

| Token | Value | Role |
| :--- | :--- | :--- |
| **Primary** | #4c22bd | Hero Actions & Accents |
| **Surface** | #fdf8fb | Global Canvas |
| **Surface Container Low** | #f7f2f5 | Secondary Sectioning |
| **Surface Container Lowest**| #ffffff | Active Cards / Modals |
| **Rounded DEFAULT** | 1rem | Standard Components |
| **Spacing 4** | 1.4rem | Standard Gutter |
| **Spacing 12** | 4rem | Section Breathing Room |