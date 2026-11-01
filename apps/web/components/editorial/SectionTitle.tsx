import Link from "next/link";
import { Icon } from "./Icon";
export function SectionTitle({
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
    <div className="editorial-section-heading">
      <div>
        <p className="eyebrow">{label}</p>
        <h2>{title}</h2>
      </div>
      {href && (
        <Link prefetch={false} href={href}>
          {action}
          <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}
