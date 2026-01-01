
import React, { useState, useEffect } from 'react';
import ImageUploader from './ImageUploader';
import Spinner, { ErrorDisplay } from './Spinner';
import HoverableImage from './HoverableImage';
import { editImage, upscaleImage } from '../services/imageEditingService';
import { generateClothingDescription } from '../services/gemini/text';
import { Feature, ImageFile, AspectRatio, ImageResolution, DEFAULT_IMAGE_RESOLUTION } from '../types';
import { useImageGallery } from '../contexts/ImageGalleryContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useApi } from '../contexts/ApiProviderContext';
import { en } from '../locales/en';
import { getErrorMessage } from '../utils/imageUtils';
import { AddIcon, DeleteIcon, GalleryIcon, MagicWandIcon } from './Icons';
import Tooltip from './Tooltip';
import ImageOptionsPanel from './ImageOptionsPanel';
import { BOXED_PROMPT, FOLDED_PROMPT, MANNEQUIN_BACKGROUND_PROMPTS, LookbookStyle, GarmentType, FoldedPresentationType, MannequinBackgroundStyleKey } from './LookbookGenerator.prompts';


// FIX: Defined the missing OutputTab type.
type OutputTab = 'main' | 'variations' | 'closeup';

interface LookbookSet {
  main: ImageFile;
  variations: ImageFile[];
  closeups: ImageFile[];
}

interface ClothingItem {
  id: number;
  image: ImageFile | null;
}

interface LookbookFormState {
  clothingImages: ClothingItem[];
  fabricTextureImage: ImageFile | null;
  fabricTexturePrompt: string;
  clothingDescription: string;
  lookbookStyle: LookbookStyle;
  garmentType: GarmentType;
  foldedPresentationType: FoldedPresentationType;
  mannequinBackgroundStyle: MannequinBackgroundStyleKey;
  negativePrompt: string;
}

const initialFormState: LookbookFormState = {
  clothingImages: [{ id: Date.now(), image: null }],
  fabricTextureImage: null,
  fabricTexturePrompt: '',
  clothingDescription: '',
  lookbookStyle: 'flat lay',
  garmentType: 'one-piece',
  foldedPresentationType: 'boxed',
  mannequinBackgroundStyle: 'minimalistShowroom',
  negativePrompt: '',
};

export const LookbookGenerator: React.FC = () => {
  const [formState, setFormState] = useState<LookbookFormState>(initialFormState);

  const {
    clothingImages, fabricTextureImage, fabricTexturePrompt, clothingDescription,
    lookbookStyle, garmentType, foldedPresentationType, mannequinBackgroundStyle, negativePrompt
  } = formState;

  const updateForm = (updates: Partial<LookbookFormState>) => {
    setFormState(prev => ({...prev, ...updates}));
  }
  
  const [generatedLookbook, setGeneratedLookbook] = useState<LookbookSet | null>(null);
  const [upscalingStates, setUpscalingStates] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [isGeneratingCloseUp, setIsGeneratingCloseUp] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [variationCount, setVariationCount] = useState<number>(2);
  const [activeOutputTab, setActiveOutputTab] = useState<'main' | 'variations' | 'closeup'>('main');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('Default');
  const [resolution, setResolution] = useState<ImageResolution>(DEFAULT_IMAGE_RESOLUTION);
  
  const { addImage } = useImageGallery();
  const { t } = useLanguage();
  const { aivideoautoAccessToken, aivideoautoImageModels, getModelsForFeature } = useApi();
  const { imageEditModel } = getModelsForFeature(Feature.Lookbook);
  const isAivideoautoModel = imageEditModel.startsWith('aivideoauto--');
  const requireAivideoautoConfig = () => {
    if (isAivideoautoModel && !aivideoautoAccessToken) {
      setError(t('error.api.aivideoautoAuth'));
      return false;
    }
    return true;
  };
  const buildImageServiceConfig = (onStatusUpdate: (message: string) => void) => ({
    onStatusUpdate,
    aivideoautoAccessToken,
    aivideoautoImageModels,
  });

  const MANNEQUIN_BACKGROUND_STYLES: { key: MannequinBackgroundStyleKey; label: string }[] = (
    Object.keys(t('lookbook.mannequinBackgroundStyles', { returnObjects: true })) as MannequinBackgroundStyleKey[]
).map(key => ({
    key,
    label: t(`lookbook.mannequinBackgroundStyles.${key}`),
}));

  const handleClothingUpload = (file: ImageFile | null, id: number) => {
    const newClothingImages = clothingImages.map(item => item.id === id ? { ...item, image: file } : item);
    updateForm({ clothingImages: newClothingImages });
    if(file) addImage(file);
  };
  const addClothingUploader = () => updateForm({ clothingImages: [...clothingImages, { id: Date.now(), image: null }] });
  const removeClothingUploader = (id: number) => updateForm({ clothingImages: clothingImages.filter(item => item.id !== id) });
  
  const handleClearForm = () => {
      setFormState(initialFormState);
  }

  const handleGenerateDescription = async () => {
    const firstImage = clothingImages.find(item => item.image)?.image;
    if (!firstImage) {
        setError(t('lookbook.descriptionError'));
        return;
    }
    setIsGeneratingDescription(true);
    setError(null);
    try {
        const description = await generateClothingDescription(firstImage);
        updateForm({ clothingDescription: description });
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
        setIsGeneratingDescription(false);
    }
  };

  const handleGenerate = async () => {
    const validClothingImages = clothingImages.filter(item => item.image !== null);
    if (validClothingImages.length === 0) {
      setError(t('lookbook.inputError'));
      return;
    }
    if (!requireAivideoautoConfig()) {
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('lookbook.generatingStatus'));
    setError(null);
    setGeneratedLookbook(null);

    const imagesForApi: ImageFile[] = validClothingImages.map(item => item.image as ImageFile);
    let fabricPromptSection = '';

    if (fabricTextureImage) {
        imagesForApi.push(fabricTextureImage);
        fabricPromptSection += `
          **Critical Instruction: Fabric Replacement**
          - An additional image ('Fabric Texture Image') is provided. Your most important task is to replace the original fabric of the main clothing item with the texture from this image.
          - The new texture must wrap realistically around the garment's folds, seams, and contours.
          - The lighting on the new texture must match the scene's overall lighting.
        `;
    }

    if (fabricTexturePrompt.trim()) {
        fabricPromptSection += `
          **Fabric Texture Description**: Use this description to guide the texture application: "${fabricTexturePrompt.trim()}".
        `;
    }
    
    if (fabricTextureImage || fabricTexturePrompt.trim()) {
        fabricPromptSection += `
          - Preserve the clothing's original silhouette, shape, and all non-fabric details (buttons, zippers).
          - This texture application instruction overrides any conflicting details from the source clothing.
        `;
    }

    let prompt = '';
    if (imagesForApi.length > (fabricTextureImage ? 2 : 1)) {
        prompt += `
          **Image Roles**: Multiple images of the same clothing item are provided, showing different angles (e.g., front, side, back).
          **Core Synthesis Task**: Your primary goal is to mentally reconstruct a complete, 3D understanding of the single garment from these multiple 2D views. Synthesize all details—shape, seams, texture, pattern flow, and features—into one cohesive object. The final output should feature this synthesized garment.
        `;
    } else {
        prompt += `
          **Image Role**: A single image of a clothing item is provided.
        `;
    }

    let stylePrompt = '';
    switch (lookbookStyle) {
        case 'folded': {
            const basePrompt = foldedPresentationType === 'boxed' ? BOXED_PROMPT : FOLDED_PROMPT;
            const outfitTypeMap: Record<GarmentType, string> = {
                'one-piece': 'a one-piece garment (dress or jumpsuit)',
                'two-piece': 'a two-piece set (top + pants, or top + skirt)',
                'three-piece': 'a three-piece set (inner top, pants/skirt, and outer jacket)'
            };
            const outfitTypeText = outfitTypeMap[garmentType];
            stylePrompt = basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
            break;
        }
        case 'flat lay': {
            const basePrompt = `
**Task**: Create a high-end e-commerce flat lay photo of the \${outfitType}, matching the reference image's style: top-down angle, soft natural light, and a clean lifestyle composition.

**Subject**: \${outfitType} from the source image, laid out neatly on a bright background.

- CRITICAL RULE: Maintain every outfit detail with 100% accuracy – fabric, seams, folds, patterns, buttons, zippers, elastic bands, hardware, and true colors.
- Do not alter, simplify, or redraw any details.

**Display Instructions**:
1. The outfit is laid out naturally, shot from top-down.
    - If **one-piece (dress/jumpsuit)** → lay out the full continuous form, showing its natural drape.
    - If **two-piece (top + pants/skirt)** → place the top above, pants/skirt directly below, in a straight layout.
    - If **multi-piece (inner top + pants/skirt + jacket)** → layer each piece in natural order or place them neatly in parallel.
2. Background: light-colored rug + warm-toned wood floor/furniture, maintaining the reference image's minimal, lifestyle vibe.
3. Decor accessories should match the vibe: magazines, a bright boucle chair, a wooden table, a decorative wool basket.
4. Lighting: natural, soft, slightly angled, creating soft, not harsh, shadows.
5. Composition: outfit is central, decor accessories are arranged around it to complement, not obstruct the main form.
6. The output image must be hyper-realistic, 2K, sharp, and color-accurate.

**Negative prompt**:
no mannequin, no human body parts, no extra outfits not in source,
no distorted proportions, no misplaced seams, no extra buttons,
no fake logos, no text overlay, no watermarks, no clutter,
no harsh shadows, no reflections, no oversaturation, no underexposure,
no blurry details, no fabric distortion, no incorrect colors.
            `;
            const outfitTypeMap: Record<GarmentType, string> = {
                'one-piece': 'a one-piece garment (dress or jumpsuit)',
                'two-piece': 'a two-piece set (top + pants, or top + skirt)',
                'three-piece': 'a three-piece set (inner top, pants/skirt, and outer jacket)'
            };
            const outfitTypeText = outfitTypeMap[garmentType];
            stylePrompt = basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
            break;
        }
        case 'mannequin': {
            const basePrompt = `
**Task**: Generate a professional studio photograph of clothing on a high-end mannequin.
**Subject**: Replace the mannequin’s outfit with the clothing from the provided source image(s). Preserve every intricate detail with 100% accuracy — fabric texture, true colors, seams, pleats, stitching, embroidery, hardware, and proportions.

**Mannequin Style (Strict Requirement)**:
- Headless, armless, and legless female torso, solid ivory/cream color.
- Topped with a short, plain cylindrical neck block (ivory/cream), capped by a flat round metallic gold disk.
- Mounted on a slim metallic stand with a simple square base.

**Clothing Integration**:
- Transfer the outfit onto the mannequin, maintaining exact proportions, layers, and structure.
- Render folds, shine, and depth photorealistically, with lighting and shadows matching the scene.
- No simplification, no missing parts, no blending errors.

**Background Instructions**:
Use the following background style:  
**\${backgroundStyle}**

**Lighting**: Soft, diffuse studio or daylight, subtle highlights and shadows to enhance form and fabric.

**Goal**: Flawless 2K photorealistic image, where all elements are true to the description — only the outfit changes.

**Negative prompt (Strict)**:
NO mannequin heads (ball, oval, dome, fabric-wrapped, stylized), NO mannequin arms, NO mannequin legs, NO human body parts, NO skin.  
No extra mannequins, no background props, no shelving, no clutter,  
no reflections, no color casts, no harsh shadows, no over/underexposure,  
no text overlay, no fake logos, no watermarks, no background changes,  
no distortion, no missing garment details, no incorrect colors.
            `;
            const backgroundStyleText = MANNEQUIN_BACKGROUND_PROMPTS[mannequinBackgroundStyle];
            stylePrompt = basePrompt.replace(/\$\{backgroundStyle\}/g, backgroundStyleText);
            break;
        }
        case 'hanger': {
            const basePrompt = `
**Task**: Generate a photorealistic, professional e-commerce product image.

**Subject**: \${outfitType} from the provided source image(s).

**Background & Arrangement Instructions**:
- The setting is a minimalist, built-in closet alcove with off-white matte walls.
- Both sides have open white shutter-style panel doors, framing the closet.
- A single horizontal chrome clothing rack (matte silver) is mounted near the top of the alcove.
- Garments are hung as follows:
    - For one-piece: Hang the single item (dress, jumpsuit, shirt, or pants/skirt) on the transparent acrylic hanger (right position).
    - For two-piece: Hang the top on the transparent acrylic hanger (right) and the bottom on the gold metal hanger (left), side by side.
    - For three-piece: Hang the top and bottom as above, with the jacket/outer layer either layered on the right hanger or on a separate hanger next to the others, matching the spacing in the scene.
- Hangers must be slim (one transparent acrylic, one gold metal), spaced identically as described, and attached to the rack in the same alignment and proportions.

**Props & Decor**:
- On the left of the built-in white shelf, place a stylish bag that visually complements and matches the style, color palette, and level of formality of \${outfitType}. The bag should enhance the overall fashion aesthetic, remain minimalist and clean in design, and never distract from the garment(s).
- On the right of the shelf, place a pair of elegant shoes (heels, loafers, or sandals) that coordinate perfectly with \${outfitType} in both color and style. Shoes should be neatly paired, fashion-forward, and appropriate for the type of garment(s) displayed.
- The props must always look modern, tasteful, and catalog-ready, fitting a minimalist closet scene.
- All surfaces must remain clean, with no excess clutter or unrelated items.

**Lighting & Mood**:
- Soft, bright natural light from above or slightly to the side, with gentle shadows under rack, clothes, bag, and shoes.
- Modern, calm, and catalog-ready mood, with subtle highlights on metal and acrylic details.

**Display**:
- \${outfitType} must be displayed fully visible from hanger top to hem, with spacing, proportions, and arrangement matching the above description exactly.

**Critical Rule**:
- Every detail of the new garment(s) must be preserved with 100% accuracy — fabric texture, color, pattern, seams, stitching, hardware, etc.
- Do not stylize, simplify, or alter fit/silhouette.
- Do not change or move any other background element, only props (bag and shoes) are allowed to adapt to match the outfit.

**Output Specs**:
- High-resolution (2K or higher), photorealistic.

**Goal**:  
Produce a flawless product shot of \${outfitType} in a minimalist closet scene as described, with **bag and shoes auto-styled to match and enhance the outfit**, maintaining a clean, professional, and harmonious visual presentation.
            `;
            const outfitTypeMap: Record<GarmentType, string> = {
                'one-piece': 'the one-piece garment (dress, jumpsuit, single shirt, single pants/skirt)',
                'two-piece': 'the two-piece set (shirt + pants, shirt + skirt)',
                'three-piece': 'the three-piece set (shirt + pants/skirt + jacket/outer layer)'
            };
            const outfitTypeText = outfitTypeMap[garmentType];
            stylePrompt = basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
            break;
        }
        case 'studio background':
            stylePrompt = `
              **Task**: Recreate the provided image with a new, professional studio background, while perfectly preserving the subject.
              **Subject**: The person and their complete outfit from the source image.
              **CRITICAL RULES**:
              1.  **Perfect Subject Preservation**: The person's identity (face, hair, body shape), their entire outfit (design, color, texture, fit), and their exact pose MUST be preserved with 100% accuracy. Do NOT alter, redraw, or change the subject in any way.
              2.  **Background Replacement**: Completely remove and discard the original background.
              3.  **New Background Generation**: Generate a new, photorealistic, and clean studio background. The background should be a seamless, slightly off-white or light gray paper backdrop, subtly textured.
              4.  **Studio Lighting**: The lighting on the model must be adjusted to match a professional studio lighting setup. Use soft, diffused light (like from a large softbox) to create gentle, flattering shadows. The lighting should look clean, polished, and consistent across the model and the new background.
              5.  **Floor**: The floor should be a smooth, reflective surface that subtly mirrors the model, creating a sense of space and professionalism.
              6.  **Seamless Integration**: Ensure the model is perfectly integrated into the new scene. Pay close attention to edges, hair strands, and semi-translucent fabrics to avoid any "cut-out" look. The model must look like they were actually photographed in the new studio environment.
              **Goal**: A high-resolution (2K), photorealistic image suitable for a premium e-commerce catalog or fashion lookbook, featuring the original model and clothing in a new, clean studio setting.
            `;
            break;
        case 'minimalist showroom': {
            const basePrompt = `
Task: Generate a photorealistic, high-end lookbook image of \${outfitType} displayed in a fixed minimalist beige studio setup.
The background, rack, floor, and lighting must match a premium beige studio aesthetic.
The outfit, bag, and shoes change according to styling logic below.

Scene (LOCKED):
- Background: seamless matte beige wall, warm and even tone.
- Floor: smooth light-gray concrete with soft reflection.
- Lighting: natural daylight from upper-left, diffused and shadow-soft. No visible window streaks.
- Composition: centered, straight-on camera, mid height, symmetrical layout.

Rack (LOCKED):
- Freestanding rectangular clothing rack with two vertical posts and one horizontal bar in brushed/satin silver.
- Bottom shelf in same metal, visible across frame.
- Positioned level and centered; no hanging cables or ceiling wires.

Pedestal (LOCKED):
- Left side: a tall rectangular concrete pedestal with soft matte surface, neutral gray tone.
- Size proportionate (roughly ¼ rack height), flush with floor.
- Used to display the handbag accessory dynamically generated per outfit.

Garment Display (variable):
- \${outfitType} hangs naturally on thin gold/brass hangers.
- For two-piece sets: top (left) and bottom (right) slightly spaced, full length visible.
- For one-piece: center aligned.
- Fabric hangs with natural gravity, realistic folds, premium texture.

Auto-Styled Accessories (UNLOCKED):
1️⃣ **Bag (on pedestal):**
   - AI automatically generates a handbag that harmonizes with the outfit’s tone, material, and formality.
   - Style logic:
     • For structured or tailored outfits → classic boxy leather handbag or mini satchel.  
     • For flowy or feminine outfits → soft clutch, curved shoulder bag, or woven tote.  
     • For casual outfits → minimalist bucket or crescent bag.
   - Color harmony:
     • If outfit light or neutral → darker accent bag (black, chocolate, tan).  
     • If outfit dark → lighter contrast (ivory, nude, beige).  
     • If outfit colorful → tonal analog (warm camel, soft taupe).  
   - The bag must sit realistically on the pedestal, lit by the same light direction.

2️⃣ **Shoes (on floor, centered below rack):**
   - AI automatically generates shoes that complement both outfit and bag in tone and mood.
   - Style logic:
     • Dresses/skirts → pumps, slingbacks, or mules.  
     • Trousers/suits → loafers, pointed heels, or structured flats.  
     • Relaxed sets → sandals or minimalist sneakers.  
   - Color harmony:
     • Shoes either match or stay one tone lighter than the bag.  
     • Use only neutral, metallic, or soft tonal shades — never saturated hues.  
   - Shoes placed symmetrically, toes forward, shadow direction matching light source.

Lighting & Color:
- White balance: warm-neutral daylight (~4800K).  
- Keep overall tone balanced, soft, and realistic.
- No high contrast or spotlights.

Composition:
- Camera angle straight-on, mid-height.
- Equal headroom above rack and foot space below shelf.
- Everything aligned on center axis.

Negative prompt:
no mannequin, no human, no clutter, no text, no bright colors, no mirror, no harsh shadows, no ceiling cables, no props outside scene, no perspective tilt, no spotlight beams, no white background.

Absolute priorities:
- Scene geometry (wall, rack, pedestal, floor, lighting) remains identical.
- Bag and shoes adapt intelligently to outfit tone and style.
            `;
            const outfitTypeMap: Record<GarmentType, string> = {
                'one-piece': 'the one-piece garment (dress, jumpsuit, single shirt, single pants/skirt)',
                'two-piece': 'the two-piece set (shirt + pants, shirt + skirt)',
                'three-piece': 'the three-piece set (shirt + pants/skirt + jacket/outer layer)'
            };
            const outfitTypeText = outfitTypeMap[garmentType];
            stylePrompt = basePrompt.replace(/\$\{outfitType\}/g, outfitTypeText);
            break;
        }
    }
    
    prompt += "\n\n" + stylePrompt;

    if (fabricPromptSection) {
        prompt = fabricPromptSection + "\n\n" + prompt;
    }

    // Apply clothing description as a critical note if provided, for relevant styles.
    if (clothingDescription.trim() && lookbookStyle !== 'studio background') {
      const descriptionInstruction = `
\n\n**Critical Note on Garment Details (IMPORTANT)**:
- Rely on the following user-provided description to ensure accuracy of the product details.
- This description is a supplementary source of truth and should be prioritized to clarify the garment's features in the output image.
- **Detailed Description**: "${clothingDescription.trim()}"
      `.trim();
      prompt += descriptionInstruction;
    }

    try {
      const results = await editImage({ 
        images: imagesForApi, 
        prompt, 
        negativePrompt, 
        numberOfImages: 1,
        aspectRatio,
      }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
      if (results.length > 0) {
        setGeneratedLookbook({ main: results[0], variations: [], closeups: [] });
        results.forEach(addImage);
        setActiveOutputTab('main');
      }
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleUpscale = async (imageToUpscale: ImageFile, imageKey: string) => {
    setUpscalingStates(prev => ({ ...prev, [imageKey]: true }));
    setError(null);
    try {
        const result = await upscaleImage(
            imageToUpscale,
            imageEditModel,
            buildImageServiceConfig(() => {})
        );
        
        setGeneratedLookbook(prev => {
            if (!prev) return null;
            const newState = { ...prev };
            if (prev.main.base64 === imageToUpscale.base64) {
                newState.main = result;
            } else {
                const variationIndex = prev.variations.findIndex(v => v.base64 === imageToUpscale.base64);
                if (variationIndex > -1) newState.variations[variationIndex] = result;

                const closeupIndex = prev.closeups.findIndex(c => c.base64 === imageToUpscale.base64);
                if (closeupIndex > -1) newState.closeups[closeupIndex] = result;
            }
            return newState;
        });
        addImage(result);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
        setUpscalingStates(prev => ({ ...prev, [imageKey]: false }));
    }
  };

  const handleGenerateVariations = async () => {
    if (!generatedLookbook) {
        setError(t('lookbook.variationError'));
        return;
    }
    if (!requireAivideoautoConfig()) {
      return;
    }

    setIsGeneratingVariations(true);
    setError(null);

    const baseImage = generatedLookbook.main;
    let prompt = `
      **Task**: Generate ${variationCount} professional variations for a product lookbook.
      **Base Image**: Use the provided image as the reference.
      **Instructions**:
      1.  Each variation must be a new, unique, photorealistic image.
      2.  Strictly maintain the core subject (the clothing) and the original '${lookbookStyle}' aesthetic.
      3.  Introduce subtle, professional variations. Ideas:
          *   Slightly different camera angles (e.g., lower, higher, slightly to the side).
          *   Minor adjustments in professional studio lighting (e.g., changing the key light position).
          *   For '${lookbookStyle}', subtle changes in arrangement or pose that a photographer would make between shots.
      4.  **Crucially, do not change the clothing item itself.** The goal is to provide alternative shots of the same product.
      **Goal**: A set of cohesive, e-commerce ready, 2K resolution images that could be used together in a product gallery.
    `;
    
    try {
        const newVariations = await editImage({ 
            images: [baseImage], 
            prompt, 
            negativePrompt, 
            numberOfImages: variationCount,
            aspectRatio,
        }, imageEditModel, buildImageServiceConfig(setLoadingMessage));
        newVariations.forEach(addImage);
        setGeneratedLookbook(prev => prev ? { ...prev, variations: newVariations } : null);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
        setIsGeneratingVariations(false);
        setLoadingMessage('');
    }
  };
  
  const handleGenerateCloseUp = async () => {
    if (!generatedLookbook) {
        setError(t('lookbook.closeUpError'));
        return;
    }
    if (!requireAivideoautoConfig()) {
      return;
    }

    setIsGeneratingCloseUp(true);
    setError(null);
    setGeneratedLookbook(prev => prev ? { ...prev, closeups: [] } : null);

    const baseImage = generatedLookbook.main;
    
    const closeUpPrompts = [
      `A hyper-realistic, high-end e-commerce close-up photograph of the garment’s neckline or collar area. Focus on capturing the clean lines of the neckline (or collar if present), visible trims, seams, and stitching accuracy. Show texture and finishing details clearly, including buttons or fastenings if they exist. Lighting is soft and directional to highlight edges, fabric sheen, and precision craftsmanship. Background is clean and softly blurred, professional catalog style. Resolution 2K, sharp, color-accurate. Preserve 100% accuracy of garment details.`,
      `A hyper-realistic, high-end e-commerce close-up photograph of the garment’s sleeve area. Focus on the sleeve hem and structure — whether long, short, or sleeveless (if sleeveless, highlight the armhole finishing instead). Capture stitching precision, fabric weave, trims, and edge finishing. Lighting is angled and soft, emphasizing subtle folds and fabric depth. Background is clean and softly blurred, professional catalog style. Resolution 2K, sharp, color-accurate. Preserve 100% accuracy of garment details.`,
      `A hyper-realistic, high-end e-commerce close-up photograph of the garment’s front lower body section. Focus on showing the front design details clearly — waistband or hemline, seams, pleats, darts, fastenings (buttons, zippers, drawstrings, elastic waistband) if they exist. If the garment has no fastenings, emphasize the clean fabric surface and finishing quality. Capture fabric texture, stitching accuracy, edge finishing, and alignment of details. Lighting is soft and overhead, producing a clean catalog style that highlights craftsmanship. Background is clean and softly blurred. Resolution 2K, sharp, color-accurate. Preserve 100% accuracy of garment details and structure.`
    ];

    const closeUpNegativePrompt = 'no distorted proportions, no extra buttons, no missing buttons, no extra seams, no incorrect stitching, no unrealistic textures, no blurry details, no fabric warping, no duplicated trims, no misplaced zippers, no fake logos, no added accessories, no stains, no wrinkles beyond natural folds, no color shifting, no oversaturation, no underexposure, no pixelation, no watermark, no background objects';
    const combinedNegativePrompt = [negativePrompt.trim(), closeUpNegativePrompt].filter(Boolean).join(', ');

    try {
        const results: ImageFile[] = [];
        for (const [index, prompt] of closeUpPrompts.entries()) {
            setLoadingMessage(t('lookbook.generatingCloseUpStatus', { progress: index + 1, total: 3 }));
            
            const [result] = await editImage({ 
                images: [baseImage], 
                prompt, 
                aspectRatio: '1:1' as AspectRatio,
                negativePrompt: combinedNegativePrompt, 
                numberOfImages: 1 
            }, imageEditModel, buildImageServiceConfig((msg) => setLoadingMessage(`${t('lookbook.generatingCloseUpStatus', { progress: index + 1, total: 3 })} - ${msg}`)));
            
            results.push(result);
            setGeneratedLookbook(prev => prev ? { ...prev, closeups: [...results] } : null);
            addImage(result);
        }
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
        setIsGeneratingCloseUp(false);
        setLoadingMessage('');
    }
  };

  const outputContainerClasses = `relative w-full bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 min-h-[50vh] lg:min-h-0 lg:h-full ${
    generatedLookbook ? '' : 'flex items-center justify-center'
  }`;

  const lookbookStyles: { key: LookbookStyle, label: string }[] = [
      { key: 'flat lay', label: t('lookbook.styleFlatLay') },
      { key: 'mannequin', label: t('lookbook.styleMannequin') },
      { key: 'hanger', label: t('lookbook.styleHanger') },
      { key: 'folded', label: t('lookbook.styleFolded') },
      { key: 'studio background', label: t('lookbook.styleStudioBackground') },
      { key: 'minimalist showroom', label: t('lookbook.styleMinimalistShowroom') },
  ];
  
  const outputTabs: { id: OutputTab; label: string }[] = [
    { id: 'main', label: t('lookbook.tabGeneratedImage') },
    { id: 'variations', label: t('lookbook.tabVariations') },
    { id: 'closeup', label: t('lookbook.tabCloseup') },
  ];

  const anyLoading = isLoading || isGeneratingVariations || isGeneratingCloseUp || Object.values(upscalingStates).some(s => s);
  const validClothingImages = clothingImages.filter(item => item.image !== null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* --- Left Column: Inputs & Controls --- */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-center text-center gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold mb-1">{t('lookbook.title')}</h2>
            <p className="text-zinc-400">{t('lookbook.description')}</p>
          </div>
          <button onClick={handleClearForm} className="text-xs text-zinc-400 hover:text-white bg-zinc-700/50 hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors">Clear</button>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-base md:text-lg font-semibold text-center text-amber-400 mb-4">{t('lookbook.uploadTitle')}</h3>
            <div className="grid grid-cols-2 gap-4">
                {clothingImages.map((item, index) => (
                    <div key={item.id} className="relative group">
                        <Tooltip content={t('tooltips.lookbookClothing')} position="bottom">
                          <ImageUploader 
                              image={item.image} 
                              id={`clothing-${item.id}`} 
                              title={t('lookbook.clothingItemTitle', { index: index + 1 })} 
                              onImageUpload={(file) => handleClothingUpload(file, item.id)} 
                          />
                        </Tooltip>
                        {clothingImages.length > 1 && (
                            <button 
                                onClick={() => removeClothingUploader(item.id)} 
                                className="absolute -top-2 -right-2 z-10 p-1 bg-red-600 rounded-full text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove view"
                            >
                                <DeleteIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            <Tooltip content={t('tooltips.lookbookAddView')} position="bottom" className="w-full">
              <button 
                  onClick={addClothingUploader} 
                  className="w-full mt-4 bg-zinc-700/80 text-zinc-200 font-semibold py-2.5 px-4 rounded-lg hover:bg-zinc-700 transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <AddIcon className="w-5 h-5" />
                <span>{t('lookbook.addView')}</span>
              </button>
            </Tooltip>
        </div>

        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
            <h3 className="text-base md:text-lg font-semibold text-center text-amber-400">{t('lookbook.fabricTextureTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <Tooltip content={t('tooltips.lookbookFabricTexture')} position="right">
                  <ImageUploader 
                      image={fabricTextureImage} 
                      id="fabric-texture-upload" 
                      title={t('lookbook.fabricTextureUploadTitle')} 
                      onImageUpload={(file) => { updateForm({fabricTextureImage: file}); if (file) addImage(file); }} 
                  />
                </Tooltip>
                <Tooltip content={t('tooltips.lookbookFabricDescription')} position="left" className="w-full">
                    <label htmlFor="fabric-texture-prompt" className="block text-sm font-medium text-zinc-300 mb-2">
                        {t('lookbook.fabricTexturePromptLabel')}
                    </label>
                    <textarea
                        id="fabric-texture-prompt"
                        value={fabricTexturePrompt}
                        onChange={(e) => updateForm({ fabricTexturePrompt: e.target.value })}
                        placeholder={t('lookbook.fabricTexturePromptPlaceholder')}
                        rows={4}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                    />
                </Tooltip>
            </div>
            <p className="text-xs text-zinc-500 text-center">{t('lookbook.fabricTextureHelp')}</p>
        </div>
        
        <div>
            <div className="flex justify-between items-center mb-2">
                <label htmlFor="clothing-description" className="block text-sm font-medium text-zinc-300">
                    {t('lookbook.clothingDescriptionLabel')}
                </label>
                <Tooltip content={t('tooltips.lookbookGenerateDescription')} position="left">
                  <button
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingDescription || validClothingImages.length === 0}
                      className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
                      aria-label={t('lookbook.generateDescriptionAria')}
                  >
                      {isGeneratingDescription ? (
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400"></div>
                      ) : (
                          <>
                              <MagicWandIcon className="w-4 h-4" />
                              <span>{t('lookbook.generateDescriptionButton')}</span>
                          </>
                      )}
                  </button>
                </Tooltip>
            </div>
            <textarea
                id="clothing-description"
                value={clothingDescription}
                onChange={(e) => updateForm({ clothingDescription: e.target.value })}
                placeholder={t('lookbook.clothingDescriptionPlaceholder')}
                rows={2}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-1">{t('lookbook.clothingDescriptionHelp')}</p>
        </div>

        <Tooltip content={t('tooltips.lookbookNegativePrompt')} position="top" className="w-full">
            <label htmlFor="negative-prompt-lookbook" className="block text-sm font-medium text-zinc-300 mb-2">{t('common.negativePromptLabel')}</label>
            <textarea
              id="negative-prompt-lookbook"
              value={negativePrompt}
              onChange={(e) => updateForm({ negativePrompt: e.target.value })}
              placeholder={t('lookbook.negativePromptPlaceholder')}
              rows={2}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
            <p className="text-xs text-zinc-500 mt-1">{t('common.negativePromptHelp')}</p>
        </Tooltip>
        
        <div className="space-y-4">
            <Tooltip content={t('tooltips.lookbookStyle')} position="bottom">
              <div className="flex flex-col items-center gap-2">
                  <span className="text-zinc-300 font-medium">{t('lookbook.styleLabel')}:</span>
                  <div className="flex flex-wrap justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                      {lookbookStyles.map(style => (
                           <button
                              key={style.key}
                              onClick={() => updateForm({ lookbookStyle: style.key })}
                              className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize transition-colors duration-200 ${
                                  lookbookStyle === style.key ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                              }`}
                          >
                              {style.label}
                          </button>
                      ))}
                  </div>
              </div>
            </Tooltip>

            {lookbookStyle === 'folded' && (
                <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-700/50 animate-fade-in">
                    <span className="text-zinc-300 font-medium">{t('lookbook.presentationTypeLabel')}:</span>
                    <div className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                        <button
                            onClick={() => updateForm({ foldedPresentationType: 'boxed' })}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                foldedPresentationType === 'boxed' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                            }`}
                        >
                            {t('lookbook.presentationTypeBoxed')}
                        </button>
                        <button
                            onClick={() => updateForm({ foldedPresentationType: 'folded' })}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                foldedPresentationType === 'folded' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                            }`}
                        >
                            {t('lookbook.presentationTypeFolded')}
                        </button>
                    </div>
                </div>
            )}

            {['hanger', 'flat lay', 'minimalist showroom', 'folded'].includes(lookbookStyle) && (
                <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-700/50 animate-fade-in">
                    <span className="text-zinc-300 font-medium">{t('lookbook.garmentTypeLabel')}:</span>
                    <div className="flex gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                        <button
                            onClick={() => updateForm({ garmentType: 'one-piece' })}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                garmentType === 'one-piece' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                            }`}
                        >
                            {t('lookbook.garmentTypeOnePiece')}
                        </button>
                        <button
                            onClick={() => updateForm({ garmentType: 'two-piece' })}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                garmentType === 'two-piece' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                            }`}
                        >
                            {t('lookbook.garmentTypeTwoPiece')}
                        </button>
                         <button
                            onClick={() => updateForm({ garmentType: 'three-piece' })}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
                                garmentType === 'three-piece' ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                            }`}
                        >
                            {t('lookbook.garmentTypeThreePiece')}
                        </button>
                    </div>
                </div>
            )}

            {lookbookStyle === 'mannequin' && (
                <div className="flex flex-col items-center gap-2 pt-4 border-t border-zinc-700/50 animate-fade-in">
                    <span className="text-zinc-300 font-medium">{t('lookbook.mannequinBackgroundStyleLabel')}:</span>
                    <div className="flex flex-wrap justify-center gap-2 bg-zinc-800/50 p-1.5 rounded-lg">
                        {MANNEQUIN_BACKGROUND_STYLES.map(style => (
                             <button
                                key={style.key}
                                onClick={() => updateForm({ mannequinBackgroundStyle: style.key })}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors duration-200 ${
                                    mannequinBackgroundStyle === style.key ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:bg-zinc-700/50'
                                }`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
             <div className="pt-4 border-t border-zinc-700/50 animate-fade-in space-y-3">
                <ImageOptionsPanel
                  aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                  resolution={resolution} setResolution={setResolution}
                  model={imageEditModel}
                />
            </div>
        </div>

        <div className="text-center pt-2">
            <Tooltip content={t('tooltips.lookbookGenerate')} position="top">
              <button
                onClick={handleGenerate}
                disabled={anyLoading || validClothingImages.length === 0}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-3 px-8 rounded-full hover:opacity-90 disabled:from-zinc-600 disabled:to-zinc-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 transition-all transform hover:scale-105"
              >
                {isLoading ? <Spinner /> : t('lookbook.generateButton')}
              </button>
            </Tooltip>
        </div>
      </div>

      {/* --- Right Column: Output --- */}
      <div className="sticky top-8">
        <div className={outputContainerClasses}>
            {isLoading || isGeneratingVariations || isGeneratingCloseUp ? (
                <div className="flex flex-col items-center justify-center gap-4 text-center h-full">
                    <Spinner />
                    <p className="text-zinc-400">{loadingMessage}</p>
                </div>
            ) : error ? (
                <div className="p-4 w-full h-full flex items-center justify-center">
                    <ErrorDisplay title={t('common.generationFailed')} message={error} onClear={() => setError(null)} />
                </div>
            ) : generatedLookbook ? (
                <div className="flex flex-col h-full gap-4">
                    {/* Tabs */}
                    <div className="flex-shrink-0 flex justify-center border-b border-zinc-700">
                        {outputTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveOutputTab(tab.id)}
                                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                                    activeOutputTab === tab.id
                                        ? 'text-amber-400 border-b-2 border-amber-400'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-grow relative overflow-y-auto">
                        {activeOutputTab === 'main' && (
                            <div className="animate-fade-in">
                                <HoverableImage
                                    image={generatedLookbook.main}
                                    altText={t('lookbook.tabGeneratedImage')}
                                    onUpscale={() => handleUpscale(generatedLookbook.main, 'main')}
                                    isUpscaling={upscalingStates['main']}
                                />
                            </div>
                        )}
                        {activeOutputTab === 'variations' && (
                            <div className="animate-fade-in flex flex-col gap-4">
                                <div className="flex items-center justify-center gap-4">
                                    <label htmlFor="variation-slider" className="text-sm text-zinc-300">{t('lookbook.variationsLabel')}:</label>
                                    <input
                                        id="variation-slider"
                                        type="range"
                                        min="1" max="4" step="1"
                                        value={variationCount}
                                        onChange={(e) => setVariationCount(Number(e.target.value))}
                                    />
                                    <span className="bg-zinc-700 text-white font-bold rounded-full h-7 w-7 flex items-center justify-center text-sm">{variationCount}</span>
                                    <Tooltip content={t('tooltips.lookbookVariations')} position="bottom">
                                      <button onClick={handleGenerateVariations} disabled={isGeneratingVariations || isGeneratingCloseUp} className="bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:bg-zinc-600">
                                          {isGeneratingVariations ? <Spinner /> : t('lookbook.generateVariationsButton')}
                                      </button>
                                    </Tooltip>
                                </div>
                                {generatedLookbook.variations.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {generatedLookbook.variations.map((img, i) => (
                                            <HoverableImage
                                                key={i}
                                                image={img}
                                                altText={t('lookbook.variationAltText', { index: i + 1 })}
                                                onUpscale={() => handleUpscale(img, `var-${i}`)}
                                                isUpscaling={upscalingStates[`var-${i}`]}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-zinc-500 p-8">
                                        <h4 className="font-semibold">{t('lookbook.variationsPlaceholderTitle')}</h4>
                                        <p className="text-xs mt-1">{t('lookbook.variationsPlaceholderDescription')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeOutputTab === 'closeup' && (
                            <div className="animate-fade-in flex flex-col gap-4">
                                <div className="text-center">
                                    <Tooltip content={t('tooltips.lookbookCloseups')} position="bottom">
                                      <button onClick={handleGenerateCloseUp} disabled={isGeneratingCloseUp || isGeneratingVariations} className="bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg text-sm disabled:bg-zinc-600">
                                          {isGeneratingCloseUp ? <Spinner /> : t('lookbook.generateCloseUpButton')}
                                      </button>
                                    </Tooltip>
                                </div>
                                {generatedLookbook.closeups.length > 0 ? (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                        {generatedLookbook.closeups.map((img, i) => (
                                            <HoverableImage
                                                key={i}
                                                image={img}
                                                altText={t('lookbook.closeUpAltText', { index: i + 1 })}
                                                onUpscale={() => handleUpscale(img, `close-${i}`)}
                                                isUpscaling={upscalingStates[`close-${i}`]}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-zinc-500 p-8">
                                        <h4 className="font-semibold">{t('lookbook.closeupPlaceholderTitle')}</h4>
                                        <p className="text-xs mt-1">{t('lookbook.closeupPlaceholderDescription')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-center text-zinc-500 pointer-events-none p-8">
                    <GalleryIcon className="mx-auto h-16 w-16" />
                    <h3 className="mt-4 text-base md:text-lg font-semibold text-zinc-400">{t('common.outputPanelTitle')}</h3>
                    <p className="mt-1 text-sm">{t('lookbook.outputPanelDescription')}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
