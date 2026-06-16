import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('仅亮起合法操作', () => {
    render(
      <ActionBar
        canPong canGang={false} canWin canPass={false}
        onPong={vi.fn()} onGang={vi.fn()} onWin={vi.fn()} onPass={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '碰' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '杠' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '胡' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '过' })).toBeDisabled();
  });
});
