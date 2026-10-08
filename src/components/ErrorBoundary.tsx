import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main style={{ margin: 40, fontFamily: "sans-serif" }}>
          <h1>Не удалось открыть страницу</h1>
          <p>Попробуйте перезагрузить сайт.</p>
          <button onClick={() => location.reload()}>Перезагрузить</button>
        </main>
      );
    return this.props.children;
  }
}
