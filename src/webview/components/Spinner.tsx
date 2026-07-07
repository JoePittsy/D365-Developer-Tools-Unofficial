// Small inline loading indicator (CSS keyframe spinner — no external dependency).
export function Spinner() {
  return <span className="spinner" />;
}

export function LoadingMessage({ label }: { label: string }) {
  return (
    <div className="message loading-message">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
