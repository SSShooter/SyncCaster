type TextRule = {
  pattern: RegExp;
  replacement: string;
};

const clicheRules: TextRule[] = [
  { pattern: /是显而易见的/g, replacement: '很明显' },
  { pattern: /是毋庸置疑的/g, replacement: '没有疑问' },
  { pattern: /是不言而喻的/g, replacement: '不用多说' },
  { pattern: /是不可否认的/g, replacement: '确实如此' },
  { pattern: /值得注意的是[，,：:]?/g, replacement: '' },
  { pattern: /值得一提的是[，,：:]?/g, replacement: '' },
  { pattern: /需要注意的是[，,：:]?/g, replacement: '' },
  { pattern: /综上所述[，,。.:：]?/g, replacement: '' },
  { pattern: /综上[，,：:]?/g, replacement: '' },
  { pattern: /总而言之[，,。.:：]?/g, replacement: '' },
  { pattern: /总的来说[，,。.:：]?/g, replacement: '' },
  { pattern: /总体而言[，,。.:：]?/g, replacement: '' },
  { pattern: /概括来说[，,：:]?/g, replacement: '' },
  { pattern: /归根结底[，,：:]?/g, replacement: '' },
  { pattern: /简而言之[，,：:]?/g, replacement: '' },
  { pattern: /一言以蔽之[，,：:]?/g, replacement: '' },
  { pattern: /我们可以看到[，,：:]?/g, replacement: '' },
  { pattern: /我们不难发现[，,：:]?/g, replacement: '' },
  { pattern: /我们不难看出[，,：:]?/g, replacement: '' },
  { pattern: /不难发现[，,：:]?/g, replacement: '' },
  { pattern: /不难看出[，,：:]?/g, replacement: '' },
  { pattern: /由此可见[，,：:]?/g, replacement: '' },
  { pattern: /由此可知[，,：:]?/g, replacement: '' },
  { pattern: /毋庸置疑[，,：:]?/g, replacement: '' },
  { pattern: /不言而喻[，,：:]?/g, replacement: '' },
  { pattern: /显而易见[，,：:]?/g, replacement: '' },
  { pattern: /显然[，,]/g, replacement: '' },
  { pattern: /众所周知[，,：:]?/g, replacement: '' },
  { pattern: /不可否认[，,：:]?/g, replacement: '' },
  { pattern: /无可否认[，,：:]?/g, replacement: '' },
  { pattern: /可以(?:毫不夸张地)?说[，,]/g, replacement: '' },
  { pattern: /某种程度上(?:来说|来讲|说)?[，,]?/g, replacement: '' },
  { pattern: /换句话说[，,：:]?/g, replacement: '' },
  { pattern: /换言之[，,：:]?/g, replacement: '' },
  { pattern: /更重要的是[，,：:]?/g, replacement: '' },
  { pattern: /与此同时[，,：:]?/g, replacement: '' },
  { pattern: /在此基础上[，,：:]?/g, replacement: '' },
  { pattern: /从这个角度(?:来看|来说|出发)?[，,：:]?/g, replacement: '' },
  { pattern: /从某种意义上(?:来说|讲)?[，,：:]?/g, replacement: '' },
  { pattern: /在当今[^，,。.！!？?]{0,12}的(?:时代|社会|世界|背景|大背景|形势)(?:背景)?下?[，,]?/g, replacement: '' },
  { pattern: /随着[^，,。.！!？?]{0,16}的(?:发展|到来|普及|推进|不断深入|日益成熟)[，,]?/g, replacement: '' },
  { pattern: /展望未来[，,：:]?/g, replacement: '' },
  { pattern: /让我们(?:一起|共同)?(?:期待|拭目以待|携手)[^。.！!？?]*[。.！!？?]/g, replacement: '' },
  { pattern: /(?:具有|有着)(?:重要|深远|不可忽视)的(?:意义|价值|影响)[。.]/g, replacement: '。' },
  { pattern: /起着(?:至关重要|举足轻重|不可替代)的作用[。.]?/g, replacement: '' },
  { pattern: /起到了(?:至关重要|举足轻重|不可替代)的作用[。.]?/g, replacement: '' },
];

const botLeftoverRules: TextRule[] = [
  { pattern: /(?:希望|期待)(?:这|以上)?(?:内容|回答|信息)?(?:对(?:您|你))?(?:有(?:所)?帮助)[。.！!]*/g, replacement: '' },
  { pattern: /(?:如果你|如有)(?:还有)?(?:其他|任何)?(?:问题|疑问)[，,]?(?:(?:欢迎|请)?(?:随时)?(?:提问|告诉我|联系我))[。.！!]*/g, replacement: '' },
  { pattern: /(?:以下|下面)(?:是|为)(?:我为(?:您|你)?(?:整理|准备)的)?[^。.：:\n]{0,18}[：:]/g, replacement: '' },
  { pattern: /(?:当然|没问题)[！!。.]*/g, replacement: '' },
  { pattern: /(?:您|你)说得(?:完全)?(?:对|正确)[！!。.]*/g, replacement: '' },
  { pattern: /截至(?:我最后(?:一次)?(?:训练|更新)的)?[^，。.,]{0,10}[，,]/g, replacement: '' },
];

const conciseRules: TextRule[] = [
  { pattern: /为了实现这一目标/g, replacement: '为此' },
  { pattern: /由于(.{1,20}?)的事实/g, replacement: '因为$1' },
  { pattern: /在这个时间点(?:上)?/g, replacement: '现在' },
  { pattern: /具有(.{1,12}?)的能力/g, replacement: '能$1' },
  { pattern: /起到了(.{1,12}?)的作用/g, replacement: '$1' },
];

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}]/gu;
const decorationPattern = /[★☆✦✧❖◆◇▶►➤➢»«•·]/g;

function applyRules(value: string, rules: TextRule[]): string {
  return rules.reduce((current, rule) => current.replace(rule.pattern, rule.replacement), value);
}

function normalizeChinesePunctuation(value: string): string {
  return value
    .replace(/([一-龥])([,?!:;])(?!\d)/g, (_match, char: string, punct: string) => {
      const map: Record<string, string> = { ',': '，', '?': '？', '!': '！', ':': '：', ';': '；' };
      return `${char}${map[punct] || punct}`;
    })
    .replace(/([一-龥])\(/g, '$1（')
    .replace(/\)([一-龥])/g, '）$1')
    .replace(/。{2,}/g, '……')
    .replace(/！{2,}/g, '！')
    .replace(/？{2,}/g, '？')
    .replace(/，{2,}/g, '，')
    .replace(/\s*[—–]{1,2}\s*/g, '，')
    .replace(/([一-龥])[ \t]+([一-龥])/g, '$1$2');
}

function cleanLine(line: string): string {
  if (/^\s*\|.*\|\s*$/.test(line)) {
    return line.trimEnd();
  }
  return normalizeChinesePunctuation(
    applyRules(applyRules(applyRules(line, botLeftoverRules), clicheRules), conciseRules)
      .replace(emojiPattern, '')
      .replace(decorationPattern, '')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/\*\*/g, '')
  )
    .replace(/[ \t]+([，。；：,.!?！？])/g, '$1')
    .replace(/^[，,、；;：:\s]+/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd();
}

export function preCleanAiCliches(markdown: string): string {
  const lines = String(markdown || '').split('\n');
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    return inFence ? line : cleanLine(line);
  }).join('\n');
}
