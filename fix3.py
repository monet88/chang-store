import sys
import re

file_path = 'f:/CodeBase/Chang-Store/utils/photoAlbumConfig.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the double escaping and use backticks for the background prompts
text = text.replace('\\\\n', '\\n')
text = text.replace('\\\\\'', "'")

# Convert the background prompts from single quotes to backticks
text = re.sub(r"prompt:\s*'(.*?)'(?=\s*\n\s*})", lambda m: "prompt: `" + m.group(1).replace("'", "’") + "`", text, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Done!')
