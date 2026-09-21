/**
 * Camera framing, distance, and field of view preservation policy.
 * Hard-codes strict constraints ensuring the output photograph maintains the
 * exact camera distance, framing, and subject-to-frame proportions of the source.
 */

export const CAMERA_FRAMING_INSTRUCTION =
  'Preserve exact camera distance, field of view, focal length, perspective, and framing from the Subject Image. Maintain the exact same subject-to-frame scale ratio: do not zoom in, do not crop closer, and do not make the subject appear closer to the camera. The subject must occupy the exact same proportion and position of the frame as in the original photo, preserving all surrounding environmental space and negative space.';

export const CAMERA_FRAMING_PROHIBITION_LINES = [
  'Never zoom in, crop in, or bring the camera closer to the subject than in the Subject Image.',
  'Do not alter the camera distance, field of view, or subject-to-frame scale ratio.',
] as const;

export const CLOTHING_TRANSFER_CAMERA_INSTRUCTION =
  'Preserve the exact camera distance, field of view, focal length, and framing from the DESTINATION SCENE. Maintain the exact same subject-to-frame scale ratio and do not zoom in or crop closer to the subject.';

export const CLOTHING_TRANSFER_CAMERA_PROHIBITION_LINE =
  'Never zoom in, crop in, or alter the camera distance, field of view, or subject-to-frame scale ratio.';
