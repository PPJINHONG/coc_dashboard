import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// 렌더 예외 시 화이트스크린 대신 폴백 표시
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="error fallback">
          문제가 발생했습니다. 새로고침해 주세요.
        </div>
      );
    }
    return this.props.children;
  }
}
