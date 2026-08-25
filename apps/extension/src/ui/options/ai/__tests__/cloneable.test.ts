import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { toCloneable } from '../cloneable';

describe('toCloneable', () => {
  it('turns Vue reactive objects into IndexedDB cloneable plain data', () => {
    const value = reactive({
      source_url: 'https://example.com/post',
      aiRewriteDraft: {
        selectedCandidateId: 'candidate-1',
        candidates: [
          {
            id: 'candidate-1',
            title: 'Title',
            bodyMd: 'Body',
            style: 'general',
          },
        ],
      },
    });

    expect(() => structuredClone(value)).toThrow();

    const cloneable = toCloneable(value);

    expect(cloneable).toEqual({
      source_url: 'https://example.com/post',
      aiRewriteDraft: {
        selectedCandidateId: 'candidate-1',
        candidates: [
          {
            id: 'candidate-1',
            title: 'Title',
            bodyMd: 'Body',
            style: 'general',
          },
        ],
      },
    });
    expect(() => structuredClone(cloneable)).not.toThrow();
  });
});
