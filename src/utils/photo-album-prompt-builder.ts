/**
 * Photo Album prompt builder.
 *
 * Pure text builder extracted from `usePhotoAlbum` so the wording is a single
 * source of truth, testable in isolation, and the hook keeps only state,
 * image-role selection, and orchestration. All values that depend on i18n or
 * hook state (image roles, framing, pose text, hair/skin labels, background,
 * frame, notes) are resolved by the caller and passed in as strings.
 */

export interface PhotoAlbumPromptInput {
  /** Resolved description of each provided image's role. */
  imageRolesPrompt: string;
  /** Resolved framing instruction (camera view), already localized. */
  framingInstruction: string;
  /** Resolved target pose description. */
  poseInstruction: string;
  /** Resolved hair-style label. */
  hairStyle: string;
  /** Resolved skin-tone label. */
  skinTone: string;
  /** Resolved footwear instruction text. */
  footwearInstruction: string;
  /** Resolved background composition sentence. */
  backgroundInstruction: string;
  /** Resolved frame/border sentence. */
  frameInstruction: string;
  /** Resolved additional-notes sentence. */
  additionalNotesInstruction: string;
}

/** Compose the photo-album image-generation prompt from resolved parts. */
export const buildPhotoAlbumPrompt = ({
  imageRolesPrompt,
  framingInstruction,
  poseInstruction,
  hairStyle,
  skinTone,
  footwearInstruction,
  backgroundInstruction,
  frameInstruction,
  additionalNotesInstruction,
}: PhotoAlbumPromptInput): string => `
# INSTRUCTION: CREATE PHOTO ALBUM IMAGE

## 1. IMAGE ROLES
${imageRolesPrompt}

## 2. CRITICAL RULES (MUST FOLLOW)
- **Identity Preservation**: Flawlessly preserve the person’s facial features, hairstyle, and skin tone from the reference image. The resemblance must be perfect.
- **Outfit Application**:
    - If using 'Face Reference' and 'Outfit Image', dress the model in the complete outfit and footwear from the 'Outfit Image'. Preserve the outfit and footwear design, color, texture, and fit with 100% accuracy.
    - If using a single 'Source Image', use the outfit and footwear the model is already wearing. Ensure the footwear matches the original image exactly.
- **New Pose**: The model's new pose MUST be: "${poseInstruction}".
- **Model Details**:
    - **Hair Style**: ${hairStyle}
    - **Skin Tone**: ${skinTone}
    - **Footwear**: ${footwearInstruction}

## 3. SCENE COMPOSITION
- **Background**: ${backgroundInstruction}
- **Camera & Framing**: The shot must adhere to this framing: "${framingInstruction}".
- **Frame/Border**: ${frameInstruction}

## 4. ADDITIONAL NOTES
${additionalNotesInstruction}

## 5. FINAL OUTPUT
Generate a single, hyper-realistic, professional-grade fashion photograph that perfectly combines all the above elements.
    `.trim();
