import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { NativeMessagingSession } from '../native-messaging-session.js';

function encodeMessage(message: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function decodeMessage(frame: Buffer) {
  const length = frame.readUInt32LE(0);
  return JSON.parse(frame.subarray(4, 4 + length).toString('utf8')) as Record<string, unknown>;
}

async function nextFrame(stream: PassThrough): Promise<Record<string, unknown>> {
  const [chunk] = await once(stream, 'data');
  return decodeMessage(Buffer.from(chunk as Buffer));
}

describe('NativeMessagingSession', () => {
  it('matches responses back to the correct pending request', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const session = new NativeMessagingSession(input, output);
    session.start();

    const firstRequest = session.request('health');
    const outboundFirst = await nextFrame(output);

    const secondRequest = session.request('list_accounts');
    const outboundSecond = await nextFrame(output);

    input.write(
      encodeMessage({
        id: outboundSecond.id,
        ok: true,
        data: { marker: 'second' },
      })
    );
    input.write(
      encodeMessage({
        id: outboundFirst.id,
        ok: true,
        data: { marker: 'first' },
      })
    );

    await expect(secondRequest).resolves.toMatchObject({
      id: outboundSecond.id,
      ok: true,
      data: { marker: 'second' },
    });
    await expect(firstRequest).resolves.toMatchObject({
      id: outboundFirst.id,
      ok: true,
      data: { marker: 'first' },
    });
  });

  it('rejects pending requests when the native stream disconnects', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const session = new NativeMessagingSession(input, output);
    session.start();

    const pending = session.request('health');
    await nextFrame(output);

    input.end();

    await expect(pending).rejects.toMatchObject({
      code: 'extension_unavailable',
    });
  });
});
