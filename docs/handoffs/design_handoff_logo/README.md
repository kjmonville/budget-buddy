# Handoff: Budget Buddy Logo (Coin-bag direction)

## Overview
A new brand mark for Budget Buddy, replacing the placeholder 💰 emoji currently used in the web header and the iOS app icon. The mark is a stylized money bag with an inset amber coin showing a "BB" monogram. Web app uses a flat mark + wordmark lockup; iOS app uses a Liquid Glass treatment of the same mark.

## About the Design Files
The files in this bundle are **design references**. The SVG and PNG in `assets/` are production-ready exports — use those directly. The HTML prototype is for visual reference only.

## Fidelity
**High-fidelity** — final colors, proportions, and asset files are included.

## Brand Tokens

| Token | Value | Usage |
|---|---|---|
| Indigo (primary) | `#6366F1` | Bag body, primary brand color |
| Indigo deep | `#4F46E5` | Bag neck, monogram, gradient end |
| Indigo darkest | `#3730A3` | iOS gradient bottom |
| Amber | `#F59E0B` | Coin face, accent |
| White | `#FFFFFF` | Glass elements, dark-mode mark fill |

Wordmark: **Space Grotesk 700**, letter-spacing `-0.025em`. Self-host or load from Google Fonts.

## Assets

### `assets/budget-buddy-mark.svg`
Full-color flat mark. 64×64 viewBox, scales to any size. **Use this in the web app.**

### `assets/budget-buddy-mark-mono.svg`
Single-color version using `currentColor` for the bag, white for the coin. Use anywhere the brand color needs to follow surrounding context (e.g. a dark-mode-only inverted state).

### `assets/budget-buddy-icon-1024.png`
1024×1024 master iOS app icon with Liquid Glass treatment (indigo gradient background, frosted-glass disc, mark centered, top sheen, amber bottom bloom). **Source for the iOS app icon set.**

## Web App Implementation

Replace the placeholder logo in the home header.

**Current code** (in the header component, near the logo wordmark):
```jsx
<span className="bb-logo-emoji">💰</span>
<span className="bb-logo-text">Budget Buddy</span>
```

**Replace with:**
```jsx
<img src="/assets/budget-buddy-mark.svg" alt="" className="bb-logo-mark" width="28" height="28" />
<span className="bb-logo-text">Budget Buddy</span>
```

**Styling:**
- Logo mark: 28×28px in the header. Keep 10px gap between mark and wordmark.
- Wordmark font: switch the `.bb-logo-text` font-family to `'Space Grotesk', sans-serif`, weight 700, letter-spacing `-0.025em`. Add the Google Fonts `<link>` to `<head>` or self-host the font file.
- Wordmark color: keep current indigo (`#6366F1`) or switch to `#4F46E5` for slightly higher contrast — designer recommends `#4F46E5`.

**Favicon / browser tab:** export the SVG as a 32×32 and 16×16 PNG (or use the SVG directly with `<link rel="icon" type="image/svg+xml" href="/assets/budget-buddy-mark.svg">`). Replace any existing favicon references.

**Other places to update:**
- Login / signup pages
- Email templates
- Marketing site (if separate)
- README / repo OG image
- PWA manifest (`icons` array — generate 192, 512, and 192-maskable from the SVG)

## iOS App Implementation

Replace the existing app icon set.

1. Open the Xcode project, select `Assets.xcassets`, then the `AppIcon` set.
2. Use `assets/budget-buddy-icon-1024.png` as the **App Store / 1024pt** slot.
3. From the 1024 master, generate every required size (Xcode 14+ accepts a single 1024 entry, but if your project uses per-size slots, generate: 20, 29, 40, 60, 76, 83.5 pt at @2x and @3x). Tools: Bakery, IconKit, or a quick ImageMagick script — never upscale; only downscale from the 1024 master.
4. Do **not** add a transparent background — iOS expects fully opaque, square artwork.
5. Do **not** pre-round the corners — iOS applies the squircle mask itself.
6. If the project supports iOS 18 dark/tinted icon variants, also export:
   - **Dark**: same artwork, replace the indigo gradient background with `#0B0B14 → #1C1B3A` and bump the glass disc opacity slightly.
   - **Tinted**: monochrome — use `assets/budget-buddy-mark-mono.svg` rendered white on a transparent square; iOS will tint it.

After replacing, do a clean build and verify the icon on a device home screen, in Settings, in Spotlight, and in the App Switcher.

## In-app branding (iOS)

Anywhere the app currently shows the 💰 emoji or a placeholder logo (splash, onboarding, about screen), replace with the SVG mark. SwiftUI: drop the SVG into the asset catalog as a vector or convert to a PDF asset, then `Image("BudgetBuddyMark").resizable().aspectRatio(contentMode: .fit)`.

## Out of Scope
- Animated splash / launch animation (can be a follow-up)
- Marketing collateral, App Store screenshots
- Apple Watch / iPad-specific icon variants beyond what Xcode auto-generates

## Files in This Bundle
- `assets/budget-buddy-mark.svg` — primary flat mark
- `assets/budget-buddy-mark-mono.svg` — monochrome variant
- `assets/budget-buddy-icon-1024.png` — iOS master icon
- `prototype/Budget Buddy Logo Explorations.html` — interactive design canvas (visual reference)

## Suggested Claude Code Prompt

> Read `docs/handoffs/design_handoff_logo/README.md`, then:
> 1. Replace the 💰 emoji in the web app's header with `assets/budget-buddy-mark.svg` per the README.
> 2. Switch the `Budget Buddy` wordmark to Space Grotesk 700 with the specified letter-spacing.
> 3. Update the favicon and PWA manifest icons.
> 4. In the iOS project, replace the AppIcon set using `assets/budget-buddy-icon-1024.png` as the master.
> 5. Open a single PR with the changes; do not modify unrelated files.
