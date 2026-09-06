
import { en } from '../locales/en';

export const BOXED_PROMPT = `## PRESENTATION: BOXED UNBOXING SHOT
Create a high-end e-commerce photograph in a luxury unboxing presentation of \${outfitType} from the source evidence.

Scene & Display:
1. Premium Box:
    - A clean, rigid presentation box in cream white or soft pastel, with crisp edges and a matte finish.
    - The box lid is open and positioned slightly tilted behind or beside the box, fully revealing the interior.
    - The box lid is clean with no printed logos, text, or branding.
2. Interior & Packaging:
    - Neat, flat, pristine white tissue paper lines the box.
3. Folding & Arrangement:
    - Fold the \${outfitType} neatly and squarely inside the box:
        - Shirts, tops, or polos: folded squarely with the collar, neckline, and button placket clearly visible.
        - Dresses or one-piece garments: folded neatly into a rectangle with the neckline/shoulders visible and the hem tucked cleanly inside the box bounds.
        - Multi-piece sets (2-3 pieces): each piece folded separately, stacked or aligned neatly inside the box, maintaining the complete garment count.
4. Setting & Lighting:
    - Set on a bright, minimalist surface (such as soft white textile or light wood).
    - Soft, diffused studio lighting with gentle natural contact shadows, avoiding harsh specular highlights.

Avoid:
- No brown shipping cartons, cardboard flaps, packing tape, or shipping labels.
- No mannequins, human body parts, or extra garments not in the source references.
- No invented buttons, trims, pockets, or altered garment construction.
- No harsh shadows, reflections, blown highlights, or blurry details.
`;

export const FOLDED_PROMPT = `## PRESENTATION: CLEAN FOLDED SHOT
Create a high-end e-commerce top-down photograph of \${outfitType} neatly folded directly on a flat presentation surface.

Scene & Display:
1. Folding & Layout:
    - Fold the \${outfitType} cleanly and position it centrally on the background:
        - Shirts, tops, or polos: folded squarely with the collar and button placket clearly visible.
        - Dresses or one-piece garments: folded neatly into a vertical or rectangular form with the neckline visible and hem tucked neatly inward.
        - Multi-piece sets (2-3 pieces): fold each garment piece separately, arranged side-by-side or stacked in a balanced, catalog-ready composition, preserving the complete garment count.
    - Preserve any visible authentic product tags or brand labels naturally attached to the garment.
2. Background & Surface:
    - Flat, clean, neutral surface (such as light natural wood, light gray architectural concrete, or clean linen).
3. Lighting & Photography:
    - Overhead, top-down camera framing.
    - Soft, diffused studio lighting emphasizing authentic fabric weave and texture without harsh shadows.

Avoid:
- No mannequins, hangers, or human body parts.
- No extra garments, accessories, or props not present in the source outfit.
- No invented buttons, misplaced seams, altered silhouettes, or incorrect colors.
- No harsh shadows, reflection glare, or background clutter.
`;


export const GHOST_MANNEQUIN_PROMPT = `## PRESENTATION: PRODUCT SHOT — GHOST MANNEQUIN

1. TASK & DISPLAY
Render the clothing in ghost mannequin (invisible mannequin) style on a seamless pure white background (#FFFFFF). The garment appears as if worn by an invisible body, retaining its natural 3D shape, volume, and drape.
- Front-facing, straight-on camera perspective (0° angle) with ~5% border padding.
- Natural worn 3D silhouette — not flattened, not vacuum-sealed.
- No visible human model, mannequin surface, stand, or hanger.
- Garment count must match the source outfit exactly. Do NOT add or remove pieces.

2. RECONSTRUCTION & FIDELITY
- Cross-reference all source views to reconstruct the complete garment (front placket/buttons, neckline, back panel, seams, sleeve shape, and hems).
- If a detail is clearly visible in any source view, preserve it exactly.
- When views differ due to folds or angle, trust the clearest supported view.
- Never blend contradictory details from multiple views into a new hybrid design.
- If a region is hidden or unresolved across all source views, keep only the most likely continuous garment shape. Do NOT invent new buttons, trims, pockets, labels, logos, embroidery, lining details, or closures.
- Sheer/translucent fabrics: render transparent with the white background showing through at authentic opacity.
\${ACCESSORIES_SECTION}
\${FOOTWEAR_SECTION}

3. LIGHTING & ENVIRONMENT
- Background: pure white (#FFFFFF), seamless, zero texture.
- Lighting: flat, even, shadowless studio light with minimal soft contact shadow beneath the base.

4. PROHIBITIONS
- NO human skin/face/hair/hands/feet.
- NO mannequin texture or stand visible.
- NO hanger or background objects.
- NO invented hidden garment details.
`;

export const CLEAN_FLAT_LAY_PROMPT = `## PRESENTATION: PRODUCT SHOT — CLEAN FLAT LAY

1. TASK & DISPLAY
Render all pieces of the outfit as separate, neatly laid-out items on a seamless pure white background (#FFFFFF).
- Top-down camera perspective with ~5% border padding.
- Layout: arrange each piece separately with clear spacing (~10% gap) and NO overlap between pieces. Stack vertically in dressing order (top piece above, bottom piece below; outer jacket -> inner shirt -> pants/skirt).
- Natural flat lay: laid flat with realistic fabric volume and natural folds, not unnaturally rigid.
- Garment count must match the source outfit exactly. Do NOT add or remove pieces.

2. RECONSTRUCTION & FIDELITY
- Cross-reference all source views to reconstruct each piece completely (collar, placket, seams, waistband, pockets, cuffs, hems).
- If a detail is clearly visible in any source view, preserve it exactly.
- When views differ due to folds or angle, trust the clearest supported view.
- Never blend contradictory details from multiple views into a new hybrid design.
- If a region is hidden or unresolved across all source views, keep only the most likely continuous garment shape. Do NOT invent new buttons, trims, pockets, labels, logos, embroidery, lining details, or closures.
- Sheer/translucent fabrics: render transparent with the white background showing through at authentic opacity.
\${ACCESSORIES_SECTION}
\${FOOTWEAR_SECTION}

3. LIGHTING & ENVIRONMENT
- Background: pure white (#FFFFFF), seamless, zero texture.
- Lighting: flat, even, shadowless studio illumination with minimal soft contact shadow beneath each piece.

4. PROHIBITIONS
- NO human skin/face/hair/hands/feet.
- NO mannequin or hanger.
- NO overlap between pieces.
- NO invented hidden garment details.
`;

export type LookbookStyle = 'flat lay' | 'mannequin' | 'hanger' | 'studio background' | 'minimalist showroom' | 'folded' | 'product shot';
export type GarmentType = 'one-piece' | 'two-piece' | 'three-piece';
export type ProductShotSubType = 'ghost-mannequin' | 'clean-flat-lay';
export type FoldedPresentationType = 'boxed' | 'folded';
export type MannequinBackgroundStyleKey = keyof typeof en.lookbook.mannequinBackgroundStyles;

export const MANNEQUIN_BACKGROUND_PROMPTS: Record<MannequinBackgroundStyleKey, string> = {
    minimalistShowroom: "Wall painted light beige. On the left: built-in white wall shelf with displayed handbags and shoes. On the right: low wooden cabinet with ribbed glass doors and brass handles, plus a clear vase or decorative object. A few small photos are taped to the wall above the cabinet. Composition must match the reference: mannequin + wall shelf + cabinet, all visible, but cropped above the floor level. No extra props or clutter.",
    luxuryLivingRoom: "A minimalist interior wall with a soft gray tone and a medium-sized arched niche in the center. The wall has a subtle fine-grain noise texture (like plaster or speckled paint), never flat smooth, for a photorealistic showroom effect. In front, a cream-beige curved sofa occupies about three-quarters of the frame width, slightly shifted right, left edge cropped by the frame. Sofa curves are soft, elegant. Floor: pale wood or light gray, clean and minimal. No harsh contrast.",
    whiteStudio: "A neutral studio room with a light beige/white wall and simple molding at the bottom. To the left: a round white side table with a glass vase of pink and white flowers and small decor. To the right: a cream sofa with a handbag, white woven heels, and a decorative box. Floor is clean, elegant wood. Scene is lit with natural soft daylight from the left, for a calm, luxurious mood.",
    retailBoutique: `
The background is a built-in rectangular studio “box” or alcove, with all three visible walls (left, right, back), the ceiling, and the floor in pure matte white. 
Each plane connects with crisp, visible right angles, creating a clear three-dimensional space. 
A single slim horizontal chrome clothing bar runs from the left wall to the right wall, mounted high near the top. 
The floor is also matte white, with no shadows but a faint, soft reflection under the mannequin’s base. 
There is absolutely no other decor, props, shelving, or visible outside room. 
The lighting is ultra-soft, diffuse studio lighting with no harsh shadows, evenly illuminating all surfaces. 
The final composition must be perfectly centered and balanced. 
Strictly avoid: plain walls without the box structure, wide empty studios, horizon lines, curved walls, dark floors, any decor, doors, windows, colored backgrounds, shelving, missing box walls, or an off-center mannequin.
`.trim()
};
