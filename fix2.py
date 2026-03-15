import sys
import re

file_path = 'f:/CodeBase/Chang-Store/components/BackgroundReplacer.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "import ResultPlaceholder from './shared/ResultPlaceholder';\n\nconst COMPONENT_ID",
    "import ResultPlaceholder from './shared/ResultPlaceholder';\nimport { PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';\n\nconst COMPONENT_ID"
)
text = text.replace(
    "import ResultPlaceholder from './shared/ResultPlaceholder';\r\n\r\nconst COMPONENT_ID",
    "import ResultPlaceholder from './shared/ResultPlaceholder';\r\nimport { PHOTO_ALBUM_BACKGROUNDS } from '../utils/photoAlbumConfig';\r\n\r\nconst COMPONENT_ID"
)

text = text.replace(
'''  const PREDEFINED_BG_KEYS = ['studioMirrorChair', 'sofaMirrorCurtain', 'curvedSofaCurtain'];
  const allBackgroundLabels = t('photoAlbum.backgroundLabels', { returnObjects: true });
  const allBackgroundPrompts = t('photoAlbum.backgroundPrompts', { returnObjects: true });''',
'''  const PREDEFINED_BG_KEYS = ['studioMirrorChair', 'sofaMirrorCurtain', 'curvedSofaCurtain'];
  const allBackgroundLabels: Record<string, string> = t('photoAlbum.backgroundLabels', { returnObjects: true });
  const allBackgroundPrompts: Record<string, string> = PHOTO_ALBUM_BACKGROUNDS.reduce((acc, curr) => {
    acc[curr.id] = curr.prompt;
    return acc;
  }, {} as Record<string, string>);'''
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
