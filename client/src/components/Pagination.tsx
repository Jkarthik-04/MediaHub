export function Pagination({
  page,
  totalPages,
  disabled = false,
  onChange,
}: {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <section className="surface pagination" aria-label="Pagination">
      <p>
        Page {page} of {totalPages}
      </p>
      <div className="inline-actions">
        <button
          className="tab"
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="tab"
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
