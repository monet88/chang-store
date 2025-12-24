  | Short Name                   | Full Tool Name                                |
  |------------------------------|-----------------------------------------------|
  | ui_to_artifact               | mcp__mcp-router__ui_to_artifact               |
  | extract_text_from_screenshot | mcp__mcp-router__extract_text_from_screenshot |
  | diagnose_error_screenshot    | mcp__mcp-router__diagnose_error_screenshot    |
  | understand_technical_diagram | mcp__mcp-router__understand_technical_diagram |
  | analyze_data_visualization   | mcp__mcp-router__analyze_data_visualization   |
  | ui_diff_check                | mcp__mcp-router__ui_diff_check                |
  | analyze_image                | mcp__mcp-router__analyze_image                |
  | analyze_video                | mcp__mcp-router__analyze_video                |
  | webReader                    | mcp__mcp-router__webReader                    |
  | webSearchPrime               | mcp__mcp-router__webSearchPrime  


  ● MCP-Router Tools

  | Tool                         | Purpose                                               |
  |------------------------------|-------------------------------------------------------|
  | webReader                    | Fetch URL → convert HTML to markdown for LLM          |
  | webSearchPrime               | Web search with title, URL, summary, site info        |
  | ui_to_artifact               | Convert UI screenshots → code/prompt/spec/description |
  | extract_text_from_screenshot | OCR - extract text from screenshots                   |
  | diagnose_error_screenshot    | Analyze error messages, stack traces                  |
  | understand_technical_diagram | Analyze architecture, flowcharts, UML, ER diagrams    |
  | analyze_data_visualization   | Analyze charts, graphs, dashboards                    |
  | ui_diff_check                | Compare two UI screenshots for differences            |
  | analyze_image                | General-purpose image analysis (fallback)             |
  | analyze_video                | Analyze video content with AI vision                  |


  1. Tôi muốn tận dụng tối đa khả năng của mcp tools, đặc biệt là ui_to_artifact, extract_text_from_screenshot, diagnose_error_screenshot, understand_technical_diagram, analyze_data_visualization, ui_diff_check, analyze_image, analyze_video, webReader, webSearchPrime. Thì có cần tạo ra một skill riêng biệt hoặc hook vào các tool này không? để AI sẽ tự động dùng tới khi cần thiết, phù hợp.
  2. Gemini model cli thì sẽ làm tác vụ cần thinking, cần detail tốt hơn.


    | Scenario                        | Tool Used     | Use Case                                                               |
  |---------------------------------|---------------|------------------------------------------------------------------------|
  | Skill activated (ai-multimodal) | gemini -p CLI | Heavy tasks: image/video generation, deep analysis, thinking-intensive |
  | No skill                        | MCP tools     | Quick tasks: web search, URL fetch, UI analysis, OCR, diagrams         |

  MCP Tools Available (no skill needed):

  - webSearchPrime - Web search
  - webReader - Fetch URL content
  - ui_to_artifact - UI → code/prompt/spec
  - extract_text_from_screenshot - OCR
  - diagnose_error_screenshot - Error analysis
  - understand_technical_diagram - Diagram analysis
  - analyze_data_visualization - Charts/graphs
  - ui_diff_check - UI comparison
  - analyze_image - General image
  - analyze_video - Video content

  Gemini CLI (skill activated):

  - Image generation (Imagen 4)
  - Video generation (Veo 3)
  - Deep multimodal analysis
  - Tasks needing extended thinking

  Workflow này tối ưu token và latency. 👍

● Test Prompts cho MCP Tools

  1. webSearchPrime

  Tool: mcp__mcp-router__webSearchPrime
  Params: {
    "search_query": "React 19 new features 2025",
    "location": "us"
  }

  2. webReader

  Tool: mcp__mcp-router__webReader
  Params: {
    "url": "https://react.dev/blog"
  }

  3. ui_to_artifact

  Tool: mcp__mcp-router__ui_to_artifact
  Params: {
    "image_source": "path/to/screenshot.png",
    "output_type": "code",
    "prompt": "Generate React component with Tailwind CSS"
  }
  output_type: code | prompt | spec | description

  4. extract_text_from_screenshot

  Tool: mcp__mcp-router__extract_text_from_screenshot
  Params: {
    "image_source": "path/to/code-screenshot.png",
    "prompt": "Extract all code from this screenshot",
    "programming_language": "typescript"
  }

  5. diagnose_error_screenshot

  Tool: mcp__mcp-router__diagnose_error_screenshot
  Params: {
    "image_source": "path/to/error.png",
    "prompt": "Diagnose this error and provide fix",
    "context": "running npm build"
  }

  6. understand_technical_diagram

  Tool: mcp__mcp-router__understand_technical_diagram
  Params: {
    "image_source": "path/to/diagram.png",
    "prompt": "Explain this system architecture",
    "diagram_type": "architecture"
  }
  diagram_type: architecture | flowchart | uml | er-diagram | sequence

  7. analyze_data_visualization

  Tool: mcp__mcp-router__analyze_data_visualization
  Params: {
    "image_source": "path/to/chart.png",
    "prompt": "Extract trends and key metrics",
    "analysis_focus": "trends"
  }
  analysis_focus: trends | anomalies | comparisons | performance metrics

  8. ui_diff_check

  Tool: mcp__mcp-router__ui_diff_check
  Params: {
    "expected_image_source": "path/to/design.png",
    "actual_image_source": "path/to/implementation.png",
    "prompt": "Compare design vs implementation, list differences"
  }

  9. analyze_image

  Tool: mcp__mcp-router__analyze_image
  Params: {
    "image_source": "path/to/image.png",
    "prompt": "Describe this image in detail"
  }

  10. analyze_video

  Tool: mcp__mcp-router__analyze_video
  Params: {
    "video_source": "path/to/video.mp4",
    "prompt": "Summarize key moments and actions"
  }
  Supports: MP4, MOV, M4V (max 8MB)

  ---
  Quick Copy Test (webSearchPrime + webReader):
  Search: "Claude Code hooks tutorial"
  Fetch: https://docs.anthropic.com

Check mcp-management skill, mcp-manager agent, và command ck:use-mcp