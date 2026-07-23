import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceDisplay, RecipeMetaLine } from '@/components/SourceDisplay';

describe('SourceDisplay', () => {
  it('renders nothing when source is null', () => {
    const { container } = render(<SourceDisplay source={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when source is undefined', () => {
    const { container } = render(<SourceDisplay source={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a plain text span for non-URL sources', () => {
    render(<SourceDisplay source="Grandma's cookbook" />);
    expect(screen.getByText("Grandma's cookbook")).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders an anchor for https:// sources', () => {
    render(<SourceDisplay source="https://example.com/recipe" />);
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/recipe');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('strips www. from the display hostname', () => {
    render(<SourceDisplay source="https://www.bbc.co.uk/food/recipe/123" />);
    expect(screen.getByText('bbc.co.uk')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SourceDisplay source="My book" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not render a link for http:// (only https triggers link)', () => {
    render(<SourceDisplay source="http://example.com/recipe" />);
    // http:// does not start with 'https://' so no link
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('http://example.com/recipe')).toBeInTheDocument();
  });
});

describe('RecipeMetaLine', () => {
  it('renders nothing when neither categoryName nor source is provided', () => {
    const { container } = render(<RecipeMetaLine />);
    expect(container.firstChild).toBeNull();
  });

  it('renders category when only categoryName provided', () => {
    render(<RecipeMetaLine categoryName="Desserts" />);
    expect(screen.getByText('Desserts')).toBeInTheDocument();
    expect(screen.queryByText(/Source/)).toBeNull();
  });

  it('renders source when only source provided', () => {
    render(<RecipeMetaLine source="Family recipes" />);
    expect(screen.getByText('Family recipes')).toBeInTheDocument();
    expect(screen.queryByText(/Category/)).toBeNull();
  });

  it('renders both category and source', () => {
    render(<RecipeMetaLine categoryName="Mains" source="Jamie Oliver" />);
    expect(screen.getByText('Mains')).toBeInTheDocument();
    expect(screen.getByText('Jamie Oliver')).toBeInTheDocument();
  });

  it('renders a link for https:// sources', () => {
    render(<RecipeMetaLine source="https://www.seriouseats.com/pasta" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.seriouseats.com/pasta');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows stripped hostname for URL sources in RecipeMetaLine', () => {
    render(<RecipeMetaLine source="https://www.seriouseats.com/pasta" />);
    expect(screen.getByText('seriouseats.com')).toBeInTheDocument();
  });

  it('applies custom className to the wrapper', () => {
    const { container } = render(<RecipeMetaLine categoryName="Test" className="my-meta" />);
    expect(container.firstChild).toHaveClass('my-meta');
  });
});
