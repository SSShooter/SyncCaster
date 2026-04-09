# SyncCaster Platform List

Complete list of 17+ supported platforms with their capabilities and special notes.

## Platform Capabilities Matrix

| Platform ID | Name | Markdown | HTML | LaTeX | Editor Type | Notes |
|-------------|-------|----------|-------|--------|-------------|--------|
| `juejin` | 掘金 | ✅ | ❌ | ✅ | Markdown | Popular tech community |
| `csdn` | CSDN | ✅ | ❌ | ✅ | Markdown | Largest dev community in China |
| `cnblogs` | 博客园 | ✅ | ❌ | ✅ | Markdown | Requires math support enabled |
| `51cto` | 51CTO | ✅ | ❌ | ✅ | Markdown | IT education platform |
| `tencent-cloud` | 腾讯云+社区 | ✅ | ❌ | ✅ | Markdown | Cloud platform blog |
| `aliyun` | 阿里云开发者社区 | ✅ | ❌ | ✅ | Markdown | Cloud platform blog |
| `zhihu` | 知乎 | ❌ | ✅ | ✅ | Rich Text | Q&A + articles |
| `jianshu` | 简书 | ✅ | ❌ | ✅ | Markdown | General content platform |
| `segmentfault` | 思否 | ✅ | ❌ | ✅ | Markdown | Developer Q&A |
| `bilibili` | 哔哩哔哩 | ✅ | ❌ | ✅ | Markdown | Video platform articles |
| `oschina` | 开源中国 | ✅ | ❌ | ✅ | Markdown | Open source community |
| `toutiao` | 今日头条 | ❌ | ✅ | ✅ | Rich Text | News aggregator |
| `infoq` | InfoQ | ✅ | ❌ | ✅ | Markdown | Tech news platform |
| `baijiahao` | 百家号 | ❌ | ✅ | ✅ | Rich Text | Baidu content platform |
| `wangyihao` | 网易号 | ❌ | ✅ | ✅ | Rich Text | NetEase content platform |
| `wechat` | 微信公众号 | ✅ | ✅ | ✅ | Rich Text | Requires special formatter |
| `medium` | Medium | ✅ | ❌ | ✅ | Markdown | English platform |

## Platform Details

### Markdown-First Platforms

#### juejin (掘金)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Supports code syntax highlighting
- LaTeX math with `$` delimiters
- Front matter supported
- Tag limit: 5 tags

**Best For**: Technical tutorials, dev articles

**Example**:
```markdown
---
tags: [vue, javascript, tutorial]
---

# Vue 3 Composition API

Complete guide to Vue 3's Composition API.

Math: $E = mc^2$
```

---

#### csdn (CSDN)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Largest developer community in China
- LaTeX with `$$` or `$` delimiters
- Rich markdown support
- Category selection required

**Best For**: Dev tutorials, code examples

---

#### cnblogs (博客园)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Requires "MathJax" support enabled in settings
- Traditional developer community
- Custom theme support

**Best For**: Long-form technical content

---

#### 51cto (51CTO)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- IT education and certification focus
- Markdown with math support
- Category selection required

**Best For**: Certification prep, IT tutorials

---

#### tencent-cloud (腾讯云+社区)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Cloud platform developer community
- Requires account registration
- Cloud-focused content preferred

**Best For**: Cloud architecture, DevOps

---

#### aliyun (阿里云开发者社区)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Alibaba Cloud developer community
- Cloud computing focus
- Technical depth appreciated

**Best For**: Cloud tutorials, case studies

---

#### jianshu (简书)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- General content platform (not tech-only)
- LaTeX support limited
- Good for broader audience

**Best For**: Tech articles for general readers

---

#### segmentfault (思否)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Developer Q&A + articles
- Code highlighting
- Technical depth appreciated

**Best For**: Problem-solving, technical Q&A

---

#### bilibili (哔哩哔哩)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Video platform with articles (专栏)
- Rich media support
- Young audience

**Best For**: Video-related tutorials, casual tech

---

#### oschina (开源中国)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Open source community focus
- Project promotion
- Open source content preferred

**Best For**: Open source tutorials, project announcements

---

#### infoq (InfoQ)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- Tech news and trends
- High quality standards
- Industry expertise valued

**Best For**: Industry insights, architecture patterns

---

#### medium (Medium)

**Capabilities**: Markdown, LaTeX

**Special Notes**:
- English-only platform
- International audience
- Clean reading experience
- LaTeX support limited

**Best For**: English tech articles, global audience

---

### Rich Text Platforms

#### zhihu (知乎)

**Capabilities**: HTML, LaTeX

**Special Notes**:
- Q&A platform with articles
- Rich text editor (WYSIWYG)
- LaTeX with `$$` or `$` delimiters
- Image handling differs

**Best For**: Q&A, thought leadership articles

**HTML Handling**:
- SyncCaster converts Markdown to HTML automatically
- Inline styles preserved
- Math equations rendered as images

---

#### toutiao (今日头条)

**Capabilities**: HTML, LaTeX

**Special Notes**:
- News aggregator platform
- Mass audience
- Rich text editor
- Algorithm-driven distribution

**Best For**: Tech news, viral content

---

#### baijiahao (百家号)

**Capabilities**: HTML, LaTeX

**Special Notes**:
- Baidu content platform
- SEO benefits
- Rich text editor
- Baidu ecosystem

**Best For**: SEO-optimized content, Baidu traffic

---

#### wangyihao (网易号)

**Special Notes**:
- NetEase content platform
- News and articles
- Rich text editor

**Best For**: News, general tech content

---

### Special Platforms

#### wechat (微信公众号)

**Capabilities**: Markdown, HTML, LaTeX

**Special Notes**:
- **Requires special formatter** (use `render_wechat_html`)
- No native Markdown support
- HTML + inline CSS required
- Rich theme support
- Manual formatting often needed

**Best For**: WeChat ecosystem, subscriber base

**Rendering**:
```markdown
# Use render_wechat_html tool

Input: markdown
Options: { theme: 'default' }
Output: html + css
```

**Themes**:
- `default` - Clean, professional
- `dark` - Dark mode optimized
- Custom themes supported

**Image Handling**:
- Local images need upload first
- URL images preserved
- Width constraints apply

---

## Capability Comparison

### Markdown Support

**Full Support**: juejin, csdn, cnblogs, 51cto, tencent-cloud, aliyun, jianshu, segmentfault, bilibili, oschina, infoq, medium

**No Markdown** (HTML only): zhihu, toutiao, baijiahao, wangyihao

**Special**: wechat (requires HTML rendering)

### LaTeX Support

**Full Support**: All platforms

**Implementation**:
- Markdown platforms: `$E=mc^2$` or `$$E=mc^2$$`
- HTML platforms: Converted to MathJax or images

### Code Highlighting

All platforms support code blocks with syntax highlighting:

```markdown
```javascript
const hello = "world";
```
```

Language detection automatic on most platforms.

---

## Account Requirements

### Registration Required

All platforms require account registration before publishing.

### Login Methods

- **Platform Login**: In extension → Accounts tab → Click platform icon
- **Cookie-Based**: Extension stores login cookies
- **Expiration**: Cookies expire (re-login required)

### Multiple Accounts

- Some platforms allow multiple accounts (e.g., CSDN)
- Extension tracks per-account status
- Default account selected for auto-publish

---

## Platform-Specific Limits

| Platform | Title Length | Tags | Categories | Image Limit |
|-----------|---------------|------|------------|-------------|
| juejin | 100 chars | 5 max | Required | 20 max |
| csdn | 100 chars | 10 max | Required | Unlimited |
| zhihu | 50 chars | 5 max | Optional | Unlimited |
| jianshu | 50 chars | 5 max | Optional | 9 max |
| wechat | 64 chars | None | Optional | Unlimited |

*Note: Limits may change. SyncCaster handles validation automatically.*

---

## Recommended Publishing Strategy

### For Technical Content

1. **Primary**: juejin, csdn (high dev engagement)
2. **Secondary**: zhihu (Q&A traffic), segmentfault (problem-solving)
3. **Niche**: oschina (open source), bilibili (video-related)

### For General Audience

1. **Primary**: toutiao, jianshu (broad reach)
2. **Secondary**: zhihu (Q&A potential), wechat (subscribers)

### For International Audience

1. **Primary**: medium (English-speaking)
2. **Secondary**: Translate to Chinese, publish to local platforms

### For SEO/Baidu Traffic

1. **Primary**: baijiahao (Baidu ecosystem)
2. **Secondary**: zhihu (high Baidu ranking)

---

## Platform Selection Tips

### Use Markdown-First Platforms When:

- Writing pure code tutorials
- Heavy LaTeX math equations
- Want clean, version-controlled source
- Prefer writing in Markdown

### Use Rich Text Platforms When:

- Publishing Q&A (zhihu)
- Targeting news audiences (toutiao)
- Need rich media formatting
- Platform-specific formatting requirements

### Use WeChat When:

- Building subscriber base
- Private audience
- Need rich themes
- Manual formatting acceptable

---

## Troubleshooting

### Platform-Specific Issues

**juejin**: Login required every few weeks
**csdn**: Image upload may fail (retry)
**zhihu**: LaTeX renders as images (limit equations)
**wechat**: Formatting may break (use `render_wechat_html`)

### Common Problems

**Account Expired**: Re-login in extension → Accounts tab
**Publish Failed**: Check platform status (outage?)
**Format Issues**: Platform-specific quirks (see above)
**Image Errors**: Upload images first, then retry publish

---

## Updates

Platform capabilities and requirements change. For latest information:

1. Check SyncCaster GitHub releases
2. Review platform documentation
3. Test publish with sample content
4. Monitor job status errors

See [error-codes.md](error-codes.md) for error handling.
