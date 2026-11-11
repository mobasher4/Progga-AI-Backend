// Tolerant parser for a JSON object the model is still writing, so we can show
// parts of it before it is complete. Unfinished strings, objects and arrays are
// closed where the text stops; `open` is the path of the string being written.

export type JsonPath = (string | number)[];

export interface PartialJson {
  value: unknown;
  /** Path of the string value still being written, or null if text stopped elsewhere. */
  open: JsonPath | null;
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
const LITERAL = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/;

export function parsePartialJson(text: string): PartialJson {
  const src = text.replace(/^\s*```(?:json)?\s*/i, "");
  let i = 0;
  let open: JsonPath | null = null;
  let ended = false; // the text ran out somewhere

  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };

  function str(path: JsonPath): string {
    i++; // opening quote
    let out = "";
    while (i < src.length) {
      const c = src[i];
      if (c === '"') {
        i++;
        return out;
      }
      if (c === "\\") {
        if (i + 1 >= src.length) break;
        const e = src[i + 1];
        if (e === "u") {
          if (i + 6 > src.length) break;
          out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
          i += 6;
        } else {
          out += ESCAPES[e] ?? e;
          i += 2;
        }
        continue;
      }
      out += c;
      i++;
    }
    ended = true;
    open = path;
    return out;
  }

  function val(path: JsonPath): unknown {
    ws();
    if (i >= src.length) {
      ended = true;
      return undefined;
    }
    const c = src[i];
    if (c === "{") return obj(path);
    if (c === "[") return arr(path);
    if (c === '"') return str(path);
    const m = LITERAL.exec(src.slice(i));
    // a literal touching the end may still be growing (e.g. "12" of "125"), but we never show numbers
    if (m) {
      i += m[0].length;
      return JSON.parse(m[0]);
    }
    ended = true;
    return undefined;
  }

  function obj(path: JsonPath): Record<string, unknown> {
    i++;
    const out: Record<string, unknown> = {};
    while (!ended) {
      ws();
      if (i >= src.length) break;
      if (src[i] === "}") {
        i++;
        return out;
      }
      if (src[i] === ",") {
        i++;
        continue;
      }
      if (src[i] !== '"') break;
      const key = str([...path, ""]);
      if (ended) {
        open = null; // a half-written key is not a value
        return out;
      }
      ws();
      if (src[i] !== ":") break;
      i++;
      const v = val([...path, key]);
      if (v !== undefined) out[key] = v;
    }
    ended = true;
    return out;
  }

  function arr(path: JsonPath): unknown[] {
    i++;
    const out: unknown[] = [];
    while (!ended) {
      ws();
      if (i >= src.length) break;
      if (src[i] === "]") {
        i++;
        return out;
      }
      if (src[i] === ",") {
        i++;
        continue;
      }
      const v = val([...path, out.length]);
      if (v !== undefined) out.push(v);
    }
    ended = true;
    return out;
  }

  const value = val([]);
  return { value, open };
}

export const samePath = (a: JsonPath | null, b: JsonPath) => !!a && a.length === b.length && a.every((p, k) => p === b[k]);
