const tokens = [
  "WASTE",
  "SPECTACLE",
  "NO REFUNDS",
  "BURN PUBLICLY",
  "NOT A PRODUCT",
  "STATUS SOAKED",
  "ZERO UTILITY",
  "OPULENT IDIOCY",
  "SEASON OF ASH",
];

export function MarqueeBanner() {
  const content = tokens.join("  ·  ");
  return (
    <div className="w-full overflow-hidden border-y-2 border-ivory bg-ember">
      <div className="marquee whitespace-nowrap py-2 text-ink">
        <span className="display px-8 text-lg font-black tracking-[0.3em]">
          {content}  ·  {content}  ·  {content}
        </span>
        <span
          className="display px-8 text-lg font-black tracking-[0.3em]"
          aria-hidden="true"
        >
          {content}  ·  {content}  ·  {content}
        </span>
      </div>
    </div>
  );
}
