import { VSCodeProgressRing } from '@vscode/webview-ui-toolkit/react';

// Small inline loading indicator, matching the old `.spinner` sizing.
export function Spinner() {
  return <VSCodeProgressRing className="inline-ring" />;
}

export function LoadingMessage({ label }: { label: string }) {
  return (
    <div className="message loading-message">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
