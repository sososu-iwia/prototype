"use client";
import { useErrorLabels } from "../../components/ui/ErrorLabels";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const labels = useErrorLabels();
  return (
    <main id="content" className="detail-page">
      <div className="container">
        <h1>{labels.error}</h1>
        <button className="btn btn-primary" onClick={reset}>
          {labels.retry}
        </button>
      </div>
    </main>
  );
}
