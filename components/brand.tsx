import Image from "next/image";

type BrandProps = {
  textClassName?: string;
  logoClassName?: string;
  stacked?: boolean;
  showSubtitle?: boolean;
};

export function Brand({ textClassName = "", logoClassName = "", stacked = false, showSubtitle = false }: BrandProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${stacked ? "flex-col text-center" : ""}`}>
      <Image
        src="/logo-refined.svg"
        alt="Teilekiste Logo"
        width={48}
        height={48}
        priority
        className={`h-10 w-10 shrink-0 ${logoClassName}`.trim()}
      />
      <span className={`min-w-0 ${stacked ? "space-y-1" : ""}`}>
        <span className={`block leading-none ${textClassName}`.trim()}>Teilekiste</span>
        {showSubtitle ? (
          <span className="block text-xs font-medium uppercase tracking-[0.18em] text-workshop-500">
            Werkstatt Inventory
          </span>
        ) : null}
      </span>
    </span>
  );
}
