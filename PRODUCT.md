# Product

## Register

product

## Users

Three audiences share one workspace:

- **Fashion e-commerce teams** producing styled product imagery at scale who
  cannot run constant photoshoots. They show up to a session with reference
  garments and a list of looks; success is shipping looks faster than the next
  shoot would have been booked.
- **Content creators** producing outfit visuals for social, blogs, or
  lookbooks. They iterate visually, save the takes they like, and re-prompt the
  ones they don't.
- **Individuals exploring outfit combinations virtually** before purchase.
  They drop in a self portrait + a garment photo and want a credible composite
  in seconds.

Across all three: bilingual (English / Vietnamese), comfortable with AI tools
but expecting a real product, not a prompt console. They keep many tabs open;
the studio has to feel direct and unpadded.

## Product Purpose

Replace physical photoshoots with AI-generated fashion imagery. One subject
photo plus one garment photo equals a styled output in seconds, with
configurable models, aspect ratios, and quality. Three studio modes (Gemini,
Grok, GPT Image) sit behind a single switcher so the user picks the engine
once and keeps the same workflow vocabulary across providers (Try-On, Lookbook,
Background, Pose, Photo Album, AI Editor, Watermark Remover, Clothing Transfer,
Identity Transfer, Pattern Generator).

Success looks like:

- The user generates a usable image inside their first minute.
- They never lose a result; the gallery is silent and reliable.
- Switching providers or features is one click and never loses the running
  prompt unless the user agrees to lose it.

## Brand Personality

Quiet, expert, fashion-adjacent. Three words: **studio-grade, calm,
deliberate.**

Voice is editorial rather than marketing: short labels, precise nouns. Warmth
comes from the amber accent and from a careful black surface, not from
exclamation marks. The product talks to people who already know what a
photoshoot costs; it does not need to oversell what it replaces.

## Anti-references

Match-and-refuse:

- **Generic SaaS dashboards** with cards-in-cards, identical metric tiles, and
  uppercase eyebrows on every section. The studio is a workbench, not a
  landing page.
- **Prompt-console tools** (raw textarea + "Generate" button on a flat dark
  background). The product is not a thin GUI on top of an API.
- **Mid-range e-commerce skins** (Shopify-default greys, generic gradient
  CTAs, stock illustrations). The user is producing imagery that competes with
  these; the studio cannot look like one of them.
- **Stock AI-art apps** with purple/blue gradients, Inter for everything,
  rainbow accent walls, "magic wand" iconography on every action.
- **Adobe-style chrome-heavy panels** with dense toolbars at every edge. The
  studio earns chrome only where output, settings, and prompt meet.

## Design Principles

1. **Output-first chrome.** The generated image is the largest, most
   color-saturated thing on screen. Settings, prompt, and controls collapse
   toward neutral once the user has committed.
2. **Single accent, used sparingly.** One amber/orange ramp marks "active",
   "primary action", or "brand". Anything else uses zinc neutrals or near-black
   surfaces. Never two competing accents on the same view.
3. **Show, don't tell.** Every workflow demonstrates itself with a real
   reference image and a real prompt. No copy that explains a feature without
   showing it.
4. **One action per screen.** Each studio panel has exactly one primary CTA
   ("Tạo" / "Generate"). Secondary actions sit at lower visual weight; tertiary
   actions live in the utility dock.
5. **Workspace continuity.** Switching feature, studio, or language never
   disorients. The header structure, sidebar order, and primary CTA placement
   stay constant; only the body content swaps.

## Accessibility & Inclusion

Target: WCAG 2.1 AA across both English and Vietnamese surfaces.

- Body text contrast ≥ 4.5:1 on the dark zinc/black surface; large text and
  primary buttons ≥ 3:1.
- Every interactive element has a visible focus ring. The amber focus ring is
  the only place amber-on-black appears outside of primary CTAs.
- Form inputs and dropzones expose `aria-label` keys via the locale layer; the
  Vietnamese surface is the test surface for label length, not an
  afterthought.
- Reduced motion: every transition longer than the existing 200ms tab
  crossfade has a `@media (prefers-reduced-motion: reduce)` alternative.
- Color is never the only signal. Active tab + selected option also use
  weight, position, or a check glyph in addition to amber.
- Touch targets ≥ 44px on mobile; the mobile sidebar already drives most of
  this.
