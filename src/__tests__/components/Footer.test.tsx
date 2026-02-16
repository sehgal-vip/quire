import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

describe('Footer', () => {
  it('renders privacy message', () => {
    render(<Footer />);
    expect(screen.getByText(/Your files never leave your browser/)).toBeInTheDocument();
  });

  it('mentions local processing', () => {
    render(<Footer />);
    expect(screen.getByText(/All processing happens locally/)).toBeInTheDocument();
  });
});
