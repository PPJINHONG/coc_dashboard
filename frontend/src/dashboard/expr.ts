// 대시보드 패널 수식 계산기.
// 서버 검사기(backend/core/dashboard_expr.py)와 문법·함수·변수를 항상 같이 바꾼다.
//
//   expr   := add
//   add    := mul (('+' | '-') mul)*
//   mul    := unary (('*' | '/' | '%') unary)*
//   unary  := ('-' | '+') unary | pow
//   pow    := primary ('^' unary)?
//   primary:= number | name | name '(' args ')' | '(' expr ')'

export const MAX_EXPR_LENGTH = 200;

// 함수 이름 → [최소 인자 수, 최대 인자 수(Infinity는 제한 없음), 계산]
const FUNCTIONS: Record<string, [number, number, (...a: number[]) => number]> = {
  abs: [1, 1, Math.abs],
  round: [1, 2, (x, d = 0) => {
    const f = 10 ** Math.trunc(d);
    return Math.round(x * f) / f;
  }],
  floor: [1, 1, Math.floor],
  ceil: [1, 1, Math.ceil],
  sqrt: [1, 1, Math.sqrt],
  log: [1, 1, Math.log],
  log10: [1, 1, Math.log10],
  exp: [1, 1, Math.exp],
  sin: [1, 1, Math.sin],
  cos: [1, 1, Math.cos],
  tan: [1, 1, Math.tan],
  pow: [2, 2, Math.pow],
  min: [1, Infinity, Math.min],
  max: [1, Infinity, Math.max],
  clamp: [3, 3, (x, lo, hi) => Math.min(Math.max(x, lo), hi)],
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);
const CONSTANTS = ['pi', 'e'];
// 함수식(원본 데이터 생성)용 변수
export const FUNCTION_VARS = [...CONSTANTS, 't'];
// 변환 수식용 변수: x 원본 값, i 순번(0부터), n 개수, t 라벨 숫자, prev 이전 원본 값, sum/avg/min/max 원본 통계
export const FORMULA_VARS = [...CONSTANTS, 'x', 'i', 'n', 't', 'prev', 'sum', 'avg', 'min', 'max'];

export class ExprError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExprError';
  }
}

type Token = { kind: 'num' | 'name' | 'op'; text: string; pos: number };
type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: (...a: number[]) => number; args: Node[] };

const NUMBER_RE = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const NAME_RE = /[A-Za-z_][A-Za-z0-9_]*/y;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < src.length) {
    const ch = src[pos];
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }
    NUMBER_RE.lastIndex = pos;
    let m = NUMBER_RE.exec(src);
    if (m) {
      tokens.push({ kind: 'num', text: m[0], pos });
      pos += m[0].length;
      continue;
    }
    NAME_RE.lastIndex = pos;
    m = NAME_RE.exec(src);
    if (m) {
      tokens.push({ kind: 'name', text: m[0], pos });
      pos += m[0].length;
      continue;
    }
    if (!'+-*/%^(),'.includes(ch)) {
      throw new ExprError(`${pos + 1}번째 글자 '${ch}'는 수식에 쓸 수 없습니다.`);
    }
    tokens.push({ kind: 'op', text: ch, pos });
    pos++;
  }
  return tokens;
}

class Parser {
  private i = 0;
  private tokens: Token[];
  private allowed: Set<string>;

  constructor(tokens: Token[], allowed: string[]) {
    this.tokens = tokens;
    this.allowed = new Set(allowed);
  }

  private peek(): Token | undefined {
    return this.tokens[this.i];
  }

  private isOp(chars: string): boolean {
    const t = this.peek();
    return t !== undefined && t.kind === 'op' && chars.includes(t.text);
  }

  private expect(ch: string) {
    const t = this.peek();
    if (!t || t.kind !== 'op' || t.text !== ch) {
      const where = t ? `${t.pos + 1}번째 글자` : '수식 끝';
      throw new ExprError(ch === ')' ? `${where}에서 닫는 괄호 ')'가 필요합니다.` : `${where}에서 '${ch}'가 필요합니다.`);
    }
    this.i++;
  }

  parse(): Node {
    if (this.tokens.length === 0) throw new ExprError('수식이 비어 있습니다.');
    const node = this.add();
    const t = this.peek();
    if (t) throw new ExprError(`${t.pos + 1}번째 글자 '${t.text}' 앞에서 수식이 끝나야 합니다.`);
    return node;
  }

  private add(): Node {
    let a = this.mul();
    while (this.isOp('+-')) {
      const op = this.tokens[this.i++].text;
      a = { k: 'bin', op, a, b: this.mul() };
    }
    return a;
  }

  private mul(): Node {
    let a = this.unary();
    while (this.isOp('*/%')) {
      const op = this.tokens[this.i++].text;
      a = { k: 'bin', op, a, b: this.unary() };
    }
    return a;
  }

  private unary(): Node {
    if (this.isOp('+-')) {
      const op = this.tokens[this.i++].text;
      const a = this.unary();
      return op === '-' ? { k: 'neg', a } : a;
    }
    return this.power();
  }

  private power(): Node {
    const a = this.primary();
    if (this.isOp('^')) {
      this.i++;
      return { k: 'bin', op: '^', a, b: this.unary() };
    }
    return a;
  }

  private primary(): Node {
    const t = this.tokens[this.i++];
    if (!t) throw new ExprError('수식이 중간에 끝났습니다. 값이나 괄호가 더 필요합니다.');
    if (t.kind === 'num') return { k: 'num', v: Number(t.text) };
    if (t.kind === 'name') {
      if (this.isOp('(')) return this.call(t.text);
      if (!this.allowed.has(t.text)) {
        if (t.text in FUNCTIONS) throw new ExprError(`'${t.text}'는 함수입니다. '${t.text}(...)'처럼 괄호와 함께 씁니다.`);
        throw new ExprError(`알 수 없는 이름 '${t.text}'입니다. 쓸 수 있는 변수: ${[...this.allowed].sort().join(', ')}`);
      }
      return { k: 'var', name: t.text };
    }
    if (t.text === '(') {
      const node = this.add();
      this.expect(')');
      return node;
    }
    throw new ExprError(`${t.pos + 1}번째 글자 '${t.text}' 자리에 값이 필요합니다.`);
  }

  private call(name: string): Node {
    const def = FUNCTIONS[name];
    if (!def) throw new ExprError(`'${name}' 함수는 지원하지 않습니다.`);
    this.expect('(');
    const args: Node[] = [];
    if (!this.isOp(')')) {
      args.push(this.add());
      while (this.isOp(',')) {
        this.i++;
        args.push(this.add());
      }
    }
    this.expect(')');
    const [lo, hi] = def;
    if (args.length < lo || args.length > hi) {
      const want = lo === hi ? `${lo}개` : hi === Infinity ? `${lo}개 이상` : `${lo}~${hi}개`;
      throw new ExprError(`'${name}' 함수에는 값이 ${want} 필요합니다(현재 ${args.length}개).`);
    }
    return { k: 'call', fn: def[2], args };
  }
}

function evaluate(node: Node, vars: Record<string, number>): number {
  switch (node.k) {
    case 'num':
      return node.v;
    case 'var':
      return node.name === 'pi' ? Math.PI : node.name === 'e' ? Math.E : (vars[node.name] ?? NaN);
    case 'neg':
      return -evaluate(node.a, vars);
    case 'call':
      return node.fn(...node.args.map((a) => evaluate(a, vars)));
    case 'bin': {
      const a = evaluate(node.a, vars);
      const b = evaluate(node.b, vars);
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        default: return a ** b;
      }
    }
  }
}

export type Compiled = (vars: Record<string, number>) => number;

// 수식을 한 번 해석해 반복 계산할 수 있는 함수로 만든다. 문법이 틀리면 ExprError.
export function compile(src: string, allowedVars: string[]): Compiled {
  if (src.length > MAX_EXPR_LENGTH) throw new ExprError(`수식은 ${MAX_EXPR_LENGTH}자 이하로 입력해 주세요.`);
  const tree = new Parser(tokenize(src), allowedVars).parse();
  return (vars) => evaluate(tree, vars);
}

// 문법 오류 메시지만 필요할 때. 문제가 없으면 null.
export function checkExpression(src: string, allowedVars: string[]): string | null {
  try {
    compile(src, allowedVars);
    return null;
  } catch (err) {
    return err instanceof ExprError ? err.message : String(err);
  }
}
