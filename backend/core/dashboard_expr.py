"""대시보드 패널 수식 문법 검사.

계산은 화면(frontend/src/dashboard/expr.ts)에서 하고, 서버는 저장 전에 같은 문법인지 검사만 합니다.
두 파일의 문법(연산자·함수·변수)은 항상 같이 바꿉니다.

문법
  expr   := add
  add    := mul (('+' | '-') mul)*
  mul    := unary (('*' | '/' | '%') unary)*
  unary  := ('-' | '+') unary | pow
  pow    := primary ('^' unary)?
  primary:= number | name | name '(' args ')' | '(' expr ')'
"""

import re

MAX_LENGTH = 200

# 함수 이름 → (최소 인자 수, 최대 인자 수). None 은 제한 없음.
FUNCTIONS = {
    "abs": (1, 1),
    "round": (1, 2),
    "floor": (1, 1),
    "ceil": (1, 1),
    "sqrt": (1, 1),
    "log": (1, 1),
    "log10": (1, 1),
    "exp": (1, 1),
    "sin": (1, 1),
    "cos": (1, 1),
    "tan": (1, 1),
    "pow": (2, 2),
    "min": (1, None),
    "max": (1, None),
    "clamp": (3, 3),
}

CONSTANTS = {"pi", "e"}
# 함수식(원본 데이터 생성)에서 쓸 수 있는 변수
FUNCTION_VARS = CONSTANTS | {"t"}
# 변환 수식에서 쓸 수 있는 변수: x 원본 값, i 순번(0부터), n 개수, t 라벨 숫자, prev 이전 원본 값,
# sum/avg/min/max 원본 전체의 합계·평균·최소·최대
FORMULA_VARS = CONSTANTS | {"x", "i", "n", "t", "prev", "sum", "avg", "min", "max"}

_NUMBER = re.compile(r"(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?")
_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


class ExprError(ValueError):
    """수식 오류. 메시지는 화면에 그대로 보여 줄 한국어 문장입니다."""


def _tokenize(src):
    tokens = []
    pos = 0
    while pos < len(src):
        ch = src[pos]
        if ch.isspace():
            pos += 1
            continue
        m = _NUMBER.match(src, pos)
        if m:
            tokens.append(("num", m.group(), pos))
            pos = m.end()
            continue
        m = _NAME.match(src, pos)
        if m:
            tokens.append(("name", m.group(), pos))
            pos = m.end()
            continue
        if ch not in "+-*/%^(),":
            raise ExprError(f"{pos + 1}번째 글자 '{ch}'는 수식에 쓸 수 없습니다.")
        tokens.append(("op", ch, pos))
        pos += 1
    return tokens


class _Parser:
    def __init__(self, tokens, allowed_vars):
        self.tokens = tokens
        self.i = 0
        self.allowed_vars = allowed_vars

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def take(self):
        tok = self.peek()
        self.i += 1
        return tok

    def is_op(self, chars):
        tok = self.peek()
        return tok is not None and tok[0] == "op" and tok[1] in chars

    def expect(self, char):
        tok = self.peek()
        if tok is None or tok[0] != "op" or tok[1] != char:
            where = "수식 끝" if tok is None else f"{tok[2] + 1}번째 글자"
            if char == ")":
                raise ExprError(f"{where}에서 닫는 괄호 ')'가 필요합니다.")
            raise ExprError(f"{where}에서 '{char}'가 필요합니다.")
        self.take()

    def parse(self):
        if not self.tokens:
            raise ExprError("수식이 비어 있습니다.")
        self.add()
        tok = self.peek()
        if tok is not None:
            raise ExprError(f"{tok[2] + 1}번째 글자 '{tok[1]}' 앞에서 수식이 끝나야 합니다.")

    def add(self):
        self.mul()
        while self.is_op("+-"):
            self.take()
            self.mul()

    def mul(self):
        self.unary()
        while self.is_op("*/%"):
            self.take()
            self.unary()

    def unary(self):
        if self.is_op("+-"):
            self.take()
            self.unary()
            return
        self.power()

    def power(self):
        self.primary()
        if self.is_op("^"):
            self.take()
            self.unary()

    def primary(self):
        tok = self.take()
        if tok is None:
            raise ExprError("수식이 중간에 끝났습니다. 값이나 괄호가 더 필요합니다.")
        kind, text, pos = tok
        if kind == "num":
            return
        if kind == "name":
            if self.is_op("("):
                self.call(text, pos)
                return
            if text not in self.allowed_vars:
                if text in FUNCTIONS:
                    raise ExprError(f"'{text}'는 함수입니다. '{text}(...)'처럼 괄호와 함께 씁니다.")
                names = ", ".join(sorted(self.allowed_vars))
                raise ExprError(f"알 수 없는 이름 '{text}'입니다. 쓸 수 있는 변수: {names}")
            return
        if text == "(":
            self.add()
            self.expect(")")
            return
        raise ExprError(f"{pos + 1}번째 글자 '{text}' 자리에 값이 필요합니다.")

    def call(self, name, pos):
        if name not in FUNCTIONS:
            raise ExprError(f"'{name}' 함수는 지원하지 않습니다.")
        self.expect("(")
        count = 0
        if not self.is_op(")"):
            self.add()
            count = 1
            while self.is_op(","):
                self.take()
                self.add()
                count += 1
        self.expect(")")
        lo, hi = FUNCTIONS[name]
        if count < lo or (hi is not None and count > hi):
            want = f"{lo}개" if lo == hi else (f"{lo}개 이상" if hi is None else f"{lo}~{hi}개")
            raise ExprError(f"'{name}' 함수에는 값이 {want} 필요합니다(현재 {count}개).")


def validate_expression(src, allowed_vars):
    """수식 문법을 검사합니다. 틀리면 ExprError 를 던집니다."""
    if len(src) > MAX_LENGTH:
        raise ExprError(f"수식은 {MAX_LENGTH}자 이하로 입력해 주세요.")
    _Parser(_tokenize(src), allowed_vars).parse()
