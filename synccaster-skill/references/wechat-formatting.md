# WeChat Formatting Guide

Complete guide for rendering Markdown to WeChat-compatible HTML and CSS.

## Overview

WeChat (微信公众号) uses a rich text editor that doesn't support Markdown natively. SyncCaster provides a specialized formatter (`render_wechat_html`) that converts Markdown to WeChat-compatible HTML with inline CSS.

**Key Difference**: Other platforms accept Markdown directly; WeChat requires pre-rendered HTML with inline styles.

---

## Rendering Tool

### render_wechat_html

Converts Markdown to WeChat HTML/CSS.

**Request**:
```json
{
  "action": "render_wechat_html",
  "payload": {
    "markdown": "# Hello\n\nThis is formatted.",
    "options": {
      "theme": "default",
      "highlightCode": true
    }
  }
}
```

**Required**:
- `markdown` (string): Markdown content

**Optional**:
- `options` (object):
  - `theme` (string): Theme name (`"default"` | `"dark"` | custom)
  - `highlightCode` (boolean): Enable code highlighting

**Response**:
```json
{
  "ok": true,
  "data": {
    "html": "<section class=\"wx-content\">...</section>",
    "css": ".wx-content { ... }",
    "meta": {
      "wordCount": 150,
      "readTime": "1 min"
    }
  }
}
```

---

## Themes

### Default Theme (`default`)

Clean, professional styling suitable for most content.

**Characteristics**:
- Readable font size (16px)
- Good contrast (black text on white background)
- Optimized line height (1.6)
- Subtle accent colors for headings

**Best For**:
- Technical articles
- Business content
- General readership

---

### Dark Theme (`dark`)

Dark mode optimized for night reading.

**Characteristics**:
- Dark background (#1a1a1a)
- Light text (#e0e0e0)
- Reduced eye strain
- Modern aesthetic

**Best For**:
- Developer content
- Technical tutorials
- Night reading

---

### Custom Themes

You can create custom themes by specifying theme name in options.

**Theme Structure** (stored in extension):
```javascript
{
  "backgroundColor": "#ffffff",
  "textColor": "#333333",
  "headingColor": "#000000",
  "accentColor": "#0066cc",
  "codeBackgroundColor": "#f5f5f5",
  "codeColor": "#333333",
  "quoteBorderColor": "#e0e0e0",
  "linkColor": "#0066cc",
  "lineHeight": 1.6,
  "fontSize": "16px",
  "headingFontWeight": "600"
}
```

**Usage**:
```json
{
  "markdown": "# Content",
  "options": {
    "theme": "my-custom-theme"
  }
}
```

---

## Markdown to HTML Mapping

### Headings

```markdown
# H1 Heading
## H2 Heading
### H3 Heading
```

**Rendered as**:
```html
<h1 style="font-size: 28px; font-weight: 600; margin-bottom: 16px;">H1 Heading</h1>
<h2 style="font-size: 24px; font-weight: 600; margin-bottom: 14px;">H2 Heading</h2>
<h3 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">H3 Heading</h3>
```

---

### Paragraphs

```markdown
This is a paragraph with **bold** and *italic* text.
```

**Rendered as**:
```html
<p style="line-height: 1.6; margin-bottom: 16px;">
  This is a paragraph with <strong>bold</strong> and <em>italic</em> text.
</p>
```

---

### Lists

```markdown
- Item 1
- Item 2
  - Nested item
```

**Rendered as**:
```html
<ul style="padding-left: 20px; margin-bottom: 16px;">
  <li style="margin-bottom: 8px;">Item 1</li>
  <li style="margin-bottom: 8px;">
    Item 2
    <ul style="padding-left: 20px; margin-top: 8px;">
      <li style="margin-bottom: 8px;">Nested item</li>
    </ul>
  </li>
</ul>
```

---

### Code Blocks

```markdown
```javascript
const hello = "world";
console.log(hello);
```
```

**Rendered as** (with highlighting):
```html
<pre style="background: #f5f5f5; padding: 16px; overflow-x: auto;"><code style="font-family: monospace; font-size: 14px;"><span style="color: #0000ff;">const</span> hello = <span style="color: #008000;">"world"</span>;
<span style="color: #0000ff;">console</span>.<span style="color: #000000;">log</span>(hello);</code></pre>
```

---

### Blockquotes

```markdown
> This is a quote
> Multiple lines
```

**Rendered as**:
```html
<blockquote style="border-left: 4px solid #e0e0e0; padding-left: 16px; margin: 16px 0; color: #666666;">
  This is a quote
  Multiple lines
</blockquote>
```

---

### Links

```markdown
[Link text](https://example.com)
```

**Rendered as**:
```html
<a href="https://example.com" style="color: #0066cc; text-decoration: none;">Link text</a>
```

---

### Images

```markdown
![Alt text](https://example.com/image.png)
```

**Rendered as**:
```html
<img src="https://example.com/image.png" alt="Alt text" style="max-width: 100%; height: auto; display: block; margin: 16px 0;" />
```

---

## LaTeX Math

Supported via KaTeX rendering.

```markdown
Inline math: $E = mc^2$

Block math:
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

**Rendered as**: HTML with KaTeX classes and inline styles for visual rendering.

**Note**: WeChat doesn't support external KaTeX libraries. Math is rendered as styled text or SVG if complex.

---

## Tables

```markdown
| Header 1 | Header 2 |
|-----------|-----------|
| Cell 1    | Cell 2    |
```

**Rendered as**:
```html
<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
  <thead>
    <tr>
      <th style="border: 1px solid #e0e0e0; padding: 8px; text-align: left;">Header 1</th>
      <th style="border: 1px solid #e0e0e0; padding: 8px; text-align: left;">Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #e0e0e0; padding: 8px;">Cell 1</td>
      <td style="border: 1px solid #e0e0e0; padding: 8px;">Cell 2</td>
    </tr>
  </tbody>
</table>
```

---

## Horizontal Rules

```markdown
---
```

**Rendered as**:
```html
<hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
```

---

## Publishing Workflow

### Step 1: Render Content

```
Use render_wechat_html tool
Input: markdown content
Output: html + css
```

### Step 2: Open WeChat Editor

1. Log in to WeChat MP (mp.weixin.qq.com)
2. Navigate to "New Article" (新建图文)
3. Open editor

### Step 3: Paste Content

**Option A: Copy-Paste HTML**
```
1. Copy HTML from tool output
2. In WeChat editor, switch to "Source" or HTML view
3. Paste HTML
4. Switch back to visual editor
```

**Option B: Copy-Paste Visual**
```
1. Copy HTML to temporary HTML file
2. Open in browser
3. Copy rendered content visually
4. Paste in WeChat editor
5. Adjust formatting if needed
```

### Step 4: Apply CSS

If CSS is returned separately:

1. In WeChat editor, find "Styles" or "CSS" section
2. Paste CSS content
3. Preview to verify styling

### Step 5: Adjust Manually

WeChat editor is rich text. You may need to:

- Adjust image sizes
- Fix spacing issues
- Reformat complex layouts
- Add WeChat-specific elements (covers, summaries)

### Step 6: Preview and Publish

1. Preview in WeChat mobile view
2. Make final adjustments
3. Publish or save as draft

---

## Best Practices

### 1. Use Simple Formatting

WeChat editor has limitations. Prefer:
- Clear heading hierarchy (H1 → H2 → H3)
- Short paragraphs (2-3 sentences)
- Bullet points for lists
- Code blocks for technical content

### 2. Optimize for Mobile

- Use readable font sizes (16px+)
- Ensure sufficient contrast
- Avoid excessive nesting
- Test on mobile preview

### 3. Image Guidelines

- **Local images**: Upload to WeChat media library first
- **URL images**: Verify HTTPS and accessibility
- **Image size**: Max width ~700px for mobile
- **Alt text**: Describe for accessibility

### 4. Code Blocks

- Keep code blocks concise (< 50 lines)
- Use syntax highlighting
- Consider line wrapping for mobile
- Test preview on mobile

### 5. Math Equations

- Keep equations simple
- Use block math for complex formulas
- Test rendering in WeChat
- Consider alternative explanations if rendering fails

### 6. Link Handling

- Use descriptive anchor text
- Avoid excessive links
- Test link accessibility
- Use HTTPS URLs

---

## Common Issues and Solutions

### Issue 1: Code Formatting Lost

**Symptom**: Code blocks lose formatting after paste.

**Solution**:
1. Switch to WeChat editor's HTML/source view
2. Paste pre-rendered HTML
3. Or reformat manually in visual editor

### Issue 2: Images Not Showing

**Symptom**: Images broken after paste.

**Solution**:
1. Upload images to WeChat media library
2. Replace URLs with WeChat media URLs
3. Ensure HTTPS

### Issue 3: Math Equations Not Rendering

**Symptom**: LaTeX equations not visible or broken.

**Solution**:
1. Keep equations simple
2. Use block math: `$$...$$`
3. Consider converting to images for complex math
4. Test preview before publish

### Issue 4: Tables Misaligned

**Symptom**: Table columns not aligned on mobile.

**Solution**:
1. Reduce table width
2. Simplify table structure
3. Consider using lists instead of tables
4. Test on mobile preview

### Issue 5: Styling Lost

**Symptom**: Inline styles not applied.

**Solution**:
1. Use WeChat's style editor
2. Apply CSS separately in style section
3. Manually adjust formatting in visual editor
4. Use default theme for better compatibility

---

## Advanced Usage

### Custom CSS Injection

If you need custom styling beyond themes:

1. Render with `theme: 'default'`
2. Modify CSS output manually
3. Apply in WeChat editor's style section

### Interactive Elements

WeChat supports:
- Audio clips
- Video embeds
- QR codes
- Location maps

**Note**: These require manual addition in WeChat editor.

### Rich Media

- **GIFs**: Upload as regular images
- **Videos**: Use WeChat video upload
- **Audio**: Use WeChat audio embed
- **QR Codes**: Generate and insert as image

---

## Troubleshooting

### Tool Errors

**Error**: `render_wechat_html` fails

**Solutions**:
1. Verify markdown is non-empty
2. Check for invalid markdown syntax
3. Try simpler content first
4. Check extension console for errors

### Display Issues

**Symptom**: HTML renders differently in WeChat

**Solutions**:
1. Switch to source view to paste HTML
2. Apply CSS manually
3. Adjust formatting in visual editor
4. Test on mobile preview

### Performance Issues

**Symptom**: Large content causes lag

**Solutions**:
1. Split into multiple articles
2. Reduce image count/size
3. Simplify formatting
4. Optimize HTML size

---

## Tools and Resources

### WeChat Editor

- URL: https://mp.weixin.qq.com
- Features: Rich text, media upload, mobile preview
- Limitations: No native Markdown, formatting quirks

### Online Previewers

Test rendered HTML before WeChat:

- WeChat Official Preview: Built into editor
- Third-party tools: Search "WeChat editor preview"

### Alternative Formatters

If SyncCaster formatter doesn't meet needs:

- MdNice: https://mdnice.com/
- WeFormat: WeChat-focused formatters
- Custom: Build own renderer

---

## Summary

**Key Points**:
1. WeChat requires pre-rendered HTML (no native Markdown)
2. Use `render_wechat_html` tool for conversion
3. Paste in WeChat editor's source view for best results
4. Test on mobile preview before publishing
5. Manual adjustments often needed

**Quick Workflow**:
```
Markdown → render_wechat_html → HTML + CSS → WeChat editor (source view) → Preview → Publish
```

For other platforms, use `create_post` and `publish_post` directly (no pre-rendering needed).

See [MCP-TOOLS.md](./mcp-tools.md) for tool reference.
See [PLATFORM-LIST.md](./platform-list.md) for platform comparison.
