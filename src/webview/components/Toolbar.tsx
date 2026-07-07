import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import type { SolutionFilter } from '../hooks/useExtensionState';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  solutionFilter: SolutionFilter | null;
  onPickSolution: () => void;
  onClearSolution: () => void;
}

export function Toolbar({ search, onSearchChange, solutionFilter, onPickSolution, onClearSolution }: Props) {
  return (
    <div className="toolbar">
      <VSCodeTextField
        className="search-field"
        placeholder="Search entities…"
        value={search}
        onInput={e => onSearchChange((e.target as HTMLInputElement).value)}
      >
        <span slot="start" className="search-icon">⌕</span>
      </VSCodeTextField>

      <div className="solution-row">
        {/* Native button — the toolkit button's shadow DOM can't host a full-width, left-aligned,
            truncating label, so this is styled directly with VS Code theme variables. */}
        <button
          type="button"
          className={'chip' + (solutionFilter ? ' active' : '')}
          onClick={onPickSolution}
        >
          <span className="chip-label">{solutionFilter ? solutionFilter.name : 'All solutions'}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {solutionFilter && (
          <button type="button" className="chip-clear" title="Clear solution filter" onClick={onClearSolution}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
