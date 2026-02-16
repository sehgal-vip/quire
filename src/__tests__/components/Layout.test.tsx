import { render, screen } from '@testing-library/react';
import { Layout } from '@/components/layout/Layout';

// Mock Header and Footer to simplify
vi.mock('@/components/layout/Header', () => ({
  Header: ({ onShowShortcuts }: { onShowShortcuts: () => void }) => (
    <header data-testid="header">
      <h1>Quire</h1>
      <button onClick={onShowShortcuts}>Help</button>
    </header>
  ),
}));

vi.mock('@/components/layout/Footer', () => ({
  Footer: () => <footer data-testid="footer">Your files never leave your browser.</footer>,
}));

describe('Layout', () => {
  it('U-LY-01: renders header with Quire branding', () => {
    render(
      <Layout onShowShortcuts={() => {}}>
        <div>content</div>
      </Layout>
    );
    expect(screen.getByText('Quire')).toBeInTheDocument();
  });

  it('U-LY-02: renders footer with privacy message', () => {
    render(
      <Layout onShowShortcuts={() => {}}>
        <div>content</div>
      </Layout>
    );
    expect(screen.getByText(/Your files never leave your browser/)).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <Layout onShowShortcuts={() => {}}>
        <div data-testid="child">Hello</div>
      </Layout>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('has header, main, and footer structure', () => {
    render(
      <Layout onShowShortcuts={() => {}}>
        <div>content</div>
      </Layout>
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
