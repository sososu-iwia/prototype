import Link from "next/link";
export function SectionHeading({
  label,
  title,
  href,
  action,
}: {
  label: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
      </div>
      {href && (
        <Link className="section-link" href={href}>
          {action}
        </Link>
      )}
    </div>
  );
}
