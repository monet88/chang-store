/**
 * Pose Changer prompt builders.
 *
 * Pure text builders extracted from `usePoseChanger` so the prompt wording is a
 * single source of truth, testable in isolation, and the hook keeps only state
 * and orchestration. Framing text is resolved by the caller (it depends on the
 * i18n `t` function) and passed in, keeping these builders dependency-free.
 */

/**
 * Build the text-driven pose prompt: re-pose the model from a written pose
 * description while preserving identity, outfit, and background.
 */
export const buildTextPosePrompt = (promptText: string, framingInstruction: string): string => `
  **Task**: Photorealistically change the pose of a model based on a text description, while perfectly preserving the model, their clothing, and the background.
  **Source Image**: Contains the model and their clothing.
  **New Pose Description**: "${promptText}".
  **CRITICAL RULES**:
  1.  **Analyze Clothing**: First, analyze the clothing in the Source Image to understand its type (e.g., dress, jeans, blouse), fabric properties (e.g., silk, denim, cotton), and fit (e.g., loose, tight, structured).
  2.  **Preserve Identity**: The model's identity (face, hair, body shape), their entire outfit (design, color, texture), and the entire background from the Source Image MUST be preserved with 100% accuracy.
  3.  **Apply New Pose**: Re-render the model in a new, physically plausible pose that accurately matches the **New Pose Description**.
  4.  **Realistic Draping**: This is the most important step. Re-drape the *exact same* clothing onto the model in their new pose. The draping must be physically accurate, showing how the specific fabric would naturally fold, stretch, and hang based on the new body position and gravity. The fit must remain consistent with the original garment.
  5.  **Camera Framing**: ${framingInstruction}
  **Final Goal**: A high-resolution (2K), photorealistic image.
`.trim();

/**
 * Build the reference-driven pose prompt: transfer the pose from a reference
 * image onto the subject, preserving the subject's identity/outfit/background.
 * An optional custom text instruction is appended when provided.
 */
export const buildReferencePosePrompt = (customPosePrompt: string, framingInstruction: string): string => `
  **Task**: Photorealistically transfer the pose from a 'Pose Reference Image' onto the model in a 'Subject Image', while perfectly preserving the model, their clothing, and the background.
  **Image Roles**:
  -   **First Image ('Subject Image')**: Contains the model, clothing, and background to be preserved.
  -   **Second Image ('Pose Reference Image')**: Provides the target pose.
  **CRITICAL RULES**:
  1.  **Extract Pose**: Analyze the 'Pose Reference Image' to understand the exact body position.
  2.  **Preserve Subject, Clothing, and Background**: The model's identity, their entire outfit, and the entire background from the 'Subject Image' MUST be preserved with 100% accuracy.
  3.  **Apply Pose**: Re-render the model from the 'Subject Image' in the exact pose extracted from the 'Pose Reference Image'.
  4.  **Photorealistic Integration**: The model's body must be anatomically correct, clothing redraped realistically, and lighting must match.
  5.  **Camera Framing**: ${framingInstruction}
  ${customPosePrompt.trim() ? `**Additional Text Instruction**: While applying the pose from the reference image, also incorporate this detail: "${customPosePrompt.trim()}".` : ''}
  **Strict Negative Constraints**: DO NOT copy clothing, background, or identity from the 'Pose Reference Image'.
  **Final Goal**: A high-resolution (2K), photorealistic image where the model from the 'Subject Image' is now in the pose from the 'Pose Reference Image'.
`.trim();
