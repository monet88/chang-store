import sys
import re

file_path = 'f:/CodeBase/Chang-Store/components/PhotoAlbumCreator.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
text = text.replace(
    "import ResultPlaceholder from './shared/ResultPlaceholder';\n\ntype GenerationMode",
    "import ResultPlaceholder from './shared/ResultPlaceholder';\nimport { PHOTO_ALBUM_POSES, PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';\n\ntype GenerationMode"
)
text = text.replace(
    "import ResultPlaceholder from './shared/ResultPlaceholder';\r\n\r\ntype GenerationMode",
    "import ResultPlaceholder from './shared/ResultPlaceholder';\r\nimport { PHOTO_ALBUM_POSES, PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';\r\n\r\ntype GenerationMode"
)


# 2. State
text = text.replace(
'''    const POSES: string[] = t('photoAlbum.poses', { returnObjects: true });
    const FRAMES = t('photoAlbum.frames', { returnObjects: true });
    const BACKGROUND_LABELS = t('photoAlbum.backgroundLabels', { returnObjects: true });
    const BACKGROUND_PROMPTS = t('photoAlbum.backgroundPrompts', { returnObjects: true });
    const HAIR_STYLES = t('photoAlbum.hairStyles', { returnObjects: true });
    const SKIN_TONES = t('photoAlbum.skinTones', { returnObjects: true });''',
'''    const POSE_LABELS: Record<string, string> = t('photoAlbum.poseLabels', { returnObjects: true });
    const POSES: string[] = PHOTO_ALBUM_POSES.map(p => p.id);
    const FRAMES = t('photoAlbum.frames', { returnObjects: true });
    const BACKGROUND_LABELS: Record<string, string> = t('photoAlbum.backgroundLabels', { returnObjects: true });
    const BACKGROUND_PROMPTS = PHOTO_ALBUM_BACKGROUNDS.reduce((acc, curr) => {
        acc[curr.id] = curr.prompt;
        return acc;
    }, {} as Record<string, string>);
    const HAIR_STYLES = t('photoAlbum.hairStyles', { returnObjects: true });
    const SKIN_TONES = t('photoAlbum.skinTones', { returnObjects: true });'''
)

# 3. Prompt
text = text.replace(
'''- **New Pose**: The model's new pose MUST be: "${pose}".''',
'''- **New Pose**: The model's new pose MUST be: "${PHOTO_ALBUM_POSES.find(p => p.id === pose)?.prompt || pose}".'''
)

# 4. Checkboxes
text = text.replace(
'''                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        {POSES.map(pose => (
                            <label key={pose} className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={selectedPoses.includes(pose)} onChange={() => setSelectedPoses(prev => prev.includes(pose) ? prev.filter(p => p !== pose) : [...prev, pose])} className="w-4 h-4 rounded text-amber-500 bg-zinc-700 border-zinc-600 focus:ring-amber-500" />
                                <span className="text-sm text-zinc-300">{pose}</span>
                            </label>
                        ))}
                    </div>''',
'''                    <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        {POSES.map(poseId => (
                            <label key={poseId} className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={selectedPoses.includes(poseId)} onChange={() => setSelectedPoses(prev => prev.includes(poseId) ? prev.filter(p => p !== poseId) : [...prev, poseId])} className="w-4 h-4 rounded text-amber-500 bg-zinc-700 border-zinc-600 focus:ring-amber-500" />
                                <span className="text-sm text-zinc-300">{POSE_LABELS[poseId] || poseId}</span>
                            </label>
                        ))}
                    </div>'''
)

# 5. Output display
text = text.replace(
'''                                <div key={index}>
                                    <HoverableImage image={image} altText={image.pose} />
                                    <p className="text-xs text-zinc-400 mt-1.5 text-center truncate" title={image.pose}>{image.pose}</p>
                                </div>''',
'''                                <div key={index}>
                                    <HoverableImage image={image} altText={POSE_LABELS[image.pose] || image.pose} />
                                    <p className="text-xs text-zinc-400 mt-1.5 text-center truncate" title={POSE_LABELS[image.pose] || image.pose}>{POSE_LABELS[image.pose] || image.pose}</p>
                                </div>'''
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
