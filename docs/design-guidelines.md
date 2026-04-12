# Chang Studio UI Redesign Contract

**Last Updated**: 2026-04-10
**Status**: Active design authority for the Runway-inspired redesign

## 1. Product framing
Chang Studio is not a marketing landing page. It is a cinematic fashion workspace where the image result is the primary interface and controls support the workflow without competing for attention.

### Core principles
1. **Media first** — generated results, references, and refinements get the strongest hierarchy.
2. **Editorial restraint** — dark neutral surfaces, tight typography, almost no decorative color.
3. **Workflow grouping** — navigation clusters tools by job, not by implementation history.
4. **Low-chrome controls** — forms live in rails/panels with subtle borders and no default shadows.
5. **Progressive rollout** — shell and proving flows establish the system before secondary features migrate.

## 2. Visual system

### Palette
- Background base: `#050505`
- Elevated backdrop: `rgba(255,255,255,0.03)`
- Stronger surface: `rgba(255,255,255,0.05)`
- Default border: `rgba(255,255,255,0.08)`
- Strong border: `rgba(255,255,255,0.14)`
- Primary text: `#f4f4f5`
- Secondary text: `#9f9fa9`
- Structural label text: `#6d6d77`

### Depth
- Default depth comes from scale, spacing, and media, **not** box-shadow.
- Shadows are not part of the shell language.
- Borders stay subtle and are only used for containment.

### Radius
- Interactive controls: `12px–16px`
- Panels / stages: `24px–28px`
- Pills / metadata chips: `999px`

## 3. Typography
- Primary typeface: **Plus Jakarta Sans**
- Display tracking: `-0.04em` to `-0.06em`
- Eyebrows / micro labels: uppercase with `0.22em–0.28em` tracking
- Body copy should stay compact and calm (`14px–16px`, line-height `1.5–1.6`)

## 4. Layout model

### Shell
- Desktop: fixed editorial rail on the left + wide content canvas on the right
- Mobile: overlay rail triggered by a compact menu button
- Utility actions belong inside the rail, not as floating FABs

### Priority flow template
Every proving flow should map to:
1. **Hero intro** — what the tool is for
2. **Control rail** — uploads, prompts, generation settings
3. **Result stage** — hero image/grid, progress, refine/export actions

### Responsive behavior
- **Mobile**: intro → controls → result stage stacked vertically
- **Tablet**: control rail above or beside result stage depending on density
- **Desktop**: sticky control rail + large result stage

## 5. Component rules
- Buttons should default to monochrome surfaces; white/high-contrast fills are reserved for primary actions.
- Textareas and inputs use subtle dark surfaces with light borders.
- Group selectors should feel like editorial chips, not bright segmented controls.
- Result areas must expose download/refine/state feedback without heavy banners or glow effects.

## 6. Navigation rules
Group features by workflow:
- **Create looks** — Try On, Lookbook, Clothing Transfer, Pattern Generator
- **Edit images** — AI Editor, Background, Pose, Relight, Watermark Remover, Image Editor
- **Output studio** — Photo Album, Upscale
- **Analyze** — Outfit Analysis

## 7. Do / don't

### Do
- Keep the result canvas visually dominant.
- Use uppercase labels for structure.
- Let whitespace and media establish hierarchy.
- Keep surfaces quiet and consistent across shell and proving flows.

### Don't
- Do not reintroduce global zoom scaling.
- Do not force the whole app down to `12px` root text.
- Do not use amber gradients and glow as the default shell language.
- Do not bring back floating utility FABs in the redesigned shell.
- Do not add new dependencies to achieve styling.

## 8. Rollout contract
1. Shell + navigation
2. Shared primitives / token migration
3. Priority flows: Try On, Lookbook, Clothing Transfer
4. Secondary feature adoption using the same templates

## 9. Verification expectations
- TypeScript passes
- ESLint passes
- Existing tests pass, with focused regressions added for shell and proving flows
- Desktop/tablet/mobile visual QA confirms media-first hierarchy and calmer chrome
