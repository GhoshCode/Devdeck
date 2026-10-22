import { describe, expect, it } from 'vitest';
import { capturedText } from './useTypeToCapture';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'defaultPrevented', boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  defaultPrevented: false,
  ...mods,
});

describe('capturedText', () => {
  const body = document.body;

  it('captures printable characters typed outside a field', () => {
    expect(capturedText(key('a'), body)).toBe('a');
    expect(capturedText(key('Z'), body)).toBe('Z');
    expect(capturedText(key('7'), body)).toBe('7');
    expect(capturedText(key('é'), body)).toBe('é');
  });

  it('ignores modifiers, function, navigation and named keys', () => {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta', 'F1', 'F12', 'Escape', 'Tab', 'ArrowUp', 'ArrowLeft', 'Enter', 'Backspace']) expect(capturedText(key(k), body)).toBeNull();
  });

  it('ignores shortcuts but lets AltGr characters through', () => {
    expect(capturedText(key('k', { ctrlKey: true }), body)).toBeNull();
    expect(capturedText(key('v', { metaKey: true }), body)).toBeNull(); // paste arrives as a paste event
    expect(capturedText(key('f', { altKey: true }), body)).toBeNull();
    expect(capturedText(key('@', { ctrlKey: true, altKey: true }), body)).toBe('@');
  });

  it('leaves DevDeck hotkeys and focused fields alone', () => {
    expect(capturedText(key('/'), body)).toBeNull();
    expect(capturedText(key(','), body)).toBeNull();
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    for (const el of [input, area, editable]) expect(capturedText(key('a'), el)).toBeNull();
  });

  it("doesn't steal Space from a focused button", () => {
    const btn = document.createElement('button');
    expect(capturedText(key(' '), btn)).toBeNull();
    expect(capturedText(key(' '), body)).toBe(' ');
    expect(capturedText(key('a', { isComposing: true }), body)).toBeNull();
  });
});
