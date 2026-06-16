import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TileView } from './TileView';

describe('TileView', () => {
  it('渲染五万显示 5 与万', () => {
    render(<TileView index={4} />); // 五万
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('万')).toBeInTheDocument();
  });
  it('牌背不显示数字', () => {
    const { container } = render(<TileView index={4} back />);
    expect(container.querySelector('.tile-back')).toBeTruthy();
  });
});
