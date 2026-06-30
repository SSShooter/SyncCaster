type TextRule = {
  pattern: RegExp;
  replacement: string;
};

const clicheRules: TextRule[] = [
  { pattern: /值得注意的是[，,：:]?/g, replacement: '' },
  { pattern: /值得一提的是[，,：:]?/g, replacement: '' },
  { pattern: /需要注意的是[，,：:]?/g, replacement: '' },
  { pattern: /综上所述[，,。.]?/g, replacement: '' },
  { pattern: /总而言之[，,。.]?/g, replacement: '' },
  { pattern: /总的来说[，,。.]?/g, replacement: '' },
  { pattern: /总体而言[，,。.]?/g, replacement: '' },
  { pattern: /我们可以看到[，,]?/g, replacement: '' },
  { pattern: /不难发现[，,]?/g, replacement: '' },
  { pattern: /由此可见[，,]?/g, replacement: '' },
  { pattern: /毋庸置疑[，,]?/g, replacement: '' },
  { pattern: /众所周知[，,]?/g, replacement: '' },
  { pattern: /可以说[，,]?/g, replacement: '' },
  { pattern: /某种程度上[，,]?/g, replacement: '' },
  { pattern: /换句话说[，,]?/g, replacement: '' },
  { pattern: /更重要的是[，,]?/g, replacement: '' },
  { pattern: /与此同时[，,]?/g, replacement: '' },
  { pattern: /在此基础上[，,]?/g, replacement: '' },
  { pattern: /从这个角度(?:来看|看)[，,]?/g, replacement: '' },
  { pattern: /是显而易见的/g, replacement: '很明显' },
  { pattern: /是毋庸置疑的/g, replacement: '没有疑问' },
  { pattern: /是不言而喻的/g, replacement: '不用多说' },
  { pattern: /是不可否认的/g, replacement: '确实如此' },
];

function cleanLine(line: string): string {
  return clicheRules
    .reduce((value, rule) => value.replace(rule.pattern, rule.replacement), line)
    .replace(/[ \t]+([，。；：,.!?！？])/g, '$1')
    .replace(/^[，,。.\s]+/, '')
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
