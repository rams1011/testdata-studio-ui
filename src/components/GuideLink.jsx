import GuideIcon from "./GuideIcon";

const GUIDE_LABEL = "User guide";
const GUIDE_TITLE = `${GUIDE_LABEL} (opens in new tab)`;

export default function GuideLink({ className = "" }) {
  return (
    <a
      href="/guide"
      target="_blank"
      rel="noopener noreferrer"
      className={`btn workspace-guide-link${className ? ` ${className}` : ""}`}
      title={GUIDE_TITLE}
      aria-label={GUIDE_TITLE}
    >
      <GuideIcon size={20} />
    </a>
  );
}
