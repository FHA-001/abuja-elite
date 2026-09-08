type SectionHeadingProps = {
  index: string;
  kicker: string;
  title: string;
  detail?: string;
};

export function SectionHeading({ index, kicker, title, detail }: SectionHeadingProps) {
  return (
    <div className="mb-14 grid gap-5 md:grid-cols-[100px_1fr_260px] md:items-end">
      <span className="number">{index}</span>
      <div>
        <p className="eyebrow mb-4">{kicker}</p>
        <h2 className="section-title display-font">{title}</h2>
      </div>
      {detail && <p className="body-copy text-sm md:pb-1">{detail}</p>}
    </div>
  );
}