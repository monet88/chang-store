
import { en } from '../locales/en';

export const BOXED_PROMPT = `
**Task**: Create a high-end e-commerce photo in an unboxing style, with a premium box opened to reveal the folded outfit inside.

**Subject**: \${outfitType} from the source image.

- CRITICAL RULE: Maintain 100% of the outfit's details — fabric, texture, seams, folds, patterns, buttons, zippers, elastic bands, hardware, labels, and true colors.
- Do not alter, redraw, or add any details not specified in the instructions.

**Display Instructions**:
1. Premium Box:
    - A rigid box in **cream white or light pastel**, with clean edges and a smooth surface.
    - The box lid is open, placed slightly tilted behind or to the side, revealing the outfit inside.
    - No logos or text printed on the box lid.
2. Inside the box, there is clean, flat, and neat **white tissue paper**.
3. The \${outfitType} is neatly folded and placed inside the box:
    - For a shirt/polo → folded squarely, with the collar and button placket clearly visible.
    - For a dress → folded into a rectangle, with the neck/shoulders visible, the body of the dress folded inwards, **do not let the hem show outside the box**.
    - For a 2-3 piece set → fold each piece separately, stack them neatly in the box.
5. Background: A bright surface (soft white fur rug or light wood), luxurious and minimalist.
6. Lighting: Natural or soft, diffused studio light, possibly with a slight side light (like the reference image), avoid harsh shadows.
7. The output image must be hyper-realistic, 2K, sharp, color-accurate, and have a high-end style.

**Negative prompt**:
no shipping box, no brown carton box, no ugly folded carton flaps,
no mannequin, no human body parts, no extra outfits not in source,
no distorted proportions, no misplaced seams, no extra buttons,
no logos, no text overlay, no watermarks, no clutter,
no harsh shadows, no reflections, no oversaturation, no underexposure,
no blurry details, no fabric distortion, no incorrect colors.
`;

export const FOLDED_PROMPT = `
**Task**: Create a high-end e-commerce top-down photo of the \${outfitType}, neatly folded and placed directly on a flat background.

- CRITICAL RULE: Maintain 100% of the actual details — fabric, texture, seams, folds, patterns, buttons, zippers, elastic bands, hardware, labels, and true colors.
- Do not alter, redraw, or add any details.

**Display Instructions**:
1. The \${outfitType} is neatly folded and placed on a clean, flat background.
    - If a shirt/polo → folded squarely, with the collar and button placket clearly visible.
    - If a dress → folded vertically, with the neck/shoulders visible, the body of the dress folded inwards, **do not let the hem stick out**.
    - If a 2-piece set → fold each piece separately, place them side-by-side or stacked neatly, with a balanced composition.
    - If a 3-piece set → fold each piece and arrange them in layers or parallel in a high-end showroom layout.
2. Any product tags/labels should be prominently and naturally placed.
3. Background: flat, clean, neutral color (light wood, light gray concrete, linen fabric).
4. Lighting: soft, diffused studio light from above, emphasizing fabric texture, avoid harsh shadows.
5. Minimalist composition, with the product centered in the frame, clean and luxurious.
6. The output image must be hyper-realistic, 2K, sharp, and color-accurate.

**Negative prompt**:
no mannequin, no human body parts, no extra accessories, no hangers,
no distorted proportions, no misplaced seams, no extra buttons, no fake logos,
no watermarks, no text overlay, no background clutter,
no harsh shadows, no reflections, no oversaturation, no underexposure,
no blurry details, no fabric distortion, no incorrect colors.
`;


export type LookbookStyle = 'flat lay' | 'mannequin' | 'hanger' | 'studio background' | 'minimalist showroom' | 'folded';
export type GarmentType = 'one-piece' | 'two-piece' | 'three-piece';
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
