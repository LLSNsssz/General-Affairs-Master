# Sticky Lupin Desktop 0.4 Roadmap

Current baseline: `0.3.9`

## Version goal

`0.4.0` is the first "site-support stabilization" release.

The point is not to add many features. The point is to make the current reader architecture reliable enough that supported sites feel intentional instead of partially patched.

## Core theme

- make desktop support quality predictable across sites
- reduce selector sprawl and duplicated site logic
- keep the memo-shell interaction model, but stop breaking native site controls by accident

## In scope

### 1. Site strategy layer

- centralize site detection in one place
- define per-site strategy fields:
  - `isAuthUrl`
  - `isReadingUrl`
  - `ambientCss`
  - `readerChromeSuppression`
  - `readerAdapter`
  - `shortcutActions`
- remove duplicated site branching spread between renderer runtime and preload where possible

### 2. Novelpia stabilization

- replace broad CSS suppression with a Novelpia-specific reader adapter
- preserve useful controls:
  - episode list
  - comments
  - theme/settings
  - previous/next episode access
- fix known overlay regressions:
  - first-paragraph blocking line
  - help popup stacking
  - accidental removal of footer/header controls
- keep shortcut coverage in sync with what gets hidden

### 3. Munpia promotion to first-class support

- keep Munpia as the reference implementation for extracted reader DOM
- harden Munpia reader reconstruction against minor DOM drift
- ensure list/detail/reading transitions stay consistent

### 4. Joara support upgrade

- move Joara from "light cleanup" to actual reading-surface handling
- add a Joara-specific content extraction path
- define which Joara flows are officially supported and which are not

### 5. KakaoPage support boundary

- make an explicit product decision:
  - `browse-only` in `0.4.0`, or
  - limited chapter-reader support if the flow is stable enough
- do not leave KakaoPage in an ambiguous half-supported state

### 6. Regression safety

- add a repeatable manual verification checklist for:
  - Novelpia
  - Munpia
  - Joara
  - KakaoPage
- verify:
  - navigation
  - popup layering
  - bookmark/history/settings drawers
  - collapse/expand
  - always-on-top
  - help popup
  - reader visibility and loading masks

## Out of scope

- account sync
- cloud state
- offline library
- major visual redesign
- mobile parity work
- store-release hardening beyond current portable Windows flow

## Definition of done for 0.4.0

- Novelpia no longer depends on broad "hide everything" suppression to feel usable
- Munpia remains stable after strategy extraction
- Joara has defined reading-mode support, not just themed browsing
- KakaoPage has a declared support level
- help popup, reader stage, and native webview stacking are consistent
- keyboard fallback exists for any hidden critical reader actions
- release can be built and verified without manual source patching during packaging

## Suggested milestone split

### 0.4.0-alpha

- site strategy registry introduced
- Novelpia cleanup narrowed and stabilized
- Munpia strategy extracted without regression

### 0.4.0-beta

- Joara adapter lands
- KakaoPage support level finalized
- regression checklist executed across all supported sites

### 0.4.0

- packageable Windows portable build
- no known blocker in the four-site desktop flow

## Immediate priority order

1. Novelpia reader adapter and overlay cleanup
2. strategy extraction from current scattered site logic
3. Munpia regression pass
4. Joara adapter
5. KakaoPage scope decision and implementation
